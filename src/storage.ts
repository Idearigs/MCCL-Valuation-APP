import { ValuationData, ValuationRecord } from './types';

const RECORDS_KEY = 'mcculloch-valuations';
const SIG_KEY = 'mcculloch-valuation-sig';

export function getAllRecords(): ValuationRecord[] {
  try { return JSON.parse(localStorage.getItem(RECORDS_KEY) ?? '[]'); }
  catch { return []; }
}

export function getRecord(id: string): ValuationRecord | null {
  return getAllRecords().find(r => r.id === id) ?? null;
}

function isComplete(data: ValuationData): boolean {
  return !!(data.customerName && data.date && data.scheduleHtml && data.insuranceValue);
}

export function saveRecord(record: ValuationRecord): void {
  const all = getAllRecords();
  const idx = all.findIndex(r => r.id === record.id);
  // Derive status
  record.status = isComplete(record.data) ? 'complete' : 'draft';
  if (idx >= 0) all[idx] = record;
  else all.unshift(record);
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(all)); }
  catch {
    // Quota hit – try without images
    const slim = all.map(r => r.id === record.id
      ? { ...r, data: { ...r.data, images: [] } }
      : r
    );
    localStorage.setItem(RECORDS_KEY, JSON.stringify(slim));
  }
}

export function deleteRecord(id: string): void {
  const all = getAllRecords().filter(r => r.id !== id);
  localStorage.setItem(RECORDS_KEY, JSON.stringify(all));
}

export function getSignature(): string {
  return localStorage.getItem(SIG_KEY) ?? '';
}

export function saveSignature(sig: string): void {
  localStorage.setItem(SIG_KEY, sig);
}

export function newId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36);
}
