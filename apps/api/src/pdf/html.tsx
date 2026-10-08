import { renderToStaticMarkup } from 'react-dom/server';
import type { PdfMode, ProbateDetails, ValuationDetails } from '@mccl/shared';
import type { StaticAssets } from './assets';
import type { RenderInput } from './renderer';
import { documentCss, headerFooterCss } from './template/styles';
import { ValuationDocument } from './template/valuation';
import { ProbateDocument } from './template/probate';
import type { TemplateImage } from './template/common';

/** Bump when the template changes so cached PDFs are regenerated. */
export const TEMPLATE_VERSION = 3;

/**
 * Letterhead strip heights: the images are 1786px wide, drawn at the full 210mm page width.
 * The artwork itself ends 59mm from the top and starts 54mm from the bottom, so content
 * keeps a clear gap from it in both letterhead and pre-printed paper modes.
 */
export const LETTERHEAD_MARGINS = { top: 73, bottom: 60 };

export interface Margins { top: number; bottom: number }

export interface DocumentForRender {
  type: 'valuation' | 'probate';
  documentDate: string | null;
  scheduleHtml: string;
  details: unknown;
  createdAt: Date;
}

export interface BuildOptions {
  mode: PdfMode;
  stationeryMargins: Margins;
  images: TemplateImage[];
  signatureSrc: string | null;
  sectionPages: Record<string, number>;
  markers: boolean;
}

export function marginsFor(mode: PdfMode, stationery: Margins): Margins {
  return mode === 'letterhead' ? LETTERHEAD_MARGINS : stationery;
}

const ddmmyyyy = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/London' });

export function buildRenderInput(
  doc: DocumentForRender,
  assets: StaticAssets,
  opts: BuildOptions,
): Omit<RenderInput, 'assets'> {
  const margins = marginsFor(opts.mode, opts.stationeryMargins);

  const body = doc.type === 'valuation'
    ? renderToStaticMarkup(
        <ValuationDocument
          details={doc.details as ValuationDetails}
          documentDate={doc.documentDate}
          scheduleHtml={doc.scheduleHtml}
          images={opts.images}
          signatureSrc={opts.signatureSrc}
          clarityDiagramSrc={assets.clarityDiagram}
          pages={opts.sectionPages}
          markers={opts.markers}
        />,
      )
    : renderToStaticMarkup(
        <ProbateDocument
          details={doc.details as ProbateDetails}
          scheduleHtml={doc.scheduleHtml}
          images={opts.images}
          preparedOn={ddmmyyyy(doc.createdAt)}
          markers={opts.markers}
        />,
      );

  const html = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8">
<style>${assets.fontCss}</style>
<style>:root{--page-h:${297 - margins.top - margins.bottom}mm}${documentCss}</style>
</head><body>${body}</body></html>`;

  const hf = `<style>${headerFooterCss}</style>`;
  const pageNo = '<div class="page-no">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>';

  // An empty template makes Chrome print its default date/title, so always send markup.
  const headerHtml = opts.mode === 'letterhead'
    ? `${hf}<div class="hf"><img src="${assets.letterheadHeader}"></div>`
    : `${hf}<div class="hf"></div>`;
  const footerHtml = opts.mode === 'letterhead'
    ? `${hf}<div class="hf" style="position:relative">${pageNo.replace('class="page-no"', 'class="page-no" style="position:absolute;top:0;right:0"')}<img src="${assets.letterheadFooter}"></div>`
    : `${hf}<div class="hf"></div>`;

  return { html, headerHtml, footerHtml, marginTopMm: margins.top, marginBottomMm: margins.bottom };
}
