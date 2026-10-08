import { createHash, createHmac, randomBytes } from 'node:crypto';

/** Opaque bearer token for cookies. Only its SHA-256 is stored. */
export const newToken = () => randomBytes(32).toString('base64url');

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * PINs are too short for a slow hash to add real protection. Instead they are keyed with a
 * server-side pepper (kept out of the database), which makes login a single indexed lookup
 * and makes a leaked database useless without the environment secret.
 */
export const hashPin = (pepper: string, pin: string) =>
  createHmac('sha256', pepper).update(`pin:${pin}`).digest('hex');
