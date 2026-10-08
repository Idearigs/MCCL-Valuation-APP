import { sql } from 'drizzle-orm';
import {
  bigserial, boolean, date, index, integer, jsonb, pgSchema, text, timestamp, uniqueIndex, uuid, varchar,
} from 'drizzle-orm/pg-core';

/**
 * All v2 tables live in their own Postgres schema, so v2 can share the live database
 * with the current app without touching its tables (public.users, public.valuations,
 * public.probate_valuations). The importer reads those; v2 never writes to them.
 */
export const v2 = pgSchema('v2');

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const users = v2.table('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull().default(''),
  role: varchar('role', { length: 20 }).$type<'admin' | 'staff'>().notNull().default('staff'),
  /** HMAC-SHA256(PIN_PEPPER, pin). Deterministic so PIN login is one indexed lookup. */
  pinHash: text('pin_hash').unique(),
  active: boolean('active').notNull().default(true),
  ...timestamps,
});

/**
 * Wrong-PIN counters: one row per client IP plus a 'global' row that caps guesses from
 * everywhere combined. Counters decay after a quiet period.
 */
export const pinThrottle = v2.table('pin_throttle', {
  key: varchar('key', { length: 80 }).primaryKey(),
  failures: integer('failures').notNull().default(0),
  blockedUntil: timestamp('blocked_until', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = v2.table('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tokenHash: text('token_hash').notNull().unique(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  ip: varchar('ip', { length: 64 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [index('sessions_expires_idx').on(t.expiresAt)]);

export const documents = v2.table('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: varchar('type', { length: 20 }).$type<'valuation' | 'probate'>().notNull(),
  status: varchar('status', { length: 20 }).$type<'draft' | 'complete'>().notNull().default('draft'),
  /** Customer name (valuation) or deceased name (probate), denormalised for search. */
  displayName: varchar('display_name', { length: 255 }).notNull().default(''),
  /** Insurance value (valuation) or total market value (probate). */
  headlineValue: varchar('headline_value', { length: 255 }).notNull().default(''),
  /** Valuation date or date of death. */
  documentDate: date('document_date', { mode: 'string' }),
  scheduleHtml: text('schedule_html').notNull().default(''),
  /** Type-specific fields, validated by the zod schemas in @mccl/shared. */
  details: jsonb('details').notNull().default({}),
  signatureKey: text('signature_key'),
  /** Source row id in the v1 database, makes the import idempotent. */
  legacyId: uuid('legacy_id').unique(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  ...timestamps,
}, t => [
  index('documents_created_idx').on(t.createdAt.desc()).where(sql`${t.deletedAt} is null`),
  index('documents_type_idx').on(t.type),
  index('documents_date_idx').on(t.documentDate),
]);

export const documentImages = v2.table('document_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  sizePct: integer('size_pct').notNull().default(50),
  printKey: text('print_key').notNull(),
  thumbKey: text('thumb_key').notNull(),
  /** Square crop used in the PDF picture grid (null for images imported before it existed). */
  gridKey: text('grid_key'),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [index('document_images_doc_idx').on(t.documentId, t.position)]);

/** Rendered PDFs, keyed by a hash of everything that affects the output. */
export const generatedPdfs = v2.table('generated_pdfs', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  mode: varchar('mode', { length: 20 }).$type<'letterhead' | 'stationery'>().notNull(),
  contentHash: varchar('content_hash', { length: 64 }).notNull(),
  storageKey: text('storage_key').notNull(),
  pageCount: integer('page_count').notNull(),
  byteSize: integer('byte_size').notNull(),
  renderMs: integer('render_ms').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex('generated_pdfs_doc_hash_idx').on(t.documentId, t.mode, t.contentHash)]);

export const auditLog = v2.table('audit_log', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 64 }).notNull(),
  entityType: varchar('entity_type', { length: 32 }),
  entityId: uuid('entity_id'),
  meta: jsonb('meta'),
  ip: varchar('ip', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [index('audit_log_created_idx').on(t.createdAt)]);
