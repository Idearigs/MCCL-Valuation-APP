import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signedInAgent, sampleValuation, setupTestApp } from './helpers';

let ctx: Awaited<ReturnType<typeof setupTestApp>>;
let agent: Awaited<ReturnType<typeof signedInAgent>>;

const SAMPLES_DIR = path.resolve(import.meta.dirname, '../../../.data/pdf-samples');

beforeAll(async () => {
  ctx = await setupTestApp();
  agent = await signedInAgent(ctx.app);
  await mkdir(SAMPLES_DIR, { recursive: true });
});
afterAll(() => ctx?.close());

async function download(url: string) {
  const res = await agent.get(url).buffer(true).parse((r, cb) => {
    const chunks: Buffer[] = [];
    r.on('data', (c: Buffer) => chunks.push(c));
    r.on('end', () => cb(null, Buffer.concat(chunks)));
  });
  expect(res.status).toBe(200);
  return res.body as Buffer;
}

async function pageTexts(pdf: Buffer) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({ data: new Uint8Array(pdf) });
  const doc = await task.promise;
  const texts: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    texts.push(content.items.map(i => ('str' in i ? i.str : '')).join(' '));
  }
  await task.destroy();
  return texts;
}

/** A photo-like image (noise compresses like a real photo, unlike a flat colour). */
const photo = (seed: number) => sharp({
  create: { width: 2400, height: 1800, channels: 3, background: { r: (seed * 37) % 255, g: (seed * 91) % 255, b: (seed * 53) % 255 }, noise: { type: 'gaussian', mean: 128, sigma: 40 } },
}).jpeg({ quality: 85 }).toBuffer();

describe('PDF generation: large document', () => {
  const ITEMS = 150;
  const PHOTOS = 60;
  let docId: string;

  beforeAll(async () => {
    const items = Array.from({ length: ITEMS }, (_, i) =>
      `<p><strong>Item ${i + 1}.</strong> 18ct yellow gold ring set with a round brilliant cut diamond of approximately 0.${(i % 9) + 1}ct, colour G, clarity VS2, in a four-claw setting. Ring size N½. Weight 4.${i % 10}g. Ref-${String(i + 1).padStart(3, '0')}-END</p>`,
    ).join('');
    const { body } = await agent.post('/api/documents').send(sampleValuation({ scheduleHtml: items }));
    docId = body.id;
    for (let i = 0; i < PHOTOS; i++) {
      const r = await agent.post(`/api/documents/${docId}/images`).attach('image', await photo(i), `p${i}.jpg`);
      expect(r.status).toBe(201);
    }
  }, 300_000);

  it('renders every page, loses no text, and fills in the contents page', async () => {
    const res = await agent.post(`/api/documents/${docId}/pdf`).send({ mode: 'letterhead' });
    expect(res.status).toBe(200);
    expect(res.body.cached).toBe(false);
    console.log(`letterhead: ${res.body.pageCount} pages, ${(res.body.byteSize / 1e6).toFixed(1)} MB, ${res.body.renderMs} ms`);

    const pdf = await download(res.body.url);
    await writeFile(path.join(SAMPLES_DIR, 'large-letterhead.pdf'), pdf);
    const texts = await pageTexts(pdf);
    const all = texts.join('\n');

    expect(texts.length).toBe(res.body.pageCount);
    expect(texts.length).toBeGreaterThan(15);
    // Nothing cut off: every schedule item made it into the PDF, in full.
    for (let i = 1; i <= ITEMS; i++) expect(all).toContain(`Ref-${String(i).padStart(3, '0')}-END`);
    // Section markers from the first pass are gone from the final output.
    expect(all).not.toContain('@@SECTION');

    // Contents page lists the real start pages.
    const { sectionPages } = await analysePdfWithMarkers(texts);
    const contents = texts[2]!;
    expect(contents).toMatch(new RegExp(`Schedule\\s+${sectionPages.schedule}\\b`));
    expect(contents).toMatch(new RegExp(`Picture Schedule\\s+${sectionPages.pictures}\\b`));
    expect(contents).toMatch(new RegExp(`Glossary\\s+${sectionPages.glossary}\\b`));

    // 60 photos = 5 picture pages at 12 per page in the old app; here they flow naturally.
    expect(sectionPages.glossary! - sectionPages.pictures!).toBeGreaterThanOrEqual(4);
    // Every page carries "Page X of Y".
    expect(texts.at(-1)).toContain(`Page ${texts.length} of ${texts.length}`);
    // Real text, not screenshots — and a sane size for 60 photos.
    expect(res.body.byteSize).toBeLessThan(12_000_000);
  }, 180_000);

  it('reuses the cached PDF when nothing changed', async () => {
    const res = await agent.post(`/api/documents/${docId}/pdf`).send({ mode: 'letterhead' });
    expect(res.body.cached).toBe(true);
  });

  it('renders stationery mode with the same content and no letterhead', async () => {
    const res = await agent.post(`/api/documents/${docId}/pdf`).send({ mode: 'stationery' });
    expect(res.status).toBe(200);
    console.log(`stationery: ${res.body.pageCount} pages, ${(res.body.byteSize / 1e6).toFixed(1)} MB, ${res.body.renderMs} ms`);
    const pdf = await download(res.body.url);
    await writeFile(path.join(SAMPLES_DIR, 'large-stationery.pdf'), pdf);
    const all = (await pageTexts(pdf)).join('\n');
    expect(all).toContain('Ref-150-END');
    expect(all).not.toContain('Page 1 of');
  }, 180_000);

  it('serialises concurrent requests instead of rendering in parallel', async () => {
    // Change the document so the cache misses, then fire three identical requests at once.
    await agent.put(`/api/documents/${docId}`).send(sampleValuation({ scheduleHtml: '<p>Changed</p>' }));
    const results = await Promise.all([1, 2, 3].map(() => agent.post(`/api/documents/${docId}/pdf`).send({ mode: 'letterhead' })));
    expect(results.every(r => r.status === 200)).toBe(true);
    // All three share one render.
    expect(new Set(results.map(r => r.body.renderMs)).size).toBe(1);
  }, 180_000);
});

