import { useEffect, useMemo, useState } from 'react';
import { ApiError } from '../../api/client';
import {
  optimizationApi,
  type OptimizationCandidate,
  type OptimizationRunResponse,
} from '../../api/optimization';
import PageHeader from '../../components/ui/PageHeader';

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function money(value?: number | null, currency = 'INR') {
  if (value == null) return 'Not available';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function reasonLabel(value: string) {
  return value.toLowerCase().replaceAll('_', ' ');
}

function siteName(candidate: OptimizationCandidate, side: 'source' | 'destination') {
  const site = side === 'source' ? candidate.sourceSite : candidate.destinationSite;
  return site?.siteName || (side === 'source' ? 'External supply' : 'Unknown site');
}

export default function FleetOptimization() {
  const today = useMemo(() => new Date(), []);
  const horizon = useMemo(() => {
    const value = new Date(today);
    value.setDate(value.getDate() + 84);
    return value;
  }, [today]);
  const [planningStart, setPlanningStart] = useState(isoDate(today));
  const [planningEnd, setPlanningEnd] = useState(isoDate(horizon));
  const [result, setResult] = useState<OptimizationRunResponse | null>(null);
  const [recommendations, setRecommendations] = useState<OptimizationCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadRecommendations() {
    setLoading(true);
    setError(null);
    try {
      const response = await optimizationApi.recommendations();
      setRecommendations(response.recommendations);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not load optimization recommendations.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRecommendations();
  }, []);

  async function runOptimization() {
    setRunning(true);
    setError(null);
    setMessage(null);
    try {
      const response = await optimizationApi.run(planningStart, planningEnd);
      setResult(response);
      setRecommendations(
        response.candidates.filter((candidate) => candidate.recommendationId != null),
      );
      setMessage(
        `Run ${response.run.optimizationRunId} completed. Review is required before any operational action.`,
      );
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'The optimization run could not be completed.');
    } finally {
      setRunning(false);
    }
  }

  async function decide(
    candidate: OptimizationCandidate,
    decision: 'APPROVED' | 'REJECTED',
  ) {
    if (!candidate.recommendationId || !candidate.version) return;
    setError(null);
    setMessage(null);
    try {
      const response = await optimizationApi.decide(
        candidate.recommendationId,
        decision,
        candidate.version,
        decision === 'APPROVED'
          ? 'Fleet manager reviewed source coverage, timing, and itemized cost.'
          : 'Fleet manager rejected the advisory recommendation after operational review.',
      );
      setRecommendations((items) =>
        items.map((item) =>
          item.recommendationId === candidate.recommendationId
            ? {
                ...item,
                recommendationStatus: response.status,
                version: response.version,
              }
            : item,
        ),
      );
      setMessage(response.message);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'The decision could not be recorded.');
    }
  }

  const proposed = recommendations.filter(
    (candidate) => candidate.recommendationStatus === 'PROPOSED',
  );
  const totalSavings = proposed.reduce(
    (sum, candidate) => sum + Math.max(0, candidate.netSavings ?? 0),
    0,
  );
  const blocked = result?.candidates.filter((candidate) => !candidate.feasible) ?? [];

  return (
    <main className="space-y-5">
      <PageHeader
        title="Fleet Optimization"
        subtitle="Phase-aware transfer and rental advice. Every move protects source-site requirements first."
      />

      <section className="rounded-xl border border-outline-variant bg-surface-container-lowest">
        <div className="flex flex-wrap items-end gap-3 p-4">
          <label className="field min-w-44">
            <span>Planning start</span>
            <input
              type="date"
              value={planningStart}
              max={planningEnd}
              onChange={(event) => setPlanningStart(event.target.value)}
            />
          </label>
          <label className="field min-w-44">
            <span>Planning end</span>
            <input
              type="date"
              value={planningEnd}
              min={planningStart}
              onChange={(event) => setPlanningEnd(event.target.value)}
            />
          </label>
          <button
            className="btn-primary"
            type="button"
            disabled={running || !planningStart || !planningEnd}
            onClick={runOptimization}
          >
            <span className="material-symbols-outlined text-base">calculate</span>
            {running ? 'Evaluating fleet…' : 'Run optimization'}
          </button>
          <p className="max-w-xl text-xs text-on-surface-variant">
            Advisory only. Approval records the decision; it does not change an assignment.
          </p>
        </div>

        <dl className="grid grid-cols-2 border-t border-outline-variant/70 md:grid-cols-4">
          <div className="p-4">
            <dt className="text-xs font-semibold text-on-surface-variant">Awaiting review</dt>
            <dd className="mt-1 text-xl font-black text-on-surface">{proposed.length}</dd>
          </div>
          <div className="border-l border-outline-variant/70 p-4">
            <dt className="text-xs font-semibold text-on-surface-variant">Potential savings</dt>
            <dd className="mt-1 text-xl font-black text-on-surface">{money(totalSavings)}</dd>
          </div>
          <div className="border-l border-outline-variant/70 p-4">
            <dt className="text-xs font-semibold text-on-surface-variant">Blocked alternatives</dt>
            <dd className="mt-1 text-xl font-black text-on-surface">{blocked.length}</dd>
          </div>
          <div className="border-l border-outline-variant/70 p-4">
            <dt className="text-xs font-semibold text-on-surface-variant">Last run</dt>
            <dd className="mt-1 text-sm font-bold text-on-surface">
              {result ? new Date(result.run.asOf).toLocaleString() : 'Not run this session'}
            </dd>
          </div>
        </dl>
      </section>

      {error && (
        <div className="rounded-lg border border-error/40 bg-error-container px-4 py-3 text-sm text-on-error-container" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-lg border border-tertiary/40 bg-surface-container px-4 py-3 text-sm text-on-surface" role="status">
          {message}
        </div>
      )}
      {!!result?.run.warnings.length && (
        <section className="rounded-xl border border-outline bg-surface-container-lowest p-4" aria-labelledby="data-warnings">
          <h2 id="data-warnings" className="text-sm font-black text-on-surface">Data requiring attention</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-on-surface-variant">
            {result.run.warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </section>
      )}

      <section aria-labelledby="recommendation-heading">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 id="recommendation-heading" className="text-lg font-black text-on-surface">
              Recommended actions
            </h2>
            <p className="text-sm text-on-surface-variant">
              Lowest-cost feasible action for each uncovered phase requirement.
            </p>
          </div>
          <button className="btn-secondary" type="button" disabled={loading} onClick={loadRecommendations}>
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="forecast-skeleton"><div /><div /><div /></div>
        ) : recommendations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-outline bg-surface-container-lowest p-8 text-center">
            <span className="material-symbols-outlined text-3xl text-on-surface-variant">route</span>
            <h3 className="mt-2 text-base font-black text-on-surface">No recommendations yet</h3>
            <p className="mx-auto mt-1 max-w-xl text-sm text-on-surface-variant">
              Add project phases, equipment requirements, site coordinates, inventory snapshots,
              and cost profiles, then run the optimizer.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
            {recommendations.map((candidate, index) => {
              const currency = String(candidate.costBreakdown.currency ?? 'INR');
              const proposedStatus = candidate.recommendationStatus === 'PROPOSED';
              return (
                <article
                  className={`p-4 ${index ? 'border-t border-outline-variant/70' : ''}`}
                  key={candidate.candidateId}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-primary-container px-2.5 py-1 text-xs font-black text-on-primary-container">
                          {reasonLabel(candidate.action)}
                        </span>
                        <span className="text-xs font-bold text-on-surface-variant">
                          {candidate.recommendationStatus?.toLowerCase()}
                        </span>
                      </div>
                      <h3 className="mt-3 text-base font-black text-on-surface">
                        {siteName(candidate, 'source')} → {siteName(candidate, 'destination')}
                      </h3>
                      <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
                        {candidate.explanation}
                      </p>
                      <dl className="mt-4 flex flex-wrap gap-x-7 gap-y-3 text-sm">
                        <div><dt className="text-xs text-on-surface-variant">Equipment</dt><dd className="font-bold">{candidate.recommendedUnits} × {candidate.equipmentType}</dd></div>
                        <div><dt className="text-xs text-on-surface-variant">Estimated cost</dt><dd className="font-bold">{money(candidate.candidateCost, currency)}</dd></div>
                        <div><dt className="text-xs text-on-surface-variant">Baseline</dt><dd className="font-bold">{money(candidate.baselineCost, currency)}</dd></div>
                        <div><dt className="text-xs text-on-surface-variant">Net savings</dt><dd className="font-bold">{money(candidate.netSavings, currency)}</dd></div>
                        {candidate.distanceKm != null && <div><dt className="text-xs text-on-surface-variant">Route estimate</dt><dd className="font-bold">{candidate.distanceKm.toFixed(0)} km · {candidate.transferLeadDays} day lead</dd></div>}
                      </dl>
                    </div>
                    {proposedStatus && candidate.recommendationId && (
                      <div className="flex shrink-0 gap-2">
                        <button className="btn-primary" type="button" onClick={() => decide(candidate, 'APPROVED')}>
                          Approve
                        </button>
                        <button className="btn-secondary" type="button" onClick={() => decide(candidate, 'REJECTED')}>
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {blocked.length > 0 && (
        <details className="rounded-xl border border-outline-variant bg-surface-container-lowest">
          <summary className="cursor-pointer px-4 py-3 text-sm font-black text-on-surface">
            Why {blocked.length} alternatives were blocked
          </summary>
          <div className="table-scroll border-t border-outline-variant/70">
            <table className="data-table w-full">
              <thead><tr><th>Action</th><th>Equipment</th><th>Route</th><th>Constraint</th></tr></thead>
              <tbody>
                {blocked.map((candidate) => (
                  <tr key={candidate.candidateId}>
                    <td>{reasonLabel(candidate.action)}</td>
                    <td>{candidate.equipmentType}</td>
                    <td>{siteName(candidate, 'source')} → {siteName(candidate, 'destination')}</td>
                    <td>{candidate.rejectionReasons.map(reasonLabel).join('; ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </main>
  );
}
