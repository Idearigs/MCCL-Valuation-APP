import type { SessionUser } from '@mccl/shared';

declare global {
  namespace Express {
    interface Request {
      /** Set by loadSession when a valid session cookie is present. */
      user?: SessionUser;
      sessionId?: string;
    }
  }
}

export {};
