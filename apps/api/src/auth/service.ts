import { and, eq, gt, sql } from 'drizzle-orm';
import type { SessionUser } from '@mccl/shared';
import type { Db } from '../db/client';
import { pinThrottle, sessions, users } from '../db/schema';
import { hashPin, hashToken, newToken } from './crypto';

export interface AuthConfig {
  sessionTtlMs: number;
  pinPepper: string;
}

/**
 * Wrong-PIN protection. A 4-digit PIN works from any device, so guesses are slowed down:
 *  - per IP: 5 free tries, then a short pause that grows 5s → 10s → 20s → 30s (max)
 *  - globally: 25 wrong tries from everywhere combined, then the same short pauses
 * A typo never locks anyone out for long; trying all 10,000 PINs becomes impractical.
 * Counters reset after a correct PIN or 15 quiet minutes.
 */
export const PIN_LIMITS = {
  ip: { free: 5 },
  global: { free: 25 },
  maxCooldownS: 30,
  decayMs: 15 * 60_000,
};

export function pinCooldownSeconds(failures: number, free: number): number {
  if (failures < free) return 0;
  return Math.min(5 * 2 ** (failures - free), PIN_LIMITS.maxCooldownS);
}

const toSessionUser = (u: typeof users.$inferSelect): SessionUser =>
  ({ id: u.id, email: u.email, name: u.name, role: u.role });

export function createAuthService(db: Db, cfg: AuthConfig) {
  return {
    async createSession(userId: string, meta: { ip?: string; userAgent?: string }) {
      const token = newToken();
      await db.insert(sessions).values({
        tokenHash: hashToken(token),
        userId,
        expiresAt: new Date(Date.now() + cfg.sessionTtlMs),
        ip: meta.ip?.slice(0, 64),
        userAgent: meta.userAgent?.slice(0, 500),
      });
      return token;
    },

    /** Resolves a session cookie; slides the expiry forward at most once a minute. */
    async resolveSession(token: string) {
      const [row] = await db
        .select({ session: sessions, user: users })
        .from(sessions)
        .innerJoin(users, eq(users.id, sessions.userId))
        .where(and(
          eq(sessions.tokenHash, hashToken(token)),
          gt(sessions.expiresAt, new Date()),
          eq(users.active, true),
        ))
        .limit(1);
      if (!row) return null;

      let refreshed = false;
      if (Date.now() - row.session.lastSeenAt.getTime() > 60_000) {
        await db.update(sessions)
          .set({ lastSeenAt: new Date(), expiresAt: new Date(Date.now() + cfg.sessionTtlMs) })
          .where(eq(sessions.id, row.session.id));
        refreshed = true;
      }
      return { sessionId: row.session.id, user: toSessionUser(row.user), refreshed };
    },

    async deleteSession(sessionId: string) {
      await db.delete(sessions).where(eq(sessions.id, sessionId));
    },

    /**
     * Checks a PIN under the per-IP and global throttles. The throttle rows are locked for
     * the check, so a burst of parallel guesses can't get around the pauses.
     */
    attemptPin(ip: string, pin: string):
      Promise<{ ok: true; user: SessionUser } | { ok: false; retryAfter: number }> {
      const keys = { ip: `ip:${ip}`, global: 'global' };
      return db.transaction(async tx => {
        const now = Date.now();
        await tx.insert(pinThrottle).values([{ key: keys.global }, { key: keys.ip }]).onConflictDoNothing();
        // Lock in a fixed order (global first) so concurrent requests can't deadlock.
        const [global] = await tx.select().from(pinThrottle).where(eq(pinThrottle.key, keys.global)).for('update');
        const [byIp] = await tx.select().from(pinThrottle).where(eq(pinThrottle.key, keys.ip)).for('update');

        const blockedFor = Math.max(
          (global?.blockedUntil?.getTime() ?? 0) - now,
          (byIp?.blockedUntil?.getTime() ?? 0) - now,
        );
        if (blockedFor > 0) return { ok: false as const, retryAfter: Math.ceil(blockedFor / 1000) };

        const [user] = await tx.select().from(users)
          .where(and(eq(users.pinHash, hashPin(cfg.pinPepper, pin)), eq(users.active, true)))
          .limit(1);

        if (user) {
          await tx.update(pinThrottle).set({ failures: 0, blockedUntil: null, updatedAt: new Date() })
            .where(sql`${pinThrottle.key} in (${keys.ip}, ${keys.global})`);
          return { ok: true as const, user: toSessionUser(user) };
        }

        const fresh = (row?: typeof global) =>
          row && now - row.updatedAt.getTime() < PIN_LIMITS.decayMs ? row.failures : 0;
        const ipFailures = fresh(byIp) + 1;
        const globalFailures = fresh(global) + 1;
        const ipCooldown = pinCooldownSeconds(ipFailures, PIN_LIMITS.ip.free);
        const globalCooldown = pinCooldownSeconds(globalFailures, PIN_LIMITS.global.free);
        const until = (s: number) => (s > 0 ? new Date(now + s * 1000) : null);
        await tx.update(pinThrottle).set({ failures: ipFailures, blockedUntil: until(ipCooldown), updatedAt: new Date() })
          .where(eq(pinThrottle.key, keys.ip));
        await tx.update(pinThrottle).set({ failures: globalFailures, blockedUntil: until(globalCooldown), updatedAt: new Date() })
          .where(eq(pinThrottle.key, keys.global));
        return { ok: false as const, retryAfter: Math.max(ipCooldown, globalCooldown) };
      });
    },

    async findUserByPin(pin: string) {
      const [user] = await db.select().from(users).where(eq(users.pinHash, hashPin(cfg.pinPepper, pin))).limit(1);
      return user ?? null;
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
