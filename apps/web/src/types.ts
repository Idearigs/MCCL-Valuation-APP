export interface PricingRow {
  id: string;
  component: string;
  estimatedValue: string;
}

export interface ValuationImage {
  id: string;
  src: string;   // thumbnail (short-lived signed URL from the server)
  width: number; // percentage: 25 | 33 | 50 | 75 | 100
}

export interface ValuationData {
  customerName: string;
  customerAddress: string;
  date: string;
  scheduleHtml: string;       // one continuous schedule; the server splits it into pages
  pricingRows: PricingRow[];
  totalRange: string;
  insuranceValue: string;
  numberOfItems: string;
  images: ValuationImage[];
  ownerSignature: string;     // saved signature URL, or a data: URL just drawn/picked
}

export interface ValuationRecord {
  id: string;
  customerName: string;
  date: string;
  insuranceValue: string;
  numberOfItems: string;
  status: 'draft' | 'complete';
  createdAt: string;
  updatedAt: string;
  data: ValuationData;
}

export const defaultData: ValuationData = {
  customerName: '',
  customerAddress: '',
  date: new Date().toISOString().split('T')[0],
  scheduleHtml: '',
  pricingRows: [{ id: '1', component: '', estimatedValue: '' }],
  totalRange: '',
  insuranceValue: '',
  numberOfItems: '1',
  images: [],
  ownerSignature: '',
};

export interface ProbateData {
  executorName: string;
  executorAddress: string;
  contactNumber: string;
  email: string;
  deceasedName: string;
  probateReference: string;
  dateOfDeath: string;
  scheduleHtml: string;
  totalMarketValue: string;
  images: ValuationImage[];
}

export interface ProbateRecord {
  id: string;
  executorName: string;
  deceasedName: string;
  dateOfDeath: string;
  totalMarketValue: string;
  status: 'draft' | 'complete';
  createdAt: string;
  updatedAt: string;
  data: ProbateData;
}

export const defaultProbateData: ProbateData = {
  executorName: '',
  executorAddress: '',
  contactNumber: '',
  email: '',
  deceasedName: '',
  probateReference: '',
  dateOfDeath: new Date().toISOString().split('T')[0],
  scheduleHtml: '',
  totalMarketValue: '',
  images: [],
};
