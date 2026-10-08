import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DocumentStats } from '@mccl/shared';
import { api } from './api';
import {
  IcClose, IcDownload, IcEdit, IcEye, IcFile, IcLogout, IcPlus, IcPrint, IcScale, IcSearch, IcTrash,
} from './icons';

const PAGE_SIZE = 50;

function formatDate(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const money = (v: string) => (v ? `£${v.replace(/^£/, '')}` : '—');
type TypeFilter = '' | 'valuation' | 'probate';

export default function Dashboard() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; type: 'valuation' | 'probate' } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('');

  const [stats, setStats] = useState<DocumentStats>({ valuations: 0, probates: 0, thisMonth: 0, complete: 0 });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  // Search, date filters and paging run on the server, so the list stays fast as it grows.
  const load = async (nextPage = 1) => {
    try {
      const [list, s] = await Promise.all([
        api.listDocuments({ q: search, from: dateFrom, to: dateTo, type: typeFilter || undefined, page: nextPage, pageSize: PAGE_SIZE }),
        api.getStats(),
      ]);
      const rows = list.items.map(r => ({
        ...r, _type: r.type, _name: r.displayName, _date: r.documentDate ?? '', _value: r.headlineValue, created_at: r.createdAt,
      }));
      setRecords(prev => (nextPage === 1 ? rows : [...prev, ...rows]));
      setTotal(list.total);
      setPage(nextPage);
      setStats(s);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => load(1), search ? 250 : 0);
    return () => clearTimeout(t);
  }, [search, dateFrom, dateTo, typeFilter]);

  const handleDelete = async (id: string) => {
    try {
      await api.deleteDocument(id);
      setDeleteConfirm(null);
      load(1);
    } catch (err) { console.error(err); }
  };

  const handleLogout = async () => {
    await api.logout().catch(() => undefined);
    window.location.href = '/login';
  };

  const filtered = records;
  const hasFilters = !!(search || dateFrom || dateTo || typeFilter);
  const valuationCount = stats.valuations;
  const probateCount = stats.probates;
  const thisMonth = stats.thisMonth;

  const editPath = (r: any) => r._type === 'probate' ? `/probate/edit/${r.id}` : `/edit/${r.id}`;
  const previewPath = (r: any) => r._type === 'probate' ? `/probate/preview/${r.id}` : `/preview/${r.id}`;

  const typeLabel = (r: any) => (r._type === 'probate' ? 'Probate' : 'Valuation');
  const statusBadge = (r: any) => (
    <span className={`db-status ${r.status}`}>{r.status === 'complete' ? 'Complete' : 'Draft'}</span>
  );
  // Row/card actions. Clicks don't bubble, so they don't also open the document.
  const actions = (r: any) => (
    <div className="db-actions" onClick={e => e.stopPropagation()}>
      <button className="db-act" onClick={() => navigate(editPath(r))} title="Edit" aria-label="Edit"><IcEdit /></button>
      <button className="db-act" onClick={() => navigate(`${previewPath(r)}?print=true`)} title="Print" aria-label="Print"><IcPrint /></button>
      <button className="db-act" onClick={() => navigate(`${previewPath(r)}?download=true`)} title="Download PDF" aria-label="Download PDF"><IcDownload /></button>
      <button className="db-act db-act-danger" onClick={() => setDeleteConfirm({ id: r.id, type: r._type })} title="Delete" aria-label="Delete"><IcTrash /></button>
    </div>
  );

  return (
    <div className="db-shell">
      <header className="tb-bar">
        <div className="tb-inner db-top">
          <div className="db-brand">
            <div className="db-logo">M</div>
            <div>
              <div className="tb-title">McCulloch</div>
              <div className="tb-sub">Valuation Manager</div>
            </div>
          </div>
          <div className="tb-buttons">
            <button className="tb-btn tb-btn-quiet" onClick={handleLogout} title="Sign out">
              <IcLogout /><span className="tb-label">Sign out</span>
            </button>
            <button className="tb-btn tb-btn-primary" onClick={() => setShowNewModal(true)}>
              <IcPlus /><span>New</span>
            </button>
          </div>
        </div>
      </header>

      <main className="db-main">
        <section className="db-stats">
          {([
            ['Valuations', valuationCount],
            ['Probate', probateCount],
            ['This month', thisMonth],
            ['Complete', stats.complete],
          ] as const).map(([label, value]) => (
            <div className="db-stat" key={label}>
              <div className="db-stat-value">{value}</div>
              <div className="db-stat-label">{label}</div>
            </div>
          ))}
        </section>

        <section className="db-panel">
          <div className="db-toolbar">
            <div className="db-search">
              <IcSearch />
              <input type="text" placeholder="Search name, executor or address" value={search}
                onChange={e => setSearch(e.target.value)} aria-label="Search documents" />
              {search && <button className="db-clear" onClick={() => setSearch('')} aria-label="Clear search"><IcClose /></button>}
            </div>
            <div className="tb-seg" role="radiogroup" aria-label="Document type">
              {([['', 'All'], ['valuation', 'Valuations'], ['probate', 'Probate']] as const).map(([value, label]) => (
                <button key={label} role="radio" aria-checked={typeFilter === value}
                  className={typeFilter === value ? 'on' : ''} onClick={() => setTypeFilter(value)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="db-dates">
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} aria-label="From date" title="From date" />
              <span>–</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} aria-label="To date" title="To date" />
              {(dateFrom || dateTo) && (
                <button className="db-clear" onClick={() => { setDateFrom(''); setDateTo(''); }} aria-label="Clear dates"><IcClose /></button>
              )}
            </div>
          </div>
          <div className="db-count">{loading ? 'Loading…' : `${total} ${total === 1 ? 'document' : 'documents'}`}</div>

          {loading ? (
            <div className="db-empty"><div className="upload-spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="db-empty">
              {!hasFilters ? (
                <>
                  <div className="db-empty-icon"><IcFile /></div>
                  <div className="db-empty-title">No documents yet</div>
                  <div className="db-empty-text">Create your first valuation or probate document.</div>
                  <button className="tb-btn tb-btn-primary" onClick={() => setShowNewModal(true)}><IcPlus /><span>New document</span></button>
                </>
              ) : (
                <>
                  <div className="db-empty-icon"><IcSearch /></div>
                  <div className="db-empty-title">No matching documents</div>
                  <div className="db-empty-text">Try a different name, type or date range.</div>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="db-table-wrap dash-desktop-only">
                <table className="db-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Date</th>
                      <th className="db-num">Value</th>
                      <th>Status</th>
                      <th className="db-actions-col"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(r => (
                      <tr key={r.id + r._type} onClick={() => navigate(previewPath(r))} title="Open document">
                        <td>
                          <div className="db-name">{r._name || 'Untitled'}</div>
                          <div className="db-sub">
                            <span className={`db-type ${r._type}`}>{typeLabel(r)}</span> · created {formatDate(r.created_at)}
                          </div>
                        </td>
                        <td className="db-muted">{formatDate(r._date)}</td>
                        <td className="db-num db-value">{money(r._value)}</td>
                        <td>{statusBadge(r)}</td>
                        <td className="db-actions-col">{actions(r)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Phone cards */}
              <div className="db-cards dash-mobile-only">
                {filtered.map(r => (
                  <div key={r.id + r._type} className="db-card" onClick={() => navigate(previewPath(r))} role="button" tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter') navigate(previewPath(r)); }}>
                    <div className="db-card-main">
                      <div className="db-card-left">
                        <div className="db-name">{r._name || 'Untitled'}</div>
                        <div className="db-sub">
                          <span className={`db-type ${r._type}`}>{typeLabel(r)}</span> · {formatDate(r._date)}
                        </div>
                      </div>
                      <div className="db-card-right">
                        <div className="db-value">{money(r._value)}</div>
                        {statusBadge(r)}
                      </div>
                    </div>
                    <div className="db-card-foot">
                      <span className="db-open"><IcEye /> Open</span>
                      {actions(r)}
                    </div>
                  </div>
                ))}
              </div>
              {records.length < total && (
                <div className="db-more">
                  <button className="tb-btn" onClick={() => load(page + 1)}>
                    Show more ({total - records.length} remaining)
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </main>

      {/* New Document modal */}
      {showNewModal && (
        <div className="modal-overlay" onClick={() => setShowNewModal(false)}>
          <div className="modal-card db-modal" onClick={e => e.stopPropagation()}>
            <div className="db-modal-head">
              <h3>New document</h3>
              <button className="db-clear" onClick={() => setShowNewModal(false)} aria-label="Close"><IcClose /></button>
            </div>
            <div className="db-type-grid">
              <button className="db-type-btn" onClick={() => { setShowNewModal(false); navigate('/new'); }}>
                <span className="db-type-icon valuation"><IcFile /></span>
                <span className="db-type-name">Valuation</span>
                <span className="db-type-desc">Insurance replacement</span>
              </button>
              <button className="db-type-btn" onClick={() => { setShowNewModal(false); navigate('/probate/new'); }}>
                <span className="db-type-icon probate"><IcScale /></span>
                <span className="db-type-name">Probate</span>
                <span className="db-type-desc">Probate &amp; inheritance tax</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-card db-modal" onClick={e => e.stopPropagation()}>
            <div className="db-modal-head"><h3>Delete document?</h3></div>
            <p className="db-modal-text">It will be removed from the dashboard.</p>
            <div className="db-modal-actions">
              <button className="tb-btn" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="tb-btn db-btn-danger" onClick={() => handleDelete(deleteConfirm.id)}><IcTrash /><span>Delete</span></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
