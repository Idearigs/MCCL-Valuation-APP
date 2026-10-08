import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ValuationData, PricingRow, defaultData } from './types';
import { api } from './api';
import RichEditor from './RichEditor';
import ImageUploader from './ImageUploader';
import EditorTopBar from './EditorTopBar';
import { toValuationData, valuationPayload, syncSignature } from './docMapping';

// ── Signature localStorage helpers (UX convenience only) ────
const SIG_KEY = 'mcculloch-valuation-sig';
function getSignature(): string { return localStorage.getItem(SIG_KEY) ?? ''; }
function saveSignature(sig: string): void { localStorage.setItem(SIG_KEY, sig); }

// ── Signature Pad ────────────────────────────────────────────
function SignatureUploader({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [tab, setTab] = useState<'draw' | 'upload'>('draw');
  const [drawing, setDrawing] = useState(false);
  const [hasSig, setHasSig] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tab !== 'draw' || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d')!;
    ctx.strokeStyle = '#1C1C1E'; ctx.lineWidth = 2;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  }, [tab]);

  const getPos = (e: React.TouchEvent | React.MouseEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width, sy = canvas.height / rect.height;
    if ('touches' in e) return { x: (e.touches[0].clientX - rect.left) * sx, y: (e.touches[0].clientY - rect.top) * sy };
    return { x: ((e as React.MouseEvent).clientX - rect.left) * sx, y: ((e as React.MouseEvent).clientY - rect.top) * sy };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    lastPos.current = getPos(e, canvasRef.current!);
    setDrawing(true); setHasSig(true);
  };
  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!drawing || !lastPos.current) return;
    const canvas = canvasRef.current!, ctx = canvas.getContext('2d')!;
    const pos = getPos(e, canvas);
    ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y); ctx.stroke();
    lastPos.current = pos;
  };
  const endDraw = () => { setDrawing(false); lastPos.current = null; };

  const clearCanvas = () => {
    canvasRef.current!.getContext('2d')!.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
    setHasSig(false);
  };

  const saveDrawn = () => {
    if (!hasSig || !canvasRef.current) return;
    const off = document.createElement('canvas');
    off.width = canvasRef.current.width; off.height = canvasRef.current.height;
    const ctx = off.getContext('2d')!;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, off.width, off.height);
    ctx.drawImage(canvasRef.current, 0, 0);
    const url = off.toDataURL('image/png');
    onChange(url);
    saveSignature(url);
  };

  if (value) {
    return (
      <div>
        <div className="sig-preview">
          <img src={value} alt="Signature" style={{ maxHeight: 80, maxWidth: 260 }} />
          <button className="btn btn-ghost btn-sm" onClick={() => onChange('')}>✏️ Redo</button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--grey)', marginTop: 6 }}>Saved between sessions.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {(['draw', 'upload'] as const).map(t => (
          <button key={t} className="btn btn-sm" onClick={() => setTab(t)} style={{
            background: tab === t ? 'var(--dark)' : 'var(--surface)',
            color: tab === t ? '#fff' : 'var(--dark)',
            border: '1.5px solid var(--border)',
          }}>
            {t === 'draw' ? '✍️ Draw' : '📁 Upload'}
          </button>
        ))}
      </div>

      {tab === 'draw' && (
        <div>
          <div style={{ border: '1.5px solid #D0D0D8', borderRadius: 12, overflow: 'hidden', background: '#fff', position: 'relative' }}>
            {!hasSig && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', color: '#bbb', fontSize: 14 }}>
                <span style={{ fontSize: 28, marginBottom: 4 }}>✍️</span>Sign here
              </div>
            )}
            <canvas ref={canvasRef} width={800} height={300}
              style={{ display: 'block', width: '100%', height: 220, cursor: 'crosshair', touchAction: 'none' }}
              onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
              onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button className="btn btn-ghost btn-sm" onClick={clearCanvas} disabled={!hasSig}>Clear</button>
            <button className="btn btn-primary btn-sm" onClick={saveDrawn} disabled={!hasSig}>Save Signature ✓</button>
          </div>
        </div>
      )}

      {tab === 'upload' && (
        <div>
          <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => {
              const f = e.target.files?.[0]; if (!f) return;
              const r = new FileReader();
              r.onload = ev => { const url = ev.target?.result as string; onChange(url); saveSignature(url); };
              r.readAsDataURL(f);
            }} />
          <button className="btn btn-ghost" onClick={() => inputRef.current?.click()}>+ Upload Image</button>
        </div>
      )}
      <p style={{ fontSize: 12, color: 'var(--grey)', marginTop: 8 }}>Saved between sessions.</p>
    </div>
  );
}

