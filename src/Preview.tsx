import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from './api';
import { ValuationData } from './types';
import DocumentView from './DocumentView';

// ── snake_case API row → camelCase ValuationData ─────────────
function apiRowToData(row: any): ValuationData {
  return {
    customerName: row.customer_name || '',
    customerAddress: row.customer_address || '',
    date: row.valuation_date ? row.valuation_date.split('T')[0] : '',
    scheduleHtml: row.schedule_html || '',
    pricingRows: Array.isArray(row.pricing_rows) ? row.pricing_rows : [],
    totalRange: row.total_range || '',
    insuranceValue: row.insurance_value || '',
    numberOfItems: row.number_of_items || '1',
    images: Array.isArray(row.images) ? row.images : [],
    ownerSignature: row.owner_signature || '',
  };
}

export default function Preview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ValuationData | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) { setNotFound(true); return; }
    api.getValuation(id)
      .then(row => setData(apiRowToData(row)))
      .catch(() => setNotFound(true));
  }, [id]);

  if (notFound) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 48 }}>📄</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Valuation not found</div>
        <button className="btn btn-primary" onClick={() => navigate('/')}>← Dashboard</button>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ color: 'var(--grey)', fontSize: 16 }}>Loading…</div>
      </div>
    );
  }

  return (
    <div className="preview-shell">
      <div className="preview-toolbar no-print">
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => navigate('/')}>← Dashboard</button>
          <button className="btn btn-ghost" onClick={() => navigate(`/edit/${id}`)}>✏️ Edit</button>
        </div>
        <span className="preview-title">
          {data.customerName || 'Valuation'} — {data.date ? new Date(data.date + 'T12:00:00').toLocaleDateString('en-GB') : ''}
        </span>
        <button className="btn btn-primary" onClick={() => window.print()}>
          🖨️ Print / Save as PDF
        </button>
      </div>
      <DocumentView data={data} />
    </div>
  );
}
