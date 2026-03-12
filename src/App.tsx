import { Routes, Route, Navigate } from 'react-router-dom';
import { isLoggedIn } from './api';
import Dashboard from './Dashboard';
import Editor from './Editor';
import Preview from './Preview';
import Login from './Login';

function Protected({ children }: { children: React.ReactNode }) {
  return isLoggedIn() ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/new" element={<Protected><Editor /></Protected>} />
      <Route path="/edit/:id" element={<Protected><Editor /></Protected>} />
      <Route path="/preview/:id" element={<Protected><Preview /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
