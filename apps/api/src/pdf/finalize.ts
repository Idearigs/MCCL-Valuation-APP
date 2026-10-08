import { PDFDict, PDFDocument, PDFName } from 'pdf-lib';

/**
 * Marks the PDF so print dialogs default to "Actual size" instead of "Fit to page".
 * Fit-to-page shrinks an A4 page by a few percent to suit each printer's margins, which
 * moved text by several mm against pre-printed letterhead paper (and differently on
 * every printer). Chrome's PDF viewer and Adobe Reader both honour /PrintScaling /None.
 */
export async function finalizePdf(pdf: Buffer, title: string): Promise<Buffer> {
  const doc = await PDFDocument.load(pdf, { updateMetadata: false });
  const prefs = doc.context.obj({
    PrintScaling: PDFName.of('None'),
    // Print exactly the pages in order; don't let the viewer pick a paper size.
    PickTrayByPDFSize: true,
  });
  doc.catalog.set(PDFName.of('ViewerPreferences'), prefs as PDFDict);
  doc.setTitle(title);
  doc.setCreator('McCulloch Valuation');
  doc.setProducer('McCulloch Valuation');
  return Buffer.from(await doc.save({ useObjectStreams: true }));
}
