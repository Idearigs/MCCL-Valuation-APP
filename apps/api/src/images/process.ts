import { spawn } from 'node:child_process';
import type SharpFactory from 'sharp';
import type { Sharp } from 'sharp';
import { HttpError } from '../http/errors';

/** Print variant: ~200 dpi at the largest size an image is shown on A4. */
export const PRINT_MAX_PX = 1600;
export const THUMB_MAX_PX = 400;
/** Picture-grid cells print ~50mm square: 600px is ~300 dpi. */
export const GRID_PX = 600;

export interface ProcessedImage {
  print: Buffer;
  thumb: Buffer;
  grid: Buffer;
  width: number;
  height: number;
}

interface ImageProcessor {
  name: string;
  photo(input: Buffer): Promise<ProcessedImage>;
  signature(input: Buffer): Promise<Buffer>;
}

const notAnImage = () => new HttpError(400, 'File is not a supported image');

// ── sharp (fast; used when its prebuilt binary can run on this CPU) ──────────────

function sharpProcessor(sharp: typeof SharpFactory): ImageProcessor {
  // Keep sharp's memory bounded on small containers.
  sharp.cache({ memory: 64, items: 20 });
  sharp.concurrency(2);
  return {
    name: 'sharp',
    async photo(input) {
      let base: Sharp;
      try {
        base = sharp(input, { limitInputPixels: 80_000_000, failOn: 'error' }).rotate();
        await base.metadata();
      } catch {
        throw notAnImage();
      }
      try {
        const print = await base.clone()
          .resize(PRINT_MAX_PX, PRINT_MAX_PX, { fit: 'inside', withoutEnlargement: true })
          .flatten({ background: '#ffffff' })
          .jpeg({ quality: 82, mozjpeg: true })
          .toBuffer({ resolveWithObject: true });
        const thumb = await base.clone()
          .resize(THUMB_MAX_PX, THUMB_MAX_PX, { fit: 'inside', withoutEnlargement: true })
          .flatten({ background: '#ffffff' })
          .jpeg({ quality: 75, mozjpeg: true })
          .toBuffer();
        const grid = await base.clone()
          .resize(GRID_PX, GRID_PX, { fit: 'cover', position: 'attention' })
          .flatten({ background: '#ffffff' })
          .jpeg({ quality: 80, mozjpeg: true })
          .toBuffer();
        return { print: print.data, thumb, grid, width: print.info.width, height: print.info.height };
      } catch {
        throw notAnImage();
      }
    },
    async signature(input) {
      try {
        return await sharp(input, { limitInputPixels: 40_000_000, failOn: 'error' })
          .rotate()
          .trim({ threshold: 10 })
          .resize(1200, 400, { fit: 'inside', withoutEnlargement: true })
          .png({ compressionLevel: 9 })
          .toBuffer();
      } catch {
        throw notAnImage();
      }
    },
  };
}

// ── ImageMagick (portable; Debian builds run on any x86-64 CPU) ───────────────────

/** Runs ImageMagick with the image on stdin and returns stdout. */
function magick(cmd: 'convert' | 'identify', args: string[], input: Buffer, limits = true): Promise<Buffer> {
  const limitArgs = limits ? ['-limit', 'memory', '256MiB', '-limit', 'map', '512MiB', '-limit', 'area', '80MP'] : [];
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, [...limitArgs, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    const timer = setTimeout(() => child.kill('SIGKILL'), 60_000);
    child.stdout.on('data', (c: Buffer) => out.push(c));
    child.stderr.on('data', (c: Buffer) => err.push(c));
    child.on('error', e => { clearTimeout(timer); reject(e); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve(Buffer.concat(out));
      else reject(new Error(`${cmd} exited ${code}: ${Buffer.concat(err).toString().slice(0, 300)}`));
    });
    child.stdin.on('error', () => undefined); // process may exit before reading all input
    child.stdin.end(input);
  });
}

/** Read with auto-orientation and no metadata (strips EXIF, including GPS). */
const READ = ['-', '-auto-orient', '-strip'];
const ON_WHITE = ['-background', 'white', '-alpha', 'remove', '-alpha', 'off'];

const magickProcessor: ImageProcessor = {
  name: 'imagemagick',
  async photo(input) {
    try {
      await magick('identify', ['-'], input);
    } catch {
      throw notAnImage();
    }
    try {
      const print = await magick('convert', [...READ, '-resize', `${PRINT_MAX_PX}x${PRINT_MAX_PX}>`, ...ON_WHITE, '-quality', '82', 'jpg:-'], input);
      const thumb = await magick('convert', [...READ, '-resize', `${THUMB_MAX_PX}x${THUMB_MAX_PX}>`, ...ON_WHITE, '-quality', '75', 'jpg:-'], input);
      const grid = await magick('convert', [...READ, '-resize', `${GRID_PX}x${GRID_PX}^`, '-gravity', 'center', '-extent', `${GRID_PX}x${GRID_PX}`, ...ON_WHITE, '-quality', '80', 'jpg:-'], input);
      const [width = 0, height = 0] = (await magick('identify', ['-format', '%w %h', '-'], print)).toString().trim().split(' ').map(Number);
      return { print, thumb, grid, width, height };
    } catch {
      throw notAnImage();
    }
  },
  async signature(input) {
    try {
      return await magick('convert', [...READ, '-fuzz', '4%', '-trim', '+repage', '-resize', '1200x400>', 'png:-'], input);
    } catch {
      throw notAnImage();
    }
  },
};

// ── Selection ─────────────────────────────────────────────────────────────────

/**
 * Picks the image engine on first use: sharp when its prebuilt code can run here,
 * otherwise ImageMagick. Some virtual servers expose a CPU too basic for sharp's
 * native and WebAssembly builds; ImageMagick from Debian runs on any x86-64 CPU.
 * Set IMAGE_PROCESSOR=imagemagick to skip sharp entirely.
 */
let processor: Promise<ImageProcessor> | undefined;
function getProcessor(): Promise<ImageProcessor> {
  processor ??= (async () => {
    if (process.env.IMAGE_PROCESSOR !== 'imagemagick') {
      try {
        const sharp = (await import('sharp')).default;
        // Exercise the library once: loading can "succeed" and still fail on first use.
        await sharp({ create: { width: 2, height: 2, channels: 3, background: '#fff' } }).jpeg().toBuffer();
        return sharpProcessor(sharp);
      } catch (err) {
        console.warn(`sharp is unavailable on this server, using ImageMagick instead (${(err as Error).message.split('\n')[0]})`);
      }
    }
    try {
      // (convert rejects -version after other options, so no limits here)
      await magick('convert', ['-version'], Buffer.alloc(0), false);
    } catch (err) {
      processor = undefined; // allow a retry later
      console.error('No image engine available (sharp and ImageMagick both failed):', err);
      throw new HttpError(503, 'Image processing is unavailable on this server');
    }
    return magickProcessor;
  })();
  return processor;
}

/** Which engine is in use, for diagnostics. */
export async function imageEngine(): Promise<string> {
  return (await getProcessor()).name;
}

/**
 * Normalises an upload: verifies it really is an image, applies EXIF rotation, strips
 * all metadata (including GPS location from phone photos) and produces the sizes
 * the app needs.
 */
export async function processPhoto(input: Buffer): Promise<ProcessedImage> {
  return (await getProcessor()).photo(input);
}

/** Signatures keep transparency and are trimmed to their ink. */
export async function processSignature(input: Buffer): Promise<Buffer> {
  return (await getProcessor()).signature(input);
}
