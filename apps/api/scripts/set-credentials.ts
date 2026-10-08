/**
 * Create a user or change their PIN from the command line.
 *   npx tsx --env-file=.env scripts/set-credentials.ts <email> --pin <digits> [--name "Jo"] [--role admin|staff]
 * In production (Coolify terminal): node dist/set-credentials.js <email> --pin <digits> ...
 */
import { parseArgs } from 'node:util';
import { eq } from 'drizzle-orm';
import { loadEnv } from '../src/env';
import { createDb } from '../src/db/client';
import { users } from '../src/db/schema';
import { hashPin } from '../src/auth/crypto';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    name: { type: 'string' },
    role: { type: 'string' },
    pin: { type: 'string' },
  },
});

const email = positionals[0]?.toLowerCase();
if (!email) {
  console.error('Usage: set-credentials.ts <email> --pin <digits> [--name] [--role admin|staff]');
  process.exit(1);
}
const env = loadEnv();
if (values.pin && (!/^\d+$/.test(values.pin) || values.pin.length !== env.PIN_LENGTH)) {
  console.error(`PIN must be exactly ${env.PIN_LENGTH} digits`);
  process.exit(1);
}
if (values.role && values.role !== 'admin' && values.role !== 'staff') {
  console.error('role must be admin or staff');
  process.exit(1);
}

const { db, pool } = createDb(env.DATABASE_URL, env.PG_SSL);
const patch = {
  ...(values.name && { name: values.name }),
  ...(values.role && { role: values.role as 'admin' | 'staff' }),
  ...(values.pin && { pinHash: hashPin(env.PIN_PEPPER, values.pin) }),
};

const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
if (existing) {
  await db.update(users).set({ ...patch, updatedAt: new Date() }).where(eq(users.id, existing.id));
  console.log(`Updated ${email}`);
} else {
  await db.insert(users).values({ email, ...patch });
  console.log(`Created ${email}`);
}
await pool.end();