// ── Pricing rows ─────────────────────────────────────────────
function PricingSection({ rows, totalRange, insuranceValue, numberOfItems, onChange }: {
  rows: PricingRow[]; totalRange: string; insuranceValue: string; numberOfItems: string;
  onChange: (p: Partial<Pick<ValuationData, 'pricingRows' | 'totalRange' | 'insuranceValue' | 'numberOfItems'>>) => void;
}) {
  const addRow = () => onChange({ pricingRows: [...rows, { id: Date.now().toString(), component: '', estimatedValue: '' }] });
  const removeRow = (id: string) => onChange({ pricingRows: rows.filter(r => r.id !== id) });
  const updateRow = (id: string, field: keyof PricingRow, val: string) =>
    onChange({ pricingRows: rows.map(r => r.id === id ? { ...r, [field]: val } : r) });

  return (
    <>
      <table className="pricing-table">
        <thead><tr>
          <th>Component / Item Description</th>
          <th style={{ minWidth: 160 }}>Estimated Value</th>
          <th></th>
        </tr></thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id}>
              <td><input type="text" placeholder="e.g. 0.83ct F VVS2 GIA diamond" value={row.component} onChange={e => updateRow(row.id, 'component', e.target.value)} /></td>
              <td><input type="text" placeholder="e.g. £5,200 – £5,800" value={row.estimatedValue} onChange={e => updateRow(row.id, 'estimatedValue', e.target.value)} /></td>
              <td><button className="pricing-row-remove" onClick={() => removeRow(row.id)}>×</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="add-row-btn" onClick={addRow}>+ Add Component</button>
      <div className="totals-grid">
        <div className="form-row">
          <label className="form-label">Total Replacement Range</label>
          <input type="text" placeholder="e.g. £6,700 – £7,700" value={totalRange} onChange={e => onChange({ totalRange: e.target.value })} />
        </div>
        <div className="form-row">
          <label className="form-label">Recommended Insurance Value</label>
          <input type="text" placeholder="e.g. £7,800" value={insuranceValue} onChange={e => onChange({ insuranceValue: e.target.value })} />
        </div>
      </div>
      <div className="form-row" style={{ maxWidth: 180 }}>
        <label className="form-label">Number of Items</label>
        <input type="number" min="1" value={numberOfItems} onChange={e => onChange({ numberOfItems: e.target.value })} />
      </div>
    </>
  );
}

