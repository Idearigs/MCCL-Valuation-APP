import path from 'node:path';
import { readdir, rm } from 'node:fs/promises';
import EmbeddedPostgres from 'embedded-postgres';
import type { TestProject } from 'vitest/node';

const PORT = 54331;

/** Starts a throwaway PostgreSQL for the test run. */
export default async function setup(project: TestProject) {
  // A fresh folder per run: an interrupted earlier run can't block this one (on Windows
  // Postgres ties its shared memory to the data folder path).
  const root = path.resolve(import.meta.dirname, '../../../.data');
  await Promise.all((await readdir(root).catch(() => []))
    .filter(d => d.startsWith('test-pg'))
    .map(d => rm(path.join(root, d), { recursive: true, force: true }).catch(() => undefined)));
  const dataDir = path.join(root, `test-pg-${process.pid}`);

  const pg = new EmbeddedPostgres({
    databaseDir: dataDir, user: 'test', password: 'test', port: PORT, persistent: false,
    // Match production: UTF-8, locale-independent collation.
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: () => {},
    onError: () => {},
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('mccl_test');
  project.provide('databaseUrl', `postgres://test:test@localhost:${PORT}/mccl_test`);

  return async () => {
    await pg.stop();
  };
}

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}
