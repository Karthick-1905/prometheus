import { Navigate, Route, Routes } from 'react-router-dom';
import Cockpit from './pages/Cockpit';
import RentalsPage from './pages/Rentals';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Cockpit />} />
      <Route path="/anomalies" element={<Cockpit />} />
      <Route path="/telemetry" element={<Cockpit />} />
      <Route path="/equipment" element={<Cockpit />} />
      <Route path="/equipment/:id" element={<Cockpit />} />
      <Route path="/rentals" element={<Cockpit />} />
      <Route path="/rentals-ops" element={<RentalsPage />} />
      <Route path="/forecasting" element={<Cockpit />} />
      <Route path="/optimization" element={<Cockpit />} />
      <Route path="/alerts" element={<Cockpit />} />
      <Route path="/analytics" element={<Cockpit />} />
      <Route path="/settings" element={<Cockpit />} />
      <Route path="/ml-lab" element={<Cockpit />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
