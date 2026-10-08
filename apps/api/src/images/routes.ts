import { Router } from 'express';
import multer from 'multer';
import { and, eq, sql } from 'drizzle-orm';
import { imageOrderSchema, imageUpdateSchema } from '@mccl/shared';
import { audit } from '../audit';
import type { Db } from '../db/client';
import { documentImages, documents } from '../db/schema';
import type { DocumentsRepo } from '../documents/repo';
import { HttpError, notFound, parse, uuidParam } from '../http/errors';
import type { Storage } from '../storage';
import { storePhoto, storeSignature } from './store';

/** Max images per document. Well above the largest real document. */
export const MAX_IMAGES_PER_DOCUMENT = 300;

/**
 * One file per request: the client uploads sequentially with progress, and the server
 * never holds more than a single image in memory per request.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
});

/** :id comes from the parent mount path (mergeParams), which Express typings can't see. */
const docParam = (params: object) => (params as { id?: string }).id;

export function imagesRouter({ db, repo, storage }: { db: Db; repo: DocumentsRepo; storage: Storage }) {
  // Mounted at /api/documents/:id — mergeParams exposes :id
  const router = Router({ mergeParams: true });

  async function requireDoc(rawId: unknown) {
    const doc = await repo.getRow(uuidParam(rawId, 'Document not found'));
    if (!doc) throw notFound('Document not found');
    return doc;
  }

  router.post('/images', upload.single('image'), async (req, res) => {
    const doc = await requireDoc(docParam(req.params));
    if (!req.file) throw new HttpError(400, 'No image uploaded (field "image")');

    const [{ n } = { n: 0 }] = await db.select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(documentImages).where(eq(documentImages.documentId, doc.id));
    if (n >= MAX_IMAGES_PER_DOCUMENT) throw new HttpError(400, `A document can have at most ${MAX_IMAGES_PER_DOCUMENT} images`);

    const row = await storePhoto(db, storage, doc.id, req.file.buffer);
    await touch(doc.id, req.user!.id);
    audit(db, req, { action: 'image.uploaded', entityType: 'document', entityId: doc.id });
    res.status(201).json(await repo.toImage(row));
  });

  router.put('/images/order', async (req, res) => {
    const doc = await requireDoc(docParam(req.params));
    const { imageIds } = parse(imageOrderSchema, req.body);
    const existing = await repo.listImages(doc.id);
    const known = new Set(existing.map(i => i.id));
    if (imageIds.length !== existing.length || imageIds.some(id => !known.has(id)) || new Set(imageIds).size !== imageIds.length) {
      throw new HttpError(400, 'imageIds must list every image of the document exactly once');
    }
    await db.transaction(async tx => {
      for (const [position, id] of imageIds.entries()) {
        await tx.update(documentImages).set({ position }).where(eq(documentImages.id, id));
      }
    });
    await touch(doc.id, req.user!.id);
    res.json(await Promise.all((await repo.listImages(doc.id)).map(repo.toImage)));
  });

  router.patch('/images/:imageId', async (req, res) => {
    const doc = await requireDoc(docParam(req.params));
    const imageId = uuidParam(req.params.imageId, 'Image not found');
    const patch = parse(imageUpdateSchema, req.body);
    const [row] = await db.update(documentImages).set(patch)
      .where(and(eq(documentImages.id, imageId), eq(documentImages.documentId, doc.id)))
      .returning();
    if (!row) throw notFound('Image not found');
    await touch(doc.id, req.user!.id);
    res.json(await repo.toImage(row));
  });

  router.delete('/images/:imageId', async (req, res) => {
    const doc = await requireDoc(docParam(req.params));
    const imageId = uuidParam(req.params.imageId, 'Image not found');
    const [row] = await db.delete(documentImages)
      .where(and(eq(documentImages.id, imageId), eq(documentImages.documentId, doc.id)))
      .returning();
    if (!row) throw notFound('Image not found');
    await compactPositions(doc.id);
    await storage.delete([row.printKey, row.thumbKey, ...(row.gridKey ? [row.gridKey] : [])]);
    await touch(doc.id, req.user!.id);
    audit(db, req, { action: 'image.deleted', entityType: 'document', entityId: doc.id });
    res.status(204).end();
  });

  router.put('/signature', upload.single('image'), async (req, res) => {
    const doc = await requireDoc(docParam(req.params));
    if (!req.file) throw new HttpError(400, 'No image uploaded (field "image")');
    const key = await storeSignature(storage, doc.id, req.file.buffer);
    await db.update(documents).set({ signatureKey: key, updatedAt: new Date(), updatedBy: req.user!.id })
      .where(eq(documents.id, doc.id));
    if (doc.signatureKey) await storage.delete([doc.signatureKey]);
    res.json({ signatureUrl: await storage.signedUrl(key) });
  });

  router.delete('/signature', async (req, res) => {
    const doc = await requireDoc(docParam(req.params));
    await db.update(documents).set({ signatureKey: null, updatedAt: new Date(), updatedBy: req.user!.id })
      .where(eq(documents.id, doc.id));
    if (doc.signatureKey) await storage.delete([doc.signatureKey]);
    res.status(204).end();
  });

  async function touch(documentId: string, userId: string) {
    await db.update(documents).set({ updatedAt: new Date(), updatedBy: userId }).where(eq(documents.id, documentId));
  }

  async function compactPositions(documentId: string) {
    await db.execute(sql`
      update ${documentImages} di set position = ranked.rn - 1
      from (select id, row_number() over (order by position) as rn
            from ${documentImages} where document_id = ${documentId}) ranked
      where di.id = ranked.id`);
  }

  return router;
}

