import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ValuationData, PricingRow, defaultData } from './types';
import { getRecord, saveRecord, getSignature, saveSignature, newId } from './storage';
import RichEditor from './RichEditor';

// ── Image Uploader ──────────────────────────────────────────
function ImageUploader({ images, onChange }: { images: string[]; onChange: (imgs: string[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = e => onChange([...images, e.target?.result as string]);
      reader.readAsDataURL(file);
    });
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
          {images.map((src, i) => (
            <div className="image-thumb" key={i}>
              <img src={src} alt={`Item ${i + 1}`} />
              <button className="image-remove" onClick={() => onChange(images.filter((_, idx) => idx !== i))}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Signature Pad ───────────────────────────────────────────
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

// ── Pricing rows ────────────────────────────────────────────
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

// ── Main Editor ─────────────────────────────────────────────
export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [recordId] = useState(id ?? newId());
  const [data, setData] = useState<ValuationData>(() => {
    if (id) {
      const rec = getRecord(id);
      if (rec) return rec.data;
    }
    // Load saved signature for new valuations
    return { ...defaultData, ownerSignature: getSignature() };
  });
  const [saved, setSaved] = useState(false);

  const update = (partial: Partial<ValuationData>) => {
    setData(d => ({ ...d, ...partial }));
    setSaved(false);
  };

  const persist = (d: ValuationData) => {
    const existing = id ? getRecord(id) : null;
    saveRecord({
      id: recordId,
      customerName: d.customerName,
      date: d.date,
      insuranceValue: d.insuranceValue,
      numberOfItems: d.numberOfItems,
      status: 'draft',
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      data: d,
    });
  };

  const handleSave = () => {
    persist(data);
    setSaved(true);
  };

  const handlePreview = () => {
    persist(data);
    navigate(`/preview/${recordId}`);
  };

  return (
    <div className="form-shell">
      {/* Header */}
      <header className="form-header">
        <div className="form-header-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>← Dashboard</button>
            <div className="form-brand">
              {id ? `Edit — ${data.customerName || 'Valuation'}` : 'New Valuation'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {saved && <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>✓ Saved</span>}
            <button className="btn btn-ghost btn-sm" onClick={handleSave}>Save Draft</button>
            <button className="btn btn-primary btn-sm" onClick={handlePreview}>Preview & Print →</button>
          </div>
        </div>
      </header>

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
            <p style={{ fontSize: 13, color: 'var(--grey)', marginBottom: 12 }}>
              Describe the jewellery items in detail. Use <strong>Bold</strong> for section headings and <strong>• List</strong> for bullet points.
            </p>
            <RichEditor value={data.scheduleHtml} onChange={html => update({ scheduleHtml: html })} />
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
            <ImageUploader images={data.images} onChange={images => update({ images })} />
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
          <button className="btn btn-ghost" style={{ padding: '12px 32px' }} onClick={handleSave}>
            💾 Save Draft
          </button>
          <button className="btn btn-primary" style={{ padding: '12px 32px', fontSize: 15, borderRadius: 12 }}
            onClick={handlePreview}>
            Generate Document →
          </button>
        </div>
      </main>
    </div>
  );
}