// ── Main Editor ──────────────────────────────────────────────
export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [apiId, setApiId] = useState<string | null>(id ?? null);
  const [data, setData] = useState<ValuationData>({ ...defaultData, ownerSignature: getSignature() });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  // Signature as last stored on the server, to know whether it needs uploading.
  const savedSignature = useRef('');

  // Load existing record from API
  useEffect(() => {
    if (!id) return;
    api.getDocument(id)
      .then(doc => {
        const d = toValuationData(doc);
        savedSignature.current = d.ownerSignature;
        setData(d);
      })
      .catch(() => setLoadError('Could not load valuation'));
  }, [id]);

  const update = (partial: Partial<ValuationData>) => {
    setData(d => ({ ...d, ...partial }));
    setSaved(false);
  };

  const persist = async (d: ValuationData): Promise<string> => {
    const payload = valuationPayload(d);
    let docId = apiId;
    if (docId) {
      await api.updateDocument(docId, payload);
    } else {
      const doc = await api.createDocument(payload);
      docId = doc.id;
      setApiId(doc.id);
      // Update URL without full navigation so subsequent saves use PUT
      window.history.replaceState(null, '', `/edit/${doc.id}`);
    }
    const sig = await syncSignature(docId, d.ownerSignature, savedSignature.current);
    savedSignature.current = sig;
    if (sig !== d.ownerSignature) setData(cur => ({ ...cur, ownerSignature: sig }));
    return docId;
  };

  // Photos are stored against the document, so a brand-new valuation is saved first.
  const ensureDocId = async () => apiId ?? persist(data);

  const handleSave = async () => {
    setSaving(true);
    try {
      await persist(data);
      setSaved(true);
    } catch (err) {
      alert(`Could not save: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    setSaving(true);
    try {
      const savedId = await persist(data);
      navigate(`/preview/${savedId}`);
    } catch (err) {
      alert(`Could not save: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
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
      <EditorTopBar
        title={id ? data.customerName || 'Valuation' : 'New valuation'}
        saved={saved} saving={saving}
        onBack={() => navigate('/')} onSave={handleSave} onPreview={handlePreview}
      />

      <main className="form-main">
        {/* 1. Customer Details */}
        <div className="section-card">
          <div className="section-header">
            <div className="section-number">1</div>
            <div className="section-title">Customer Details</div>
          </div>
          <div className="section-body">
            <div className="form-row">
              <label className="form-label">Customer Full Name *</label>
              <input type="text" placeholder="e.g. Travis Hatt" value={data.customerName}
                onChange={e => update({ customerName: e.target.value })} />
            </div>
            <div className="form-row">
              <label className="form-label">Address <span className="form-hint">— one line per address line</span></label>
              <textarea placeholder={'52 Marlborough Road\nBeeston\nNG9 2HG\nNottingham'}
                value={data.customerAddress} onChange={e => update({ customerAddress: e.target.value })}
                style={{ minHeight: 100 }} />
            </div>
            <div className="form-row" style={{ maxWidth: 220 }}>
              <label className="form-label">Valuation Date</label>
              <input type="date" value={data.date} onChange={e => update({ date: e.target.value })} />
            </div>
          </div>
        </div>

        {/* 2. Schedule */}
        <div className="section-card">
          <div className="section-header">
            <div className="section-number">2</div>
            <div className="section-title">Schedule Content</div>
          </div>
          <div className="section-body">
            <p style={{ fontSize: 13, color: 'var(--grey)', marginBottom: 16 }}>
              Type the whole schedule here. Page breaks are added automatically when the document is generated.
            </p>
            <RichEditor
              value={data.scheduleHtml}
              onChange={scheduleHtml => update({ scheduleHtml })}
              placeholder="Schedule content…"
            />
          </div>
        </div>

        {/* 3. Pricing */}
        <div className="section-card">
          <div className="section-header">
            <div className="section-number">3</div>
            <div className="section-title">Pricing Breakdown</div>
          </div>
          <div className="section-body">
            <PricingSection rows={data.pricingRows} totalRange={data.totalRange}
              insuranceValue={data.insuranceValue} numberOfItems={data.numberOfItems}
              onChange={update} />
          </div>
        </div>

        {/* 4. Images */}
        <div className="section-card">
          <div className="section-header">
            <div className="section-number">4</div>
            <div className="section-title">Picture Schedule — Item Photos</div>
          </div>
          <div className="section-body">
            <ImageUploader images={data.images} onChange={images => update({ images })} ensureDocId={ensureDocId} />
          </div>
        </div>

        {/* 5. Signature */}
        <div className="section-card">
          <div className="section-header">
            <div className="section-number">5</div>
            <div className="section-title">Owner Signature</div>
          </div>
          <div className="section-body">
            <SignatureUploader value={data.ownerSignature}
              onChange={ownerSignature => update({ ownerSignature })} />
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
