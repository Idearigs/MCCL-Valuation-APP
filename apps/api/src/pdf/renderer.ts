import { existsSync } from 'node:fs';
import type { Browser } from 'playwright-core';

export interface RenderAsset {
  data: Buffer;
  contentType: string;
}

/** Everything a renderer needs; identical for local Chrome and Gotenberg. */
export interface RenderInput {
  html: string;
  /** Body fragments for Chrome's repeating header/footer (must be self-contained: inline images only). */
  headerHtml: string;
  footerHtml: string;
  marginTopMm: number;
  marginBottomMm: number;
  /** Files referenced by relative URL from `html` (photos, signature). */
  assets: Record<string, RenderAsset>;
}

export interface PdfRenderer {
  render(input: RenderInput): Promise<Buffer>;
  close(): Promise<void>;
}

const ORIGIN = 'http://render.local';

/**
 * Drives a local Chrome via Playwright. Used for development and tests; production uses
 * Gotenberg, which runs the same Chrome print engine in its own container.
 */
export class ChromeRenderer implements PdfRenderer {
  private browser: Promise<Browser> | undefined;

  constructor(private readonly executablePath?: string) {}

  private getBrowser() {
    this.browser ??= (async () => {
      const { chromium } = await import('playwright-core');
      const executablePath = this.executablePath ?? defaultChromePath();
      // In the Linux container: Docker's /dev/shm is tiny, and Chrome's sandbox needs kernel
      // features containers usually lack. The page only ever loads our own generated HTML and
      // every network request is blocked (see render()), so running unsandboxed is acceptable.
      const args = process.platform === 'linux' ? ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] : [];
      const browser = await chromium.launch({ executablePath, headless: true, args });
      browser.on('disconnected', () => { this.browser = undefined; });
      return browser;
    })().catch(err => {
      this.browser = undefined;
      throw err;
    });
    return this.browser;
  }

  async render(input: RenderInput): Promise<Buffer> {
    const browser = await this.getBrowser();
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      // Serve the document and its assets from memory; block everything else.
      await page.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin !== ORIGIN) return route.abort();
        if (url.pathname === '/index.html') {
          return route.fulfill({ body: input.html, contentType: 'text/html; charset=utf-8' });
        }
        const asset = input.assets[decodeURIComponent(url.pathname.slice(1))];
        if (!asset) return route.fulfill({ status: 404 });
        return route.fulfill({ body: asset.data, contentType: asset.contentType });
      });
      await page.goto(`${ORIGIN}/index.html`, { waitUntil: 'load', timeout: 60_000 });
      await page.evaluate(() => document.fonts.ready);
      return await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: input.headerHtml,
        footerTemplate: input.footerHtml,
        margin: { top: `${input.marginTopMm}mm`, bottom: `${input.marginBottomMm}mm`, left: '0', right: '0' },
      });
    } finally {
      await context.close();
    }
  }

  async close() {
    const browser = await this.browser?.catch(() => undefined);
    this.browser = undefined;
    await browser?.close();
  }
}

function defaultChromePath() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  const found = candidates.find(existsSync);
  if (!found) throw new Error('Chrome not found; set CHROME_PATH or use PDF_RENDERER=gotenberg');
  return found;
}

/**
 * Gotenberg (https://gotenberg.dev): a shared Docker service wrapping headless Chrome.
 * POST /forms/chromium/convert/html with index.html, header.html, footer.html and assets.
 */
export class GotenbergRenderer implements PdfRenderer {
  constructor(private readonly baseUrl: string, private readonly timeoutMs = 120_000) {}

  async render(input: RenderInput): Promise<Buffer> {
    const wrap = (body: string) => `<!doctype html><html><head><meta charset="utf-8"></head><body>${body}</body></html>`;
    const form = new FormData();
    form.append('files', new Blob([input.html], { type: 'text/html' }), 'index.html');
    form.append('files', new Blob([wrap(input.headerHtml)], { type: 'text/html' }), 'header.html');
    form.append('files', new Blob([wrap(input.footerHtml)], { type: 'text/html' }), 'footer.html');
    for (const [name, asset] of Object.entries(input.assets)) {
      form.append('files', new Blob([new Uint8Array(asset.data)], { type: asset.contentType }), name);
    }
    form.append('paperWidth', '210mm');
    form.append('paperHeight', '297mm');
    form.append('marginTop', `${input.marginTopMm}mm`);
    form.append('marginBottom', `${input.marginBottomMm}mm`);
    form.append('marginLeft', '0');
    form.append('marginRight', '0');
    form.append('printBackground', 'true');

    const res = await fetch(`${this.baseUrl.replace(/\/$/, '')}/forms/chromium/convert/html`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new Error(`Gotenberg ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return Buffer.from(await res.arrayBuffer());
  }

  async close() {}
}
