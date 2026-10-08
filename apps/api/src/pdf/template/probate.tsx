import type { ProbateDetails } from '@mccl/shared';
import { Photos, ScheduleHtml, Section, type TemplateImage } from './common';

export interface ProbateTemplateProps {
  details: ProbateDetails;
  scheduleHtml: string;
  images: TemplateImage[];
  /** Date the valuation was prepared (dd/mm/yyyy on the declaration). */
  preparedOn: string;
  markers: boolean;
}

export function ProbateDocument(p: ProbateTemplateProps) {
  const d = p.details;
  return (
    <div className="probate">
      <Section id="cover" markers={p.markers}>
        <p className="probate-title">Jewellery Valuation for Probate</p>
        <p className="probate-subtitle">
          Prepared in accordance with HMRC guidelines for Inheritance Tax purposes.
        </p>
        <hr className="probate-rule" />
        <div className="probate-section-label">Client Details:</div>
        <div className="probate-field">Name of Executor/Administrator: {d.executorName}</div>
        <div className="probate-field">Address: {d.executorAddress}</div>
        <div className="probate-field">Contact Number: {d.contactNumber}</div>
        <div className="probate-field">Email: {d.email}</div>
        <hr className="probate-rule" />
        <div className="probate-section-label">Deceased Details:</div>
        <div className="probate-field">Name of Deceased: {d.deceasedName}</div>
        <div className="probate-field">Probate Reference {d.probateReference || 'N/A'}</div>
        <hr className="probate-rule" />
        <div className="probate-section-label">Purpose of Valuation:</div>
        <div className="probate-purpose-text">
          This valuation has been prepared for the sole purpose of probate and Inheritance Tax
          assessment. Values stated are open market values as of the date of death and reflect the
          estimated price the items might reasonably achieve if sold on the open market (e.g. via
          auction), rather than replacement or retail values.
        </div>
      </Section>

      <Section id="schedule" markers={p.markers}>
        <div className="probate-section-label">Items :</div>
        <ScheduleHtml html={p.scheduleHtml} emptyText="(No items entered)" />
        <div className="probate-total">Total Estimated Market Value: {d.totalMarketValue || '—'}</div>
      </Section>

      {p.images.length > 0 && (
        <Section id="pictures" markers={p.markers}>
          <Photos images={p.images} />
        </Section>
      )}

      <Section id="declaration" markers={p.markers}>
        <div className="probate-declaration">
          <hr className="probate-rule" />
          <div className="probate-section-label">Assumptions &amp; Notes:</div>
          <p>• Items have been inspected [in person/from photographs/supplied list], and where applicable, measurements and grading are approximate.</p>
          <p>• No laboratory testing or hallmark verification has been undertaken unless otherwise stated.</p>
          <p>• Valuation reflects the condition and market demand at the time of assessment.</p>
          <hr className="probate-rule" style={{ marginTop: '14pt' }} />
          <div className="probate-section-label" style={{ marginTop: '6pt' }}>Declaration:</div>
          <p style={{ margin: '6pt 0 16pt' }}>
            I certify that this valuation has been carried out independently and to the best of my professional knowledge.
          </p>
          <div className="probate-declaration-fields">
            <p>Valuer&apos;s Name: Hasitha De Silva</p>
            <p>Qualifications: BA (Hons) Jewellery Manufacturing and Design.</p>
            <p>University of Kent at Canterbury</p>
            <p className="probate-sig-line">Signature: <span className="probate-sig-blank" /></p>
            <p>Date: {p.preparedOn}</p>
          </div>
        </div>
      </Section>
    </div>
  );
}
