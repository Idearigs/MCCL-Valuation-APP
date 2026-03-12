import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearToken } from './api';

function formatDate(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const data = await api.getValuations();
      setRecords(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    try {
      await api.deleteValuation(id);
      setDeleteConfirm(null);
      load();
    } catch (err) { console.error(err); }
  };

  const handleLogout = () => { clearToken(); window.location.href = '/login'; };

  const filtered = records.filter(r => {
    const matchesSearch =
      (r.customer_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.valuation_date || '').includes(search);
    const dateField = (r.valuation_date || '').split('T')[0];
    const matchesFrom = !dateFrom || dateField >= dateFrom;
    const matchesTo = !dateTo || dateField <= dateTo;
    return matchesSearch && matchesFrom && matchesTo;
  });

  const thisMonth = records.filter(r => {
    const d = new Date(r.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const totalValue = records.reduce((sum, r) => {
    const n = parseFloat((r.insurance_value || '').replace(/[£,]/g, ''));
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  return (
    <div className="dash-shell">
      <header className="dash-header">
        <div className="dash-header-inner">
          <div className="dash-brand">
            <div className="dash-brand-text">McCulloch - Valuation Manager</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={() => navigate('/new')}>+ New Valuation</button>
            <button className="btn btn-ghost" onClick={handleLogout}>Sign out</button>
          </div>
        </div>
      </header>

      <main className="dash-main">
        <div className="dash-stats">
          <div className="dash-stat-card">
            <div className="dash-stat-label">Total Valuations</div>
            <div className="dash-stat-value">{records.length}</div>
          </div>
          <div className="dash-stat-card">
            <div className="dash-stat-label">This Month</div>
            <div className="dash-stat-value">{thisMonth}</div>
          </div>
          <div className="dash-stat-card">
            <div className="dash-stat-label">Complete</div>
            <div className="dash-stat-value">{records.filter(r => r.status === 'complete').length}</div>
          </div>
          <div className="dash-stat-card">
            <div className="dash-stat-label">Total Insured Value</div>
            <div className="dash-stat-value">{totalValue > 0 ? `£${totalValue.toLocaleString('en-GB')}` : '—'}</div>
          </div>
        </div>

        <div className="dash-table-card">
          <div className="dash-table-toolbar">
            <input type="text" placeholder="Search by customer name or date…" value={search} onChange={e => setSearch(e.target.value)} className="dash-search" />
            <span className="dash-count">{filtered.length} {filtered.length === 1 ? 'valuation' : 'valuations'}</span>
          </div>
          <div className="dash-date-filters">
            <span className="dash-date-label">Date:</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="dash-date-input" title="From date" />
            <span className="dash-date-label">—</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="dash-date-input" title="To date" />
            {(dateFrom || dateTo) && (
              <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => { setDateFrom(''); setDateTo(''); }}>✕</button>
            )}
          </div>

          {loading ? (
            <div className="dash-empty"><div style={{ color: 'var(--grey)' }}>Loading…</div></div>
          ) : filtered.length === 0 ? (
            <div className="dash-empty">
              {records.length === 0 ? (
                <>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>No valuations yet</div>
                  <div style={{ color: 'var(--grey)', marginBottom: 20 }}>Create your first valuation document</div>
                  <button className="btn btn-primary" onClick={() => navigate('/new')}>+ New Valuation</button>
                </>
              ) : (
                <><div style={{ fontSize: 36, marginBottom: 8 }}>🔍</div><div>No results for "{search}"</div></>
              )}
            </div>
          ) : (
            <div className="dash-table-wrap">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Valuation Date</th>
                    <th>Items</th>
                    <th>Insurance Value</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id} className="dash-row">
                      <td className="dash-cell-name">{r.customer_name || '—'}</td>
                      <td>{formatDate(r.valuation_date)}</td>
                      <td>{r.number_of_items || '—'}</td>
                      <td className="dash-cell-value">{r.insurance_value ? `£${r.insurance_value.replace(/^£/, '')}` : '—'}</td>
                      <td><span className={`dash-badge ${r.status}`}>{r.status === 'complete' ? 'Complete' : 'Draft'}</span></td>
                      <td className="dash-cell-meta">{formatDate(r.created_at)}</td>
                      <td>
                        <div className="dash-actions">
                          <button className="dash-action-btn" onClick={() => navigate(`/edit/${r.id}`)} title="Edit">✏️</button>
                          <button className="dash-action-btn" onClick={() => navigate(`/preview/${r.id}`)} title="Preview & Print">🖨️</button>
                          <button className="dash-action-btn download" onClick={() => navigate(`/preview/${r.id}?download=true`)} title="Download PDF">⬇</button>
                          <button className="dash-action-btn danger" onClick={() => setDeleteConfirm(r.id)} title="Delete">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🗑️</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Delete Valuation?</h3>
            <p style={{ color: 'var(--grey)', marginBottom: 24, fontSize: 14 }}>This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => handleDelete(deleteConfirm)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
