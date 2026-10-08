/** Private object storage. Files are only ever exposed through short-lived signed URLs. */
export interface Storage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(keys: string[]): Promise<void>;
  signedUrl(key: string, ttlSeconds?: number): Promise<string>;
  /** Origin(s) signed URLs point at, for the CSP img-src directive. */
  readonly origins: string[];
}

export const DEFAULT_URL_TTL = 6 * 60 * 60;
