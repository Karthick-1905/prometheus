import DashboardPage from './pages/Dashboard';
import MlLabPage from './pages/MlLab';
import DemandForecastPage from './pages/DemandForecast';
import DealerDemandPage from './pages/DealerDemand';

export default function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/ml-lab') return <MlLabPage />;
  if (path === '/demand') return <DemandForecastPage />;
  if (path === '/dealer/demand') return <DealerDemandPage />;
  return <DashboardPage />;
}
