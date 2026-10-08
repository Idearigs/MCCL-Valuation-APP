import type { Request } from 'express';
import type { Db } from './db/client';
import { auditLog } from './db/schema';

export interface AuditEntry {
  action: string;
  entityType?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
}

/** Records who did what. Never fails the request: audit errors are only logged. */
export function audit(db: Db, req: Request, entry: AuditEntry, userId = req.user?.id) {
  db.insert(auditLog).values({
    ...entry,
    userId: userId ?? null,
    ip: req.ip ?? null,
  }).catch(err => req.log?.error({ err, entry }, 'Failed to write audit log'));
}
