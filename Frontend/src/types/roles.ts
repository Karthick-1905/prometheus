export type Role = 'fleet_manager' | 'dealer' | 'site_manager' | 'operator' | 'system_admin';

export const ROLES: Role[] = ['fleet_manager', 'dealer', 'site_manager', 'operator', 'system_admin'];

export const API_ROLE: Record<Role, string> = {
  fleet_manager: 'FLEET_MANAGER',
  dealer: 'DEALER',
  site_manager: 'SITE_MANAGER',
  operator: 'OPERATOR',
  system_admin: 'SYSTEM_ADMINISTRATOR',
};

export function roleFromApi(role: string): Role | null {
  const normalized = role.toUpperCase();
  if (normalized === 'FLEET_MANAGER') return 'fleet_manager';
  if (normalized === 'DEALER' || normalized === 'DEALER_MANAGER') return 'dealer';
  if (normalized === 'SITE_MANAGER' || normalized === 'SITE_ENGINEER') return 'site_manager';
  if (normalized === 'SYSTEM_ADMINISTRATOR') return 'system_admin';
  if (normalized === 'OPERATOR') return 'operator';
  return null;
}

export const ROLE_LABELS: Record<Role, string> = {
  fleet_manager: 'Fleet Manager',
  dealer: 'Dealer',
  site_manager: 'Site Manager',
  operator: 'Operator',
  system_admin: 'System Administrator',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  fleet_manager: 'Monitor the entire rental fleet, utilization, and anomalies',
  dealer: 'Manage rentals, inventory, and customer accounts',
  site_manager: 'Assign equipment and operators on the job site',
  operator: 'View assignment, scan QR, and log activity',
  system_admin: 'Verify services, models, simulations, and forecasting operations',
};

export const ROLE_ICONS: Record<Role, string> = {
  fleet_manager: 'local_shipping',
  dealer: 'storefront',
  site_manager: 'domain',
  operator: 'engineering',
  system_admin: 'admin_panel_settings',
};

export const ROLE_HOME: Record<Role, string> = {
  fleet_manager: '/fleet/dashboard',
  dealer: '/dealer/dashboard',
  site_manager: '/site/dashboard',
  operator: '/operator/dashboard',
  system_admin: '/admin/system',
};

export interface NavItem {
  path: string;
  label: string;
  icon: string;
}

export const ROLE_NAV: Record<Role, NavItem[]> = {
  fleet_manager: [
    { path: '/fleet/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { path: '/fleet/assets', label: 'Assets', icon: 'inventory_2' },
    { path: '/fleet/utilization', label: 'Utilization', icon: 'bar_chart' },
    { path: '/fleet/telemetry', label: 'Live Telemetry', icon: 'sensors' },
    { path: '/fleet/anomalies', label: 'Anomaly Detection', icon: 'warning' },
    { path: '/fleet/demand', label: 'Demand Planning', icon: 'query_stats' },
    { path: '/fleet/optimization', label: 'Fleet Optimization', icon: 'route' },
  ],
  dealer: [
    { path: '/dealer/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { path: '/dealer/rentals', label: 'Rental Operations', icon: 'assignment' },
    { path: '/dealer/inventory', label: 'Equipment Inventory', icon: 'construction' },
    { path: '/dealer/customers', label: 'Customers', icon: 'groups' },
    { path: '/dealer/demand', label: 'Demand Positioning', icon: 'moving' },
    { path: '/dealer/optimization', label: 'Fleet Optimization', icon: 'route' },
  ],
  site_manager: [
    { path: '/site/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { path: '/site/operators', label: 'Operators', icon: 'badge' },
    { path: '/site/assignment', label: 'Equipment Assignment', icon: 'swap_horiz' },
    { path: '/site/equipment', label: 'Site Equipment', icon: 'precision_manufacturing' },
  ],
  operator: [
    { path: '/operator/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { path: '/operator/scan', label: 'Scan QR', icon: 'qr_code_scanner' },
    { path: '/operator/assignment', label: 'Current Assignment', icon: 'handyman' },
    { path: '/operator/history', label: 'Activity History', icon: 'history' },
  ],
  system_admin: [
    { path: '/admin/system', label: 'System & ML', icon: 'settings_suggest' },
    { path: '/admin/demand', label: 'Demand Planning', icon: 'query_stats' },
    { path: '/admin/optimization', label: 'Fleet Optimization', icon: 'route' },
  ],
};

export const COMMON_NAV: NavItem[] = [
  { path: '/profile', label: 'Profile', icon: 'person' },
  { path: '/notifications', label: 'Notifications', icon: 'notifications' },
  { path: '/settings', label: 'Settings', icon: 'settings' },
];

export function rolePrefix(role: Role): string {
  if (role === 'fleet_manager') return '/fleet';
  if (role === 'dealer') return '/dealer';
  if (role === 'site_manager') return '/site';
  if (role === 'system_admin') return '/admin';
  return '/operator';
}

export function pathAllowedForRole(path: string, role: Role): boolean {
  if (path === '/login') return true;
  if (COMMON_NAV.some((n) => path === n.path || path.startsWith(n.path + '/'))) return true;
  const prefix = rolePrefix(role);
  return path === prefix || path.startsWith(prefix + '/');
}
