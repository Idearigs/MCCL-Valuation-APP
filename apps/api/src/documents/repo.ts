import { and, asc, count, desc, eq, gte, ilike, isNull, lte, or, sql, type SQL } from 'drizzle-orm';
import {
  summarise,
  type DocumentImage, type DocumentInput, type DocumentListItem, type DocumentRecord,
  type DocumentStats, type ListQuery, type Paginated,
} from '@mccl/shared';
import type { Db } from '../db/client';
import { documentImages, documents } from '../db/schema';
import type { Storage } from '../storage';
import { sanitizeScheduleHtml } from './sanitize';

type DocumentRow = typeof documents.$inferSelect;
type ImageRow = typeof documentImages.$inferSelect;

const escapeLike = (s: string) => s.replace(/[\\%_]/g, c => `\\${c}`);

export function createDocumentsRepo(db: Db, storage: Storage) {
  const notDeleted = isNull(documents.deletedAt);

  async function toImage(row: ImageRow): Promise<DocumentImage> {
    const [thumbUrl, printUrl] = await Promise.all([
      storage.signedUrl(row.thumbKey),
      storage.signedUrl(row.printKey),
    ]);
    return {
      id: row.id, position: row.position, sizePct: row.sizePct,
      width: row.width, height: row.height, thumbUrl, printUrl,
    };
  }

  async function toRecord(row: DocumentRow, images: ImageRow[]): Promise<DocumentRecord> {
    return {
      id: row.id,
      type: row.type,
      status: row.status,
      displayName: row.displayName,
      headlineValue: row.headlineValue,
      documentDate: row.documentDate,
      scheduleHtml: row.scheduleHtml,
      details: row.details,
      images: await Promise.all(images.map(toImage)),
      signatureUrl: row.signatureKey ? await storage.signedUrl(row.signatureKey) : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    } as DocumentRecord;
  }

  function columnsFor(input: DocumentInput) {
    const clean = { ...input, scheduleHtml: sanitizeScheduleHtml(input.scheduleHtml) };
    return {
      ...summarise(clean),
      type: clean.type,
      documentDate: clean.documentDate,
      scheduleHtml: clean.scheduleHtml,
      details: clean.details,
    };
  }

  return {
    async list(q: ListQuery): Promise<Paginated<DocumentListItem>> {
      const filters: SQL[] = [notDeleted];
      if (q.type) filters.push(eq(documents.type, q.type));
      if (q.status) filters.push(eq(documents.status, q.status));
      if (q.from) filters.push(gte(documents.documentDate, q.from));
      if (q.to) filters.push(lte(documents.documentDate, q.to));
      if (q.q) {
        const term = `%${escapeLike(q.q)}%`;
        filters.push(or(
          ilike(documents.displayName, term),
          ilike(sql`${documents.details}->>'executorName'`, term),
          ilike(sql`${documents.details}->>'probateReference'`, term),
          ilike(sql`${documents.details}->>'customerAddress'`, term),
        )!);
      }
      const where = and(...filters);
      const [rows, [totalRow]] = await Promise.all([
        db.select({
          id: documents.id, type: documents.type, status: documents.status,
          displayName: documents.displayName, headlineValue: documents.headlineValue,
          documentDate: documents.documentDate, createdAt: documents.createdAt, updatedAt: documents.updatedAt,
        }).from(documents).where(where)
          .orderBy(desc(documents.createdAt), desc(documents.id))
          .limit(q.pageSize).offset((q.page - 1) * q.pageSize),
        db.select({ total: count() }).from(documents).where(where),
      ]);
      return {
        items: rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })),
        total: totalRow?.total ?? 0,
        page: q.page,
        pageSize: q.pageSize,
      };
    },

    async stats(): Promise<DocumentStats> {
      const [row] = await db.select({
        valuations: sql<number>`count(*) filter (where ${documents.type} = 'valuation')`.mapWith(Number),
        probates: sql<number>`count(*) filter (where ${documents.type} = 'probate')`.mapWith(Number),
        thisMonth: sql<number>`count(*) filter (where ${documents.createdAt} >= date_trunc('month', now()))`.mapWith(Number),
        complete: sql<number>`count(*) filter (where ${documents.status} = 'complete')`.mapWith(Number),
      }).from(documents).where(notDeleted);
      return row ?? { valuations: 0, probates: 0, thisMonth: 0, complete: 0 };
    },

    async getRow(id: string) {
      const [row] = await db.select().from(documents).where(and(eq(documents.id, id), notDeleted)).limit(1);
      return row ?? null;
    },

    async listImages(documentId: string) {
      return db.select().from(documentImages)
        .where(eq(documentImages.documentId, documentId))
        .orderBy(asc(documentImages.position));
    },

    async get(id: string): Promise<DocumentRecord | null> {
      const row = await this.getRow(id);
      if (!row) return null;
      return toRecord(row, await this.listImages(id));
    },

    async create(input: DocumentInput, userId: string): Promise<DocumentRecord> {
      const [row] = await db.insert(documents)
        .values({ ...columnsFor(input), createdBy: userId, updatedBy: userId })
        .returning();
      return toRecord(row!, []);
    },

    async update(id: string, input: DocumentInput, userId: string): Promise<DocumentRecord | null> {
      const [row] = await db.update(documents)
        .set({ ...columnsFor(input), updatedBy: userId, updatedAt: new Date() })
        .where(and(eq(documents.id, id), notDeleted))
        .returning();
      if (!row) return null;
      return toRecord(row, await this.listImages(id));
    },

    /** Soft delete: the record and its files stay recoverable. */
    async softDelete(id: string, userId: string): Promise<boolean> {
      const rows = await db.update(documents)
        .set({ deletedAt: new Date(), updatedBy: userId })
        .where(and(eq(documents.id, id), notDeleted))
        .returning({ id: documents.id });
      return rows.length > 0;
    },

    toImage,
  };
}

export type DocumentsRepo = ReturnType<typeof createDocumentsRepo>;
