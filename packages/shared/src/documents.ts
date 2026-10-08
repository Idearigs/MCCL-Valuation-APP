import { z } from 'zod';

export const DOCUMENT_TYPES = ['valuation', 'probate'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export type DocumentStatus = 'draft' | 'complete';

const text = (max: number) => z.string().max(max).default('');
/** ISO calendar date (YYYY-MM-DD) or null. */
const isoDate = z.iso.date().nullable().default(null);

export const pricingRowSchema = z.object({
  id: z.string().max(64),
  component: text(500),
  estimatedValue: text(200),
});
export type PricingRow = z.infer<typeof pricingRowSchema>;

export const valuationDetailsSchema = z.object({
  customerName: text(255),
  customerAddress: text(2000),
  pricingRows: z.array(pricingRowSchema).max(200).default([]),
  totalRange: text(255),
  insuranceValue: text(255),
  numberOfItems: text(50),
});
export type ValuationDetails = z.infer<typeof valuationDetailsSchema>;

export const probateDetailsSchema = z.object({
  executorName: text(255),
  executorAddress: text(2000),
  contactNumber: text(100),
  email: text(255),
  deceasedName: text(255),
  probateReference: text(255),
  totalMarketValue: text(255),
});
export type ProbateDetails = z.infer<typeof probateDetailsSchema>;

/** Max schedule HTML size — generous; real schedules are a few hundred KB at most. */
export const MAX_SCHEDULE_HTML = 2_000_000;

const baseInput = {
  /** Valuation date for valuations, date of death for probate. */
  documentDate: isoDate,
  scheduleHtml: z.string().max(MAX_SCHEDULE_HTML).default(''),
};

export const documentInputSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('valuation'), ...baseInput, details: valuationDetailsSchema }),
  z.object({ type: z.literal('probate'), ...baseInput, details: probateDetailsSchema }),
]);
export type DocumentInput = z.infer<typeof documentInputSchema>;

/** Derived, denormalised fields used for listing/searching. */
export function summarise(input: DocumentInput): {
  displayName: string;
  headlineValue: string;
  status: DocumentStatus;
} {
  if (input.type === 'valuation') {
    const d = input.details;
    const complete = !!(d.customerName && input.documentDate && input.scheduleHtml && d.insuranceValue);
    return { displayName: d.customerName, headlineValue: d.insuranceValue, status: complete ? 'complete' : 'draft' };
  }
  const d = input.details;
  const complete = !!(d.executorName && d.deceasedName && input.documentDate);
  return { displayName: d.deceasedName, headlineValue: d.totalMarketValue, status: complete ? 'complete' : 'draft' };
}

export interface DocumentImage {
  id: string;
  position: number;
  /** Display width in the picture schedule, percent. */
  sizePct: number;
  width: number;
  height: number;
  /** Short-lived signed URLs. */
  thumbUrl: string;
  printUrl: string;
}

export type DocumentRecord = DocumentInput & {
  id: string;
  status: DocumentStatus;
  displayName: string;
  headlineValue: string;
  images: DocumentImage[];
  signatureUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export interface DocumentListItem {
  id: string;
  type: DocumentType;
  status: DocumentStatus;
  displayName: string;
  headlineValue: string;
  documentDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export const listQuerySchema = z.object({
  type: z.enum(DOCUMENT_TYPES).optional(),
  status: z.enum(['draft', 'complete']).optional(),
  q: z.string().trim().max(200).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type ListQuery = z.infer<typeof listQuerySchema>;

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DocumentStats {
  valuations: number;
  probates: number;
  thisMonth: number;
  complete: number;
}

export const PDF_MODES = ['letterhead', 'stationery'] as const;
export type PdfMode = (typeof PDF_MODES)[number];

export const pdfRequestSchema = z.object({
  mode: z.enum(PDF_MODES).default('letterhead'),
});

export interface PdfResult {
  url: string;
  mode: PdfMode;
  pageCount: number;
  byteSize: number;
  renderMs: number;
  /** True when an identical earlier render was reused. */
  cached: boolean;
}

export const imageUpdateSchema = z.object({
  sizePct: z.union([z.literal(25), z.literal(33), z.literal(50), z.literal(75), z.literal(100)]).optional(),
});

export const imageOrderSchema = z.object({
  imageIds: z.array(z.uuid()).max(500),
});
