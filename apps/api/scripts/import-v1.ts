/**
 * Copies documents from a v1 (current live app) database into v2.
 * The v1 database is only read (inside a READ ONLY transaction); nothing in it changes.
 *
 *   npx tsx --env-file=.env scripts/import-v1.ts <v1-database-url> [--uploads-base https://live.app] [--replace] [--dry-run]
 *   (production: node dist/import-v1.js "$LEGACY_DATABASE_URL" --uploads-base "$LEGACY_UPLOADS_URL")
 *
 * - Idempotent: documents already imported (matched by their v1 id) are skipped, so it can
 *   be re-run to pick up new documents. --replace re-imports them instead.
 * - Schedules are converted to one continuous schedule (see documents/legacy.ts).
 * - Photos: base64 photos come from the database; /uploads/... files are downloaded from
 *   --uploads-base (database backups don't contain them). Missing photos are reported.
 */
import { parseArgs } from 'node:util';
import { eq, inArray } from 'drizzle-orm';
import pg from 'pg';
import {
  probateDetailsSchema, summarise, valuationDetailsSchema, type DocumentInput,
} from '@mccl/shared';
import { createDb, runMigrations } from '../src/db/client';
import { documentImages, documents } from '../src/db/schema';
import { convertLegacySchedule, fixMojibake } from '../src/documents/legacy';
import { loadEnv } from '../src/env';
import { storePhoto, storeSignature } from '../src/images/store';
import { createStorage } from '../src/storage';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    'uploads-base': { type: 'string' },
    replace: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
  },
});
const sourceUrl = positionals[0];
if (!sourceUrl) {
  console.error('Usage: import-v1.ts <v1-database-url> [--uploads-base URL] [--replace] [--dry-run]');
  process.exit(1);
}

type Row = Record<string, any>;

// ── Read v1 (read-only) ───────────────────────────────────────
const source = new pg.Client({ connectionString: sourceUrl });
await source.connect();
await source.query('begin read only');
const valuations: Row[] = (await source.query('select * from valuations order by created_at')).rows;
const probates: Row[] = (await source.query('select * from probate_valuations order by created_at')).rows;
await source.query('rollback');
await source.end();

// ── Write v2 ──────────────────────────────────────────────────
const env = loadEnv();
const { db, pool } = createDb(env.DATABASE_URL, env.PG_SSL);
await runMigrations(db);
const storage = createStorage(env);

const fix = (v: unknown) => (typeof v === 'string' ? fixMojibake(v) : '');
const imageSrc = (img: unknown) => (typeof img === 'string' ? img : (img as { src?: string })?.src ?? '');
const imageSize = (img: unknown) => {
  const w = Number((img as { width?: number })?.width);
  return [25, 33, 50, 75, 100].includes(w) ? w : 50;
};

async function loadImage(src: string): Promise<Buffer | null> {
  if (src.startsWith('data:')) return Buffer.from(src.split(',')[1] ?? '', 'base64');
  const base = values['uploads-base'];
  if (src.startsWith('/') && !base) return null;
  const res = await fetch(src.startsWith('/') ? `${base!.replace(/\/$/, '')}${src}` : src, { signal: AbortSignal.timeout(30_000) });
  return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
}

function toInput(type: 'valuation' | 'probate', row: Row): DocumentInput {
  const scheduleHtml = convertLegacySchedule(row.schedule_html);
  if (type === 'valuation') {
    return {
      type,
      documentDate: row.valuation_date ?? null,
      scheduleHtml,
      details: valuationDetailsSchema.parse({
        customerName: fix(row.customer_name),
        customerAddress: fix(row.customer_address),
        pricingRows: (Array.isArray(row.pricing_rows) ? row.pricing_rows : [])
          .filter((p: Row) => p && (p.component || p.estimatedValue))
          .map((p: Row, i: number) => ({ id: String(p.id ?? i + 1), component: fix(p.component), estimatedValue: fix(p.estimatedValue) })),
        totalRange: fix(row.total_range),
        insuranceValue: fix(row.insurance_value),
        numberOfItems: fix(row.number_of_items) || '1',
      }),
    };
  }
  return {
    type,
    documentDate: row.date_of_death ?? null,
    scheduleHtml,
    details: probateDetailsSchema.parse({
      executorName: fix(row.executor_name),
      executorAddress: fix(row.executor_address),
      contactNumber: fix(row.contact_number),
      email: fix(row.email),
      deceasedName: fix(row.deceased_name),
      probateReference: fix(row.probate_reference),
      totalMarketValue: fix(row.total_market_value),
    }),
  };
}

