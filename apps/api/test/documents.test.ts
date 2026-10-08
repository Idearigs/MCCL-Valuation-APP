import sharp from 'sharp';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { signedInAgent, sampleValuation, setupTestApp } from './helpers';

let ctx: Awaited<ReturnType<typeof setupTestApp>>;
let agent: Awaited<ReturnType<typeof signedInAgent>>;

beforeEach(async () => {
  await ctx?.close();
  ctx = await setupTestApp();
  agent = await signedInAgent(ctx.app);
});
afterAll(() => ctx?.close());

describe('documents CRUD', () => {
  it('creates, reads, updates and soft-deletes a valuation', async () => {
    const created = await agent.post('/api/documents').send(sampleValuation());
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      type: 'valuation', status: 'complete', displayName: 'Jane Smith',
      headlineValue: '£3,800', documentDate: '2026-09-01', images: [], signatureUrl: null,
    });
    const id = created.body.id;

    const fetched = await agent.get(`/api/documents/${id}`);
    expect(fetched.body.details.pricingRows).toHaveLength(1);

    const updated = await agent.put(`/api/documents/${id}`)
      .send(sampleValuation({ details: { ...sampleValuation().details, insuranceValue: '' } }));
    expect(updated.status).toBe(200);
    expect(updated.body.status).toBe('draft');

    await agent.delete(`/api/documents/${id}`).expect(204);
    expect((await agent.get(`/api/documents/${id}`)).status).toBe(404);
    expect((await agent.delete(`/api/documents/${id}`)).status).toBe(404);
  });

  it('round-trips non-ASCII text (UTF-8)', async () => {
    const name = 'Zoë Ørsted → ½ct ✓ 日本';
    const res = await agent.post('/api/documents').send(sampleValuation({ details: { ...sampleValuation().details, customerName: name } }));
    expect((await agent.get(`/api/documents/${res.body.id}`)).body.displayName).toBe(name);
  });

  it('keeps DATE values exact (no timezone shift)', async () => {
    const res = await agent.post('/api/documents').send(sampleValuation({ documentDate: '2026-03-29' }));
    expect(res.body.documentDate).toBe('2026-03-29');
  });

  it('creates probate documents with their own fields', async () => {
    const res = await agent.post('/api/documents').send({
      type: 'probate',
      documentDate: '2026-01-15',
      details: { executorName: 'Tom Brown', deceasedName: 'Mary Brown', totalMarketValue: '£12,000' },
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'complete', displayName: 'Mary Brown', headlineValue: '£12,000' });
  });

  it('rejects invalid input with details', async () => {
    const res = await agent.post('/api/documents').send({ type: 'valuation', documentDate: 'yesterday', details: {} });
    expect(res.status).toBe(400);
    expect(res.body.details[0].path).toBe('documentDate');
  });

  it('refuses to change a document type', async () => {
    const { body } = await agent.post('/api/documents').send(sampleValuation());
    const res = await agent.put(`/api/documents/${body.id}`).send({ type: 'probate', details: {} });
    expect(res.status).toBe(400);
  });

  it('returns 404 for malformed ids instead of a server error', async () => {
    expect((await agent.get('/api/documents/not-a-uuid')).status).toBe(404);
  });

  it('strips scripts and layout hacks from schedule HTML', async () => {
    const res = await agent.post('/api/documents').send(sampleValuation({
      scheduleHtml: '<p style="margin-top:80px;text-align:center" onclick="x()">Ring<script>alert(1)</script></p><font size="7">Big</font><img src=x onerror=alert(1)>',
    }));
    expect(res.body.scheduleHtml).toBe('<p style="text-align:center">Ring</p>Big');
  });
});

