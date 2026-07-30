/** Demand forecasting client — uses session auth when present, else demo headers. */
import { idempotencyKey, readApiSession, request as platformRequest } from './client';

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export interface ProjectSummary {
  projectId: number;
  customerId: number;
  siteId: number;
  projectCode: string;
  projectName: string;
  projectType: string;
  projectSize: number;
  projectSizeUnit: string;
  region: string;
  currentPhase: string;
  phaseStartDate: string;
  phaseEndDate: string;
  expectedProjectEnd: string;
  projectStatus: string;
  progressPercentage: number;
  priority: string;
  scenario?: string | null;
  equipmentTypes: string[];
}

export interface ForecastPoint {
  forecastId: number;
  forecastWeek: string;
  predictedUnits: number;
  lowerUnits: number;
  upperUnits: number;
  safePlanningUnits: number;
  predictedMachineHours: number;
  predictedUtilization: number | null;
  trend: 'RISING' | 'FALLING' | 'STABLE' | string;
  confidence: string;
  forecastMethod: string;
  coldStart: boolean;
  explanation: string;
  comparableCohort?: string | null;
  version: number;
}

export interface HistoryPoint {
  weekStart: string;
  requestedUnits: number;
  fulfilledUnits: number;
  unmetUnits: number;
  rentedUnits: number;
  engineHours: number;
  idleHours: number;
  operatingUtilization: number | null;
  projectPhase: string;
}

export interface ForecastSummary {
  weekOneExpectedUnits: number;
  weekOneSafeUnits: number;
  fourWeekMachineHours: number;
  currentUtilization: number | null;
  idleCapacity: number | null;
  trend: string;
  confidence: string;
  coldStart: boolean;
}

export interface ForecastResponse {
  success: boolean;
  project: ProjectSummary;
  equipmentType: string;
  history: HistoryPoint[];
  forecast: ForecastPoint[];
  summary: ForecastSummary;
  asOf: string;
  forecastRunId: string;
  modelVersion: string;
  servingMethods?: { units?: string; machineHours?: string };
  dataMode: string;
  pricingMode: string;
  warning: string;
}

export interface ProjectBundleResponse {
  success: boolean;
  project: ProjectSummary;
  equipment: Array<{
    equipmentType: string;
    summary: ForecastSummary;
    forecast: ForecastPoint[];
  }>;
  asOf: string;
  forecastRunId: string;
  modelVersion: string;
  servingMethods?: { units?: string; machineHours?: string };
  dataMode: string;
  pricingMode: string;
  warning: string;
}

export interface PackageCandidate {
  packageCode: string;
  packageName: string;
  billingModel: string;
  durationDays: number;
  includedUnits: number;
  includedHours: number;
  estimatedCost: number;
  expectedIncludedCapacityUsage: number;
  estimatedUnusedCapacity: number;
  expectedExtraHourCharges: number;
  shortageRisk: number;
  commitmentRisk: number;
  flexibilityScore: number;
  score: number;
  cancellationPolicy: string;
  description: string;
  simulatedPricing: boolean;
  estimatedSavings?: number;
}

export interface Recommendation {
  recommendationId: number;
  projectId: number;
  equipmentType: string;
  action: string;
  preference: string;
  currentPackageCode?: string | null;
  recommended: PackageCandidate;
  alternatives: PackageCandidate[];
  explanation: string;
  customerBenefit: string;
  pricingVersion: string;
  simulatedPricing: boolean;
  decision?: string;
}

export interface DemandStatus {
  service: string;
  ready: boolean;
  dataMode: string;
  synthetic: boolean;
  modelLoaded: boolean;
  modelPromoted: boolean;
  unitModelPromoted?: boolean;
  hourModelPromoted?: boolean;
  modelVersion: string;
  modelError: string | null;
  servingMethods?: { units?: string; machineHours?: string };
  manifest?: Record<string, unknown>;
  warning?: string;
}

export interface DealerRow {
  region: string;
  equipmentType: string;
  forecastWeek: string;
  expectedDemand: number;
  safeDemand: number;
  expectedAvailable: number;
  shortageOrSurplus: number;
  projectCount: number;
  confidence: string;
  severity: string;
}

export interface DealerAction {
  actionId: number;
  equipmentType: string;
  forecastWeek: string;
  sourceRegion: string;
  destinationRegion: string;
  recommendedUnits: number;
  sourceSafetyBuffer: number;
  transferLeadDays: number;
  status: string;
  customerImpact: string;
  rationale: string;
  version?: number;
}

