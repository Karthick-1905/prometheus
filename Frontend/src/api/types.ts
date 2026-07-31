export interface Envelope<T> {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
}

export interface DashboardUser {
  actorId: string;
  role: string;
  companyId: number | null;
  dealerId: number | null;
  siteId: number | null;
  authMode: string;
  permissions: Record<string, boolean>;
}

export interface LoginResponse {
  success: boolean;
  accessToken: string;
  tokenType: string;
  expiresInMinutes: number;
  user: DashboardUser;
  mode?: string;
}

export interface Telemetry {
  timestamp?: string | null;
  engineStatus?: string | null;
  fuelLevel?: number | null;
  engineHours?: number | null;
  idleHours?: number | null;
  speed?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  engineTemperature?: number | null;
  batteryVoltage?: number | null;
  loadPercentage?: number | null;
  vibrationLevel?: number | null;
}

export interface Machine {
  equipmentId: number;
  equipmentName?: string | null;
  equipmentType?: string | null;
  dealerName?: string | null;
  contractId?: number;
  rentalStatus?: string | null;
  expectedReturn?: string | null;
  siteId?: number | null;
  siteName?: string | null;
  operatorId?: string | null;
  liveStatus?: string;
  lastSeenAt?: string | null;
  openAlertCount?: number;
  highestSeverity?: string | null;
  telemetry?: Telemetry | null;
  telemetryHistory?: Telemetry[];
  alerts?: Alert[];
}

export interface Alert {
  alertId: number;
  equipmentId: string;
  equipmentType?: string | null;
  siteId?: string | null;
  operatorId?: string | null;
  anomalyType?: string | null;
  severity?: string | null;
  description?: string | null;
  recommendation?: string | null;
  triggerValue?: number | null;
  thresholdValue?: number | null;
  isResolved: boolean;
  resolvedAt?: string | null;
  detectedAt?: string | null;
}

export interface Equipment {
  equipmentId: number;
  dealerId: number;
  equipmentName: string;
  equipmentType: string;
  model?: string | null;
  serialNumber?: string | null;
  qrCode?: string | null;
  rfidTag?: string | null;
  status?: string | null;
  dailyRentalCost?: number | null;
}

export interface Contract {
  contractId: number;
  dealerId: number;
  companyId: number;
  companyName?: string | null;
  equipmentId: number;
  equipmentName?: string | null;
  equipmentType?: string | null;
  rentalStart?: string | null;
  expectedReturn?: string | null;
  actualReturn?: string | null;
  rentalStatus?: string | null;
}

export interface Site {
  siteId: number;
  companyId: number;
  siteName: string;
  location?: string | null;
  status?: string | null;
}

export interface Assignment {
  assignmentId: number;
  contractId: number;
  siteId: number;
  siteName?: string | null;
  equipmentId?: number | null;
  equipmentName?: string | null;
  equipmentType?: string | null;
  status?: string | null;
  checkoutTime?: string | null;
  checkinTime?: string | null;
  assignedBy?: number | null;
  checkedOutBy?: number | null;
}

export interface OperatorRosterEntry {
  operatorId: string;
  userId: number;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  availability: 'ASSIGNED' | 'AVAILABLE';
  activeAssignmentId?: number | null;
  equipmentId?: number | null;
  equipmentName?: string | null;
  siteId?: number | null;
  siteName?: string | null;
  checkedOutAt?: string | null;
}

export type JsonRecord = Record<string, unknown>;
