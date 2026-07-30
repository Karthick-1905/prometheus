import { backendRootPath, idempotencyKey, query, readEventStream, request } from './client';
import type {
  Alert,
  Assignment,
  Contract,
  DashboardUser,
  Envelope,
  Equipment,
  JsonRecord,
  LoginResponse,
  Machine,
  Site,
  Telemetry,
} from './types';

const json = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });
const patch = (body: unknown): RequestInit => ({ method: 'PATCH', body: JSON.stringify(body) });
const idem = (prefix: string, body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Idempotency-Key': idempotencyKey(prefix) },
  body: JSON.stringify(body),
});

export const systemApi = {
  root: () => request<JsonRecord>(backendRootPath()),
  health: () => request<JsonRecord>('/health'),
  mlHealth: () => request<JsonRecord>('/api/ml/health'),
  mlStatus: () => request<JsonRecord>('/api/ml/status'),
  predict: (body: JsonRecord) => request<JsonRecord>('/api/ml/predict', json(body)),
  train: (body: JsonRecord) => request<JsonRecord>('/api/ml/train', json(body)),
  simulate: (body: JsonRecord) => request<JsonRecord>('/api/simulate', json(body)),
};

export const authApi = {
  login: (body: JsonRecord) => request<LoginResponse>('/api/v1/auth/login', json(body)),
  me: () => request<{ success: boolean; user: DashboardUser }>('/api/v1/auth/me'),
  refresh: () => request<LoginResponse>('/api/v1/auth/refresh', json({})),
};

export const alertApi = {
  legacyList: (resolved = false, limit = 100) =>
    request<{ success: boolean; alerts: Alert[] }>(
      query('/api/alerts', { resolved, limit }),
    ),
  legacySummary: () => request<JsonRecord>('/api/alerts/summary'),
  legacyResolve: (alertId: number) =>
    request<{ success: boolean; alert: Alert }>('/api/alerts', patch({ alertId })),
  list: (filters: { resolved?: boolean; severity?: string; equipmentId?: string; limit?: number } = {}) =>
    request<Envelope<Alert[]>>(query('/api/v1/alerts', filters)),
  summary: () => request<JsonRecord>('/api/v1/alerts/summary'),
  detail: (alertId: number) =>
    request<Envelope<Alert>>(`/api/v1/alerts/${alertId}`),
  resolve: (alertId: number) =>
    request<Envelope<Alert>>(`/api/v1/alerts/${alertId}/resolve`, json({})),
};

export const telemetryApi = {
  snapshot: () =>
    request<{ success: boolean; snapshot: Array<JsonRecord> }>('/api/telemetry'),
};

export const fleetApi = {
  overview: () => request<JsonRecord>('/api/v1/fleet/overview'),
  machines: (filters: Record<string, string | number | boolean | null | undefined> = {}) =>
    request<Envelope<Machine[]>>(query('/api/v1/fleet/machines', filters)),
  machine: (equipmentId: number) =>
    request<Envelope<Machine>>(`/api/v1/fleet/machines/${equipmentId}`),
  telemetry: (equipmentId: number, limit = 100) =>
    request<Envelope<Telemetry[]>>(
      query(`/api/v1/fleet/machines/${equipmentId}/telemetry`, { limit }),
    ),
  alerts: (equipmentId: number, limit = 50) =>
    request<Envelope<Alert[]>>(
      query(`/api/v1/fleet/machines/${equipmentId}/alerts`, { limit }),
    ),
  map: () => request<Envelope<JsonRecord[]>>('/api/v1/fleet/map'),
  sites: () => request<Envelope<JsonRecord[]>>('/api/v1/fleet/sites'),
  unassigned: () => request<Envelope<Machine[]>>('/api/v1/fleet/unassigned'),
  logs: (equipmentId?: number, limit = 50) =>
    request<Envelope<JsonRecord[]>>(
      query('/api/v1/fleet/logs', { equipmentId, limit }),
    ),
  expiringContracts: (days = 7) =>
    request<Envelope<JsonRecord[]>>(query('/api/v1/contracts/expiring', { days })),
  overdueContracts: () => request<Envelope<JsonRecord[]>>('/api/v1/contracts/overdue'),
};

