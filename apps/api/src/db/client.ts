import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import * as schema from './schema';

// Return DATE columns as plain 'YYYY-MM-DD' strings. The v1 app converted them to
// JS Dates, which shift by a day depending on the server timezone.
pg.types.setTypeParser(pg.types.builtins.DATE, v => v);

export function createDb(databaseUrl: string, ssl = false) {
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    ssl: ssl ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  const db = drizzle(pool, { schema });
  return { db, pool };
}

export type Db = ReturnType<typeof createDb>['db'];

/** Migrations live in apps/api/drizzle (dev/tests) or next to the bundle (dist/../drizzle). */
export async function runMigrations(db: Db) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [path.resolve(here, '../../drizzle'), path.resolve(here, '../drizzle')];
  const { existsSync } = await import('node:fs');
  const migrationsFolder = candidates.find(p => existsSync(path.join(p, 'meta', '_journal.json')));
  if (!migrationsFolder) throw new Error(`Migrations folder not found (looked in ${candidates.join(', ')})`);
  // Migration bookkeeping also stays inside the v2 schema.
  await migrate(db, { migrationsFolder, migrationsSchema: 'v2' });
}
