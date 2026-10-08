import type { CookieOptions, NextFunction, Request, RequestHandler, Response } from 'express';
import { HttpError } from '../http/errors';
import type { AuthService } from './service';

export interface CookieConfig {
  secure: boolean;
  sessionTtlMs: number;
}

/** `__Host-` cookies are bound to this exact origin; the prefix requires Secure. */
export const cookieNames = (secure: boolean) => ({
  session: secure ? '__Host-mccl_sid' : 'mccl_sid',
});

export function cookieHelpers(cfg: CookieConfig) {
  const names = cookieNames(cfg.secure);
  const base: CookieOptions = { httpOnly: true, secure: cfg.secure, sameSite: 'strict', path: '/' };
  return {
    names,
    setSession: (res: Response, token: string) =>
      res.cookie(names.session, token, { ...base, maxAge: cfg.sessionTtlMs }),
    clearSession: (res: Response) => res.clearCookie(names.session, base),
  };
}

export type Cookies = ReturnType<typeof cookieHelpers>;

/** Attaches req.user from the session cookie. Never rejects on its own. */
export function loadSession(auth: AuthService, cookies: Cookies): RequestHandler {
  return async (req, res, next) => {
    const sessionToken = req.cookies?.[cookies.names.session];
    if (sessionToken) {
      const session = await auth.resolveSession(sessionToken);
      if (session) {
        req.user = session.user;
        req.sessionId = session.sessionId;
        if (session.refreshed) cookies.setSession(res, sessionToken);
      } else {
        cookies.clearSession(res);
      }
    }
    next();
  };
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(new HttpError(401, 'Not signed in'));
  next();
};

/**
 * CSRF defence in depth on top of SameSite=Strict cookies: state-changing requests
 * must come from our own origin.
 */
export function requireSameOrigin(appOrigin?: string): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.get('origin');
    if (!origin) return next(); // non-browser clients (and same-origin requests in some browsers)
    const allowed = appOrigin ?? `${req.protocol}://${req.get('host')}`;
    if (origin !== allowed) return next(new HttpError(403, 'Cross-origin request blocked'));
    next();
  };
}
