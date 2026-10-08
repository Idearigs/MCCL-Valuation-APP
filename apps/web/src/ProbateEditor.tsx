import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ProbateData, defaultProbateData } from './types';
import { api } from './api';
import RichEditor from './RichEditor';
import ImageUploader from './ImageUploader';
import EditorTopBar from './EditorTopBar';
import { toProbateData, probatePayload } from './docMapping';

// ── Main Editor ──────────────────────────────────────────
export default function ProbateEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [apiId, setApiId] = useState<string | null>(id ?? null);
  const [data, setData] = useState<ProbateData>({ ...defaultProbateData });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!id) return;
    api.getDocument(id)
      .then(doc => setData(toProbateData(doc)))
      .catch(() => setLoadError('Could not load probate document'));
  }, [id]);

  const update = (partial: Partial<ProbateData>) => {
    setData(d => ({ ...d, ...partial }));
    setSaved(false);
  };

  const persist = async (d: ProbateData): Promise<string> => {
    const payload = probatePayload(d);
    if (apiId) {
      await api.updateDocument(apiId, payload);
      return apiId;
    } else {
      const doc = await api.createDocument(payload);
      setApiId(doc.id);
      window.history.replaceState(null, '', `/probate/edit/${doc.id}`);
      return doc.id;
    }
  };

  // Photos are stored against the document, so a brand-new probate is saved first.
  const ensureDocId = async () => apiId ?? persist(data);

  const handleSave = async () => {
    setSaving(true);
    try { await persist(data); setSaved(true); }
    catch (err) { alert(`Could not save: ${(err as Error).message}`); }
    finally { setSaving(false); }
  };

  const handlePreview = async () => {
    setSaving(true);
    try {
      const savedId = await persist(data);
      navigate(`/probate/preview/${savedId}`);
    } catch (err) { alert(`Could not save: ${(err as Error).message}`); }
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
      <EditorTopBar
        title={id ? data.deceasedName || 'Probate' : 'New probate valuation'}
        saved={saved} saving={saving}
        onBack={() => navigate('/')} onSave={handleSave} onPreview={handlePreview}
      />

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
              List all items here. Page breaks are added automatically when the document is generated.
            </p>
            <RichEditor
              value={data.scheduleHtml}
              onChange={scheduleHtml => update({ scheduleHtml })}
              placeholder="Items…"
            />
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
            <ImageUploader images={data.images} onChange={images => update({ images })} ensureDocId={ensureDocId} />
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