describe('listing', () => {
  beforeEach(async () => {
    await agent.post('/api/documents').send(sampleValuation({ documentDate: '2026-01-10' }));
    await agent.post('/api/documents').send(sampleValuation({ details: { ...sampleValuation().details, customerName: 'Bob 100%_Jones' } }));
    await agent.post('/api/documents').send({ type: 'probate', documentDate: '2026-05-01', details: { deceasedName: 'Ann Lee', executorName: 'Pat Lee' } });
  });

  it('paginates newest first', async () => {
    const page1 = await agent.get('/api/documents?pageSize=2');
    expect(page1.body).toMatchObject({ total: 3, page: 1, pageSize: 2 });
    expect(page1.body.items).toHaveLength(2);
    expect(page1.body.items[0].displayName).toBe('Ann Lee');
    const page2 = await agent.get('/api/documents?pageSize=2&page=2');
    expect(page2.body.items).toHaveLength(1);
  });

  it('filters by type, date range and search (including executor name)', async () => {
    expect((await agent.get('/api/documents?type=probate')).body.total).toBe(1);
    expect((await agent.get('/api/documents?from=2026-02-01&to=2026-12-31')).body.total).toBe(2);
    expect((await agent.get('/api/documents?q=pat')).body.items[0].displayName).toBe('Ann Lee');
    // LIKE wildcards in the search are treated literally
    expect((await agent.get('/api/documents?q=100%25_')).body.total).toBe(1);
    expect((await agent.get('/api/documents?q=%25')).body.total).toBe(1);
  });

  it('returns dashboard stats', async () => {
    const res = await agent.get('/api/documents/stats');
    expect(res.body).toEqual({ valuations: 2, probates: 1, thisMonth: 3, complete: 3 });
  });
});

describe('images', () => {
  const photo = () => sharp({
    create: { width: 3000, height: 2000, channels: 3, background: '#c08040' },
  }).jpeg().withExif({ IFD0: { Copyright: 'secret-gps-stand-in' } }).toBuffer();

  it('uploads, resizes, strips metadata, and serves via signed URLs only', async () => {
    const { body: doc } = await agent.post('/api/documents').send(sampleValuation());
    const res = await agent.post(`/api/documents/${doc.id}/images`).attach('image', await photo(), 'ring.jpg');
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ position: 0, sizePct: 50, width: 1600, height: 1067 });

    const file = await agent.get(res.body.printUrl).buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(file.status).toBe(200);
    const meta = await sharp(file.body as Buffer).metadata();
    expect(meta.width).toBe(1600);
    expect(meta.exif).toBeUndefined();

    // Tampered / unsigned URLs are refused
    expect((await request(ctx.app).get(res.body.printUrl.replace(/sig=[^&]+/, 'sig=forged'))).status).toBe(403);
    expect((await request(ctx.app).get(res.body.printUrl.split('?')[0])).status).toBe(403);
  });

  it('rejects files that are not images', async () => {
    const { body: doc } = await agent.post('/api/documents').send(sampleValuation());
    const res = await agent.post(`/api/documents/${doc.id}/images`)
      .attach('image', Buffer.from('<svg onload="alert(1)"></svg>'), 'evil.jpg');
    expect(res.status).toBe(400);
  });

  it('reorders, resizes and deletes images, keeping positions compact', async () => {
    const { body: doc } = await agent.post('/api/documents').send(sampleValuation());
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await agent.post(`/api/documents/${doc.id}/images`).attach('image', await photo(), `p${i}.jpg`);
      ids.push(r.body.id);
    }
    const reordered = await agent.put(`/api/documents/${doc.id}/images/order`).send({ imageIds: [ids[2], ids[0], ids[1]] });
    expect(reordered.body.map((i: { id: string }) => i.id)).toEqual([ids[2], ids[0], ids[1]]);

    expect((await agent.put(`/api/documents/${doc.id}/images/order`).send({ imageIds: [ids[0]] })).status).toBe(400);

    const patched = await agent.patch(`/api/documents/${doc.id}/images/${ids[0]}`).send({ sizePct: 100 });
    expect(patched.body.sizePct).toBe(100);

    await agent.delete(`/api/documents/${doc.id}/images/${ids[2]}`).expect(204);
    const after = await agent.get(`/api/documents/${doc.id}`);
    expect(after.body.images.map((i: { id: string; position: number }) => [i.id, i.position]))
      .toEqual([[ids[0], 0], [ids[1], 1]]);
  });

  it('stores signatures as trimmed PNGs', async () => {
    const { body: doc } = await agent.post('/api/documents').send(sampleValuation());
    const sig = await sharp({ create: { width: 800, height: 300, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: Buffer.from('<svg width="800" height="300"><path d="M100 150 L700 160" stroke="black" stroke-width="8"/></svg>') }])
      .png().toBuffer();
    const res = await agent.put(`/api/documents/${doc.id}/signature`).attach('image', sig, 'sig.png');
    expect(res.status).toBe(200);
    expect((await agent.get(`/api/documents/${doc.id}`)).body.signatureUrl).toMatch(/signature-.*\.png/);
  });
});