export const analyticsApi = {
  summary: (days = 7) =>
    request<Envelope<JsonRecord>>(query('/api/v1/analytics/usage/summary', { days })),
  bySite: (days = 7) =>
    request<Envelope<JsonRecord[]>>(query('/api/v1/analytics/usage/by-site', { days })),
  byEquipment: (days = 7) =>
    request<Envelope<JsonRecord[]>>(
      query('/api/v1/analytics/usage/by-equipment', { days }),
    ),
  byType: (days = 7) =>
    request<Envelope<JsonRecord[]>>(query('/api/v1/analytics/usage/by-type', { days })),
  utilization: (days = 7) =>
    request<Envelope<JsonRecord>>(query('/api/v1/analytics/utilization', { days })),
  underutilized: (days = 7, threshold = 0.35) =>
    request<Envelope<JsonRecord[]>>(
      query('/api/v1/analytics/underutilized', { days, threshold }),
    ),
};

export const dealerApi = {
  me: () => request<Envelope<JsonRecord>>('/api/v1/dealers/me'),
  summary: () => request<Envelope<JsonRecord>>('/api/v1/dealers/me/summary'),
  equipment: (filters: Record<string, string | number | undefined> = {}) =>
    request<Envelope<Equipment[]>>(query('/api/v1/dealers/equipment', filters)),
  createEquipment: (body: JsonRecord) =>
    request<Envelope<Equipment>>('/api/v1/dealers/equipment', json(body)),
  equipmentDetail: (equipmentId: number) =>
    request<Envelope<Equipment>>(`/api/v1/dealers/equipment/${equipmentId}`),
  updateEquipment: (equipmentId: number, body: JsonRecord) =>
    request<Envelope<Equipment>>(`/api/v1/dealers/equipment/${equipmentId}`, patch(body)),
  rotateQr: (equipmentId: number) =>
    request<Envelope<JsonRecord>>(`/api/v1/dealers/equipment/${equipmentId}/qr`, json({})),
  contracts: (rentalStatus?: string, limit = 100) =>
    request<Envelope<Contract[]>>(
      query('/api/v1/dealers/contracts', { rentalStatus, limit }),
    ),
  createContract: (body: JsonRecord) =>
    request<Envelope<Contract>>('/api/v1/dealers/contracts', json(body)),
  completeContract: (contractId: number) =>
    request<Envelope<Contract>>(
      `/api/v1/dealers/contracts/${contractId}/complete`,
      json({}),
    ),
};

export const siteApi = {
  sites: () => request<Envelope<Site[]>>('/api/v1/sites'),
  createSite: (body: JsonRecord) =>
    request<Envelope<Site>>('/api/v1/sites', json(body)),
  site: (siteId: number) => request<Envelope<Site>>(`/api/v1/sites/${siteId}`),
  summary: (siteId: number) =>
    request<Envelope<Site & { activeAssignments: number; equipment: Assignment[] }>>(
      `/api/v1/sites/${siteId}/summary`,
    ),
  equipment: (siteId: number) =>
    request<Envelope<Assignment[]>>(`/api/v1/sites/${siteId}/equipment`),
  assignments: (siteId?: number) =>
    request<Envelope<Assignment[]>>(query('/api/v1/assignments', { siteId })),
  createAssignment: (body: JsonRecord) =>
    request<Envelope<Assignment>>('/api/v1/assignments', json(body)),
  byQr: (qrCode: string) =>
    request<Envelope<JsonRecord>>(`/api/v1/equipment/by-qr/${encodeURIComponent(qrCode)}`),
  byRfid: (rfidTag: string) =>
    request<Envelope<JsonRecord>>(
      `/api/v1/equipment/by-rfid/${encodeURIComponent(rfidTag)}`,
    ),
  checkout: (body: JsonRecord) =>
    request<Envelope<JsonRecord>>('/api/v1/checkouts/scan', json(body)),
  activeCheckouts: (siteId?: number) =>
    request<Envelope<Assignment[]>>(query('/api/v1/checkouts/active', { siteId })),
};

