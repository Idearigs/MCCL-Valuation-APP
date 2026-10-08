import type { ValuationDetails } from '@mccl/shared';
import { AddressLines, OrdinalDate, Photos, ScheduleHtml, Section, type TemplateImage } from './common';

export interface ValuationTemplateProps {
  details: ValuationDetails;
  documentDate: string | null;
  scheduleHtml: string;
  images: TemplateImage[];
  signatureSrc: string | null;
  clarityDiagramSrc: string;
  /** Start page of each section, filled in on the second render pass. */
  pages: Partial<Record<'schedule' | 'pictures' | 'glossary', number>>;
  markers: boolean;
}

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

export function ValuationDocument(p: ValuationTemplateProps) {
  const d = p.details;
  const year = p.documentDate ? p.documentDate.slice(0, 4) : String(new Date().getFullYear());
  const pricingRows = d.pricingRows.filter(r => r.component || r.estimatedValue);
  const hasPricing = pricingRows.length > 0 || d.totalRange || d.insuranceValue;
  const insurance = d.insuranceValue ? `£${d.insuranceValue.replace(/^£/, '')}` : '£0.00';

  const contents: [string, number | undefined][] = [
    ['Contents', 3],
    ['Schedule', p.pages.schedule],
    ['Picture Schedule', p.pages.pictures],
    ['Glossary', p.pages.glossary],
  ];

  return (
    <>
      <Section id="cover" markers={p.markers}>
        <p className="cover-title">Valuation For Insurance Replacement</p>
        <div className="cover-property">
          <div>Property Of {d.customerName}</div>
          <AddressLines text={d.customerAddress} />
        </div>
        <p className="cover-date"><OrdinalDate iso={p.documentDate} /></p>
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
            comprehensive and fully researched as possible. The values represent the Jeweller&apos;s
            professional opinion of the approximate replacement value, within the market and are
            only valid for the purpose specified. This document is not to be reproduced or used for
            the purpose of re-sale including internet auction sites.
          </p>
        </div>
      </Section>

      <Section id="carried" markers={p.markers}>
        <div className="fill-page">
          <p className="carried-heading">Carried out on behalf of</p>
          <div className="carried-block">
            <div>{d.customerName}</div>
            <AddressLines text={d.customerAddress} />
          </div>
          <div style={{ marginTop: '14mm' }}>
            <p className="carried-heading">Carried out by</p>
            <div className="carried-block">
              <div>Hasitha De Silva</div>
              <div>B.A (Hons) Jewellery Design &amp; Manufacture</div>
              <div>University of Kent at Canterbury</div>
              <div>Dated</div>
              <div><OrdinalDate iso={p.documentDate} /></div>
            </div>
          </div>
        </div>
      </Section>

      <Section id="contents" markers={p.markers}>
        <p className="doc-section-title">Contents</p>
        <div className="contents-note">
          This report is valid only in its entirety and for its stated purpose and intended use. It
          has been prepared in accordance with the standards laid down by the National
          Association of Jewellers and contains the following elements.
        </div>
        {contents.map(([label, page]) => (
          <div className="contents-item" key={label}>
            <span>{label}</span>
            <span className="contents-dots" />
            {/* Fixed-width slot so the 2nd pass can't change the layout */}
            <span style={{ minWidth: '8mm', textAlign: 'right' }}>{page ?? '00'}</span>
          </div>
        ))}
      </Section>

      <Section id="schedule" markers={p.markers}>
        <p className="doc-section-title">Schedule</p>
        <ScheduleHtml html={p.scheduleHtml} emptyText="(No schedule content entered)" />
      </Section>

      {hasPricing && (
        <Section id="pricing" markers={p.markers}>
          <p className="pricing-header">Replacement Cost (UK Retail Market {year})</p>
          <div className="pricing-row"><span className="pricing-label">Component</span></div>
          <div className="pricing-row" style={{ marginTop: '-2mm' }}><span className="pricing-label">Estimated Value</span></div>
          {pricingRows.map(row => (
            <div className="keep" key={row.id}>
              <div className="pricing-row" style={{ marginTop: '4mm' }}>
                <span className="pricing-label">{row.component}</span>
              </div>
              {row.estimatedValue && <div className="pricing-row" style={{ marginTop: '-1mm' }}>{row.estimatedValue}</div>}
            </div>
          ))}
          {d.totalRange && (
            <div className="keep">
              <p className="pricing-total-label">Total realistic replacement value</p>
              <p className="pricing-total-value">{d.totalRange}</p>
            </div>
          )}
          {d.insuranceValue && (
            <div className="keep">
              <p className="pricing-insurance-label">Recommended Insurance Value:</p>
              <p className="pricing-insurance-value">{d.insuranceValue}</p>
              <p className="pricing-footnote">
                (Industry standard is to round up slightly to reflect fluctuating diamond
                costs, bespoke labour, and jewellery inflation.)
              </p>
            </div>
          )}
        </Section>
      )}

      <Section id="pictures" markers={p.markers}>
        <p className="doc-section-title">Picture Schedule</p>
        {p.images.length > 0
          ? <Photos images={p.images} />
          : <p className="doc-body" style={{ color: '#aaa' }}>(No images uploaded)</p>}
      </Section>

      <Section id="glossary" markers={p.markers}>
        <p className="doc-section-title">Glossary</p>
        <div className="glossary">
          {GLOSSARY_TERMS.map(({ term, def }) => (
            <p key={term}><span className="glossary-term">{term}:</span> {def}</p>
          ))}
          <img className="clarity-diagram" src={p.clarityDiagramSrc} alt="Diamond clarity scale" />
          {CLARITY_GRADES.map(({ grade, label, desc }) => (
            <p key={grade}><span className="glossary-term">{grade}: {label}</span> — {desc}</p>
          ))}
        </div>
      </Section>

      <Section id="insurer" markers={p.markers} className="insurer">
        <p className="doc-section-title" style={{ marginBottom: '4mm' }}>Insurer Notice</p>
        <div className="insurer-header-text">
          <div>PLEASE SEND THIS NOTICE TO YOUR INSURANCE PROVIDER</div>
          <div>INSURER INFORMATION: PLEASE READ CAREFULLY</div>
        </div>
        <div className="insurer-row">
          <div>Valuation Date: <OrdinalDate iso={p.documentDate} /></div>
          <div>Number of Items: {d.numberOfItems || '1'}</div>
          <div style={{ fontWeight: 700 }}>Total value: {insurance}</div>
        </div>
        <hr className="insurer-rule" />
        <div className="insurer-row" style={{ marginBottom: '2mm' }}>Property Of</div>
        <div className="insurer-row" style={{ fontWeight: 700 }}>
          <div>{d.customerName}</div>
          <AddressLines text={d.customerAddress} />
        </div>
        <hr className="insurer-rule" />
        <p className="insurer-contact">
          Should you require any further information or assistance regarding this valuation, please do not
          hesitate to contact McCulloch the Jewellers on 0115&nbsp;925&nbsp;7552.
        </p>
        <div className="insurer-sig-block">
          <div className="insurer-sig">
            {p.signatureSrc ? <img src={p.signatureSrc} alt="Signature" /> : <div className="insurer-sig-blank" />}
            <div className="insurer-sig-name">Hasitha De Silva</div>
            <div className="insurer-sig-place">Andrew McCulloch Jewellers</div>
          </div>
        </div>
      </Section>
    </>
  );
}
