import path from 'node:path';
import { existsSync } from 'node:fs';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { rateLimit } from 'express-rate-limit';
import { sql } from 'drizzle-orm';
import type { Env } from './env';
import type { Logger } from './logger';
import type { Db } from './db/client';
import type { Storage } from './storage';
import { LocalStorage } from './storage/local';
import { createAuthService } from './auth/service';
import { cookieHelpers, loadSession, requireAuth, requireSameOrigin } from './auth/middleware';
import { authRouter } from './auth/routes';
import { createDocumentsRepo } from './documents/repo';
import { documentsRouter } from './documents/routes';
import { imagesRouter } from './images/routes';
import type { PdfRenderer } from './pdf/renderer';
import { createPdfService } from './pdf/service';
import { pdfRouter, pdfToolsRouter } from './pdf/routes';
import { errorHandler, notFoundHandler } from './http/errors';

export interface AppDeps {
  env: Env;
  db: Db;
  storage: Storage;
  logger: Logger;
  renderer: PdfRenderer;
}

export function createApp({ env, db, storage, logger, renderer }: AppDeps) {
  const app = express();
  const secureCookies = env.NODE_ENV === 'production';
  const sessionTtlMs = env.SESSION_TTL_HOURS * 3_600_000;

  const auth = createAuthService(db, { sessionTtlMs, pinPepper: env.PIN_PEPPER });
  const cookies = cookieHelpers({ secure: secureCookies, sessionTtlMs });
  const repo = createDocumentsRepo(db, storage);
  const pdf = createPdfService({
    db, repo, storage, renderer, logger,
    stationeryMargins: { top: env.STATIONERY_TOP_MM, bottom: env.STATIONERY_BOTTOM_MM },
  });

  app.set('trust proxy', 1); // behind Coolify's Traefik proxy
  app.disable('x-powered-by');

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        'img-src': ["'self'", 'data:', 'blob:', ...storage.origins],
        // errors.buymediamonds.co.uk: the shared error hub the web app reports crashes to.
        'connect-src': ["'self'", ...storage.origins, 'https://*.ingest.sentry.io', 'https://*.ingest.us.sentry.io', 'https://errors.buymediamonds.co.uk'],
        'worker-src': ["'self'", 'blob:'],
      },
    },
  }));

  // ── Unauthenticated endpoints ──
  app.get('/health', (_req, res) => { res.json({ status: 'ok' }); });
  app.get('/ready', async (_req, res) => {
    try {
      await db.execute(sql`select 1`);
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'database unavailable' });
    }
  });

  app.use('/api', pinoHttp({
    logger,
    customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
    autoLogging: { ignore: req => req.url?.startsWith('/api/files/') ?? false },
    serializers: {
      req: req => ({ id: req.id, method: req.method, url: req.url?.split('?')[0], ip: req.remoteAddress }),
      res: res => ({ statusCode: res.statusCode }),
    },
  }));
  app.use('/api', rateLimit({
    windowMs: 60_000, limit: 600, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'Too many requests' },
  }));
  app.use('/api', express.json({ limit: '3mb' }));
  app.use('/api', cookieParser());
  app.use('/api', requireSameOrigin(env.APP_ORIGIN));

  if (storage instanceof LocalStorage) app.use('/api/files', storage.router());

  app.use('/api', loadSession(auth, cookies));
  app.use('/api/auth', authRouter({ db, auth, cookies, pinLength: env.PIN_LENGTH, pinPepper: env.PIN_PEPPER }));

  // ── Authenticated API ──
  app.use('/api/documents', requireAuth, documentsRouter({ db, repo }));
  app.use('/api/documents/:id', requireAuth, imagesRouter({ db, repo, storage }));
  app.use('/api/documents/:id', requireAuth, pdfRouter({ db, pdf }));
  app.use('/api/pdf', requireAuth, pdfToolsRouter({ pdf }));
  app.use('/api', notFoundHandler);

  // ── Web app (production) ──
  if (env.WEB_DIST_DIR && existsSync(env.WEB_DIST_DIR)) {
    const dist = path.resolve(env.WEB_DIST_DIR);
    // Hashed assets are immutable; index.html must never be cached.
    app.use('/assets', express.static(path.join(dist, 'assets'), { immutable: true, maxAge: '1y' }));
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.get('/{*path}', (_req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      res.sendFile(path.join(dist, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
