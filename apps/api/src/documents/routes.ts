import { Router } from 'express';
import { documentInputSchema, listQuerySchema } from '@mccl/shared';
import { audit } from '../audit';
import type { Db } from '../db/client';
import { HttpError, notFound, parse, uuidParam } from '../http/errors';
import type { DocumentsRepo } from './repo';

export function documentsRouter({ db, repo }: { db: Db; repo: DocumentsRepo }) {
  const router = Router();

  router.get('/', async (req, res) => {
    res.json(await repo.list(parse(listQuerySchema, req.query)));
  });

  router.get('/stats', async (_req, res) => {
    res.json(await repo.stats());
  });

  router.get('/:id', async (req, res) => {
    const doc = await repo.get(uuidParam(req.params.id));
    if (!doc) throw notFound('Document not found');
    res.json(doc);
  });

  router.post('/', async (req, res) => {
    const input = parse(documentInputSchema, req.body);
    const doc = await repo.create(input, req.user!.id);
    audit(db, req, { action: 'document.created', entityType: 'document', entityId: doc.id, meta: { type: doc.type } });
    res.status(201).json(doc);
  });

  router.put('/:id', async (req, res) => {
    const id = uuidParam(req.params.id);
    const input = parse(documentInputSchema, req.body);
    const existing = await repo.getRow(id);
    if (!existing) throw notFound('Document not found');
    if (existing.type !== input.type) throw new HttpError(400, 'Document type cannot change');
    const doc = await repo.update(id, input, req.user!.id);
    audit(db, req, { action: 'document.updated', entityType: 'document', entityId: id });
    res.json(doc);
  });

  router.delete('/:id', async (req, res) => {
    const id = uuidParam(req.params.id);
    if (!(await repo.softDelete(id, req.user!.id))) throw notFound('Document not found');
    audit(db, req, { action: 'document.deleted', entityType: 'document', entityId: id });
    res.status(204).end();
  });

  return router;
}
