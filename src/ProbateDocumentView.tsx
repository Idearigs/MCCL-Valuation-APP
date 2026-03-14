import { useState } from 'react';
import { ProbateData, ValuationImage } from './types';

// ── Shared letterhead components ───────────────────────────

function LhHeader() {
  const [ok, setOk] = useState(true);
  return ok ? (
    <img src="/letterhead-header.png" className="doc-lh-img" onError={() => setOk(false)} />
  ) : (
    <div className="doc-lh-fallback">
      <div className="doc-company-name">McCulloch The Jewellers</div>
      <div className="doc-company-sub">JEWELLERS &amp; WATCHMAKERS</div>
      <hr className="doc-lh-rule" />
    </div>
  );
}

function LhFooter() {
  const [ok, setOk] = useState(true);
  return ok ? (
    <img src="/letterhead-footer.png" className="doc-lf-img" onError={() => setOk(false)} />
  ) : (
    <div className="doc-lf-fallback">
      7 The Square, Beeston NG9 2JG · 0115 925 7552 · has@mccullochjewellers.co.uk
    </div>
  );
}

function A4Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="doc-page">
      <LhHeader />
      <div className="doc-content">
        {children}
      </div>
      <LhFooter />
    </div>
  );
}

// ── Page 1: Cover / Details ────────────────────────────────

function Page1Cover({ data }: { data: ProbateData }) {
  return (
    <A4Page>
      <p className="probate-title">Jewellery Valuation for Probate</p>
      <p className="probate-subtitle">
        Prepared in accordance with HMRC guidelines for Inheritance Tax purposes.
      </p>
      <hr className="probate-rule" />

      <div className="probate-section-label">Client Details:</div>
      <div className="probate-field">Name of Executor/Administrator: {data.executorName}</div>
      <div className="probate-field">Address: {data.executorAddress}</div>
      <div className="probate-field">Contact Number: {data.contactNumber}</div>
      <div className="probate-field">Email: {data.email}</div>
      <hr className="probate-rule" />

      <div className="probate-section-label">Deceased Details:</div>
      <div className="probate-field">Name of Deceased: {data.deceasedName}</div>
      <div className="probate-field">Probate Reference {data.probateReference || 'N/A'}</div>
      <hr className="probate-rule" />

      <div className="probate-section-label">Purpose of Valuation:</div>
      <div className="probate-purpose-text">
        This valuation has been prepared for the sole purpose of probate and Inheritance Tax
        assessment. Values stated are open market values as of the date of death and reflect the
        estimated price the items might reasonably achieve if sold on the open market (e.g. via
        auction), rather than replacement or retail values.
      </div>
    </A4Page>
  );
}

// ── Pages 2+: Schedule ─────────────────────────────────────

function parseSchedulePages(raw: string): string[] {
  if (!raw) return [''];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.length > 0 ? parsed : [''];
  } catch { /* legacy */ }
  return [raw];
}

function SchedulePages({ data }: { data: ProbateData }) {
  const pages: string[] = data.schedulePages?.length > 0
    ? data.schedulePages
    : parseSchedulePages('');

  return (
    <>
      {pages.map((pageHtml, i) => (
        <A4Page key={i}>
          {i === 0 && <div className="probate-items-label">Items :</div>}
          {pageHtml ? (
            <div className="schedule-html-body" dangerouslySetInnerHTML={{ __html: pageHtml }} />
          ) : (
            <p className="schedule-html-body" style={{ color: '#aaa' }}>(No items entered)</p>
          )}
          {/* Total on last page */}
          {i === pages.length - 1 && data.totalMarketValue && (
            <div className="probate-total">
              Total Estimated Market Value: {data.totalMarketValue}
            </div>
          )}
        </A4Page>
      ))}
    </>
  );
}

// ── Photos page ────────────────────────────────────────────

function PhotosPage({ data }: { data: ProbateData }) {
  const images: ValuationImage[] = data.images.map((img: any) =>
    typeof img === 'string' ? { src: img, width: 50 } : img
  );
  if (images.length === 0) return null;
  return (
    <A4Page>
      <p className="doc-section-title">Picture Schedule</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4mm' }}>
        {images.map((img, i) => (
          <div key={i} style={{ width: `calc(${img.width}% - 4mm)`, pageBreakInside: 'avoid', breakInside: 'avoid' }}>
            <img src={img.src} alt={`Item ${i + 1}`}
              style={{ width: '100%', maxHeight: '80mm', objectFit: 'contain',
                border: '1px solid #ddd', borderRadius: 4 }} />
          </div>
        ))}
      </div>
    </A4Page>
  );
}

// ── Main export ────────────────────────────────────────────

export default function ProbateDocumentView({ data }: { data: ProbateData }) {
  return (
    <div className="doc-pages-wrap">
      <Page1Cover data={data} />
      <SchedulePages data={data} />
      <PhotosPage data={data} />
    </div>
  );
}
