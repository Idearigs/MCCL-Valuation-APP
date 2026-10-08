import os from 'node:os';
import path from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import { inject } from 'vitest';
import { createApp } from '../src/app';
import { hashPin } from '../src/auth/crypto';
import { createDb, runMigrations, type Db } from '../src/db/client';
import { users } from '../src/db/schema';
import { loadEnv, type Env } from '../src/env';
import { createLogger } from '../src/logger';
import { LocalStorage } from '../src/storage/local';
import { ChromeRenderer } from '../src/pdf/renderer';

export const ADMIN = { email: 'owner@example.com', pin: '4321' };
export const STAFF = { email: 'partner@example.com', pin: '1111' };

export async function setupTestApp(overrides: Partial<Record<keyof Env, string>> = {}) {
  const env = loadEnv({
    NODE_ENV: 'test',
    DATABASE_URL: inject('databaseUrl'),
    PIN_PEPPER: 'test-pepper-test-pepper-test-pepper-0000',
    FILE_URL_SECRET: 'test-file-secret-test-file-secret-0000',
    STORAGE_DRIVER: 'local',
    LOCAL_STORAGE_DIR: await mkdtemp(path.join(os.tmpdir(), 'mccl-files-')),
    ...overrides,
  });
  const { db, pool } = createDb(env.DATABASE_URL);
  await runMigrations(db);
  await resetDb(db);

  const storage = new LocalStorage(env.LOCAL_STORAGE_DIR, env.FILE_URL_SECRET!);
  const renderer = new ChromeRenderer(env.CHROME_PATH);
  const app = createApp({ env, db, storage, logger: createLogger(env), renderer });

  await db.insert(users).values([
    { email: ADMIN.email, name: 'Owner', role: 'admin', pinHash: hashPin(env.PIN_PEPPER, ADMIN.pin) },
    { email: STAFF.email, name: 'Partner', role: 'staff', pinHash: hashPin(env.PIN_PEPPER, STAFF.pin) },
  ]);

  return { app, db, env, storage, close: async () => { await renderer.close(); await pool.end(); } };
}

export async function resetDb(db: Db) {
  await db.execute(sql`truncate v2.audit_log, v2.generated_pdfs, v2.document_images, v2.documents, v2.sessions, v2.pin_throttle, v2.users restart identity cascade`);
}

type App = Awaited<ReturnType<typeof setupTestApp>>['app'];

/** A browser signed in with the owner's PIN. */
export async function signedInAgent(app: App, pin = ADMIN.pin) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/pin').send({ pin });
  if (res.status !== 200) throw new Error(`PIN sign-in failed: ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}

export function sampleValuation(overrides: Record<string, unknown> = {}) {
  return {
    type: 'valuation',
    documentDate: '2026-09-01',
    scheduleHtml: '<p>18ct yellow gold diamond ring</p>',
    details: {
      customerName: 'Jane Smith',
      customerAddress: '1 High Street\nBeeston',
      pricingRows: [{ id: '1', component: 'Diamond', estimatedValue: '£3,000' }],
      totalRange: '£3,000 – £3,500',
      insuranceValue: '£3,800',
      numberOfItems: '1',
    },
    ...overrides,
  };
}
