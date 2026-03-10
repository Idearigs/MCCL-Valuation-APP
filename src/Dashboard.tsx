import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ValuationRecord } from './types';
import { getAllRecords, deleteRecord } from './storage';

function formatDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function formatCreated(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<ValuationRecord[]>([]);
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const load = () => setRecords(getAllRecords());
  useEffect(load, []);

  const handleDelete = (id: string) => {
    deleteRecord(id);
    setDeleteConfirm(null);
    load();
  };

  const filtered = records.filter(r =>
    r.customerName.toLowerCase().includes(search.toLowerCase()) ||
    r.date.includes(search)
  );

  // Stats
  const thisMonth = records.filter(r => {
    const d = new Date(r.createdAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const totalValue = records.reduce((sum, r) => {
    const n = parseFloat(r.insuranceValue.replace(/[£,]/g, ''));
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  return (
    <div className="dash-shell">
      {/* ── Header ── */}
      <header className="dash-header">
        <div className="dash-header-inner">
          <div className="dash-brand">
            <img src="/letterhead-header.png" alt="" className="dash-brand-img" />
            <div className="dash-brand-text">Valuation Manager</div>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/new')}>
            + New Valuation
          </button>
        </div>
      </header>

      <main className="dash-main">
        {/* ── Stats ── */}
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
            <div className="dash-stat-value">
              {totalValue > 0 ? `£${totalValue.toLocaleString('en-GB')}` : '—'}
            </div>
          </div>
        </div>

        {/* ── Search + table ── */}
        <div className="dash-table-card">
          <div className="dash-table-toolbar">
            <input
              type="text"
              placeholder="Search by customer name or date…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="dash-search"
            />
            <span className="dash-count">
              {filtered.length} {filtered.length === 1 ? 'valuation' : 'valuations'}
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className="dash-empty">
              {records.length === 0 ? (
                <>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>No valuations yet</div>
                  <div style={{ color: 'var(--grey)', marginBottom: 20 }}>
                    Create your first valuation document
                  </div>
                  <button className="btn btn-primary" onClick={() => navigate('/new')}>
                    + New Valuation
                  </button>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>🔍</div>
                  <div>No results for "{search}"</div>
                </>
              )}
            </div>
          ) : (
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
                    <td className="dash-cell-name">{r.customerName || '—'}</td>
                    <td>{formatDate(r.date)}</td>
                    <td>{r.numberOfItems || '—'}</td>
                    <td className="dash-cell-value">
                      {r.insuranceValue
                        ? `£${r.insuranceValue.replace(/^£/, '')}`
                        : '—'}
                    </td>
                    <td>
                      <span className={`dash-badge ${r.status}`}>
                        {r.status === 'complete' ? 'Complete' : 'Draft'}
                      </span>
                    </td>
                    <td className="dash-cell-meta">{formatCreated(r.createdAt)}</td>
                    <td>
                      <div className="dash-actions">
                        <button
                          className="dash-action-btn"
                          onClick={() => navigate(`/edit/${r.id}`)}
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          className="dash-action-btn"
                          onClick={() => navigate(`/preview/${r.id}`)}
                          title="Preview & Print"
                        >
                          🖨️
                        </button>
                        <button
                          className="dash-action-btn danger"
                          onClick={() => setDeleteConfirm(r.id)}
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* ── Delete confirm modal ── */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🗑️</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Delete Valuation?</h3>
            <p style={{ color: 'var(--grey)', marginBottom: 24, fontSize: 14 }}>
              This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setDeleteConfirm(null)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                style={{ flex: 1 }}
                onClick={() => handleDelete(deleteConfirm)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
