import { Routes, Route } from 'react-router-dom';
import Dashboard from './Dashboard';
import Editor from './Editor';
import Preview from './Preview';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/new" element={<Editor />} />
      <Route path="/edit/:id" element={<Editor />} />
      <Route path="/preview/:id" element={<Preview />} />
    </Routes>
  );
}
