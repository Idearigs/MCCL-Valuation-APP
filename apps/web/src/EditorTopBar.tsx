import { IcBack, IcEye, IcSave } from './icons';

/** Sticky header for the valuation and probate editors (same style as the preview's). */
export default function EditorTopBar({ title, saved, saving, onBack, onSave, onPreview }: {
  title: string;
  saved: boolean;
  saving: boolean;
  onBack: () => void;
  onSave: () => void;
  onPreview: () => void;
}) {
  const status = saving ? 'Saving…' : saved ? 'All changes saved' : 'Not saved yet';
  return (
    <header className="tb-bar">
      <div className="tb-inner tb-inner-editor">
        <div className="tb-heading-row">
          <button className="tb-icon-btn" onClick={onBack} aria-label="Back to dashboard" title="Dashboard">
            <IcBack />
          </button>
          <div className="tb-heading">
            <div className="tb-title">{title}</div>
            <div className={`tb-sub${saved && !saving ? ' tb-sub-ok' : ''}`}>{status}</div>
          </div>
        </div>
        <div className="tb-buttons">
          <button className="tb-btn" onClick={onSave} disabled={saving} title="Save draft">
            <IcSave /><span className="tb-label">Save</span>
          </button>
          <button className="tb-btn tb-btn-primary" onClick={onPreview} disabled={saving} title="Save and preview the document">
            <IcEye /><span>Preview</span>
          </button>
        </div>
      </div>
    </header>
  );
}
