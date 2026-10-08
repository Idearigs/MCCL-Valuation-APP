import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** apps/api/assets in dev (src/pdf → ../../assets) or /app/assets next to the bundle (dist → ../assets). */
function assetsDir() {
  const dir = [path.resolve(here, '../../assets'), path.resolve(here, '../assets')].find(existsSync);
  if (!dir) throw new Error('PDF assets folder not found');
  return dir;
}

const dataUri = (buf: Buffer, type: string) => `data:${type};base64,${buf.toString('base64')}`;

const FONT_FILES = [
  ['400', 'normal'], ['600', 'normal'], ['700', 'normal'],
  ['400', 'italic'], ['600', 'italic'], ['700', 'italic'],
] as const;

export interface StaticAssets {
  letterheadHeader: string;
  letterheadFooter: string;
  clarityDiagram: string;
  /** @font-face rules with embedded Playfair Display, so output never depends on network fonts. */
  fontCss: string;
}

let cached: Promise<StaticAssets> | undefined;

export function loadStaticAssets(): Promise<StaticAssets> {
  cached ??= (async () => {
    const dir = assetsDir();
    const png = async (name: string) => dataUri(await readFile(path.join(dir, name)), 'image/png');
    const require = createRequire(import.meta.url);
    const fonts = await Promise.all(FONT_FILES.map(async ([weight, style]) => {
      const file = require.resolve(`@fontsource/playfair-display/files/playfair-display-latin-${weight}-${style}.woff2`);
      return `@font-face{font-family:'Playfair Display';font-style:${style};font-weight:${weight};` +
        `src:url(${dataUri(await readFile(file), 'font/woff2')}) format('woff2');}`;
    }));
    return {
      letterheadHeader: await png('letterhead-header.png'),
      letterheadFooter: await png('letterhead-footer.png'),
      clarityDiagram: await png('clarity-diagram.png'),
      fontCss: fonts.join('\n'),
    };
  })();
  return cached;
}
