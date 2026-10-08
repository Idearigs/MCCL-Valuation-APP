/**
 * Copies documents from a v1 (current live app) database into v2.
 * The v1 database is only read (inside a READ ONLY transaction); nothing in it changes.
 *
 *   Production (Coolify terminal, same database + /app/uploads volume):  node dist/import-v1.js
 *   Local:  npx tsx --env-file=.env scripts/import-v1.ts [v1-database-url] [--uploads-dir DIR | --uploads-base URL] [--replace] [--dry-run]
 *
 * - Idempotent: documents already imported (matched by their v1 id) are skipped, so it can
 *   be re-run to pick up new documents. --replace re-imports them instead.
 * - Schedules are converted to one continuous schedule (see documents/legacy.ts).
 * - Photos: base64 photos come from the database; /uploads/... files are read from the
 *   uploads folder (default /app/uploads) or downloaded from --uploads-base. Missing ones are reported.
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { eq, inArray, sql } from 'drizzle-orm';
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
    'uploads-dir': { type: 'string' },
    replace: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
  },
});

const env = loadEnv();
// By default v1's tables are read from the same database (v2 lives in its own schema),
// and /uploads photos from the shared /app/uploads volume.
const sourceUrl = positionals[0] ?? process.env.LEGACY_DATABASE_URL ?? env.DATABASE_URL;
const uploadsDir = values['uploads-dir'] ?? process.env.LEGACY_UPLOADS_DIR
  ?? (existsSync('/app/uploads') ? '/app/uploads' : undefined);
const uploadsBase = values['uploads-base'] ?? process.env.LEGACY_UPLOADS_URL;

type Row = Record<string, any>;

// ── Read v1 (read-only) ───────────────────────────────────────
const source = new pg.Client({ connectionString: sourceUrl, ssl: env.PG_SSL ? { rejectUnauthorized: false } : false });
await source.connect();
await source.query('begin read only');
const valuations: Row[] = (await source.query('select * from public.valuations order by created_at')).rows;
const probates: Row[] = (await source.query('select * from public.probate_valuations order by created_at')).rows;
await source.query('rollback');
await source.end();

// ── Write v2 ──────────────────────────────────────────────────
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
  if (src.startsWith('/uploads/') && uploadsDir) {
    const file = path.join(uploadsDir, path.basename(src));
    if (existsSync(file)) return readFile(file);
  }
  if (src.startsWith('/') && !uploadsBase) return null;
  const res = await fetch(src.startsWith('/') ? `${uploadsBase!.replace(/\/$/, '')}${src}` : src, { signal: AbortSignal.timeout(30_000) });
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
// Documents imported by an earlier run. updatedBy is only set by edits made in v2.
const existingRows = all.length === 0 ? [] : await db.select({
  legacyId: documents.legacyId,
  updatedBy: documents.updatedBy,
  signatureKey: documents.signatureKey,
  photos: sql<number>`(select count(*) from ${documentImages} where ${documentImages.documentId} = ${documents.id})`.mapWith(Number),
}).from(documents).where(inArray(documents.legacyId, all.map(([, r]) => String(r.id))));
const existing = new Map(existingRows.map(r => [r.legacyId!, {
  photos: r.photos, hasSignature: !!r.signatureKey, editedInV2: !!r.updatedBy,
}]));

const report = { imported: 0, repaired: 0, skipped: 0, failed: 0, photos: 0, photosMissing: 0, signatures: 0 };
console.log(`Found ${valuations.length} valuations and ${probates.length} probates in v1.${values['dry-run'] ? ' (dry run)' : ''}`);

for (const [type, row] of all) {
  const id8 = String(row.id).slice(0, 8);
  let insertedId: string | null = null;
  try {
    const prior = existing.get(String(row.id));
    if (prior) {
      // Re-import when asked, or when an earlier run left it incomplete (missing photos
      // or signature) and nobody has edited it in v2 since. Edited documents are kept.
      const expectedPhotos = (Array.isArray(row.images) ? row.images : []).length;
      const expectsSignature = typeof row.owner_signature === 'string' && row.owner_signature.startsWith('data:');
      const incomplete = prior.photos < expectedPhotos || (expectsSignature && !prior.hasSignature);
      const repair = !prior.editedInV2 && incomplete;
      if (!values.replace && !repair) { report.skipped++; continue; }
      if (repair && !values.replace) report.repaired++;
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
    insertedId = doc!.id;

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
    // Don't leave a half-imported document behind: the next run retries it cleanly.
    if (insertedId) await removeImported(String(row.id)).catch(() => undefined);
  }
}

console.log('\nSummary:', report);
if (report.photosMissing && !uploadsDir && !uploadsBase) {
  console.log('Photos stored as /uploads files were skipped: pass --uploads-dir <folder> or --uploads-base <live app URL>.');
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
