/** Central mock datasets — swap for API responses later */

export const fleetStats = {
  totalEquipment: 48,
  activeRentals: 31,
  available: 12,
  working: 24,
  idle: 7,
  maintenance: 5,
  overdueRentals: 3,
  activeAlerts: 9,
};

export const assets = [
  {
    id: 'CAT-EX-1001',
    name: '320 GC Excavator',
    type: 'Excavator',
    dealer: 'Midwest CAT',
    site: 'Mining Site S003',
    operator: 'J. Rivera',
    status: 'WORKING',
    availability: 'Rented',
    fuel: 72,
    engineHours: 1243,
    lastUpdated: '2 min ago',
  },
  {
    id: 'CAT-BD-1002',
    name: 'D6 Dozer',
    type: 'Bulldozer',
    dealer: 'Midwest CAT',
    site: 'Quarry S001',
    operator: 'A. Patel',
    status: 'WORKING',
    availability: 'Rented',
    fuel: 58,
    engineHours: 2104,
    lastUpdated: '5 min ago',
  },
  {
    id: 'CAT-WL-1004',
    name: '950M Wheel Loader',
    type: 'Wheel Loader',
    dealer: 'Great Lakes CAT',
    site: '—',
    operator: '—',
    status: 'AVAILABLE',
    availability: 'Available',
    fuel: 91,
    engineHours: 876,
    lastUpdated: '12 min ago',
  },
  {
    id: 'CAT-DT-1003',
    name: '740 Articulated Truck',
    type: 'Dump Truck',
    dealer: 'Great Lakes CAT',
    site: 'Port P004',
    operator: 'M. Chen',
    status: 'IDLE',
    availability: 'Rented',
    fuel: 44,
    engineHours: 3401,
    lastUpdated: '1 min ago',
  },
  {
    id: 'CAT-CR-1005',
    name: '50T Crane',
    type: 'Crane',
    dealer: 'Midwest CAT',
    site: 'Yard',
    operator: '—',
    status: 'MAINTENANCE',
    availability: 'Unavailable',
    fuel: 30,
    engineHours: 5120,
    lastUpdated: '1 hr ago',
  },
  {
    id: 'CAT-EX-1008',
    name: '336 Excavator',
    type: 'Excavator',
    dealer: 'Midwest CAT',
    site: 'Highway S002',
    operator: 'K. Singh',
    status: 'WORKING',
    availability: 'Rented',
    fuel: 67,
    engineHours: 990,
    lastUpdated: '3 min ago',
  },
];

export const utilizationRows = [
  { id: 'CAT-EX-1001', runtime: 42.5, idle: 6.2, fuel: 380, downtime: 2.0, utilization: 82 },
  { id: 'CAT-BD-1002', runtime: 38.0, idle: 11.5, fuel: 410, downtime: 4.5, utilization: 70 },
  { id: 'CAT-DT-1003', runtime: 28.0, idle: 14.0, fuel: 520, downtime: 6.0, utilization: 58 },
  { id: 'CAT-EX-1008', runtime: 45.0, idle: 3.5, fuel: 350, downtime: 1.0, utilization: 91 },
  { id: 'CAT-WL-1004', runtime: 12.0, idle: 2.0, fuel: 90, downtime: 0, utilization: 25 },
];

export const utilizationChart = [
  { day: 'Mon', runtime: 120, idle: 28 },
  { day: 'Tue', runtime: 132, idle: 24 },
  { day: 'Wed', runtime: 118, idle: 35 },
  { day: 'Thu', runtime: 145, idle: 22 },
  { day: 'Fri', runtime: 138, idle: 30 },
  { day: 'Sat', runtime: 90, idle: 18 },
  { day: 'Sun', runtime: 40, idle: 8 },
];

