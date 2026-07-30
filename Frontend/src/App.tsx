import { Navigate, Route, Routes } from 'react-router-dom';
import DashboardPage from './pages/Dashboard';
import MlLabPage from './pages/MlLab';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/ml-lab" element={<MlLabPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
