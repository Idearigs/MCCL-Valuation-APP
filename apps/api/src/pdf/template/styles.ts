/**
 * Print stylesheet for generated documents. Ported from the v1 screen styles
 * (apps/web/src/index.css `.doc-*`), but written for paged media: content flows across
 * pages and Chrome decides the breaks, guided by the break-* rules below.
 */
export const documentCss = /* css */ `
@page { size: A4; }

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body {
  font-family: 'Playfair Display', 'Times New Roman', Georgia, serif;
  color: #222;
  padding: 0 20mm;
  orphans: 3;
  widows: 3;
}

/* Each top-level section starts on a fresh page; long ones flow onto as many as needed. */
.section { position: relative; break-before: page; }
.section:first-child { break-before: auto; }
.fill-page {
  min-height: calc(var(--page-h) - 4mm);
  display: flex; flex-direction: column; justify-content: center;
}
.marker { position: absolute; top: 0; left: 0; font-size: 1px; color: #fff; }

p, li, tr, .keep { break-inside: avoid; }
h1, h2, h3, h4, .doc-section-title, .pricing-header, .probate-section-label { break-after: avoid; }

.doc-section-title {
  font-size: 18pt; font-weight: 700; font-style: italic;
  text-align: center; margin: 2mm 0 10mm; color: #222;
}
.doc-body { font-size: 10.5pt; font-style: italic; line-height: 1.9; color: #333; }
.doc-body p { margin-bottom: 8pt; }

/* Cover */
.cover-title {
  font-size: 15pt; font-weight: 700; font-style: italic;
  text-align: center; text-decoration: underline; margin: 2mm 0 8mm;
}
.cover-property { font-size: 13pt; font-style: italic; font-weight: 700; text-align: center; line-height: 2.2; }
.cover-date { font-size: 12pt; font-style: italic; text-align: right; margin: 8mm 0; }

/* Carried out by */
.carried-heading { font-size: 13pt; font-weight: 700; font-style: italic; text-align: center; margin-bottom: 4mm; }
.carried-block { text-align: center; font-size: 13pt; font-style: italic; line-height: 2.2; margin: 6mm 0; }

/* Contents */
.contents-note { font-size: 10.5pt; font-style: italic; font-weight: 700; line-height: 2; margin-bottom: 14mm; }
.contents-item { display: flex; align-items: baseline; font-size: 11pt; font-style: italic; font-weight: 700; margin-bottom: 10mm; }
.contents-dots { flex: 1; border-bottom: 1.5px dotted #777; margin: 0 8px; }

/* Schedule (user content, sanitised server-side) */
.schedule { font-size: 10.5pt; font-style: italic; line-height: 1.9; color: #333; }
.schedule p { margin-bottom: 7pt; }
.schedule p:empty { min-height: 1em; }
.schedule strong { font-weight: 700; }
.schedule ul, .schedule ol { margin: 6pt 0 10pt 20pt; }
.schedule li { margin-bottom: 3pt; }
.schedule h2, .schedule h3, .schedule h4 { font-size: 12pt; margin: 8pt 0 4pt; }
.schedule table { width: 100%; border-collapse: collapse; margin-bottom: 6pt; }
.schedule th, .schedule td { padding: 4pt 12pt 4pt 0; text-align: left; vertical-align: top; }
.schedule th { font-weight: 700; border-bottom: 1px solid #333; }
.schedule thead { display: table-header-group; } /* repeat table headers on each page */
.schedule .empty { color: #aaa; }

/* Pricing */
.pricing-header { font-size: 11pt; font-style: italic; margin-bottom: 5mm; }
.pricing-row { font-size: 10.5pt; font-style: italic; margin-bottom: 5mm; }
.pricing-label { font-weight: 700; text-decoration: underline; }
.pricing-total-label { font-size: 11pt; font-style: italic; font-weight: 700; margin: 6mm 0 3mm; }
.pricing-total-value { font-size: 12pt; font-style: italic; margin-bottom: 6mm; }
.pricing-insurance-label { font-size: 11pt; font-style: italic; font-weight: 700; text-decoration: underline; margin-bottom: 3mm; }
.pricing-insurance-value { font-size: 12pt; font-style: italic; margin-bottom: 8mm; }
.pricing-footnote { font-size: 10pt; font-style: italic; }

/* Picture schedule: 4 columns, square crops, numbered. Flows onto as many pages as needed. */
.photos { display: flex; flex-wrap: wrap; gap: 3mm; }
.photo {
  position: relative; width: calc((100% - 9mm) / 4); aspect-ratio: 1;
  break-inside: avoid;
}
.photo img { width: 100%; height: 100%; object-fit: cover; border: 1px solid #ddd; border-radius: 1mm; display: block; }
.photo-num {
  position: absolute; top: 1mm; left: 1mm; min-width: 4.5mm; height: 4.5mm; padding: 0 1mm;
  background: rgba(0,0,0,.6); color: #fff; font: 700 7pt/4.5mm Arial, sans-serif;
  border-radius: .8mm; text-align: center;
}

/* Glossary */
.glossary { font-size: 8.5pt; font-style: italic; line-height: 1.7; }
.glossary p { margin-bottom: 4pt; }
.glossary-term { font-weight: 700; }
.clarity-diagram { width: 100%; display: block; margin: 7pt 0; }

/* Insurer notice */
.insurer-header-text { text-align: center; font-size: 10.5pt; font-weight: 700; line-height: 2; margin-bottom: 6mm; }
.insurer-rule { border: none; border-top: 1px solid #777; margin: 8mm 0; }
.insurer-row { text-align: center; font-size: 11pt; font-style: italic; line-height: 1.8; }
.insurer-contact { text-align: center; font-size: 10pt; font-style: italic; color: #555; margin-top: 8mm; }
.insurer-sig-block { display: flex; justify-content: flex-end; margin-top: 10mm; break-inside: avoid; }
.insurer-sig { text-align: center; }
.insurer-sig img { max-width: 35mm; max-height: 18mm; display: block; margin: 0 auto 1mm; }
.insurer-sig-blank { width: 35mm; height: 16mm; border-bottom: 1px solid #555; margin: 0 auto 1mm; }
.insurer-sig-name { font-size: 10pt; font-style: italic; font-weight: 700; }
.insurer-sig-place { font-size: 10pt; font-style: italic; }

/* Probate */
.probate { font-size: 10.5pt; line-height: 1.5; }
.probate-title { font-size: 13pt; font-weight: 700; text-decoration: underline; text-align: center; margin: 2mm 0 6pt; }
.probate-subtitle { font-size: 11pt; font-weight: 700; text-decoration: underline; text-align: center; margin-bottom: 8pt; }
.probate-rule { border: none; border-top: 1px solid #333; margin: 10pt 0; }
.probate-section-label { font-size: 11pt; font-weight: 600; margin-bottom: 6pt; }
.probate-field { margin-bottom: 6pt; }
.probate-purpose-text { line-height: 1.7; }
.probate .schedule { font-style: normal; line-height: 1.6; }
.probate-total {
  font-size: 11pt; font-weight: 700; text-decoration: underline; text-align: right;
  margin-top: 12pt; padding-top: 6pt; border-top: 1px solid #333; break-inside: avoid;
}
.probate-declaration p { margin-bottom: 6pt; line-height: 1.6; }
.probate-declaration-fields p { margin-bottom: 10pt; }
.probate-sig-line { display: flex; align-items: flex-end; gap: 8pt; }
.probate-sig-blank { display: inline-block; width: 160pt; border-bottom: 1px solid #333; height: 24pt; }
`;

/** Chrome renders header/footer templates in a separate, unstyled context. */
export const headerFooterCss = /* css */ `
#header, #footer { padding: 0 !important; margin: 0 !important; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.hf { width: 100%; margin: 0; padding: 0; font-family: Arial, sans-serif; }
.hf img { width: 100%; display: block; }
.page-no { font-size: 7pt; color: #888; text-align: right; padding: 0 20mm 1.5mm; }
`;