export const telemetryCards = [
  {
    id: 'CAT-EX-1001',
    engineStatus: 'ON',
    fuel: 72,
    temperature: 88,
    speed: 4.2,
    gps: '11.0245, 76.9353',
    lastUpdated: 'Just now',
  },
  {
    id: 'CAT-BD-1002',
    engineStatus: 'ON',
    fuel: 58,
    temperature: 94,
    speed: 6.1,
    gps: '11.0312, 76.9410',
    lastUpdated: '45s ago',
  },
  {
    id: 'CAT-DT-1003',
    engineStatus: 'IDLE',
    fuel: 44,
    temperature: 76,
    speed: 0,
    gps: '11.0188, 76.9280',
    lastUpdated: '1 min ago',
  },
  {
    id: 'CAT-EX-1008',
    engineStatus: 'ON',
    fuel: 67,
    temperature: 102,
    speed: 3.5,
    gps: '11.0401, 76.9502',
    lastUpdated: '2 min ago',
  },
  {
    id: 'CAT-CR-1005',
    engineStatus: 'OFF',
    fuel: 30,
    temperature: 42,
    speed: 0,
    gps: 'Yard',
    lastUpdated: '1 hr ago',
  },
  {
    id: 'CAT-WL-1004',
    engineStatus: 'OFF',
    fuel: 91,
    temperature: 38,
    speed: 0,
    gps: 'Dealer lot',
    lastUpdated: '12 min ago',
  },
];

export const anomalyAlerts = [
  {
    id: 1,
    type: 'High Idle Time',
    equipmentId: 'CAT-DT-1003',
    severity: 'WARNING',
    description: 'Idle ratio 33% over shift — above fleet norm.',
    detectedAt: '10:14 AM',
  },
  {
    id: 2,
    type: 'High Temperature',
    equipmentId: 'CAT-EX-1008',
    severity: 'CRITICAL',
    description: 'Engine temp 102°C sustained > 5 min under load.',
    detectedAt: '10:08 AM',
  },
  {
    id: 3,
    type: 'Fuel Drop',
    equipmentId: 'CAT-BD-1002',
    severity: 'CRITICAL',
    description: 'Fuel drop of 12% in 8 minutes while engine OFF.',
    detectedAt: '09:52 AM',
  },
  {
    id: 4,
    type: 'Offline Equipment',
    equipmentId: 'CAT-CR-1005',
    severity: 'WARNING',
    description: 'No telemetry heartbeat for 58 minutes.',
    detectedAt: '09:30 AM',
  },
  {
    id: 5,
    type: 'Missing Operator',
    equipmentId: 'CAT-EX-1001',
    severity: 'CRITICAL',
    description: 'Engine ON with no assigned operator badge.',
    detectedAt: '09:18 AM',
  },
  {
    id: 6,
    type: 'Equipment Outside Site',
    equipmentId: 'CAT-BD-1002',
    severity: 'WARNING',
    description: 'GPS outside geofence of Quarry S001 (0.08°).',
    detectedAt: '08:55 AM',
  },
];

export const recentTelemetry = [
  { id: 'CAT-EX-1001', event: 'Fuel 72% · Temp 88°C', time: '2m' },
  { id: 'CAT-BD-1002', event: 'Speed 6.1 km/h · Working', time: '5m' },
  { id: 'CAT-DT-1003', event: 'Engine idle · 0 km/h', time: '6m' },
  { id: 'CAT-EX-1008', event: 'Temp warning 102°C', time: '8m' },
];

export const recentActivities = [
  { text: 'Rental RC-2041 extended +7 days', time: '15m' },
  { text: 'CAT-WL-1004 returned to dealer lot', time: '42m' },
  { text: 'Operator K. Singh checked out EX-1008', time: '1h' },
  { text: 'Maintenance closed on CR-1005 (pending parts)', time: '2h' },
];

export const aiRecommendations = [
  'Move CAT-WL-1004 to Highway S002 — demand spike forecast +18%.',
  'Schedule coolant service for CAT-EX-1008 after high-temp alerts.',
  'Review idle policy at Port P004 (CAT-DT-1003).',
];

export const fleetHealth = {
  score: 86,
  label: 'Good',
  notes: ['3 overdue contracts', '5 units in maintenance', 'Anomaly rate within baseline'],
};

// ── Dealer ───────────────────────────────────────────────
export const dealerStats = {
  activeRentals: 18,
  returned: 6,
  available: 11,
};

export const rentals = [
  {
    id: 'RC-2041',
    customer: 'Apex Construction',
    equipment: 'CAT-EX-1001',
    start: '2026-07-01',
    end: '2026-08-15',
    status: 'ACTIVE',
  },
  {
    id: 'RC-2038',
    customer: 'Ridge Mining Co.',
    equipment: 'CAT-BD-1002',
    start: '2026-06-20',
    end: '2026-07-28',
    status: 'OVERDUE',
  },
  {
    id: 'RC-2035',
    customer: 'Harbor Logistics',
    equipment: 'CAT-DT-1003',
    start: '2026-07-10',
    end: '2026-08-01',
    status: 'ACTIVE',
  },
  {
    id: 'RC-2029',
    customer: 'Apex Construction',
    equipment: 'CAT-WL-1004',
    start: '2026-05-01',
    end: '2026-07-01',
    status: 'RETURNED',
  },
  {
    id: 'RC-2044',
    customer: 'Northline Paving',
    equipment: 'CAT-EX-1008',
    start: '2026-07-20',
    end: '2026-09-01',
    status: 'ACTIVE',
  },
];

