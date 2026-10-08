import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { PdfMode, PdfResult } from '@mccl/shared';
import type { Db } from '../db/client';
import { generatedPdfs } from '../db/schema';
import type { DocumentsRepo } from '../documents/repo';
import type { Logger } from '../logger';
import type { Storage } from '../storage';
import { analysePdf } from './analyse';
import { loadStaticAssets } from './assets';
import { buildRenderInput, marginsFor, TEMPLATE_VERSION, type Margins } from './html';
import type { PdfRenderer, RenderAsset } from './renderer';

/** Runs tasks one at a time so a burst of Generate clicks can't exhaust memory. */
class Queue {
  private tail: Promise<unknown> = Promise.resolve();
  pending = 0;
  run<T>(task: () => Promise<T>): Promise<T> {
    this.pending++;
    const result = this.tail.then(task, task);
    this.tail = result.catch(() => undefined).finally(() => { this.pending--; });
    return result;
  }
}

export interface PdfServiceDeps {
  db: Db;
  repo: DocumentsRepo;
  storage: Storage;
  renderer: PdfRenderer;
  logger: Logger;
  stationeryMargins: Margins;
}

export function createPdfService({ db, repo, storage, renderer, logger, stationeryMargins }: PdfServiceDeps) {
  const queue = new Queue();
  /** Identical concurrent requests share one render. */
  const inFlight = new Map<string, Promise<PdfResult>>();

  async function generate(documentId: string, mode: PdfMode): Promise<PdfResult | null> {
    const doc = await repo.getRow(documentId);
    if (!doc) return null;
    const images = await repo.listImages(documentId);

    const contentHash = createHash('sha256').update(JSON.stringify({
      v: TEMPLATE_VERSION,
      mode,
      margins: marginsFor(mode, stationeryMargins),
      type: doc.type,
      documentDate: doc.documentDate,
      scheduleHtml: doc.scheduleHtml,
      details: doc.details,
      createdAt: doc.type === 'probate' ? doc.createdAt.toISOString().slice(0, 10) : null,
      images: images.map(i => [i.gridKey ?? i.printKey, i.position]),
      signature: doc.signatureKey,
    })).digest('hex');

    const [cached] = await db.select().from(generatedPdfs).where(and(
      eq(generatedPdfs.documentId, documentId),
      eq(generatedPdfs.mode, mode),
      eq(generatedPdfs.contentHash, contentHash),
    )).limit(1);
    if (cached) {
      return {
        url: await storage.signedUrl(cached.storageKey, 15 * 60),
        mode, pageCount: cached.pageCount, byteSize: cached.byteSize, renderMs: cached.renderMs, cached: true,
      };
    }

    const key = `${documentId}:${mode}:${contentHash}`;
    let job = inFlight.get(key);
    if (!job) {
      job = queue.run(async () => {
        const started = Date.now();
        const staticAssets = await loadStaticAssets();

        // Photos use the pre-cropped 600px grid variant and are handed to Chrome as local files.
        const assets: Record<string, RenderAsset> = {};
        const templateImages = await Promise.all(images.map(async (img, i) => {
          const name = `img-${i + 1}.jpg`;
          assets[name] = { data: await storage.get(img.gridKey ?? img.printKey), contentType: 'image/jpeg' };
          return { src: name };
        }));
        let signatureSrc: string | null = null;
        if (doc.signatureKey) {
          assets['signature.png'] = { data: await storage.get(doc.signatureKey), contentType: 'image/png' };
          signatureSrc = 'signature.png';
        }

        const build = (sectionPages: Record<string, number>, markers: boolean) => ({
          ...buildRenderInput(doc, staticAssets, {
            mode, stationeryMargins, images: templateImages, signatureSrc, sectionPages, markers,
          }),
          assets,
        });

        // Valuations list section page numbers on their Contents page, so they render twice:
        // pass 1 finds where each section starts, pass 2 is the final document. The page
        // number slots are fixed-width and the markers take no space, so layout is identical.
        const needsContents = doc.type === 'valuation';
        let pdf = await renderer.render(build({}, needsContents));
        const first = await analysePdf(pdf);
        if (needsContents) pdf = await renderer.render(build(first.sectionPages, false));
        const renderMs = Date.now() - started;

        const storageKey = `documents/${documentId}/pdf/${mode}-${contentHash.slice(0, 16)}.pdf`;
        await storage.put(storageKey, pdf, 'application/pdf');
        await db.insert(generatedPdfs).values({
          documentId, mode, contentHash, storageKey,
          pageCount: first.pageCount, byteSize: pdf.length, renderMs,
        }).onConflictDoNothing();
        logger.info({ documentId, mode, pages: first.pageCount, bytes: pdf.length, renderMs, images: images.length }, 'PDF rendered');

        return {
          url: await storage.signedUrl(storageKey, 15 * 60),
          mode, pageCount: first.pageCount, byteSize: pdf.length, renderMs, cached: false,
        };
      }).finally(() => inFlight.delete(key));
      inFlight.set(key, job);
    }
    return job;
  }

  return { generate, get queued() { return queue.pending; } };
}

export type PdfService = ReturnType<typeof createPdfService>;
