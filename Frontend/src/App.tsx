import { Navigate, Route, Routes } from 'react-router-dom';
import RoleLayout from './components/layout/RoleLayout';
import { useRole } from './context/RoleContext';
import LoginPage from './pages/Login';
import ProfilePage from './pages/common/Profile';
import NotificationsPage from './pages/common/Notifications';
import SettingsPage from './pages/common/Settings';
import FleetDashboard from './pages/fleet/Dashboard';
import FleetAssets from './pages/fleet/Assets';
import FleetUtilization from './pages/fleet/Utilization';
import FleetLiveTelemetry from './pages/fleet/LiveTelemetry';
import FleetAnomalyDetection from './pages/fleet/AnomalyDetection';
import DealerDashboard from './pages/dealer/Dashboard';
import DealerRentalOps from './pages/dealer/RentalOps';
import DealerInventory from './pages/dealer/Inventory';
import DealerCustomers from './pages/dealer/Customers';
import SiteDashboard from './pages/site/Dashboard';
import SiteOperators from './pages/site/Operators';
import SiteAssignment from './pages/site/Assignment';
import SiteEquipmentPage from './pages/site/SiteEquipment';
import OperatorDashboard from './pages/operator/Dashboard';
import OperatorScanQR from './pages/operator/ScanQR';
import OperatorCurrentAssignment from './pages/operator/CurrentAssignment';
import OperatorActivityHistory from './pages/operator/ActivityHistory';
import DemandLab from './pages/DemandLab';
import DealerDemandPage from './pages/DealerDemand';
import SystemOperations from './pages/admin/SystemOperations';
import { GuestOnly, RequireRole } from './routes/ProtectedRoute';
import { ROLE_HOME } from './types/roles';

function RootRedirect() {
  const { role, homePath } = useRole();
  if (!role) return <Navigate to="/login" replace />;
  return <Navigate to={homePath} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <GuestOnly>
            <LoginPage />
          </GuestOnly>
        }
      />

      <Route
        element={
          <RequireRole>
            <RoleLayout />
          </RequireRole>
        }
      >
        {/* Common */}
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/settings" element={<SettingsPage />} />

        {/* Fleet Manager */}
        <Route path="/fleet/dashboard" element={<FleetDashboard />} />
        <Route path="/fleet/assets" element={<FleetAssets />} />
        <Route path="/fleet/utilization" element={<FleetUtilization />} />
        <Route path="/fleet/telemetry" element={<FleetLiveTelemetry />} />
        <Route path="/fleet/anomalies" element={<FleetAnomalyDetection />} />
        <Route path="/fleet/demand" element={<DemandLab />} />

        {/* Dealer */}
        <Route path="/dealer/dashboard" element={<DealerDashboard />} />
        <Route path="/dealer/rentals" element={<DealerRentalOps />} />
        <Route path="/dealer/inventory" element={<DealerInventory />} />
        <Route path="/dealer/customers" element={<DealerCustomers />} />
        <Route path="/dealer/demand" element={<DealerDemandPage />} />

        {/* Site Manager */}
        <Route path="/site/dashboard" element={<SiteDashboard />} />
        <Route path="/site/operators" element={<SiteOperators />} />
        <Route path="/site/assignment" element={<SiteAssignment />} />
        <Route path="/site/equipment" element={<SiteEquipmentPage />} />

        {/* Operator */}
        <Route path="/operator/dashboard" element={<OperatorDashboard />} />
        <Route path="/operator/scan" element={<OperatorScanQR />} />
        <Route path="/operator/assignment" element={<OperatorCurrentAssignment />} />
        <Route path="/operator/history" element={<OperatorActivityHistory />} />

        {/* System Administrator */}
        <Route path="/admin/system" element={<SystemOperations />} />
        <Route path="/admin/demand" element={<DemandLab />} />

      </Route>

      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<UnknownRedirect />} />
    </Routes>
  );
}

function UnknownRedirect() {
  const { role } = useRole();
  if (!role) return <Navigate to="/login" replace />;
  return <Navigate to={ROLE_HOME[role]} replace />;
}