export const customers = [
  { id: 'C-01', name: 'Apex Construction', contact: 'ops@apex.co', phone: '+1 312-555-0142', activeRentals: 2 },
  { id: 'C-02', name: 'Ridge Mining Co.', contact: 'fleet@ridge.mine', phone: '+1 218-555-0199', activeRentals: 1 },
  { id: 'C-03', name: 'Harbor Logistics', contact: 'site@harbor.io', phone: '+1 504-555-0110', activeRentals: 1 },
  { id: 'C-04', name: 'Northline Paving', contact: 'pm@northline.com', phone: '+1 612-555-0177', activeRentals: 1 },
];

// ── Site Manager ─────────────────────────────────────────
export const siteStats = {
  equipmentOnSite: 9,
  operators: 6,
  running: 5,
  waiting: 4,
};

export const operators = [
  { name: 'J. Rivera', equipment: 'CAT-EX-1001', shift: 'Day 06:00–14:00', status: 'ON SHIFT' },
  { name: 'A. Patel', equipment: 'CAT-BD-1002', shift: 'Day 06:00–14:00', status: 'ON SHIFT' },
  { name: 'M. Chen', equipment: 'CAT-DT-1003', shift: 'Swing 14:00–22:00', status: 'OFF SHIFT' },
  { name: 'K. Singh', equipment: 'CAT-EX-1008', shift: 'Day 06:00–14:00', status: 'ON SHIFT' },
  { name: 'L. Okonkwo', equipment: '—', shift: 'Day 06:00–14:00', status: 'STANDBY' },
  { name: 'S. Nguyen', equipment: '—', shift: 'Night 22:00–06:00', status: 'OFF SHIFT' },
];

export const siteEquipment = [
  { id: 'CAT-EX-1001', runtime: 6.4, idle: 0.8, fuel: 72, status: 'WORKING' },
  { id: 'CAT-BD-1002', runtime: 5.9, idle: 1.2, fuel: 58, status: 'WORKING' },
  { id: 'CAT-DT-1003', runtime: 2.1, idle: 3.4, fuel: 44, status: 'IDLE' },
  { id: 'CAT-EX-1008', runtime: 6.8, idle: 0.4, fuel: 67, status: 'WORKING' },
];

// ── Operator ─────────────────────────────────────────────
export const operatorProfile = {
  name: 'J. Rivera',
  assignedEquipment: 'CAT-EX-1001',
  site: 'Mining Site S003',
  shift: 'Day 06:00–14:00',
  workingHours: 5.6,
};

export const currentAssignment = {
  equipment: 'CAT-EX-1001',
  site: 'Mining Site S003',
  runtime: 6.4,
  fuel: 72,
  assignmentTime: 'Today 06:12 AM',
};

export const activityHistory = [
  { date: '2026-07-29', equipment: 'CAT-EX-1001', site: 'Mining Site S003', hours: 7.2, action: 'Check-out' },
  { date: '2026-07-28', equipment: 'CAT-EX-1001', site: 'Mining Site S003', hours: 6.8, action: 'Check-out' },
  { date: '2026-07-27', equipment: 'CAT-WL-1004', site: 'Highway S002', hours: 5.1, action: 'Check-out' },
  { date: '2026-07-26', equipment: 'CAT-EX-1001', site: 'Mining Site S003', hours: 7.5, action: 'Check-out' },
];

export const mockScanResult = {
  equipmentId: 'CAT-EX-1001',
  name: '320 GC Excavator',
  status: 'Available',
  site: 'Mining Site S003',
};

export const notifications = [
  { id: 1, title: 'Critical: Engine overheat EX-1008', time: '10 min ago', read: false },
  { id: 2, title: 'Rental RC-2038 is overdue', time: '1 hr ago', read: false },
  { id: 3, title: 'Weekly utilization report ready', time: 'Yesterday', read: true },
  { id: 4, title: 'Maintenance window for CR-1005', time: '2 days ago', read: true },
];
