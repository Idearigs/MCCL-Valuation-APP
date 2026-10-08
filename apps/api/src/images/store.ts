import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { documentImages } from '../db/schema';
import type { Storage } from '../storage';
import { processPhoto, processSignature } from './process';

/** Processes a photo, stores its sizes and appends it to the document's picture schedule. */
export async function storePhoto(db: Db, storage: Storage, documentId: string, input: Buffer, sizePct = 50) {
  const img = await processPhoto(input);
  const imageId = randomUUID();
  const keyFor = (variant: string) => `documents/${documentId}/images/${imageId}-${variant}.jpg`;
  const [printKey, thumbKey, gridKey] = [keyFor('print'), keyFor('thumb'), keyFor('grid')];
  await Promise.all([
    storage.put(printKey, img.print, 'image/jpeg'),
    storage.put(thumbKey, img.thumb, 'image/jpeg'),
    storage.put(gridKey, img.grid, 'image/jpeg'),
  ]);
  const [row] = await db.insert(documentImages).values({
    id: imageId,
    documentId,
    // Appends atomically even when uploads race.
    position: sql`(select coalesce(max(${documentImages.position}), -1) + 1 from ${documentImages} where ${documentImages.documentId} = ${documentId})`,
    sizePct,
    printKey, thumbKey, gridKey, width: img.width, height: img.height,
  }).returning();
  return row!;
}

/** Processes a signature image and stores it; returns the storage key. */
export async function storeSignature(storage: Storage, documentId: string, input: Buffer) {
  const png = await processSignature(input);
  const key = `documents/${documentId}/signature-${randomUUID()}.png`;
  await storage.put(key, png, 'image/png');
  return key;
}
