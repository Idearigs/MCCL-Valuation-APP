import { z } from 'zod';

const bool = z.enum(['true', 'false']).default('false').transform(v => v === 'true');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(5000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z.string().min(1),
  PG_SSL: bool,

  /** Public origin of the app, e.g. https://valuation.example.co.uk. Used for CSRF origin checks. */
  APP_ORIGIN: z.url().optional(),
  /** Directory holding the built web app, served by the API in production. */
  WEB_DIST_DIR: z.string().optional(),

  // ── Auth ──
  /** Sliding idle timeout for a signed-in session. */
  SESSION_TTL_HOURS: z.coerce.number().positive().default(12),
  PIN_LENGTH: z.coerce.number().int().min(4).max(8).default(4),
  /** Secret mixed into PIN hashes. Changing it invalidates every PIN. */
  PIN_PEPPER: z.string().min(32),
  /** First user, created on startup when ADMIN_PIN is set and the user doesn't exist yet. */
  ADMIN_NAME: z.string().default('Owner'),
  ADMIN_EMAIL: z.email().default('owner@mccullochjewellers.co.uk'),
  ADMIN_PIN: z.string().regex(/^\d{4,8}$/).optional(),

  // ── File storage ──
  STORAGE_DRIVER: z.enum(['local', 'r2']).default('local'),
  LOCAL_STORAGE_DIR: z.string().default('.data/files'),
  /** Signs local-driver file URLs. */
  FILE_URL_SECRET: z.string().min(32).optional(),
  R2_ENDPOINT: z.url().optional(),
  R2_BUCKET: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),

  // ── PDF rendering ──
  /** `gotenberg` in production (shared container); `chrome` drives a local Chrome for dev/tests. */
  PDF_RENDERER: z.enum(['chrome', 'gotenberg']).default('chrome'),
  /** e.g. http://gotenberg:3000 on the Coolify network. */
  GOTENBERG_URL: z.url().optional(),
  /** Chrome/Chromium binary for PDF_RENDERER=chrome. Defaults to the installed Google Chrome. */
  CHROME_PATH: z.string().optional(),
  /** Blank space kept for pre-printed letterhead paper (stationery mode). */
  STATIONERY_TOP_MM: z.coerce.number().min(0).max(150).default(65),
  STATIONERY_BOTTOM_MM: z.coerce.number().min(0).max(150).default(35),

  SENTRY_DSN: z.string().optional(),
}).superRefine((env, ctx) => {
  if (env.PDF_RENDERER === 'gotenberg' && !env.GOTENBERG_URL) {
    ctx.addIssue({ code: 'custom', path: ['GOTENBERG_URL'], message: 'required when PDF_RENDERER=gotenberg' });
  }
  if (env.STORAGE_DRIVER === 'r2') {
    for (const key of ['R2_ENDPOINT', 'R2_BUCKET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'] as const) {
      if (!env[key]) ctx.addIssue({ code: 'custom', path: [key], message: 'required when STORAGE_DRIVER=r2' });
    }
  } else if (!env.FILE_URL_SECRET) {
    ctx.addIssue({ code: 'custom', path: ['FILE_URL_SECRET'], message: 'required when STORAGE_DRIVER=local' });
  }
  if (env.ADMIN_PIN && env.ADMIN_PIN.length !== env.PIN_LENGTH) {
    ctx.addIssue({ code: 'custom', path: ['ADMIN_PIN'], message: `must be ${env.PIN_LENGTH} digits (PIN_LENGTH)` });
  }
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
