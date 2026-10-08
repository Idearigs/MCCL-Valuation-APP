import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { api } from './api';
import Dashboard from './Dashboard';
import Editor from './Editor';
import Preview from './Preview';
import ProbateEditor from './ProbateEditor';
import ProbatePreview from './ProbatePreview';
import Login from './Login';

// The session is an httpOnly cookie, so ask the server whether we're signed in.
function Protected({ children }: { children: React.ReactNode }) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    api.status().then(s => setSignedIn(!!s.user)).catch(() => setSignedIn(false));
  }, []);
  if (signedIn === null) return null;
  return signedIn ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/new" element={<Protected><Editor /></Protected>} />
      <Route path="/edit/:id" element={<Protected><Editor /></Protected>} />
      <Route path="/preview/:id" element={<Protected><Preview /></Protected>} />
      <Route path="/probate/new" element={<Protected><ProbateEditor /></Protected>} />
      <Route path="/probate/edit/:id" element={<Protected><ProbateEditor /></Protected>} />
      <Route path="/probate/preview/:id" element={<Protected><ProbatePreview /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
