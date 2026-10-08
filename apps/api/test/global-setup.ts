import path from 'node:path';
import { rm } from 'node:fs/promises';
import EmbeddedPostgres from 'embedded-postgres';
import type { TestProject } from 'vitest/node';

const PORT = 54331;

/** Starts a throwaway PostgreSQL for the test run. */
export default async function setup(project: TestProject) {
  const dataDir = path.resolve(import.meta.dirname, '../../../.data/test-pg');
  await rm(dataDir, { recursive: true, force: true });

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
