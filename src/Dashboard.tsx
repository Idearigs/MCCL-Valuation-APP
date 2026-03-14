import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearToken } from './api';

function formatDate(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const IcEdit = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const IcEye = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);
const IcDownload = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);
const IcTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);

export default function Dashboard() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; type: 'valuation' | 'probate' } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);

  const load = async () => {
    try {
      const [valuations, probates] = await Promise.all([
        api.getValuations(),
        api.getProbates(),
      ]);
      const vRows = valuations.map((r: any) => ({ ...r, _type: 'valuation', _name: r.customer_name, _date: r.valuation_date, _value: r.insurance_value }));
      const pRows = probates.map((r: any) => ({ ...r, _type: 'probate', _name: r.deceased_name, _date: r.date_of_death, _value: r.total_market_value }));
      const combined = [...vRows, ...pRows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setRecords(combined);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string, type: 'valuation' | 'probate') => {
    try {
      if (type === 'probate') await api.deleteProbate(id);
      else await api.deleteValuation(id);
      setDeleteConfirm(null);
      load();
    } catch (err) { console.error(err); }
  };

  const handleLogout = () => { clearToken(); window.location.href = '/login'; };

  const filtered = records.filter(r => {
    const matchesSearch =
      (r._name || '').toLowerCase().includes(search.toLowerCase()) ||
      (r._date || '').includes(search);
    const dateField = (r._date || '').split('T')[0];
    const matchesFrom = !dateFrom || dateField >= dateFrom;
    const matchesTo = !dateTo || dateField <= dateTo;
    return matchesSearch && matchesFrom && matchesTo;
  });

  const valuationCount = records.filter(r => r._type === 'valuation').length;
  const probateCount = records.filter(r => r._type === 'probate').length;
  const thisMonth = records.filter(r => {
    const d = new Date(r.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const editPath = (r: any) => r._type === 'probate' ? `/probate/edit/${r.id}` : `/edit/${r.id}`;
  const previewPath = (r: any) => r._type === 'probate' ? `/probate/preview/${r.id}` : `/preview/${r.id}`;

  return (
    <div className="dash-shell">
      <header className="dash-header">
        <div className="dash-header-inner">
          <div className="dash-brand">
            <div className="dash-brand-text">MCCL · Valuation</div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button className="btn btn-primary btn-sm dash-nav-btn" onClick={() => setShowNewModal(true)}>+ New</button>
            <button className="dash-signout-btn" onClick={handleLogout}>Sign out</button>
          </div>
        </div>
      </header>

      <main className="dash-main">
        <div className="dash-stats">
          <div className="dash-stat-card">
            <div className="dash-stat-label">Valuations</div>
            <div className="dash-stat-value">{valuationCount}</div>
          </div>
          <div className="dash-stat-card">
            <div className="dash-stat-label">Probate</div>
            <div className="dash-stat-value">{probateCount}</div>
          </div>
          <div className="dash-stat-card">
            <div className="dash-stat-label">This Month</div>
            <div className="dash-stat-value">{thisMonth}</div>
          </div>
          <div className="dash-stat-card">
            <div className="dash-stat-label">Complete</div>
            <div className="dash-stat-value">{records.filter(r => r.status === 'complete').length}</div>
          </div>
        </div>

        <div className="dash-table-card">
          <div className="dash-table-toolbar">
            <input type="text" placeholder="Search by name or date…" value={search} onChange={e => setSearch(e.target.value)} className="dash-search" />
            <span className="dash-count">{filtered.length} {filtered.length === 1 ? 'document' : 'documents'}</span>
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
                  <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>No documents yet</div>
                  <div style={{ color: 'var(--grey)', marginBottom: 20 }}>Create your first valuation or probate document</div>
                  <button className="btn btn-primary" onClick={() => setShowNewModal(true)}>+ New Document</button>
                </>
              ) : (
                <><div style={{ fontSize: 36, marginBottom: 8 }}>🔍</div><div>No results for "{search}"</div></>
              )}
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="dash-table-wrap dash-desktop-only">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Name</th>
                      <th>Date</th>
                      <th>Value</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(r => (
                      <tr key={r.id + r._type} className="dash-row">
                        <td>
                          <span className={`dash-badge ${r._type === 'probate' ? 'probate-badge' : 'valuation-badge'}`}>
                            {r._type === 'probate' ? 'Probate' : 'Valuation'}
                          </span>
                        </td>
                        <td className="dash-cell-name">{r._name || '—'}</td>
                        <td>{formatDate(r._date)}</td>
                        <td className="dash-cell-value">{r._value ? `£${r._value.replace(/^£/, '')}` : '—'}</td>
                        <td><span className={`dash-badge ${r.status}`}>{r.status === 'complete' ? 'Complete' : 'Draft'}</span></td>
                        <td className="dash-cell-meta">{formatDate(r.created_at)}</td>
                        <td>
                          <div className="dash-actions">
                            <button className="dash-action-btn" onClick={() => navigate(editPath(r))} title="Edit">✏️</button>
                            <button className="dash-action-btn" onClick={() => navigate(previewPath(r))} title="Preview & Print">🖨️</button>
                            <button className="dash-action-btn download" onClick={() => navigate(`${previewPath(r)}?download=true`)} title="Download PDF">⬇</button>
                            <button className="dash-action-btn danger" onClick={() => setDeleteConfirm({ id: r.id, type: r._type })} title="Delete">🗑️</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="dash-cards dash-mobile-only">
                {filtered.map(r => (
                  <div key={r.id + r._type} className="dash-card">
                    <div className="dash-card-body">
                      <div className="dash-card-row1">
                        <div className="dash-card-left">
                          <div className="dash-card-name">{r._name || '—'}</div>
                          <div className="dash-card-sub">
                            {[r._type === 'probate' ? 'Probate' : 'Valuation', formatDate(r._date)].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                        <div className="dash-card-right">
                          {r._value && <div className="dash-card-amount">£{r._value.replace(/^£/, '')}</div>}
                          <span className={`dash-badge ${r.status}`}>{r.status === 'complete' ? 'Complete' : 'Draft'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="dash-card-actions">
                      <button className="dash-ic-btn" onClick={() => navigate(editPath(r))} title="Edit"><IcEdit /></button>
                      <button className="dash-ic-btn" onClick={() => navigate(previewPath(r))} title="Preview"><IcEye /></button>
                      <button className="dash-ic-btn accent" onClick={() => navigate(`${previewPath(r)}?download=true`)} title="Download PDF"><IcDownload /></button>
                      <button className="dash-ic-btn danger" onClick={() => setDeleteConfirm({ id: r.id, type: r._type })} title="Delete"><IcTrash /></button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      {/* New Document modal */}
      {showNewModal && (
        <div className="modal-overlay" onClick={() => setShowNewModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Select Document Type</h3>
            <p style={{ color: 'var(--grey)', fontSize: 13, marginBottom: 24 }}>What type of document would you like to create?</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                className="new-doc-type-btn"
                onClick={() => { setShowNewModal(false); navigate('/new'); }}
              >
                <span style={{ fontSize: 28, marginBottom: 8, display: 'block' }}>📋</span>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Valuation</div>
                <div style={{ fontSize: 12, color: 'var(--grey)' }}>Insurance replacement valuation</div>
              </button>
              <button
                className="new-doc-type-btn"
                onClick={() => { setShowNewModal(false); navigate('/probate/new'); }}
              >
                <span style={{ fontSize: 28, marginBottom: 8, display: 'block' }}>⚖️</span>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Probate</div>
                <div style={{ fontSize: 12, color: 'var(--grey)' }}>Probate &amp; inheritance tax valuation</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Delete Document?</h3>
            <p style={{ color: 'var(--grey)', marginBottom: 24, fontSize: 14 }}>This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => handleDelete(deleteConfirm.id, deleteConfirm.type)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
