import { eq } from 'drizzle-orm';
import type { Env } from './env';
import type { Logger } from './logger';
import type { Db } from './db/client';
import { users } from './db/schema';
import { hashPin } from './auth/crypto';

/** Creates the first user from ADMIN_* env vars. Never overwrites an existing user. */
export async function seedAdmin(db: Db, env: Env, logger: Logger) {
  if (!env.ADMIN_PIN) return;
  const email = env.ADMIN_EMAIL.toLowerCase();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return;
  await db.insert(users).values({
    email,
    name: env.ADMIN_NAME,
    role: 'admin',
    pinHash: hashPin(env.PIN_PEPPER, env.ADMIN_PIN),
  });
  logger.info({ name: env.ADMIN_NAME }, 'First user created');
}
