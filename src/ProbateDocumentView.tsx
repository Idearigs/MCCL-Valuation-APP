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

// Fix common mojibake: £ stored as UTF-8 bytes decoded as Latin-1 → Â£
function fixEncoding(html: string): string {
  return html
    .replace(/Â£/g, '£')
    .replace(/Â€/g, '€')
    .replace(/â€™/g, '\u2019')
    .replace(/â€œ/g, '\u201C')
    .replace(/â€/g, '\u201D');
}

function SchedulePages({ data }: { data: ProbateData }) {
  const pages: string[] = data.schedulePages?.length > 0
    ? data.schedulePages
    : parseSchedulePages('');

  // Strip mojibake from total value too
  const total = fixEncoding(data.totalMarketValue || '');

  return (
    <>
      {pages.map((pageHtml, i) => (
        <A4Page key={i}>
          {i === 0 && <div className="probate-items-label">Items :</div>}
          {pageHtml ? (
            <div className="schedule-html-body probate-schedule-body"
              dangerouslySetInnerHTML={{ __html: fixEncoding(pageHtml) }} />
          ) : (
            <p className="schedule-html-body" style={{ color: '#aaa' }}>(No items entered)</p>
          )}
          {/* Total on last page */}
          {i === pages.length - 1 && (
            <div className="probate-total">
              <strong>Total Estimated Market Value: {total || '—'}</strong>
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

  const PER_PAGE = 12;
  const chunks: ValuationImage[][] = [];
  for (let i = 0; i < images.length; i += PER_PAGE) chunks.push(images.slice(i, i + PER_PAGE));

  return (
    <>
      {chunks.map((chunk, pageIdx) => (
        <A4Page key={pageIdx}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3mm' }}>
            {chunk.map((img, i) => {
              const globalIdx = pageIdx * PER_PAGE + i;
              return (
                <div key={i} style={{ position: 'relative', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                  <div style={{
                    position: 'absolute', top: 3, left: 3,
                    background: 'rgba(0,0,0,0.6)', color: '#fff',
                    fontSize: '7pt', fontWeight: 700,
                    width: 16, height: 16, borderRadius: 3,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1,
                  }}>{globalIdx + 1}</div>
                  <img src={img.src} alt={`Item ${globalIdx + 1}`}
                    style={{ width: '100%', aspectRatio: '1', objectFit: 'cover',
                      border: '1px solid #ccc', borderRadius: 3, display: 'block' }} />
                </div>
              );
            })}
          </div>
        </A4Page>
      ))}
    </>
  );
}

// ── Declaration page ───────────────────────────────────────

function DeclarationPage({ createdAt }: { createdAt: string }) {
  const dateDisplay = createdAt
    ? new Date(createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';

  return (
    <A4Page>
      <hr className="probate-rule" />
      <div className="probate-section-label">Assumptions &amp; Notes:</div>
      <div className="probate-declaration-bullets">
        <p>• Items have been inspected [in person/from photographs/supplied list], and where applicable, measurements and grading are approximate.</p>
        <p>• No laboratory testing or hallmark verification has been undertaken unless otherwise stated.</p>
        <p>• Valuation reflects the condition and market demand at the time of assessment.</p>
      </div>
      <hr className="probate-rule" style={{ marginTop: '14pt' }} />

      <div className="probate-section-label" style={{ marginTop: '6pt' }}>Declaration:</div>
      <div className="probate-declaration-text">
        I certify that this valuation has been carried out independently and to the best of my professional knowledge.
      </div>

      <div className="probate-declaration-fields">
        <p>Valuer's Name: Hasitha De Silva</p>
        <p>Qualifications: BA (Hons) Jewellery Manufacturing and Design.</p>
        <p>University of Kent at Canterbury</p>
        <p className="probate-sig-line">Signature: <span className="probate-sig-blank" /></p>
        <p>Date: {dateDisplay}</p>
      </div>
    </A4Page>
  );
}

// ── Main export ────────────────────────────────────────────

export default function ProbateDocumentView({ data, createdAt }: { data: ProbateData; createdAt?: string }) {
  return (
    <div className="doc-pages-wrap">
      <Page1Cover data={data} />
      <SchedulePages data={data} />
      <PhotosPage data={data} />
      <DeclarationPage createdAt={createdAt || ''} />
    </div>
  );
}
