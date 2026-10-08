import type SharpFactory from 'sharp';
import type { Sharp } from 'sharp';
import { HttpError } from '../http/errors';

/**
 * sharp is loaded on first use, not at startup: if its native library can't load on a
 * server (and the WebAssembly fallback is missing too), the app still starts and only
 * photo processing reports an error.
 */
let sharpModule: Promise<typeof SharpFactory> | undefined;
function loadSharp(): Promise<typeof SharpFactory> {
  sharpModule ??= import('sharp').then(m => {
    const sharp = m.default;
    // Keep sharp's memory bounded on small containers.
    sharp.cache({ memory: 64, items: 20 });
    sharp.concurrency(2);
    return sharp;
  }).catch(err => {
    sharpModule = undefined;
    console.error('Image processing (sharp) failed to load:', err);
    throw new HttpError(503, 'Image processing is unavailable on this server');
  });
  return sharpModule;
}

/** Print variant: ~200 dpi at the largest size an image is shown on A4. */
export const PRINT_MAX_PX = 1600;
export const THUMB_MAX_PX = 400;
/** Picture-grid cells print ~40mm square: 600px is ~380 dpi. */
export const GRID_PX = 600;

export interface ProcessedImage {
  print: Buffer;
  thumb: Buffer;
  grid: Buffer;
  width: number;
  height: number;
}

/**
 * Normalises an upload: verifies it really is an image, applies EXIF rotation, strips
 * all metadata (including GPS location from phone photos) and produces the sizes
 * the app needs.
 */
export async function processPhoto(input: Buffer): Promise<ProcessedImage> {
  const sharp = await loadSharp();
  let base: Sharp;
  try {
    base = sharp(input, { limitInputPixels: 80_000_000, failOn: 'error' }).rotate();
    await base.metadata();
  } catch {
    throw new HttpError(400, 'File is not a supported image');
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
    throw new HttpError(400, 'File is not a supported image');
  }
}

/** Signatures keep transparency and are trimmed to their ink. */
export async function processSignature(input: Buffer): Promise<Buffer> {
  const sharp = await loadSharp();
  try {
    return await sharp(input, { limitInputPixels: 40_000_000, failOn: 'error' })
      .rotate()
      .trim({ threshold: 10 })
      .resize(1200, 400, { fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer();
  } catch {
    throw new HttpError(400, 'File is not a supported image');
  }
}
