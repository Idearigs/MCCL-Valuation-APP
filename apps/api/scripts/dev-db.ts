/**
 * Runs a local PostgreSQL server for development without Docker.
 *   npm run db:dev
 * Data lives in .data/dev-pg at the repo root. DATABASE_URL:
 *   postgres://mccl:mccl@localhost:54320/mccl
 */
import path from 'node:path';
import { existsSync } from 'node:fs';
import EmbeddedPostgres from 'embedded-postgres';

const dataDir = path.resolve(import.meta.dirname, '../../../.data/dev-pg');
const fresh = !existsSync(dataDir);

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'mccl',
  password: 'mccl',
  port: 54320,
  persistent: true,
  // Match production: UTF-8, locale-independent collation.
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
});

if (fresh) await pg.initialise();
await pg.start();
if (fresh) await pg.createDatabase('mccl');
console.log('Postgres running: postgres://mccl:mccl@localhost:54320/mccl  (Ctrl+C to stop)');

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
