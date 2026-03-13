import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from './api';
import { ValuationData } from './types';
import DocumentView from './DocumentView';

// ── snake_case API row → camelCase ValuationData ─────────────
function apiRowToData(row: any): ValuationData {
  return {
    customerName: row.customer_name || '',
    customerAddress: row.customer_address || '',
    date: row.valuation_date ? row.valuation_date.split('T')[0] : '',
    scheduleHtml: row.schedule_html || '',
    pricingRows: Array.isArray(row.pricing_rows) ? row.pricing_rows : [],
    totalRange: row.total_range || '',
    insuranceValue: row.insurance_value || '',
    numberOfItems: row.number_of_items || '1',
    images: Array.isArray(row.images)
      ? row.images.map((img: any) => typeof img === 'string' ? { src: img, width: 50 } : img)
      : [],
    ownerSignature: row.owner_signature || '',
  };
}

export default function Preview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<ValuationData | null>(null);
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
      if (docRef.current) docRef.current.style.transform = '';
      if (outerRef.current) { outerRef.current.style.height = ''; outerRef.current.style.overflow = ''; }
    };
    const restoreAfterPrint = () => applyScale();
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
    api.getValuation(id)
      .then(row => setData(apiRowToData(row)))
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

      // Hide letterhead images, schedule thead/tfoot, and add padding for clean PDF
      const lhImgs = docRef.current.querySelectorAll('.doc-lh-img');
      const lfImgs = docRef.current.querySelectorAll('.doc-lf-img');
      const scheduleTheads = docRef.current.querySelectorAll('.schedule-table thead');
      const scheduleTfoots = docRef.current.querySelectorAll('.schedule-table tfoot');

      const origLhDisplay: string[] = [];
      const origLfDisplay: string[] = [];
      const origTheadDisplay: string[] = [];
      const origTfootDisplay: string[] = [];
      const origPagePaddingTop: string[] = [];
      const origPagePaddingBottom: string[] = [];

      lhImgs.forEach((el, i) => {
        origLhDisplay[i] = (el as HTMLElement).style.display;
        (el as HTMLElement).style.display = 'none';
      });
      lfImgs.forEach((el, i) => {
        origLfDisplay[i] = (el as HTMLElement).style.display;
        (el as HTMLElement).style.display = 'none';
      });
      scheduleTheads.forEach((el, i) => {
        origTheadDisplay[i] = (el as HTMLElement).style.display;
        (el as HTMLElement).style.display = 'none';
      });
      scheduleTfoots.forEach((el, i) => {
        origTfootDisplay[i] = (el as HTMLElement).style.display;
        (el as HTMLElement).style.display = 'none';
      });
      pages.forEach((el, i) => {
        origPagePaddingTop[i] = (el as HTMLElement).style.paddingTop;
        origPagePaddingBottom[i] = (el as HTMLElement).style.paddingBottom;
        (el as HTMLElement).style.paddingTop = '20mm';
        (el as HTMLElement).style.paddingBottom = '20mm';
      });

      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const filename = `Valuation-${(data.customerName || 'document').replace(/\s+/g, '-')}.pdf`;

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

      // Restore original styles
      lhImgs.forEach((el, i) => { (el as HTMLElement).style.display = origLhDisplay[i]; });
      lfImgs.forEach((el, i) => { (el as HTMLElement).style.display = origLfDisplay[i]; });
      scheduleTheads.forEach((el, i) => { (el as HTMLElement).style.display = origTheadDisplay[i]; });
      scheduleTfoots.forEach((el, i) => { (el as HTMLElement).style.display = origTfootDisplay[i]; });
      pages.forEach((el, i) => {
        (el as HTMLElement).style.paddingTop = origPagePaddingTop[i];
        (el as HTMLElement).style.paddingBottom = origPagePaddingBottom[i];
      });
    } finally {
      docRef.current.style.transform = origTransform;
      setDownloading(false);
    }
  };

  if (notFound) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 48 }}>📄</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Valuation not found</div>
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
          <button className="btn btn-ghost" onClick={() => navigate(`/edit/${id}`)}>✏️ Edit</button>
        </div>
        <span className="preview-title">
          {data.customerName || 'Valuation'} — {data.date ? new Date(data.date + 'T12:00:00').toLocaleDateString('en-GB') : ''}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => window.print()}>
            🖨️ Print
          </button>
          <button className="btn btn-primary" onClick={handleDownloadPdf} disabled={downloading}>
            {downloading ? 'Generating…' : '⬇ Download PDF'}
          </button>
        </div>
      </div>
      <div ref={outerRef} style={{ width: '100%', overflow: 'hidden' }}>
        <div ref={docRef}>
          <DocumentView data={data} />
        </div>
      </div>
    </div>
  );
}