export const demandPlatformApi = {
  status: () => request<JsonRecord>('/api/demand/status'),
  legacyForecast: (equipmentType = 'Excavator', horizonDays = 7) =>
    request<JsonRecord>(
      query('/api/demand/forecast', { equipmentType, horizonDays }),
    ),
  projects: () => request<JsonRecord>('/api/demand/projects'),
  project: (projectId: number) => request<JsonRecord>(`/api/demand/projects/${projectId}`),
  equipmentForecast: (projectId: number, equipmentType: string) =>
    request<JsonRecord>(
      `/api/demand/projects/${projectId}/equipment/${encodeURIComponent(equipmentType)}`,
    ),
  packages: (projectId: number, equipmentType: string, preference = 'BALANCED') =>
    request<JsonRecord>(
      query(`/api/demand/projects/${projectId}/packages`, {
        equipmentType,
        preference,
      }),
    ),
  dealer: (filters: Record<string, string | undefined> = {}) =>
    request<JsonRecord>(query('/api/demand/dealer', filters)),
  metrics: () => request<JsonRecord>('/api/demand/metrics'),
  explanation: (forecastId: number) =>
    request<JsonRecord>(`/api/demand/forecasts/${forecastId}/explanation`),
  override: (body: JsonRecord) =>
    request<JsonRecord>('/api/demand/override', idem('override', body)),
  feedback: (body: JsonRecord) =>
    request<JsonRecord>('/api/demand/feedback', idem('feedback', body)),
  manualReview: (body: JsonRecord) =>
    request<JsonRecord>('/api/demand/manual-reviews', idem('manual-review', body)),
  decideAction: (actionId: number, body: JsonRecord) =>
    request<JsonRecord>(
      `/api/demand/dealer/actions/${actionId}/decision`,
      idem('dealer-action', body),
    ),
  generateSynthetic: (body: JsonRecord) =>
    request<JsonRecord>('/api/demand/dev/synthetic/generate', json(body)),
  retrain: (body: JsonRecord) =>
    request<JsonRecord>('/api/demand/dev/models/retrain', json(body)),
};

export interface AppNotification {
  notificationId: number;
  companyId?: number | null;
  dealerId?: number | null;
  siteId?: number | null;
  contractId?: number | null;
  equipmentId?: number | null;
  assignmentId?: number | null;
  type: string;
  severity: string;
  title: string;
  body: string;
  actionUrl?: string | null;
  actionLabel?: string | null;
  recipientEmail?: string | null;
  emailStatus?: string | null;
  emailError?: string | null;
  emailSentAt?: string | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt?: string | null;
}

export const notificationsApi = {
  list: (unreadOnly = false, limit = 50) =>
    request<Envelope<AppNotification[]> & { meta?: { total?: number; unread?: number } }>(
      query('/api/v1/notifications', { unreadOnly, limit }),
    ),
  unreadCount: () =>
    request<{ success: boolean; data: { unread: number } }>('/api/v1/notifications/unread-count'),
  scan: (endingSoonDays = 3, sendEmail = true) =>
    request<Envelope<JsonRecord>>(
      query('/api/v1/notifications/scan', { endingSoonDays, sendEmail }),
      { method: 'POST' },
    ),
  markRead: (notificationId: number) =>
    request<Envelope<AppNotification>>(`/api/v1/notifications/${notificationId}/read`, {
      method: 'POST',
    }),
  markAllRead: () =>
    request<Envelope<{ marked: number }>>('/api/v1/notifications/read-all', { method: 'POST' }),
  extendContract: (contractId: number, extraDays = 7) =>
    request<Envelope<JsonRecord>>(`/api/v1/contracts/${contractId}/extend`, {
      method: 'POST',
      body: JSON.stringify({ extraDays }),
    }),
};

export const liveApi = {
  fleet: (onEvent: Parameters<typeof readEventStream>[1], signal?: AbortSignal) =>
    readEventStream('/api/v1/live/fleet?intervalMs=1000&maxTicks=120', onEvent, signal),
  /** Redis-backed live machinery logs from ingestion (telemetry:events). */
  logs: (
    onEvent: Parameters<typeof readEventStream>[1],
    signal?: AbortSignal,
    opts?: { equipmentId?: string; maxSeconds?: number },
  ) => {
    const params = new URLSearchParams({
      source: 'redis',
      maxSeconds: String(opts?.maxSeconds ?? 300),
      recentLimit: '50',
    });
    if (opts?.equipmentId) params.set('equipmentId', opts.equipmentId);
    return readEventStream(`/api/v1/live/logs?${params}`, onEvent, signal);
  },
  logsDb: (onEvent: Parameters<typeof readEventStream>[1], signal?: AbortSignal) =>
    readEventStream(
      '/api/v1/live/logs?source=db&intervalMs=1000&maxTicks=120',
      onEvent,
      signal,
    ),
  alerts: (onEvent: Parameters<typeof readEventStream>[1], signal?: AbortSignal) =>
    readEventStream('/api/v1/live/alerts?intervalMs=1000&maxTicks=120', onEvent, signal),
  site: (
    siteId: number,
    onEvent: Parameters<typeof readEventStream>[1],
    signal?: AbortSignal,
  ) =>
    readEventStream(
      `/api/v1/live/site/${siteId}?intervalMs=1000&maxTicks=120`,
      onEvent,
      signal,
    ),
  redisStatus: () => request<Envelope<JsonRecord>>('/api/v1/live/redis/status'),
};
