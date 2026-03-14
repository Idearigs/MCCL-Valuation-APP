import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ProbateData, ValuationImage, defaultProbateData } from './types';
import { api } from './api';
import RichEditor from './RichEditor';

// ── snake_case API row → ProbateData ─────────────────────
function parseSchedulePages(raw: string): string[] {
  if (!raw) return [''];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.length > 0 ? parsed : [''];
  } catch { /* legacy */ }
  return [raw];
}

function apiRowToData(row: any): ProbateData {
  return {
    executorName: row.executor_name || '',
    executorAddress: row.executor_address || '',
    contactNumber: row.contact_number || '',
    email: row.email || '',
    deceasedName: row.deceased_name || '',
    probateReference: row.probate_reference || '',
    dateOfDeath: row.date_of_death ? row.date_of_death.split('T')[0] : '',
    schedulePages: parseSchedulePages(row.schedule_html || ''),
    totalMarketValue: row.total_market_value || '',
    images: Array.isArray(row.images)
      ? row.images.map((img: any) => typeof img === 'string' ? { src: img, width: 50 } : img)
      : [],
  };
}

function dataToApiPayload(d: ProbateData) {
  return {
    executor_name: d.executorName,
    executor_address: d.executorAddress,
    contact_number: d.contactNumber,
    email: d.email,
    deceased_name: d.deceasedName,
    probate_reference: d.probateReference,
    date_of_death: d.dateOfDeath || null,
    schedule_html: JSON.stringify(d.schedulePages),
    total_market_value: d.totalMarketValue,
    images: d.images,
  };
}

// ── Image Uploader ───────────────────────────────────────
const SIZE_OPTIONS = [
  { label: 'S', value: 25 },
  { label: 'M', value: 50 },
  { label: 'L', value: 75 },
  { label: 'Full', value: 100 },
];

