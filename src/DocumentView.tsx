import { useState } from 'react';
import { ValuationData, ValuationImage } from './types';

// ── Helpers ────────────────────────────────────────────────

function OrdinalDate({ iso }: { iso: string }) {
  if (!iso) return null;
  const d = new Date(iso + 'T12:00:00');
  const day = d.getDate();
  const s =
    day % 100 >= 11 && day % 100 <= 13 ? 'th' :
    day % 10 === 1 ? 'st' :
    day % 10 === 2 ? 'nd' :
    day % 10 === 3 ? 'rd' : 'th';
  const months = ['January','February','March','April','May','June',
    'July','August','September','October','November','December'];
  return <>{day}<sup>{s}</sup> {months[d.getMonth()]} {d.getFullYear()}</>;
}

function AddressLines({ text }: { text: string }) {
  return <>
    {text.split('\n').filter(Boolean).map((line, i) => <div key={i}>{line}</div>)}
  </>;
}

// ── Shared: Real letterhead images ─────────────────────────

function LhHeader() {
  const [ok, setOk] = useState(true);
  return ok ? (
    <img src="/letterhead-header.png" className="doc-lh-img" onError={() => setOk(false)} />
  ) : (
    // Fallback plain header if image missing
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

// ── A4 page wrapper ────────────────────────────────────────

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

// ── Page 1: Cover Letter ───────────────────────────────────

function Page1Cover({ data }: { data: ValuationData }) {
  return (
    <A4Page>
      <p className="cover-title">Valuation For Insurance Replacement</p>
      <div className="cover-property">
        <div>Property Of {data.customerName}</div>
        <AddressLines text={data.customerAddress} />
      </div>
      <p className="cover-date">
        <OrdinalDate iso={data.date} />
      </p>
      <div className="doc-body">
        <p>
          In accordance with your instructions, I am pleased to enclose your valuation Schedule
          for the purpose of Insurance Replacement.
        </p>
        <p>
          The values applied to your items within the valuation is based on the most appropriate
          markets for replacing each individual piece and these markets will vary according to
          the age, design and workmanship of the jewellery with other factors. All the items have
          been thoroughly examined with great care to ensure that your valuation is a
          comprehensive and fully researched as possible. The values represent the Jeweller's
          professional opinion of the approximate replacement value, within the market and are
          only valid for the purpose specified. This document is not to be reproduced or used for
          the purpose of re-sale including internet auction sites.
        </p>
      </div>
    </A4Page>
  );
}

// ── Page 2: Carried Out By ─────────────────────────────────

function Page2CarriedOut({ data }: { data: ValuationData }) {
  return (
    <A4Page>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100%' }}>
        <p className="carried-heading">Carried out on behalf of</p>
        <div className="carried-block">
          <div>{data.customerName}</div>
          <AddressLines text={data.customerAddress} />
        </div>
        <div style={{ marginTop: '14mm' }}>
          <p className="carried-heading">Carried out by</p>
          <div className="carried-block">
            <div>Hasitha De Silva</div>
            <div>B.A (Hons) Jewellery Design &amp; Manufacture</div>
            <div>University of Kent at Canterbury</div>
            <div>Dated</div>
            <div><OrdinalDate iso={data.date} /></div>
          </div>
        </div>
      </div>
    </A4Page>
  );
}

// ── Page 3: Contents ───────────────────────────────────────

function Page3Contents() {
  const items = [
    { label: 'Contents', page: '3' },
    { label: 'Schedule', page: '4' },
    { label: 'Picture Schedule', page: '5' },
    { label: 'Glossary', page: '6' },
  ];
  return (
    <A4Page>
      <p className="doc-section-title">Contents</p>
      <div className="contents-note">
        This report is valid only in its entirety and for its stated purpose and intended use. It
        has been prepared in accordance with the standards laid down by the National
        Association of Jewellers and contains the following elements.
      </div>
      {items.map(({ label, page }) => (
        <div className="contents-item" key={label}>
          <span>{label}</span>
          <span className="contents-dots" />
          <span className="contents-page">{page}</span>
        </div>
      ))}
    </A4Page>
  );
}

// ── Pages 4–7: Schedule — thead/tfoot table trick ──────────
// The <thead> and <tfoot> contain the real letterhead images.
// When this section spans multiple printed pages, Chrome automatically
// repeats both on every physical page.

function Page4to7Schedule({ data }: { data: ValuationData }) {
  const year = data.date
    ? new Date(data.date + 'T12:00:00').getFullYear()
    : new Date().getFullYear();
  const hasPricing = data.pricingRows.some(r => r.component || r.estimatedValue);

  return (
    <div className="schedule-page-wrap">
      <table className="schedule-table">

        {/* ── Repeating header spacer (no letterhead — printing on pre-printed paper) ── */}
        <thead>
          <tr><td style={{ padding: 0 }}>
            <div className="schedule-lh-spacer" />
          </td></tr>
        </thead>

        {/* ── Repeating footer spacer ── */}
        <tfoot>
          <tr><td style={{ padding: 0 }}>
            <div className="schedule-lf-spacer" />
          </td></tr>
        </tfoot>

        {/* ── All schedule content ── */}
        <tbody>
          <tr><td style={{ padding: '4mm 20mm 6mm' }}>
            <p className="doc-section-title">Schedule</p>

            {data.scheduleHtml ? (
              <div className="schedule-html-body"
                dangerouslySetInnerHTML={{ __html: data.scheduleHtml }} />
            ) : (
              <p className="schedule-html-body" style={{ color: '#aaa' }}>
                (No schedule content entered)
              </p>
            )}

            {hasPricing && (
              <div className="pricing-section">
                <hr className="schedule-rule" />
                <p className="pricing-header">
                  Replacement Cost (UK Retail Market {year})
                </p>
                <div className="pricing-row-doc">
                  <span style={{ textDecoration: 'underline', fontWeight: 700, fontStyle: 'italic' }}>
                    Component
                  </span>
                </div>
                <div className="pricing-row-doc" style={{ marginTop: '-2mm' }}>
                  <span style={{ textDecoration: 'underline', fontWeight: 700, fontStyle: 'italic' }}>
                    Estimated Value
                  </span>
                </div>

                {data.pricingRows.filter(r => r.component).map(row => (
                  <div key={row.id}>
                    <div className="pricing-row-doc" style={{ marginTop: '4mm' }}>
                      <span style={{ fontWeight: 700, fontStyle: 'italic', textDecoration: 'underline' }}>
                        {row.component}
                      </span>
                    </div>
                    {row.estimatedValue && (
                      <div className="pricing-row-doc" style={{ marginTop: '-1mm' }}>
                        <span style={{ fontStyle: 'italic' }}>{row.estimatedValue}</span>
                      </div>
                    )}
                  </div>
                ))}

                {data.totalRange && (
                  <div style={{ marginTop: '6mm' }}>
                    <p className="pricing-total-label">Total realistic replacement value</p>
                    <p className="pricing-total-value">{data.totalRange}</p>
                  </div>
                )}
                {data.insuranceValue && (
                  <>
                    <p className="pricing-insurance-label">Recommended Insurance Value:</p>
                    <p className="pricing-insurance-value">{data.insuranceValue}</p>
                    <p className="pricing-footnote">
                      (Industry standard is to round up slightly to reflect fluctuating diamond
                      costs, bespoke labour, and jewellery inflation.)
                    </p>
                  </>
                )}
              </div>
            )}
          </td></tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Page 8: Picture Schedule ───────────────────────────────

function Page8Pictures({ data }: { data: ValuationData }) {
  // Support both old string[] and new ValuationImage[] formats
  const images: ValuationImage[] = data.images.map((img: any) =>
    typeof img === 'string' ? { src: img, width: 50 } : img
  );
  return (
    <A4Page>
      <p className="doc-section-title">Picture Schedule</p>
      {images.length === 0 ? (
        <p className="doc-body" style={{ color: '#aaa' }}>(No images uploaded)</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4mm' }}>
          {images.map((img, i) => (
            <div key={i} style={{ width: `calc(${img.width}% - 4mm)`, pageBreakInside: 'avoid', breakInside: 'avoid' }}>
              <img src={img.src} alt={`Item ${i + 1}`}
                style={{ width: '100%', maxHeight: '80mm', objectFit: 'contain',
                  border: '1px solid #ddd', borderRadius: 4 }} />
            </div>
          ))}
        </div>
      )}
    </A4Page>
  );
}

// ── Page 9: Glossary ───────────────────────────────────────

const GLOSSARY_TERMS = [
  { term: 'Antique', def: 'Generally understood to refer to items over one hundred years of age.' },
  { term: 'Appraisal', def: 'The valuation; an estimate of value. An expert estimation of the quality, quantity, and other characteristics of someone or something.' },
  { term: 'Brilliant cut', def: 'A type of cutting, especially of diamonds, with 32 facets plus a table placed above the girdle and 24 facets, plus the culet (if present, placed below the girdle, in a "sunburst" pattern. The brilliant cut stone may have a variety of shapes, such as round, oval, pear shaped, marquise (boat-shaped), or heart shaped.' },
  { term: 'Bruted', def: 'A term used to describe the unpolished surface on the girdle of a cut Diamond. Frosted in appearance as a result of being shaped on a lathe (Bruting).' },
  { term: 'Chainiered', def: 'Containing small metal tubes (hinges). Often used as decoration or as part of a hinge.' },
  { term: 'CIBJO', def: 'Confédération Internationale de la Bijouterie, Joaillerie, Orfèvrerie, des Diamants, Perles et Pierres. A European regulatory body encouraging many aspects of International cooperation in the jewellery industry but in particular, enforcing correct nomenclature and definition.' },
  { term: 'Condition', def: 'The physical description of the property relating to its completeness for performing an identified role. Impairments could include damage of any kind, loss of components, wear and tear and inappropriate or unacceptable repairs.' },
  { term: 'Cut', def: '1.) In gems, a fashioned gem, as opposed to a rough or uncut gem. 2.) The shaping and polishing of a gemstone. 3.) The proportions to which a gem is fashioned. One of the "four C\'s" in diamond grading.' },
  { term: 'Diamond', def: 'Hardest of natural substances, composed of pure carbon.' },
  { term: 'Clarity', def: 'The incidence of inclusions and surface blemishes. One of the "four C\'s" in Diamond grading. The G.I.A clarity grading scale is used in this report. Size, position and number of inclusions determine the distinction between the split grades. The descriptions below assume an expert eye using a 10X loupe corrected for spherical aberration.' },
];

const CLARITY_GRADES = [
  { grade: 'FL', label: 'Flawless', desc: 'No inclusions or blemishes are visible to a skilled grader using 10× magnification.' },
  { grade: 'IF', label: 'Internally Flawless', desc: 'No inclusions and only blemishes are visible to a skilled grader using 10× magnification.' },
  { grade: 'VVS', label: 'Very, Very Slightly Included', desc: 'Inclusions are difficult for a skilled grader to see under 10× magnification.' },
  { grade: 'VS', label: 'Very Slightly Included', desc: 'Inclusions are clearly visible under 10× magnification but can be characterised as minor.' },
  { grade: 'SI', label: 'Slightly Included', desc: 'Inclusions are noticeable to a skilled grader using 10× magnification.' },
  { grade: 'I1–I2', label: 'Included', desc: 'Inclusions are obvious under 10× magnification and may affect transparency and brilliance.' },
  { grade: 'I3', label: 'Included', desc: 'Inclusions are very obvious under 10× magnification and may affect transparency and brilliance.' },
];

function Page9Glossary() {
  return (
    <A4Page>
      <p className="doc-section-title">Glossary</p>
      <div className="glossary-body">
        {GLOSSARY_TERMS.map(({ term, def }) => (
          <p key={term} style={{ marginBottom: '4pt' }}>
            <span className="glossary-term">{term}:</span> {def}
          </p>
        ))}
        <div style={{ margin: '7pt 0 7pt' }}>
          <img
            src="/clarity-diagram.png"
            alt="Diamond Clarity Diagram: FL IF VVS VS SI I1-12 I3"
            style={{ width: '100%', maxWidth: '100%', display: 'block' }}
          />
        </div>
        {CLARITY_GRADES.map(({ grade, label, desc }) => (
          <p key={grade} style={{ marginBottom: '3pt' }}>
            <span className="glossary-term">{grade}: {label}</span> — {desc}
          </p>
        ))}
      </div>
    </A4Page>
  );
}

// ── Page 10: Insurer Notice ────────────────────────────────

function Page10InsurerNotice({ data }: { data: ValuationData }) {
  const totalDisplay = data.insuranceValue
    ? `£${data.insuranceValue.replace(/^£/, '')}`
    : '£0.00';

  return (
    <A4Page>
      <p className="doc-section-title" style={{ marginBottom: '6mm' }}>Insurer Notice</p>
      <div className="insurer-header-text">
        <div>PLEASE SEND THIS NOTICE TO YOUR INSURANCE PROVIDER</div>
        <div>INSURER INFORMATION: PLEASE READ CAREFULLY</div>
      </div>
      <div className="insurer-row">
        <div>Valuation Date: <OrdinalDate iso={data.date} /></div>
        <div>Number of Items: {data.numberOfItems || '1'}</div>
        <div style={{ fontWeight: 700 }}>Total value: {totalDisplay}</div>
      </div>
      <hr className="insurer-rule" />
      <div className="insurer-row" style={{ marginBottom: '4mm' }}>
        <div>Property Of</div>
      </div>
      <div className="insurer-row" style={{ fontWeight: 700 }}>
        <div>{data.customerName}</div>
        <AddressLines text={data.customerAddress} />
      </div>
      <hr className="insurer-rule" />
      <p className="insurer-contact">
        If you have any questions, please contact McCulloch the Jewellers on 0115 925 7552
      </p>
      <div className="insurer-sig-block">
        <div className="insurer-sig-right">
          {data.ownerSignature ? (
            <img src={data.ownerSignature} alt="Signature"
              style={{ maxWidth: 130, maxHeight: 70, display: 'block', margin: '0 auto 4px' }} />
          ) : (
            <div style={{
              width: 130, height: 60, borderBottom: '1px solid #555',
              marginBottom: 4, display: 'flex', alignItems: 'flex-end',
              justifyContent: 'center', fontSize: '8pt', color: '#aaa', fontStyle: 'italic',
            }}>Signature</div>
          )}
          <div className="insurer-sig-name">Hasitha De Silva</div>
          <div className="insurer-sig-place">Andrew McCulloch Jewellers</div>
        </div>
      </div>
    </A4Page>
  );
}

// ── Main export ────────────────────────────────────────────

export default function DocumentView({ data }: { data: ValuationData }) {
  return (
    <div className="doc-pages-wrap">
      <Page1Cover data={data} />
      <Page2CarriedOut data={data} />
      <Page3Contents />
      <Page4to7Schedule data={data} />
      <Page8Pictures data={data} />
      <Page9Glossary />
      <Page10InsurerNotice data={data} />
    </div>
  );
}
