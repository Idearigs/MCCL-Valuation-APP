import type { Margins } from './html';
import type { RenderInput } from './renderer';

/**
 * A one-page alignment test for pre-printed letterhead paper. Printed at Actual size on the
 * shop printer, it shows (with millimetre rulers on both edges) where document text starts
 * and stops, so any printer offset can be read off and corrected via STATIONERY_TOP_MM /
 * STATIONERY_BOTTOM_MM.
 */
export function alignmentTestPage(margins: Margins): Omit<RenderInput, 'assets'> {
  const ticks: string[] = [];
  for (let mm = 0; mm < 297; mm += 1) {
    const len = mm % 10 === 0 ? 7 : mm % 5 === 0 ? 4.5 : 2.5;
    const label = mm % 10 === 0 && mm > 0 && mm < 297
      ? `<div class="lbl" style="top:${mm - 1.6}mm">${mm}</div>` : '';
    ticks.push(`<div class="tick" style="top:${mm}mm;width:${len}mm"></div>${label}`);
  }
  const ruler = (side: 'left' | 'right') => `<div class="ruler ${side}">${ticks.join('')}</div>`;
  const bottomLine = 297 - margins.bottom;

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@page { size: A4; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 210mm; height: 297mm; overflow: hidden; }
body { position: relative; font-family: Arial, sans-serif; color: #111; -webkit-print-color-adjust: exact; }
.ruler { position: absolute; top: 0; width: 14mm; height: 297mm; }
.ruler.left { left: 6mm; } .ruler.right { right: 6mm; }
.tick { position: absolute; height: 0; border-top: 0.25mm solid #000; }
.ruler.right .tick { right: 0; } .ruler.left .tick { left: 0; }
.lbl { position: absolute; font-size: 2.6mm; }
.ruler.left .lbl { left: 8mm; } .ruler.right .lbl { right: 8mm; }
.line { position: absolute; left: 22mm; right: 22mm; border-top: 0.5mm dashed #c00; }
.note { position: absolute; left: 0; right: 0; text-align: center; font-size: 3.4mm; color: #c00; font-weight: bold; }
.box { position: absolute; left: 20mm; right: 20mm; border: 0.3mm solid #999; }
.help { position: absolute; left: 30mm; right: 30mm; font-size: 3.4mm; line-height: 1.5; }
.help h1 { font-size: 5mm; margin-bottom: 3mm; }
.help li { margin: 0 0 1.5mm 5mm; }
</style></head><body>
${ruler('left')}${ruler('right')}
<div class="box" style="top:${margins.top}mm;bottom:${margins.bottom}mm"></div>
<div class="line" style="top:${margins.top}mm"></div>
<div class="note" style="top:${margins.top + 1.5}mm">▲ document text starts here (${margins.top} mm from the top)</div>
<div class="line" style="top:${bottomLine}mm"></div>
<div class="note" style="top:${bottomLine - 6}mm">▼ document text ends here (${margins.bottom} mm from the bottom)</div>
<div class="help" style="top:${margins.top + 16}mm">
  <h1>Pre-printed paper alignment test</h1>
  <ol>
    <li>Print this page on a sheet of the pre-printed letterhead paper, at <b>Actual size / 100%</b> (not "Fit to page").</li>
    <li>The red dashed lines should sit in the white space: the top line below the printed logo and tagline, the bottom line above the printed address block.</li>
    <li>If a line overlaps the printed artwork, read the ruler where the artwork ends and send that number. One setting moves every document.</li>
    <li>The rulers are exact: if the 100 mark is not 100 mm from the top edge of the paper, the printer is scaling the page.</li>
  </ol>
</div>
</body></html>`;

  // Chrome prints its own date/title unless templates are provided; keep them empty.
  const empty = '<div></div>';
  return { html, headerHtml: empty, footerHtml: empty, marginTopMm: 0, marginBottomMm: 0 };
}
