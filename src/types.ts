export interface PricingRow {
  id: string;
  component: string;
  estimatedValue: string;
}

export interface ValuationImage {
  src: string;
  width: number; // percentage: 25 | 33 | 50 | 75 | 100
}

export interface ValuationData {
  customerName: string;
  customerAddress: string;
  date: string;
  scheduleHtml?: string;      // legacy — migrated to schedulePages on load
  schedulePages: string[];    // one entry per A4 schedule page
  pricingRows: PricingRow[];
  totalRange: string;
  insuranceValue: string;
  numberOfItems: string;
  images: ValuationImage[];
  ownerSignature: string;
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
  schedulePages: [''],
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
  schedulePages: string[];
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
  schedulePages: [''],
  totalMarketValue: '',
  images: [],
};
