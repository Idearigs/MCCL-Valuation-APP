import * as Sentry from '@sentry/node';
import { loadEnv } from './env';
import { createLogger } from './logger';
import { createDb, runMigrations } from './db/client';
import { createStorage } from './storage';
import { seedAdmin } from './seed';
import { createApp } from './app';
import { ChromeRenderer, GotenbergRenderer } from './pdf/renderer';

const env = loadEnv();
const logger = createLogger(env);

async function main() {
  const { db, pool } = createDb(env.DATABASE_URL, env.PG_SSL);
  await runMigrations(db);
  await seedAdmin(db, env, logger);

  const storage = createStorage(env);
  const renderer = env.PDF_RENDERER === 'gotenberg'
    ? new GotenbergRenderer(env.GOTENBERG_URL!)
    : new ChromeRenderer(env.CHROME_PATH);
  const app = createApp({ env, db, storage, logger, renderer });
  if (env.SENTRY_DSN) Sentry.setupExpressErrorHandler(app);

  const server = app.listen(env.PORT, '0.0.0.0', () => {
    logger.info({ port: env.PORT, storage: env.STORAGE_DRIVER }, 'MCCL Valuation API listening');
  });

  // Graceful shutdown so Coolify redeploys don't cut off in-flight saves/uploads.
  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    server.close(() => {
      Promise.allSettled([renderer.close(), pool.end()]).finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 15_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch(err => {
  logger.fatal({ err }, 'Failed to start');
  process.exit(1);
});
