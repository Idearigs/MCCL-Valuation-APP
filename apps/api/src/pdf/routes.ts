import { Router } from 'express';
import { pdfRequestSchema } from '@mccl/shared';
import { audit } from '../audit';
import type { Db } from '../db/client';
import { notFound, parse, uuidParam } from '../http/errors';
import type { PdfService } from './service';

/** Mounted at /api/documents/:id */
export function pdfRouter({ db, pdf }: { db: Db; pdf: PdfService }) {
  const router = Router({ mergeParams: true });

  // Synchronous: renders are queued one at a time and typically take a few seconds.
  router.post('/pdf', async (req, res) => {
    const id = uuidParam((req.params as { id?: string }).id, 'Document not found');
    const { mode } = parse(pdfRequestSchema, req.body ?? {});
    const result = await pdf.generate(id, mode);
    if (!result) throw notFound('Document not found');
    if (!result.cached) {
      audit(db, req, { action: 'pdf.generated', entityType: 'document', entityId: id, meta: { mode, pages: result.pageCount, ms: result.renderMs } });
    }
    res.json(result);
  });

  return router;
}
