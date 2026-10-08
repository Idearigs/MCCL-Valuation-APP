import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import { DEFAULT_URL_TTL, type Storage } from './types';

/**
 * Filesystem storage for development and tests. Mimics R2's presigned URLs with an
 * HMAC-signed `/api/files/*` route so the rest of the app behaves identically.
 */
export class LocalStorage implements Storage {
  readonly origins: string[] = [];

  constructor(private readonly dir: string, private readonly secret: string) {}

  private pathFor(key: string) {
    const full = path.resolve(this.dir, key);
    if (!full.startsWith(path.resolve(this.dir) + path.sep)) throw new Error('Invalid storage key');
    return full;
  }

  private sign(key: string, exp: number) {
    return createHmac('sha256', this.secret).update(`${key}\n${exp}`).digest('base64url');
  }

  async put(key: string, body: Buffer) {
    const file = this.pathFor(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
  }

  get(key: string) {
    return readFile(this.pathFor(key));
  }

  async delete(keys: string[]) {
    await Promise.all(keys.map(k => rm(this.pathFor(k), { force: true })));
  }

  async signedUrl(key: string, ttlSeconds = DEFAULT_URL_TTL) {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    return `/api/files/${key}?exp=${exp}&sig=${this.sign(key, exp)}`;
  }

  /** Serves files for signed URLs. Mounted at /api/files. */
  router() {
    const router = Router();
    router.get('/{*key}', async (req, res) => {
      const key = ([] as string[]).concat(req.params.key ?? []).join('/');
      const exp = Number(req.query.exp);
      const sig = Buffer.from(String(req.query.sig ?? ''));
      const expected = Buffer.from(this.sign(key, exp));
      if (!Number.isFinite(exp) || exp < Date.now() / 1000
        || sig.length !== expected.length || !timingSafeEqual(sig, expected)) {
        res.status(403).json({ error: 'Invalid or expired link' });
        return;
      }
      try {
        const body = await this.get(key);
        res.type(path.extname(key) || 'application/octet-stream');
        res.setHeader('Cache-Control', 'private, max-age=3600');
        res.send(body);
      } catch {
        res.status(404).json({ error: 'Not found' });
      }
    });
    return router;
  }
}
