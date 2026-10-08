import type { ReactNode } from 'react';

export interface TemplateImage {
  /** Asset file name the renderer serves, e.g. "img-3.jpg". */
  src: string;
}

/** Section start marker, used to find which page each section lands on (see pdf/service.ts). */
export const sectionMarker = (id: string) => `@@SECTION:${id}@@`;

export function Section({ id, markers, children, className }: {
  id: string; markers: boolean; children: ReactNode; className?: string;
}) {
  return (
    <section className={className ? `section ${className}` : 'section'}>
      {markers && <span className="marker">{sectionMarker(id)}</span>}
      {children}
    </section>
  );
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/** 1st September 2026 */
export function OrdinalDate({ iso }: { iso: string | null }) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const suffix = d % 100 >= 11 && d % 100 <= 13 ? 'th'
    : d % 10 === 1 ? 'st' : d % 10 === 2 ? 'nd' : d % 10 === 3 ? 'rd' : 'th';
  return <>{d}<sup>{suffix}</sup> {MONTHS[m - 1]} {y}</>;
}

export function AddressLines({ text }: { text: string }) {
  return <>{text.split('\n').filter(l => l.trim()).map((line, i) => <div key={i}>{line}</div>)}</>;
}

export function Photos({ images }: { images: TemplateImage[] }) {
  return (
    <div className="photos">
      {images.map((img, i) => (
        <div className="photo" key={img.src}>
          <img src={img.src} alt={`Item ${i + 1}`} />
          <div className="photo-num">{i + 1}</div>
        </div>
      ))}
    </div>
  );
}

/** Pre-sanitised schedule HTML (see documents/sanitize.ts). */
export function ScheduleHtml({ html, emptyText }: { html: string; emptyText: string }) {
  return html.trim()
    ? <div className="schedule" dangerouslySetInnerHTML={{ __html: html }} />
    : <div className="schedule"><p className="empty">{emptyText}</p></div>;
}
