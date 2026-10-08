/**
 * Renders documents straight from a v1 (live app) database with the new PDF engine.
 * Read-only: it only SELECTs from the v1 tables.
 *
 *   npx tsx scripts/render-legacy.ts <v1-database-url> [--uploads-base https://live.app] [--out dir] [--mode letterhead|stationery] [--only <id prefix>]
 *
 * Photos stored as /uploads/... files are fetched from --uploads-base when given,
 * otherwise skipped (database backups don't contain those files).
 */
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import pg from 'pg';
import { probateDetailsSchema, valuationDetailsSchema, type PdfMode } from '@mccl/shared';
import '../src/db/client'; // DATE columns as plain strings
import { convertLegacySchedule, fixMojibake } from '../src/documents/legacy';
import { processPhoto, processSignature } from '../src/images/process';
import { analysePdf } from '../src/pdf/analyse';
import { loadStaticAssets } from '../src/pdf/assets';
import { buildRenderInput } from '../src/pdf/html';
import { ChromeRenderer, type RenderAsset } from '../src/pdf/renderer';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    'uploads-base': { type: 'string' },
    out: { type: 'string', default: path.resolve(import.meta.dirname, '../../../.data/pdf-samples/real') },
    mode: { type: 'string', default: 'letterhead' },
    only: { type: 'string' },
  },
});
const sourceUrl = positionals[0];
if (!sourceUrl) {
  console.error('Usage: render-legacy.ts <v1-database-url> [--uploads-base URL] [--out dir] [--mode letterhead|stationery]');
  process.exit(1);
}
const mode = values.mode as PdfMode;

const client = new pg.Client(sourceUrl);
await client.connect();
await client.query('begin read only');

type Row = Record<string, any>;
const valuations: Row[] = (await client.query('select * from valuations order by created_at')).rows;
const probates: Row[] = (await client.query('select * from probate_valuations order by created_at')).rows;
await client.query('rollback');
await client.end();

const imageSrc = (img: unknown) => (typeof img === 'string' ? img : (img as { src?: string })?.src ?? '');

async function loadImage(src: string): Promise<Buffer | null> {
  if (src.startsWith('data:')) return Buffer.from(src.split(',')[1] ?? '', 'base64');
  const base = values['uploads-base'];
  if (!base && src.startsWith('/')) return null;
  const res = await fetch(src.startsWith('/') ? `${base!.replace(/\/$/, '')}${src}` : src);
  return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
}

const fixAll = <T extends Record<string, unknown>>(o: T): T =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'string' ? fixMojibake(v) : v])) as T;

const renderer = new ChromeRenderer(process.env.CHROME_PATH);
const staticAssets = await loadStaticAssets();
await mkdir(values.out!, { recursive: true });

console.log('doc       type       old pages  photos  new pages   time    size');
const all = [...valuations.map(r => ['valuation', r] as const), ...probates.map(r => ['probate', r] as const)];
for (const [type, row] of all.filter(([, r]) => !values.only || String(r.id).startsWith(values.only))) {
  const details = type === 'valuation'
    ? valuationDetailsSchema.parse(fixAll({
        customerName: row.customer_name ?? '', customerAddress: row.customer_address ?? '',
        pricingRows: Array.isArray(row.pricing_rows) ? row.pricing_rows.map((p: Row, i: number) => ({
          id: String(p.id ?? i), component: fixMojibake(p.component ?? ''), estimatedValue: fixMojibake(p.estimatedValue ?? ''),
        })) : [],
        totalRange: row.total_range ?? '', insuranceValue: row.insurance_value ?? '', numberOfItems: row.number_of_items ?? '',
      }))
    : probateDetailsSchema.parse(fixAll({
        executorName: row.executor_name ?? '', executorAddress: row.executor_address ?? '',
        contactNumber: row.contact_number ?? '', email: row.email ?? '', deceasedName: row.deceased_name ?? '',
        probateReference: row.probate_reference ?? '', totalMarketValue: row.total_market_value ?? '',
      }));

  const oldPages = (() => { try { const p = JSON.parse(row.schedule_html); return Array.isArray(p) ? p.length : 1; } catch { return 1; } })();

  const assets: Record<string, RenderAsset> = {};
  const images: { src: string }[] = [];
  let missing = 0;
  for (const img of Array.isArray(row.images) ? row.images : []) {
    const buf = await loadImage(imageSrc(img)).catch(() => null);
    if (!buf) { missing++; continue; }
    const name = `img-${images.length + 1}.jpg`;
    assets[name] = { data: (await processPhoto(buf)).grid, contentType: 'image/jpeg' };
    images.push({ src: name });
  }
  let signatureSrc: string | null = null;
  if (typeof row.owner_signature === 'string' && row.owner_signature.startsWith('data:')) {
    assets['signature.png'] = { data: await processSignature(Buffer.from(row.owner_signature.split(',')[1]!, 'base64')), contentType: 'image/png' };
    signatureSrc = 'signature.png';
  }

  const doc = {
    type, details,
    documentDate: (type === 'valuation' ? row.valuation_date : row.date_of_death) ?? null,
    scheduleHtml: convertLegacySchedule(row.schedule_html),
    createdAt: new Date(row.created_at),
  };
  const build = (sectionPages: Record<string, number>, markers: boolean) => ({
    ...buildRenderInput(doc, staticAssets, {
      mode, stationeryMargins: { top: 73, bottom: 60 }, images, signatureSrc, sectionPages, markers,
    }),
    assets,
  });

  const started = Date.now();
  let pdf = await renderer.render(build({}, type === 'valuation'));
  const { pageCount, sectionPages } = await analysePdf(pdf);
  if (type === 'valuation') pdf = await renderer.render(build(sectionPages, false));
  const ms = Date.now() - started;

  const file = `${type}-${String(row.id).slice(0, 8)}-${mode}.pdf`;
  await writeFile(path.join(values.out!, file), pdf);
  const photos = `${images.length}${missing ? ` (+${missing} n/a)` : ''}`;
  console.log(`${String(row.id).slice(0, 8)}  ${type.padEnd(9)}  ${String(oldPages).padStart(9)}  ${photos.padStart(6)}  ${String(pageCount).padStart(9)}  ${(ms / 1000).toFixed(1).padStart(5)}s  ${(pdf.length / 1e6).toFixed(2)} MB`);
}

await renderer.close();
console.log(`\nPDFs written to ${values.out}`);
