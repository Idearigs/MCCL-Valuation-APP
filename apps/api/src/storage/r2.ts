import {
  DeleteObjectsCommand, GetObjectCommand, PutObjectCommand, S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DEFAULT_URL_TTL, type Storage } from './types';

export interface R2Config {
  /** https://<account-id>.r2.cloudflarestorage.com (no bucket in the path) */
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/** Cloudflare R2 via its S3-compatible API. The bucket must stay private. */
export class R2Storage implements Storage {
  private readonly client: S3Client;
  private readonly bucket: string;
  readonly origins: string[];

  constructor(cfg: R2Config) {
    this.bucket = cfg.bucket;
    this.client = new S3Client({
      region: 'auto',
      endpoint: cfg.endpoint,
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    });
    this.origins = [new URL(cfg.endpoint).origin];
  }

  async put(key: string, body: Buffer, contentType: string) {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket, Key: key, Body: body, ContentType: contentType,
    }));
  }

  async get(key: string) {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return Buffer.from(await res.Body!.transformToByteArray());
  }

  async delete(keys: string[]) {
    if (keys.length === 0) return;
    for (let i = 0; i < keys.length; i += 1000) {
      await this.client.send(new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: { Objects: keys.slice(i, i + 1000).map(Key => ({ Key })), Quiet: true },
      }));
    }
  }

  signedUrl(key: string, ttlSeconds = DEFAULT_URL_TTL) {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: ttlSeconds,
    });
  }
}
