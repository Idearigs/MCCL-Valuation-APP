import type { DocumentRecord, ProbateDetails, ValuationDetails } from '@mccl/shared';
import { api } from './api';
import { ProbateData, ValuationData, ValuationImage } from './types';

// ── API document record ⇄ editor form data ───────────────────

const toImages = (doc: DocumentRecord): ValuationImage[] =>
  doc.images.map(i => ({ id: i.id, src: i.thumbUrl, width: i.sizePct }));

export function toValuationData(doc: DocumentRecord): ValuationData {
  const d = doc.details as ValuationDetails;
  return {
    customerName: d.customerName || '',
    customerAddress: d.customerAddress || '',
    date: doc.documentDate || '',
    scheduleHtml: doc.scheduleHtml || '',
    pricingRows: d.pricingRows?.length ? d.pricingRows : [{ id: '1', component: '', estimatedValue: '' }],
    totalRange: d.totalRange || '',
    insuranceValue: d.insuranceValue || '',
    numberOfItems: d.numberOfItems || '1',
    images: toImages(doc),
    ownerSignature: doc.signatureUrl || '',
  };
}

export function valuationPayload(d: ValuationData) {
  return {
    type: 'valuation',
    documentDate: d.date || null,
    scheduleHtml: d.scheduleHtml,
    details: {
      customerName: d.customerName,
      customerAddress: d.customerAddress,
      pricingRows: d.pricingRows,
      totalRange: d.totalRange,
      insuranceValue: d.insuranceValue,
      numberOfItems: d.numberOfItems,
    },
  };
}

export function toProbateData(doc: DocumentRecord): ProbateData {
  const d = doc.details as ProbateDetails;
  return {
    executorName: d.executorName || '',
    executorAddress: d.executorAddress || '',
    contactNumber: d.contactNumber || '',
    email: d.email || '',
    deceasedName: d.deceasedName || '',
    probateReference: d.probateReference || '',
    dateOfDeath: doc.documentDate || '',
    scheduleHtml: doc.scheduleHtml || '',
    totalMarketValue: d.totalMarketValue || '',
    images: toImages(doc),
  };
}

export function probatePayload(d: ProbateData) {
  return {
    type: 'probate',
    documentDate: d.dateOfDeath || null,
    scheduleHtml: d.scheduleHtml,
    details: {
      executorName: d.executorName,
      executorAddress: d.executorAddress,
      contactNumber: d.contactNumber,
      email: d.email,
      deceasedName: d.deceasedName,
      probateReference: d.probateReference,
      totalMarketValue: d.totalMarketValue,
    },
  };
}

/**
 * Signatures are files on the server. A newly drawn/picked one arrives as a data: URL and
 * is uploaded on save; clearing it removes the stored file. Returns the URL to show.
 */
export async function syncSignature(docId: string, current: string, saved: string): Promise<string> {
  if (current === saved) return current;
  if (!current) {
    await api.deleteSignature(docId);
    return '';
  }
  if (current.startsWith('data:')) {
    const [meta, b64] = current.split(',');
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const type = meta.match(/data:([^;]+)/)?.[1] ?? 'image/png';
    const { signatureUrl } = await api.uploadSignature(docId, new Blob([bytes], { type }));
    return signatureUrl;
  }
  return current;
}
