import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { DocumentRecord, ProbateDetails } from '@mccl/shared';
import { api } from './api';
import PdfPreview from './PdfPreview';

export default function ProbatePreview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) { setNotFound(true); return; }
    api.getDocument(id).then(setDoc).catch(() => setNotFound(true));
  }, [id]);

  if (notFound) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 48 }}>📄</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Probate document not found</div>
        <button className="btn btn-primary" onClick={() => navigate('/')}>← Dashboard</button>
      </div>
    );
  }

  if (!doc) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ color: 'var(--grey)', fontSize: 16 }}>Loading…</div>
      </div>
    );
  }

  const name = (doc.details as ProbateDetails).deceasedName;
  return (
    <PdfPreview
      documentId={doc.id}
      title={`Probate — ${name || 'Document'}`}
      editPath={`/probate/edit/${doc.id}`}
      fileName={`Probate-${(name || 'document').replace(/\s+/g, '-')}.pdf`}
    />
  );
}