const all = [
  ...valuations.map(r => ['valuation', r] as const),
  ...probates.map(r => ['probate', r] as const),
];
const existing = new Set((await db.select({ legacyId: documents.legacyId }).from(documents)
  .where(inArray(documents.legacyId, all.map(([, r]) => String(r.id))))).map(r => r.legacyId));

const report = { imported: 0, skipped: 0, failed: 0, photos: 0, photosMissing: 0, signatures: 0 };
console.log(`Found ${valuations.length} valuations and ${probates.length} probates in v1.${values['dry-run'] ? ' (dry run)' : ''}`);

for (const [type, row] of all) {
  const id8 = String(row.id).slice(0, 8);
  try {
    if (existing.has(String(row.id))) {
      if (!values.replace) { report.skipped++; continue; }
      if (!values['dry-run']) await removeImported(String(row.id));
    }
    const input = toInput(type, row);
    const rawImages: unknown[] = Array.isArray(row.images) ? row.images : [];
    if (values['dry-run']) {
      console.log(`  would import ${type} ${id8} (${rawImages.length} photos)`);
      report.imported++;
      continue;
    }

    const [doc] = await db.insert(documents).values({
      ...summarise(input),
      type: input.type,
      documentDate: input.documentDate,
      scheduleHtml: input.scheduleHtml,
      details: input.details,
      legacyId: String(row.id),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at ?? row.created_at),
    }).returning();

    let missing = 0;
    for (const img of rawImages) {
      const buf = await loadImage(imageSrc(img)).catch(() => null);
      if (!buf) { missing++; continue; }
      await storePhoto(db, storage, doc!.id, buf, imageSize(img));
      report.photos++;
    }
    report.photosMissing += missing;

    if (typeof row.owner_signature === 'string' && row.owner_signature.startsWith('data:')) {
      const buf = await loadImage(row.owner_signature);
      if (buf) {
        const key = await storeSignature(storage, doc!.id, buf);
        await db.update(documents).set({ signatureKey: key }).where(eq(documents.id, doc!.id));
        report.signatures++;
      }
    }
    report.imported++;
    console.log(`  imported ${type} ${id8}${missing ? `, ${missing} photo(s) not found` : ''}`);
  } catch (err) {
    report.failed++;
    console.error(`  FAILED ${type} ${id8}: ${(err as Error).message}`);
  }
}

console.log('\nSummary:', report);
if (report.photosMissing && !values['uploads-base']) {
  console.log('Photos stored as /uploads files were skipped: pass --uploads-base <live app URL> to download them.');
}
await pool.end();
if (report.failed) process.exitCode = 1;

/** Removes a previously imported document and its stored files (for --replace). */
async function removeImported(legacyId: string) {
  const [doc] = await db.select().from(documents).where(eq(documents.legacyId, legacyId));
  if (!doc) return;
  const imgs = await db.select().from(documentImages).where(eq(documentImages.documentId, doc.id));
  await storage.delete([
    ...imgs.flatMap(i => [i.printKey, i.thumbKey, ...(i.gridKey ? [i.gridKey] : [])]),
    ...(doc.signatureKey ? [doc.signatureKey] : []),
  ]);
  await db.delete(documents).where(eq(documents.id, doc.id));
}
