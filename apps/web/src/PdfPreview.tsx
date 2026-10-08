import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { PdfMode, PdfResult } from '@mccl/shared';
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { api } from './api';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

// ── Preview & print: the PDF is generated on the server ───────
// The browser only displays the finished file, drawing each page when it scrolls into
// view, so large documents never exhaust tablet memory.
export default function PdfPreview({ documentId, title, editPath, fileName }: {
  documentId: string;
  title: string;
  editPath: string;
  fileName: string;
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<PdfMode>('letterhead');
  const [result, setResult] = useState<PdfResult | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Blob | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const autoDownloadDone = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setBusy(true); setError(''); setResult(null); setPdfBytes(null);
    (async () => {
      try {
        const r = await api.generatePdf(documentId, mode);
        const res = await fetch(r.url);
        if (!res.ok) throw new Error('Could not download the generated PDF');
        const blob = await res.blob();
        if (cancelled) return;
        setResult(r); setPdfBytes(blob);
        // Dashboard shortcuts: ?download=true saves the file, ?print=true opens the print dialog.
        if (!autoDownloadDone.current) {
          autoDownloadDone.current = true;
          if (searchParams.get('download') === 'true') saveBlob(blob, fileName);
          else if (searchParams.get('print') === 'true') printBlob(blob);
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [documentId, mode]);

  const handlePrint = () => { if (pdfBytes) printBlob(pdfBytes); };

  return (
    <div className="preview-shell">
      <div className="preview-toolbar no-print">
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => navigate('/')}>← Dashboard</button>
          <button className="btn btn-ghost" onClick={() => navigate(editPath)}>✏️ Edit</button>
        </div>
        <span className="preview-title">{title}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="preview-mode" value={mode} onChange={e => setMode(e.target.value as PdfMode)}
            title="Letterhead: for email/PDF. Plain paper: for printing on pre-printed letterhead.">
            <option value="letterhead">With letterhead</option>
            <option value="stationery">For pre-printed paper</option>
          </select>
          {mode === 'stationery' && (
            <a className="btn btn-ghost" href="/api/pdf/alignment-test" target="_blank" rel="noopener"
              title="One page with rulers: print it on pre-printed paper to check the printer's alignment">
              📏 Alignment test
            </a>
          )}
          <button className="btn btn-ghost" onClick={handlePrint} disabled={!pdfBytes}>🖨️ Print</button>
          <button className="btn btn-primary" onClick={() => pdfBytes && saveBlob(pdfBytes, fileName)} disabled={!pdfBytes}>
            ⬇ Download PDF
          </button>
        </div>
      </div>

      {busy && (
        <div className="pdf-status">
          <div className="upload-spinner" />
          <div>Generating document…</div>
        </div>
      )}
      {error && (
        <div className="pdf-status pdf-status-error">
          <div>⚠️ {error}</div>
          <button className="btn btn-primary btn-sm" onClick={() => setMode(m => m)}>Try again</button>
        </div>
      )}
      {result && pdfBytes && (
        <>
          <div className="pdf-meta no-print">
            {result.pageCount} pages · {(result.byteSize / 1e6).toFixed(1)} MB
            {result.cached ? ' · unchanged since last generated' : ` · generated in ${(result.renderMs / 1000).toFixed(1)}s`}
          </div>
          {mode === 'stationery' && (
            <div className="pdf-meta pdf-print-tip no-print">
              Printing on pre-printed letterhead: in the print dialog choose <b>Scale: Actual size (100%)</b>, not “Fit to page”.
            </div>
          )}
          <PdfPages blob={pdfBytes} />
        </>
      )}
    </div>
  );
}

/** Prints the actual PDF, so paper output matches the preview exactly. */
function printBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  frame.src = url;
  frame.onload = () => {
    try { frame.contentWindow?.focus(); frame.contentWindow?.print(); }
    catch { window.open(url, '_blank'); } // e.g. iPad: open in a tab and print from there
  };
  document.body.appendChild(frame);
  setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 60_000);
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Renders PDF pages lazily: each page is drawn only when it is near the viewport. */
function PdfPages({ blob }: { blob: Blob }) {
  const [doc, setDoc] = useState<pdfjs.PDFDocumentProxy | null>(null);

  useEffect(() => {
    let task: pdfjs.PDFDocumentLoadingTask | null = null;
    let cancelled = false;
    blob.arrayBuffer().then(buf => {
      if (cancelled) return;
      task = pdfjs.getDocument({ data: new Uint8Array(buf) });
      task.promise.then(d => { if (!cancelled) setDoc(d); });
    });
    return () => { cancelled = true; task?.destroy(); };
  }, [blob]);

  if (!doc) return null;
  return (
    <div className="pdf-pages">
      {Array.from({ length: doc.numPages }, (_, i) => <PdfPage key={i} doc={doc} pageNumber={i + 1} />)}
    </div>
  );
}

function PdfPage({ doc, pageNumber }: { doc: pdfjs.PDFDocumentProxy; pageNumber: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!visible || !canvas || !wrap) return;
    let cancelled = false;
    let renderTask: { cancel(): void; promise: Promise<void> } | null = null;
    doc.getPage(pageNumber).then(page => {
      if (cancelled) return;
      const cssWidth = wrap.clientWidth;
      const base = page.getViewport({ scale: 1 });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: (cssWidth / base.width) * dpr });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      renderTask = page.render({ canvas, viewport });
      renderTask.promise.catch(() => undefined);
    });
    return () => {
      cancelled = true;
      renderTask?.cancel();
      // Free the bitmap when the page scrolls far away (keeps memory flat on iPads).
      canvas.width = 0; canvas.height = 0;
    };
  }, [visible, doc, pageNumber]);

  return (
    <div ref={wrapRef} className="pdf-page">
      <canvas ref={canvasRef} />
    </div>
  );
}