function ImageUploader({ images, onChange }: { images: ValuationImage[]; onChange: (imgs: ValuationImage[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = e => onChange([...images, { src: e.target?.result as string, width: 50 }]);
      reader.readAsDataURL(file);
    });
  };

  const setWidth = (i: number, width: number) => {
    onChange(images.map((img, idx) => idx === i ? { ...img, width } : img));
  };

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
        onChange={e => addFiles(e.target.files)} />
      <div
        className={`image-dropzone${dragging ? ' dragover' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
      >
        <div className="image-dropzone-icon">📷</div>
        <p style={{ fontWeight: 600 }}>Click or drag images here</p>
        <p>JPEG, PNG, WEBP supported</p>
      </div>
      {images.length > 0 && (
        <div className="image-grid">
          {images.map((img, i) => (
            <div className="image-thumb" key={i}>
              <div className="image-thumb-num">{i + 1}</div>
              <img src={img.src} alt={`Item ${i + 1}`} />
              <button className="image-remove" onClick={() => onChange(images.filter((_, idx) => idx !== i))}>✕</button>
              <div className="image-size-controls">
                {SIZE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    className={`image-size-btn${img.width === opt.value ? ' active' : ''}`}
                    onClick={() => setWidth(i, opt.value)}
                    title={`${opt.value}% width`}
                  >{opt.label}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page fill bar ─────────────────────────────────────────
const SCHEDULE_PAGE_PX = Math.round(183 * 96 / 25.4);

function PageFillBar({ heightPx }: { heightPx: number }) {
  const pct = Math.round((heightPx / SCHEDULE_PAGE_PX) * 100);
  const over = pct > 100;
  const color = over ? 'var(--danger)' : pct > 85 ? '#FF9500' : 'var(--success)';
  return (
    <div className="page-fill-wrap">
      <div className="page-fill-track">
        <div className="page-fill-bar" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
      <span className="page-fill-label" style={{ color }}>
        {over ? `⚠ ${pct}% — content overflows! Add a new page below.` : `${pct}% of page used`}
      </span>
    </div>
  );
}

// ── Main Editor ──────────────────────────────────────────
export default function ProbateEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [apiId, setApiId] = useState<string | null>(id ?? null);
  const [data, setData] = useState<ProbateData>({ ...defaultProbateData });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [pageHeights, setPageHeights] = useState<number[]>([0]);

  useEffect(() => {
    if (!id) return;
    api.getProbate(id)
      .then(row => setData(apiRowToData(row)))
      .catch(() => setLoadError('Could not load probate document'));
  }, [id]);

  const update = (partial: Partial<ProbateData>) => {
    setData(d => ({ ...d, ...partial }));
    setSaved(false);
  };

  const updateSchedulePage = (i: number, html: string) => {
    const pages = [...data.schedulePages];
    pages[i] = html;
    update({ schedulePages: pages });
  };
  const addSchedulePageAfter = (i: number) => {
    const pages = [...data.schedulePages];
    pages.splice(i + 1, 0, '');
    update({ schedulePages: pages });
    setPageHeights(h => { const n = [...h]; n.splice(i + 1, 0, 0); return n; });
  };
  const deleteSchedulePage = (i: number) => {
    const pages = data.schedulePages.filter((_, idx) => idx !== i);
    update({ schedulePages: pages.length > 0 ? pages : [''] });
    setPageHeights(h => h.filter((_, idx) => idx !== i));
  };
  const setPageHeight = (i: number, px: number) => {
    setPageHeights(h => { const n = [...h]; n[i] = px; return n; });
  };

  const persist = async (d: ProbateData): Promise<string> => {
    const payload = dataToApiPayload(d);
    if (apiId) {
      await api.updateProbate(apiId, payload);
      return apiId;
    } else {
      const row = await api.createProbate(payload);
      setApiId(row.id);
      window.history.replaceState(null, '', `/probate/edit/${row.id}`);
      return row.id;
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try { await persist(data); setSaved(true); }
    catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handlePreview = async () => {
    setSaving(true);
    try {
      const savedId = await persist(data);
      navigate(`/probate/preview/${savedId}`);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  if (loadError) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 48 }}>⚠️</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{loadError}</div>
        <button className="btn btn-primary" onClick={() => navigate('/')}>← Dashboard</button>
      </div>
    );
  }

  return (
    <div className="form-shell">
      <header className="form-header">
        <div className="form-header-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>← Dashboard</button>
            <div className="form-brand">
              {id ? `Edit — ${data.deceasedName || 'Probate'}` : 'New Probate Valuation'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {saved && <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>✓ Saved</span>}
            <button className="btn btn-ghost btn-sm" onClick={handleSave} disabled={saving}>Save Draft</button>
            <button className="btn btn-primary btn-sm" onClick={handlePreview} disabled={saving}>Preview & Print →</button>
          </div>
        </div>
      </header>

      <main className="form-main">
        {/* 1. Client Details */}
        <div className="section-card">
          <div className="section-header">
            <div className="section-number">1</div>
            <div className="section-title">Client Details (Executor/Administrator)</div>
          </div>
          <div className="section-body">
            <div className="form-row">
              <label className="form-label">Name of Executor/Administrator *</label>
              <input type="text" placeholder="e.g. Mr John Davies" value={data.executorName}
                onChange={e => update({ executorName: e.target.value })} />
            </div>
            <div className="form-row">
              <label className="form-label">Address</label>
              <textarea placeholder={'51 Marjoram Road\nBradwell\nNorfolk\nNG31 8SP'}
                value={data.executorAddress} onChange={e => update({ executorAddress: e.target.value })}
                style={{ minHeight: 100 }} />
            </div>
            <div className="form-row">
              <label className="form-label">Contact Number</label>
              <input type="text" placeholder="e.g. 07469246963" value={data.contactNumber}
                onChange={e => update({ contactNumber: e.target.value })} />
            </div>
            <div className="form-row">
              <label className="form-label">Email</label>
              <input type="email" placeholder="e.g. name@example.com" value={data.email}
                onChange={e => update({ email: e.target.value })} />
            </div>
          </div>
        </div>

        {/* 2. Deceased Details */}
        <div className="section-card">
          <div className="section-header">
            <div className="section-number">2</div>
            <div className="section-title">Deceased Details</div>
          </div>
          <div className="section-body">
            <div className="form-row">
              <label className="form-label">Name of Deceased *</label>
              <input type="text" placeholder="e.g. Michael Edward Gibbs" value={data.deceasedName}
                onChange={e => update({ deceasedName: e.target.value })} />
            </div>
            <div className="form-row">
              <label className="form-label">Probate Reference</label>
              <input type="text" placeholder="e.g. N/A or reference number" value={data.probateReference}
                onChange={e => update({ probateReference: e.target.value })} />
            </div>
            <div className="form-row" style={{ maxWidth: 220 }}>
              <label className="form-label">Date of Death *</label>
              <input type="date" value={data.dateOfDeath} onChange={e => update({ dateOfDeath: e.target.value })} />
            </div>
          </div>
        </div>

        {/* 3. Items Schedule */}
        <div className="section-card">
          <div className="section-header">
            <div className="section-number">3</div>
            <div className="section-title">Items Schedule</div>
          </div>
          <div className="section-body">
            <p style={{ fontSize: 13, color: 'var(--grey)', marginBottom: 16 }}>
              Each page below = one printed A4 page. Fill the content, watch the fill bar, and click <strong>+ Add Page</strong> when a page is full.
            </p>
            {data.schedulePages.map((page, i) => (
              <div key={i} className="schedule-page-block">
                <div className="schedule-page-block-header">
                  <span className="schedule-page-block-label">Page {i + 1}</span>
                  {data.schedulePages.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--danger)', fontSize: 12 }}
                      onClick={() => deleteSchedulePage(i)}
                    >
                      Remove page
                    </button>
                  )}
                </div>
                <RichEditor
                  value={page}
                  onChange={html => updateSchedulePage(i, html)}
                  onHeightChange={px => setPageHeight(i, px)}
                  placeholder={`Items for page ${i + 1}…`}
                />
                <PageFillBar heightPx={pageHeights[i] ?? 0} />
                <button
                  type="button"
                  className="btn-add-schedule-page"
                  onClick={() => addSchedulePageAfter(i)}
                >
                  + Add page {i + 2}
                </button>
              </div>
            ))}
            <div className="form-row" style={{ marginTop: 20 }}>
              <label className="form-label">Total Estimated Market Value</label>
              <input type="text" placeholder="e.g. £3,047.00" value={data.totalMarketValue}
                onChange={e => update({ totalMarketValue: e.target.value })} />
            </div>
          </div>
        </div>

        {/* 4. Photos */}
        <div className="section-card">
          <div className="section-header">
            <div className="section-number">4</div>
            <div className="section-title">Picture Schedule — Item Photos</div>
          </div>
          <div className="section-body">
            <ImageUploader images={data.images} onChange={images => update({ images })} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, paddingTop: 12, justifyContent: 'center' }}>
          <button className="btn btn-ghost" style={{ padding: '12px 32px' }} onClick={handleSave} disabled={saving}>
            💾 Save Draft
          </button>
          <button className="btn btn-primary" style={{ padding: '12px 32px', fontSize: 15, borderRadius: 12 }}
            onClick={handlePreview} disabled={saving}>
            Generate Document →
          </button>
        </div>
      </main>
    </div>
  );
}
