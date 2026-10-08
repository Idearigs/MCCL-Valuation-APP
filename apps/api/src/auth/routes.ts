import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { eq } from 'drizzle-orm';
import { changePinSchema, pinLoginSchema, type AuthStatus } from '@mccl/shared';
import { audit } from '../audit';
import type { Db } from '../db/client';
import { users } from '../db/schema';
import { HttpError, parse } from '../http/errors';
import { hashPin } from './crypto';
import { requireAuth, type Cookies } from './middleware';
import type { AuthService } from './service';

interface Deps {
  db: Db;
  auth: AuthService;
  cookies: Cookies;
  pinLength: number;
  pinPepper: string;
}

export function authRouter({ db, auth, cookies, pinLength, pinPepper }: Deps) {
  const router = Router();

  // Wrong PINs are throttled in the database (see AuthService.attemptPin); this only stops floods.
  const floodLimiter = rateLimit({
    windowMs: 60_000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'Too many attempts, try again later' },
  });

  router.get('/status', (req, res) => {
    const status: AuthStatus = { user: req.user ?? null, pinLength };
    res.setHeader('Cache-Control', 'no-store');
    res.json(status);
  });

  router.post('/pin', floodLimiter, async (req, res) => {
    const { pin } = parse(pinLoginSchema, req.body);
    const result = await auth.attemptPin(req.ip ?? 'unknown', pin);
    if (!result.ok) {
      audit(db, req, { action: 'auth.pin_failed', meta: { retryAfter: result.retryAfter } }, undefined);
      if (result.retryAfter > 0) res.setHeader('Retry-After', String(result.retryAfter));
      res.status(result.retryAfter > 0 ? 429 : 401).json({ error: 'Incorrect PIN', retryAfter: result.retryAfter });
      return;
    }
    if (req.sessionId) await auth.deleteSession(req.sessionId);
    const token = await auth.createSession(result.user.id, { ip: req.ip, userAgent: req.get('user-agent') });
    cookies.setSession(res, token);
    audit(db, req, { action: 'auth.pin_login' }, result.user.id);
    res.json({ user: result.user });
  });

  router.post('/logout', async (req, res) => {
    if (req.sessionId) await auth.deleteSession(req.sessionId);
    cookies.clearSession(res);
    res.status(204).end();
  });

  router.put('/pin', requireAuth, floodLimiter, async (req, res) => {
    const { currentPin, newPin } = parse(changePinSchema, req.body);
    if (newPin.length !== pinLength) throw new HttpError(400, `PIN must be ${pinLength} digits`);
    const user = await auth.findUserByPin(currentPin);
    if (!user || user.id !== req.user!.id) throw new HttpError(401, 'Current PIN is incorrect');
    try {
      await db.update(users).set({ pinHash: hashPin(pinPepper, newPin), updatedAt: new Date() })
        .where(eq(users.id, user.id));
    } catch (err: unknown) {
      // unique violation: the other user already has this PIN
      const code = (err as { code?: string; cause?: { code?: string } }).cause?.code ?? (err as { code?: string }).code;
      if (code === '23505') throw new HttpError(409, 'That PIN is already in use, choose another');
      throw err;
    }
    audit(db, req, { action: 'auth.pin_changed' });
    res.status(204).end();
  });

  return router;
}
