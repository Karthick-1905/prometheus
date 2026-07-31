import { idempotencyKey, request } from './client';

export interface OptimizationSite {
  siteId: number;
  siteName?: string | null;
  location?: string | null;
}

export interface OptimizationCandidate {
  candidateId: number;
  recommendationId?: number | null;
  recommendationStatus?: string | null;
  version?: number | null;
  action: string;
  recommendedUnits: number;
  equipmentId?: number | null;
  equipmentType: string;
  sourceSite?: OptimizationSite | null;
  destinationSite?: OptimizationSite | null;
  requirementId?: number | null;
  feasible: boolean;
  rejectionReasons: string[];
  distanceKm?: number | null;
  transferLeadDays?: number | null;
  baselineCost?: number | null;
  candidateCost?: number | null;
  netSavings?: number | null;
  riskPenalty?: number | null;
  optimizationScore?: number | null;
  costBreakdown: Record<string, unknown>;
  explanation: string;
}

export interface OptimizationRunResponse {
  success: boolean;
  run: {
    optimizationRunId: number;
    planningStart: string;
    planningEnd: string;
    asOf: string;
    optimizerVersion: string;
    status: string;
    warnings: string[];
  };
  candidates: OptimizationCandidate[];
}

export const optimizationApi = {
  projectPhases: (projectId: number) =>
    request<{
      success: boolean;
      projectId: number;
      phases: Array<Record<string, unknown>>;
    }>(`/api/v1/projects/${projectId}/phases`),

  createProjectPhase: (projectId: number, body: Record<string, unknown>) =>
    request<{ success: boolean; phase: Record<string, unknown> }>(
      `/api/v1/projects/${projectId}/phases`,
      { method: 'POST', body: JSON.stringify(body) },
    ),

  createPhaseRequirement: (phaseId: number, body: Record<string, unknown>) =>
    request<{ success: boolean; requirement: Record<string, unknown> }>(
      `/api/v1/project-phases/${phaseId}/requirements`,
      { method: 'POST', body: JSON.stringify(body) },
    ),

  run: (planningStart: string, planningEnd: string) =>
    request<OptimizationRunResponse>('/api/v1/optimization/runs', {
      method: 'POST',
      body: JSON.stringify({ planningStart, planningEnd }),
    }),

  getRun: (runId: number) =>
    request<OptimizationRunResponse>(`/api/v1/optimization/runs/${runId}`),

  recommendations: () =>
    request<{ success: boolean; recommendations: OptimizationCandidate[] }>(
      '/api/v1/optimization/recommendations',
    ),

  decide: (
    recommendationId: number,
    decision: 'APPROVED' | 'REJECTED',
    expectedVersion: number,
    reason: string,
  ) =>
    request<{
      success: boolean;
      status: string;
      version: number;
      executionStatus: string;
      message: string;
    }>(`/api/v1/optimization/recommendations/${recommendationId}/decision`, {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey('optimization-decision') },
      body: JSON.stringify({ decision, expectedVersion, reason }),
    }),
};
