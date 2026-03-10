import { useParams, useNavigate } from 'react-router-dom';
import { getRecord } from './storage';
import DocumentView from './DocumentView';

export default function Preview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const record = id ? getRecord(id) : null;

  if (!record) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 48 }}>📄</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Valuation not found</div>
        <button className="btn btn-primary" onClick={() => navigate('/')}>← Dashboard</button>
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
          {record.customerName || 'Valuation'} — {record.date ? new Date(record.date + 'T12:00:00').toLocaleDateString('en-GB') : ''}
        </span>
        <button className="btn btn-primary" onClick={() => window.print()}>
          🖨️ Print / Save as PDF
        </button>
      </div>
      <DocumentView data={record.data} />
    </div>
  );
}
