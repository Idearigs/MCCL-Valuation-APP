import { sectionMarker } from './template/common';

export interface PdfAnalysis {
  pageCount: number;
  /** 1-based page on which each section marker appears. */
  sectionPages: Record<string, number>;
}

/** Reads page count and where each section landed, using pdf.js text extraction. */
export async function analysePdf(pdf: Buffer): Promise<PdfAnalysis> {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({ data: new Uint8Array(pdf) });
  const doc = await task.promise;
  try {
    const sectionPages: Record<string, number> = {};
    const re = new RegExp(sectionMarker('(\\w+)'), 'g');
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const text = (await page.getTextContent()).items.map(i => ('str' in i ? i.str : '')).join('');
      for (const m of text.matchAll(re)) {
        const id = m[1]!;
        sectionPages[id] ??= n;
      }
      page.cleanup();
    }
    return { pageCount: doc.numPages, sectionPages };
  } finally {
    await task.destroy();
  }
}