function demandHeaders(persona: 'customer' | 'dealer' = 'customer'): Record<string, string> {
  const session = readApiSession();
  if (session?.accessToken) {
    return { Authorization: `Bearer ${session.accessToken}` };
  }
  if (session?.role) {
    // Map dashboard roles onto demand demo headers
    const role = session.role.toUpperCase();
    if (persona === 'dealer' || role === 'FLEET_MANAGER' || role === 'DEALER' || role === 'DEALER_MANAGER') {
      return {
        'X-Actor-Id': session.actorId || 'demo-fleet-manager',
        'X-User-Role': role === 'DEALER' ? 'DEALER_MANAGER' : 'FLEET_MANAGER',
        'X-Dealer-Id': String(session.dealerId ?? 1),
      };
    }
    return {
      'X-Actor-Id': session.actorId || 'demo-customer-pm',
      'X-User-Role': 'CUSTOMER_PROJECT_MANAGER',
      'X-Company-Id': String(session.companyId ?? 1),
    };
  }
  // Fallback demo personas when not logged in via session
  if (persona === 'dealer') {
    return {
      'X-Actor-Id': 'demo-fleet-manager',
      'X-User-Role': 'FLEET_MANAGER',
      'X-Dealer-Id': '1',
    };
  }
  return {
    'X-Actor-Id': 'demo-customer-pm',
    'X-User-Role': 'CUSTOMER_PROJECT_MANAGER',
    'X-Company-Id': '1',
  };
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  persona: 'customer' | 'dealer' = 'customer',
): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    cache: init.cache ?? 'no-store',
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...demandHeaders(persona),
      ...(init.headers ?? {}),
    },
  });
  let payload: any;
  try {
    payload = await response.json();
  } catch {
    payload = { detail: `The server returned ${response.status} without JSON.` };
  }
  if (!response.ok) {
    throw new Error(
      typeof payload.detail === 'string'
        ? payload.detail
        : payload.error ?? `Request failed (${response.status})`,
    );
  }
  return payload as T;
}

export const demandApi = {
  status: () => request<DemandStatus>('/api/demand/status'),

  projects: () =>
    request<{
      success: boolean;
      projects: ProjectSummary[];
      warning: string;
      asOf?: string;
      modelVersion?: string;
      dataMode?: string;
      servingMethods?: { units?: string; machineHours?: string };
    }>('/api/demand/projects'),

  project: (projectId: number) =>
    request<ProjectBundleResponse>(`/api/demand/projects/${projectId}`),

  equipmentForecast: (projectId: number, equipmentType: string) =>
    request<ForecastResponse>(
      `/api/demand/projects/${projectId}/equipment/${encodeURIComponent(equipmentType)}`,
    ),

  explanation: (forecastId: number) =>
    request<{
      success: boolean;
      forecastId: number;
      facts: Record<string, unknown>;
      explanation: string;
      warning?: string;
    }>(`/api/demand/forecasts/${forecastId}/explanation`),

  packages: (projectId: number, equipmentType: string, preference: string) =>
    request<{
      success: boolean;
      recommendation: Recommendation;
      warning: string;
      modelVersion?: string;
      dataMode?: string;
    }>(
      `/api/demand/projects/${projectId}/packages?equipmentType=${encodeURIComponent(
        equipmentType,
      )}&preference=${encodeURIComponent(preference)}`,
    ),

  feedback: (body: Record<string, unknown>) =>
    request<{ success: boolean }>('/api/demand/feedback', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey('feedback') },
      body: JSON.stringify(body),
    }),

  override: (body: Record<string, unknown>) =>
    request<{ success: boolean }>('/api/demand/override', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey('override') },
      body: JSON.stringify(body),
    }),

  manualReview: (body: Record<string, unknown>) =>
    request<{ success: boolean }>('/api/demand/manual-reviews', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey('review') },
      body: JSON.stringify(body),
    }),

  dealer: () =>
    request<{
      rows: DealerRow[];
      actions: DealerAction[];
      inventoryAsOf: string;
      warning: string;
      modelVersion?: string;
    }>('/api/demand/dealer', {}, 'dealer'),

  decideDealerAction: (action: DealerAction, decision: 'APPROVED' | 'REJECTED') =>
    request<{ success: boolean; status: string }>(
      `/api/demand/dealer/actions/${action.actionId}/decision`,
      {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey('dealer-action') },
        body: JSON.stringify({
          decision,
          expectedVersion: action.version ?? 1,
          reason:
            decision === 'APPROVED'
              ? 'Fleet manager confirmed protected source surplus and lead time.'
              : 'Fleet manager rejected the proposed movement after operational review.',
        }),
      },
      'dealer',
    ),
};

// re-export platform request helper if needed by callers
export { platformRequest };
