import { describe, expect, it } from 'vitest';
import { loadEnv, withLegacyFallbacks } from '../src/env';

// The settings the live (v1) app already has in Coolify.
const v1Settings = {
  NODE_ENV: 'production',
  PG_HOST: 'db.internal', PG_PORT: '5432', PG_DATABASE: 'vludb', PG_USERNAME: 'vluapp', PG_PASSWORD: 'p@ss/word',
  JWT_SECRET: 'a-long-existing-jwt-secret-from-v1',
  ADMIN_EMAIL: 'has@mccullochjewellers.co.uk',
  ADMIN_PASSWORD: '2535',
};

describe('running on the live app\'s existing settings', () => {
  it('starts with no new variables', () => {
    const env = loadEnv(v1Settings);
    expect(env.DATABASE_URL).toBe('postgres://vluapp:p%40ss%2Fword@db.internal:5432/vludb');
    expect(env.PIN_PEPPER.length).toBeGreaterThanOrEqual(32);
    expect(env.FILE_URL_SECRET!.length).toBeGreaterThanOrEqual(32);
    expect(env.ADMIN_PIN).toBe('2535');
  });

  it('derives the same secrets on every start (PINs and links survive redeploys)', () => {
    expect(loadEnv(v1Settings).PIN_PEPPER).toBe(loadEnv(v1Settings).PIN_PEPPER);
    expect(loadEnv(v1Settings).PIN_PEPPER).not.toBe(loadEnv(v1Settings).FILE_URL_SECRET);
  });

  it('prefers explicitly set variables', () => {
    const env = withLegacyFallbacks({ ...v1Settings, DATABASE_URL: 'postgres://x/y', ADMIN_PIN: '9999', PIN_PEPPER: 'explicit' });
    expect(env.DATABASE_URL).toBe('postgres://x/y');
    expect(env.ADMIN_PIN).toBe('9999');
    expect(env.PIN_PEPPER).toBe('explicit');
  });

  it('ignores an ADMIN_PASSWORD that is not a PIN', () => {
    expect(withLegacyFallbacks({ ...v1Settings, ADMIN_PASSWORD: 'not-a-pin' }).ADMIN_PIN).toBeUndefined();
  });
});
