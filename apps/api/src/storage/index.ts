import type { Env } from '../env';
import { LocalStorage } from './local';
import { R2Storage } from './r2';
import type { Storage } from './types';

export { DEFAULT_URL_TTL, type Storage } from './types';

export function createStorage(env: Env): Storage {
  if (env.STORAGE_DRIVER === 'r2') {
    return new R2Storage({
      endpoint: env.R2_ENDPOINT!,
      bucket: env.R2_BUCKET!,
      accessKeyId: env.R2_ACCESS_KEY_ID!,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    });
  }
  return new LocalStorage(env.LOCAL_STORAGE_DIR, env.FILE_URL_SECRET!);
}