describe('PDF generation: probate', () => {
  it('renders a probate document', async () => {
    const { body: doc } = await agent.post('/api/documents').send({
      type: 'probate', documentDate: '2026-01-15',
      scheduleHtml: '<table><thead><tr><th>Item</th><th>Value</th></tr></thead><tbody><tr><td>Gold watch</td><td>£400</td></tr></tbody></table>',
      details: { executorName: 'Tom Brown', deceasedName: 'Mary Brown', totalMarketValue: '£400' },
    });
    const res = await agent.post(`/api/documents/${doc.id}/pdf`).send({});
    expect(res.status).toBe(200);
    const pdf = await download(res.body.url);
    await writeFile(path.join(SAMPLES_DIR, 'probate.pdf'), pdf);
    const all = (await pageTexts(pdf)).join('\n');
    expect(all).toContain('Jewellery Valuation for Probate');
    expect(all).toContain('Total Estimated Market Value: £400');
  }, 120_000);

  it('404s for unknown documents', async () => {
    const res = await agent.post('/api/documents/00000000-0000-0000-0000-000000000000/pdf').send({});
    expect(res.status).toBe(404);
  });

  it('requires sign-in', async () => {
    expect((await request(ctx.app).post('/api/documents/00000000-0000-0000-0000-000000000000/pdf')).status).toBe(401);
  });
});

/** Section start pages read from the final PDF's visible headings. */
async function analysePdfWithMarkers(texts: string[]) {
  const find = (heading: string, after = 3) => texts.findIndex((t, i) => i >= after && t.includes(heading)) + 1;
  return {
    sectionPages: {
      schedule: find('Schedule'),
      pictures: find('Picture Schedule'),
      glossary: find('Glossary'),
    },
  };
}


describe('printing on pre-printed letterhead paper', () => {
  it('marks every PDF to print at actual size (no fit-to-page shrinking)', async () => {
    const { body: doc } = await agent.post('/api/documents').send(sampleValuation());
    const res = await agent.post(`/api/documents/${doc.id}/pdf`).send({ mode: 'stationery' });
    const { PDFDocument, PDFDict, PDFName } = await import('pdf-lib');
    const pdf = await PDFDocument.load(await download(res.body.url));
    const prefs = pdf.catalog.lookup(PDFName.of('ViewerPreferences'), PDFDict);
    expect(prefs.get(PDFName.of('PrintScaling'))).toEqual(PDFName.of('None'));
  }, 120_000);

  it('serves a one-page alignment test with rulers and the text boundaries', async () => {
    const res = await agent.get('/api/pdf/alignment-test').buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    const texts = await pageTexts(res.body as Buffer);
    expect(texts).toHaveLength(1);
    expect(texts[0]).toContain('document text starts here (73 mm from the top)');
    expect(texts[0]).toContain('document text ends here (60 mm from the bottom)');
  }, 120_000);
});

describe('insurer notice', () => {
  it('keeps the signature on the same page as the notice, even with a long address', async () => {
    const address = Array.from({ length: 7 }, (_, i) => `Address line ${i + 1}`).join('\n');
    const { body: doc } = await agent.post('/api/documents').send(sampleValuation({
      details: { ...sampleValuation().details, customerName: 'Mrs Elizabeth Alexandra Montgomery-Smythe', customerAddress: address },
    }));
    for (const mode of ['letterhead', 'stationery']) {
      const res = await agent.post(`/api/documents/${doc.id}/pdf`).send({ mode });
      const texts = await pageTexts(await download(res.body.url));
      const noticePage = texts.findIndex(t => t.includes('Insurer Notice'));
      const signaturePage = texts.findIndex(t => t.includes('Andrew McCulloch Jewellers'));
      expect(signaturePage, mode).toBe(noticePage);
      expect(signaturePage, mode).toBe(texts.length - 1);
    }
  }, 180_000);
});
