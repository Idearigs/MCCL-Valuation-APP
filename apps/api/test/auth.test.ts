import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PIN_LIMITS, pinCooldownSeconds } from '../src/auth/service';
import { ADMIN, STAFF, setupTestApp, signedInAgent } from './helpers';

let ctx: Awaited<ReturnType<typeof setupTestApp>>;

beforeEach(async () => {
  await ctx?.close();
  ctx = await setupTestApp();
});
afterAll(() => ctx?.close());

/** Each "client" gets its own IP so per-IP throttling can be tested (trust proxy is on). */
const from = (ip: string) => ({ 'X-Forwarded-For': ip });

describe('PIN login', () => {
  it('reports signed-out status and the PIN length', async () => {
    const res = await request(ctx.app).get('/api/auth/status');
    expect(res.body).toEqual({ user: null, pinLength: 4 });
  });

  it('signs each user in by their own PIN, from any device', async () => {
    const owner = await signedInAgent(ctx.app, ADMIN.pin);
    expect((await owner.get('/api/auth/status')).body.user).toMatchObject({ email: ADMIN.email, role: 'admin' });
    const partner = await signedInAgent(ctx.app, STAFF.pin);
    expect((await partner.get('/api/auth/status')).body.user.email).toBe(STAFF.email);
    expect((await partner.get('/api/documents')).status).toBe(200);
  });

  it('sets a hardened session cookie', async () => {
    const res = await request(ctx.app).post('/api/auth/pin').send({ pin: ADMIN.pin });
    const cookie = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find(c => c.startsWith('mccl_sid='));
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
  });

  it('rejects a wrong PIN', async () => {
    const res = await request(ctx.app).post('/api/auth/pin').send({ pin: '0000' });
    expect(res.status).toBe(401);
  });

  it('pauses briefly after 5 wrong PINs from one place, never a long lockout', async () => {
    for (let i = 0; i < 4; i++) {
      expect((await request(ctx.app).post('/api/auth/pin').set(from('10.0.0.1')).send({ pin: '0000' })).status).toBe(401);
    }
    const fifth = await request(ctx.app).post('/api/auth/pin').set(from('10.0.0.1')).send({ pin: '0000' });
    expect(fifth.status).toBe(429);
    expect(fifth.body.retryAfter).toBe(5);
    // Even the right PIN waits out the short pause…
    expect((await request(ctx.app).post('/api/auth/pin').set(from('10.0.0.1')).send({ pin: ADMIN.pin })).status).toBe(429);
    // …but someone on another connection is unaffected.
    expect((await request(ctx.app).post('/api/auth/pin').set(from('10.0.0.2')).send({ pin: ADMIN.pin })).status).toBe(200);
  });

  it('caps wrong guesses from everywhere combined', async () => {
    // An attacker spreading guesses over many IPs still hits the global limit.
    let lastStatus = 0;
    for (let i = 0; i < PIN_LIMITS.global.free; i++) {
      lastStatus = (await request(ctx.app).post('/api/auth/pin').set(from(`10.1.0.${i}`)).send({ pin: '0000' })).status;
    }
    expect(lastStatus).toBe(429);
    expect((await request(ctx.app).post('/api/auth/pin').set(from('10.2.0.1')).send({ pin: '9999' })).status).toBe(429);
  });

  it('pauses grow but never exceed 30 seconds', () => {
    expect([4, 5, 6, 7, 8, 50].map(n => pinCooldownSeconds(n, 5))).toEqual([0, 5, 10, 20, 30, 30]);
  });

  it('serialises parallel guesses so a burst cannot skip the pause', async () => {
    const results = await Promise.all(Array.from({ length: 12 }, () =>
      request(ctx.app).post('/api/auth/pin').set(from('10.3.0.1')).send({ pin: '9999' })));
    expect(results.filter(r => r.status === 401).length).toBeLessThanOrEqual(4);
  });
});

describe('sessions', () => {
  it('protects the API when signed out', async () => {
    expect((await request(ctx.app).get('/api/documents')).status).toBe(401);
  });

  it('logout ends the session', async () => {
    const agent = await signedInAgent(ctx.app);
    await agent.post('/api/auth/logout').expect(204);
    expect((await agent.get('/api/documents')).status).toBe(401);
  });

  it('blocks cross-origin writes', async () => {
    const agent = await signedInAgent(ctx.app);
    expect((await agent.post('/api/auth/logout').set('Origin', 'https://evil.example')).status).toBe(403);
  });
});

describe('changing a PIN', () => {
  it('requires the current PIN and refuses a PIN the other user has', async () => {
    const agent = await signedInAgent(ctx.app);
    expect((await agent.put('/api/auth/pin').send({ currentPin: '9999', newPin: '2468' })).status).toBe(401);
    expect((await agent.put('/api/auth/pin').send({ currentPin: ADMIN.pin, newPin: STAFF.pin })).status).toBe(409);
    await agent.put('/api/auth/pin').send({ currentPin: ADMIN.pin, newPin: '2468' }).expect(204);
    expect((await request(ctx.app).post('/api/auth/pin').send({ pin: '2468' })).status).toBe(200);
    expect((await request(ctx.app).post('/api/auth/pin').send({ pin: ADMIN.pin })).status).toBe(401);
  });
});
