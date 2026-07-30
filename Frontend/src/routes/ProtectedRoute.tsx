import { Navigate, useLocation } from 'react-router-dom';
import { useRole } from '../context/RoleContext';
import { pathAllowedForRole, ROLE_HOME } from '../types/roles';

export function RequireRole({ children }: { children: React.ReactNode }) {
  const { role } = useRole();
  const location = useLocation();

  if (!role) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!pathAllowedForRole(location.pathname, role)) {
    return <Navigate to={ROLE_HOME[role]} replace />;
  }

  return <>{children}</>;
}

export function GuestOnly({ children }: { children: React.ReactNode }) {
  const { role, homePath } = useRole();
  if (role) return <Navigate to={homePath} replace />;
  return <>{children}</>;
}
