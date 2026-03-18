import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from './api';
import { ProbateData } from './types';
import ProbateDocumentView from './ProbateDocumentView';

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

export default function ProbatePreview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<ProbateData | null>(null);
  const [createdAt, setCreatedAt] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const docRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const autoDownloadTriggered = useRef<boolean>(false);

  useEffect(() => {
    const A4_PX = 210 * (96 / 25.4);
    const applyScale = () => {
      if (!outerRef.current || !docRef.current) return;
      const available = outerRef.current.offsetWidth;
      const scale = Math.min(1, available / A4_PX);
      docRef.current.style.transform = scale < 1 ? `scale(${scale})` : '';
      docRef.current.style.transformOrigin = 'top left';
      outerRef.current.style.height = scale < 1
        ? `${docRef.current.scrollHeight * scale}px`
        : '';
    };
    const resetForPrint = () => {
      if (docRef.current) {
        docRef.current.style.transform = '';
        docRef.current.querySelectorAll<HTMLElement>('.doc-lh-img, .doc-lf-img, .doc-lh-fallback, .doc-lf-fallback')
          .forEach(el => { el.style.display = 'none'; });
      }
      if (outerRef.current) { outerRef.current.style.height = ''; outerRef.current.style.overflow = ''; }
    };
    const restoreAfterPrint = () => {
      if (docRef.current) {
        docRef.current.querySelectorAll<HTMLElement>('.doc-lh-img, .doc-lf-img, .doc-lh-fallback, .doc-lf-fallback')
          .forEach(el => { el.style.display = ''; });
      }
      applyScale();
    };
    applyScale();
    window.addEventListener('resize', applyScale);
    window.addEventListener('beforeprint', resetForPrint);
    window.addEventListener('afterprint', restoreAfterPrint);
    return () => {
      window.removeEventListener('resize', applyScale);
      window.removeEventListener('beforeprint', resetForPrint);
      window.removeEventListener('afterprint', restoreAfterPrint);
    };
  }, [data]);

  useEffect(() => {
    if (!id) { setNotFound(true); return; }
    api.getProbate(id)
      .then(row => { setData(apiRowToData(row)); setCreatedAt(row.created_at || ''); })
      .catch(() => setNotFound(true));
  }, [id]);

  useEffect(() => {
    if (data && searchParams.get('download') === 'true' && !autoDownloadTriggered.current) {
      autoDownloadTriggered.current = true;
      handleDownloadPdf();
    }
  }, [data]);

  const handleDownloadPdf = async () => {
    if (!docRef.current || !data) return;
    setDownloading(true);
    const origTransform = docRef.current.style.transform;
    docRef.current.style.transform = '';
    try {
      const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ]);

      const pages = docRef.current.querySelectorAll('.doc-page');
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const filename = `Probate-${(data.deceasedName || 'document').replace(/\s+/g, '-')}.pdf`;

      for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i] as HTMLElement, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
        });
        if (i > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 210, 297);
      }

      pdf.save(filename);
    } finally {
      docRef.current.style.transform = origTransform;
      setDownloading(false);
    }
  };

  if (notFound) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 48 }}>📄</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Probate document not found</div>
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
          <button className="btn btn-ghost" onClick={() => navigate(`/probate/edit/${id}`)}>✏️ Edit</button>
        </div>
        <span className="preview-title">
          {data.deceasedName || 'Probate'} — Probate Valuation
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => window.print()}>🖨️ Print</button>
          <button className="btn btn-primary" onClick={handleDownloadPdf} disabled={downloading}>
            {downloading ? 'Generating…' : '⬇ Download PDF'}
          </button>
        </div>
      </div>
      <div ref={outerRef} style={{ width: '100%', overflow: 'hidden' }}>
        <div ref={docRef}>
          <ProbateDocumentView data={data} createdAt={createdAt} />
        </div>
      </div>
    </div>
  );
}
