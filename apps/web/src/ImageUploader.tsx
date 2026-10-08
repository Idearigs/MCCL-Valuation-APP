import { useState, useRef } from 'react';
import { ValuationImage } from './types';
import { api } from './api';

// ── Image Uploader (shared by the valuation and probate editors) ──
// Images belong to a saved document on the server, so `ensureDocId` saves a new
// document first if needed. Uploads go one at a time with a progress overlay.
export default function ImageUploader({ images, onChange, ensureDocId }: {
  images: ValuationImage[];
  onChange: (imgs: ValuationImage[]) => void;
  ensureDocId: () => Promise<string>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploadDone, setUploadDone] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);

  const uploading = uploadTotal > 0;

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    const fileArray = Array.from(files).filter(f => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
    if (fileArray.length === 0) return;
    setUploadDone(0);
    setUploadTotal(fileArray.length);
    const added: ValuationImage[] = [];
    try {
      const docId = await ensureDocId();
      for (let i = 0; i < fileArray.length; i++) {
        const img = await api.uploadImage(docId, fileArray[i]);
        added.push({ id: img.id, src: img.thumbUrl, width: img.sizePct });
        setUploadDone(i + 1);
      }
    } catch (err) {
      alert(`Image upload failed${added.length ? ` after ${added.length} image(s)` : ''}: ${(err as Error).message}`);
    } finally {
      if (added.length) onChange([...images, ...added]);
      setUploadTotal(0);
      setUploadDone(0);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = async (img: ValuationImage) => {
    try {
      await api.deleteImage(await ensureDocId(), img.id);
      onChange(images.filter(i => i.id !== img.id));
    } catch (err) {
      alert(`Could not remove image: ${(err as Error).message}`);
    }
  };

  const pct = uploadTotal > 0 ? Math.round((uploadDone / uploadTotal) * 100) : 0;

  return (
    <div>
      {uploading && (
        <div className="upload-overlay">
          <div className="upload-overlay-card">
            <div className="upload-spinner" />
            <div className="upload-overlay-title">Uploading Images…</div>
            <div className="upload-overlay-sub">{uploadDone} of {uploadTotal} done</div>
            <div className="upload-progress-track">
              <div className="upload-progress-bar" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
        onChange={e => addFiles(e.target.files)} />
      <div
        className={`image-dropzone${dragging ? ' dragover' : ''}`}
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
      >
        <div className="image-dropzone-icon">📷</div>
        <p style={{ fontWeight: 600 }}>Click or drag images here</p>
        <p>Select multiple at once — JPEG, PNG, WEBP supported</p>
      </div>
      {images.length > 0 && (
        <div className="image-grid">
          {images.map((img, i) => (
            <div className="image-thumb" key={img.id}>
              <div className="image-thumb-num">{i + 1}</div>
              <img src={img.src} alt={`Item ${i + 1}`} />
              <button className="image-remove" onClick={() => remove(img)}>✕</button>
            </div>
          ))}
        </div>
      )}
      {images.length > 0 && (
        <p style={{ fontSize: 12, color: 'var(--grey)', marginTop: 8 }}>
          {images.length} image{images.length !== 1 ? 's' : ''} in the picture schedule
        </p>
      )}
    </div>
  );
}
