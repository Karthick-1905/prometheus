import { useEffect, useMemo, useState } from 'react';
import {
  demandApi,
  type DemandStatus,
  type ForecastPoint,
  type ForecastResponse,
  type HistoryPoint,
  type PackageCandidate,
  type ProjectSummary,
  type Recommendation,
} from '../api/demand';
import '../styles/demand-planning.css';

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function dateLabel(value?: string | null, includeYear = false) {
  if (!value) return '—';
  const raw = value.includes('T') ? value : `${value}T00:00:00`;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    ...(includeYear ? { year: 'numeric' } : {}),
  });
}

function percentage(value: number | null | undefined, digits = 0) {
  if (value == null || Number.isNaN(value)) return '—';
  return `${(value * 100).toFixed(digits)}%`;
}

function readable(value?: string | null) {
  if (!value) return '—';
  return value.replaceAll('_', ' ').toLowerCase();
}

function pathFor(
  values: Array<{ x: number; value: number }>,
  y: (value: number) => number,
) {
  return values
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${y(point.value).toFixed(1)}`)
    .join(' ');
}

function ForecastTimeline({
  history,
  forecast,
  selectedWeek,
  onSelectWeek,
}: {
  history: HistoryPoint[];
  forecast: ForecastPoint[];
  selectedWeek: number;
  onSelectWeek: (index: number) => void;
}) {
  const recentHistory = history.slice(-6);
  const width = 920;
  const height = 310;
  const inset = { top: 24, right: 24, bottom: 50, left: 48 };
  const plotWidth = width - inset.left - inset.right;
  const plotHeight = height - inset.top - inset.bottom;
  const count = Math.max(2, recentHistory.length + forecast.length);
  const x = (index: number) => inset.left + (index / (count - 1)) * plotWidth;
  const maximum = Math.max(
    1,
    ...recentHistory.flatMap((point) => [point.requestedUnits, point.fulfilledUnits]),
    ...forecast.flatMap((point) => [
      point.upperUnits,
      point.predictedUnits,
      point.safePlanningUnits,
    ]),
  );
  const chartMaximum = Math.ceil(maximum * 1.12);
  const y = (value: number) => inset.top + plotHeight - (value / chartMaximum) * plotHeight;
  const historyRequested = recentHistory.map((point, index) => ({
    x: x(index),
    value: point.requestedUnits,
  }));
  const historyFulfilled = recentHistory.map((point, index) => ({
    x: x(index),
    value: point.fulfilledUnits,
  }));
  const forecastOffset = recentHistory.length;
  const expected = forecast.map((point, index) => ({
    x: x(forecastOffset + index),
    value: point.predictedUnits,
  }));
  const safe = forecast.map((point, index) => ({
    x: x(forecastOffset + index),
    value: point.safePlanningUnits,
  }));
  const expectedWithBridge =
    recentHistory.length && forecast.length
      ? [
          {
            x: x(recentHistory.length - 1),
            value: recentHistory[recentHistory.length - 1].requestedUnits,
          },
          ...expected,
        ]
      : expected;
  const band =
    forecast.length > 0
      ? [
          ...forecast.map(
            (point, index) =>
              `${index === 0 ? 'M' : 'L'} ${x(forecastOffset + index).toFixed(1)} ${y(point.upperUnits).toFixed(1)}`,
          ),
          ...forecast
            .map(
              (point, index) =>
                `L ${x(forecastOffset + index).toFixed(1)} ${y(point.lowerUnits).toFixed(1)}`,
            )
            .reverse(),
          'Z',
        ].join(' ')
      : '';
  const boundaryX =
    recentHistory.length > 0
      ? x(Math.max(0, recentHistory.length - 0.5))
      : inset.left;
  const selectedPoint = forecast[selectedWeek];
  const selectedX = selectedPoint ? x(forecastOffset + selectedWeek) : null;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    ratio,
    value: Math.round(chartMaximum * ratio),
    y: y(chartMaximum * ratio),
  }));

  return (
    <figure className="dp-chart">
      <figcaption className="dp-sr-only">
        Recent requested and fulfilled units followed by the four-week demand forecast.
      </figcaption>
      <div className="dp-chart-heading">
        <div>
          <h2>Demand history and outlook</h2>
          <p>Recent requested and fulfilled units continue into the four-week forecast.</p>
        </div>
        <div className="dp-legend" aria-label="Chart legend">
          <span><i className="is-requested" />Requested</span>
          <span><i className="is-fulfilled" />Fulfilled</span>
          <span><i className="is-expected" />Expected</span>
          <span><i className="is-safe" />Safe plan</span>
          <span><i className="is-range" />Forecast range</span>
        </div>
      </div>
      <div className="dp-chart-scroll">
        <svg
          className="dp-chart-svg"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-labelledby="demand-chart-title demand-chart-description"
        >
          <title id="demand-chart-title">Recent demand and four-week equipment forecast</title>
          <desc id="demand-chart-description">
            Requested and fulfilled unit history followed by expected units, uncertainty range,
            and the safe planning quantity for each of the next four weeks. Exact values are
            available in the table below.
          </desc>
          {ticks.map((tick) => (
            <g key={tick.ratio}>
              <line
                className="dp-grid-line"
                x1={inset.left}
                x2={width - inset.right}
                y1={tick.y}
                y2={tick.y}
              />
              <text className="dp-axis-label" x={inset.left - 10} y={tick.y + 4} textAnchor="end">
                {tick.value}
              </text>
            </g>
          ))}
          <line
            className="dp-forecast-boundary"
            x1={boundaryX}
            x2={boundaryX}
            y1={inset.top}
            y2={inset.top + plotHeight}
          />
          <text className="dp-boundary-label" x={boundaryX + 8} y={inset.top + 12}>
            Forecast
          </text>
          {band && <path className="dp-range-band" d={band} />}
          {historyRequested.length > 1 && (
            <path className="dp-history-requested" d={pathFor(historyRequested, y)} />
          )}
          {historyFulfilled.length > 1 && (
            <path className="dp-history-fulfilled" d={pathFor(historyFulfilled, y)} />
          )}
          {expectedWithBridge.length > 1 && (
            <path className="dp-expected-line" d={pathFor(expectedWithBridge, y)} />
          )}
          {safe.length > 1 && <path className="dp-safe-line" d={pathFor(safe, y)} />}
          {forecast.map((point, index) => {
            const pointX = x(forecastOffset + index);
            const isSelected = selectedWeek === index;
            return (
              <g key={point.forecastId}>
                <circle
                  className={`dp-expected-point ${isSelected ? 'is-selected' : ''}`}
                  cx={pointX}
                  cy={y(point.predictedUnits)}
                  r={isSelected ? 6 : 4}
                />
                <circle
                  className="dp-safe-point"
                  cx={pointX}
                  cy={y(point.safePlanningUnits)}
                  r={3}
                />
              </g>
            );
          })}
          {selectedPoint && selectedX != null && (
            <text
              className="dp-selected-value"
              x={selectedX}
              y={Math.max(inset.top + 12, y(selectedPoint.predictedUnits) - 12)}
              textAnchor="middle"
            >
              {selectedPoint.predictedUnits.toFixed(1)}
            </text>
          )}
          {recentHistory.map((point, index) => {
            const show = index === 0 || index === recentHistory.length - 1;
            return show ? (
              <text
                className="dp-axis-label"
                key={point.weekStart}
                x={x(index)}
                y={height - 18}
                textAnchor="middle"
              >
                {dateLabel(point.weekStart)}
              </text>
            ) : null;
          })}
          {forecast.map((point, index) => (
            <text
              className="dp-axis-label"
              key={point.forecastId}
              x={x(forecastOffset + index)}
              y={height - 18}
              textAnchor="middle"
            >
              {dateLabel(point.forecastWeek)}
            </text>
          ))}
        </svg>
      </div>
      <div className="dp-week-selector" aria-label="Select a forecast week">
        {forecast.map((point, index) => (
          <button
            type="button"
            key={point.forecastId}
            className={selectedWeek === index ? 'is-selected' : ''}
            aria-pressed={selectedWeek === index}
            onClick={() => onSelectWeek(index)}
          >
            <span>Week {index + 1}</span>
            <strong>{point.predictedUnits.toFixed(1)} expected</strong>
            <small>{dateLabel(point.forecastWeek)}</small>
          </button>
        ))}
      </div>
    </figure>
  );
}

function PackageFacts({ candidate }: { candidate: PackageCandidate }) {
  return (
    <dl className="dp-package-facts">
      <div><dt>Estimated cost</dt><dd>{currency.format(candidate.estimatedCost)}</dd></div>
      <div><dt>Included capacity</dt><dd>{candidate.includedUnits} units · {candidate.includedHours} hrs</dd></div>
      <div><dt>Unused capacity</dt><dd>{Math.round(candidate.estimatedUnusedCapacity)} hrs</dd></div>
      <div><dt>Shortage exposure</dt><dd>{percentage(candidate.shortageRisk)}</dd></div>
      <div><dt>Commitment risk</dt><dd>{percentage(candidate.commitmentRisk)}</dd></div>
      <div><dt>Cancellation</dt><dd>{candidate.cancellationPolicy}</dd></div>
    </dl>
  );
}

type PendingAction = 'accept' | 'reject' | 'review' | 'override' | null;

export default function DemandForecastPage() {
  const [status, setStatus] = useState<DemandStatus | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [equipmentType, setEquipmentType] = useState('');
  const [preference, setPreference] = useState('BALANCED');
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [overrideUnits, setOverrideUnits] = useState(0);
  const [overrideHours, setOverrideHours] = useState(0);
  const [overrideReason, setOverrideReason] = useState('');

  const selectedProject = useMemo(
    () => projects.find((project) => project.projectId === projectId) ?? forecast?.project ?? null,
    [projects, projectId, forecast],
  );
  const weekPoint = forecast?.forecast[selectedWeek] ?? forecast?.forecast[0] ?? null;

  useEffect(() => {
    let active = true;
    setInitialLoading(true);
    Promise.all([demandApi.status(), demandApi.projects()])
      .then(([serviceStatus, projectResult]) => {
        if (!active) return;
        const nextProjects = projectResult.projects ?? [];
        setStatus(serviceStatus);
        setProjects(nextProjects);
        if (nextProjects.length) {
          setProjectId(nextProjects[0].projectId);
          setEquipmentType(nextProjects[0].equipmentTypes?.[0] ?? '');
        }
      })
      .catch((reason) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : 'Unable to load demand planning.');
        }
      })
      .finally(() => {
        if (active) setInitialLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!projectId || !equipmentType) return;
    let active = true;
    setForecastLoading(true);
    setError(null);
    setNotice(null);
    demandApi
      .equipmentForecast(projectId, equipmentType)
      .then((result) => {
        if (!active) return;
        setForecast(result);
        setSelectedWeek(0);
      })
      .catch((reason) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : 'Unable to load this forecast.');
        }
      })
      .finally(() => {
        if (active) setForecastLoading(false);
      });
    return () => {
      active = false;
    };
  }, [projectId, equipmentType]);

  useEffect(() => {
    if (!projectId || !equipmentType) return;
    let active = true;
    setRecommendationLoading(true);
    demandApi
      .packages(projectId, equipmentType, preference)
      .then((result) => {
        if (active) setRecommendation(result.recommendation);
      })
      .catch((reason) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : 'Unable to compare packages.');
        }
      })
      .finally(() => {
        if (active) setRecommendationLoading(false);
      });
    return () => {
      active = false;
    };
  }, [projectId, equipmentType, preference]);

  useEffect(() => {
    if (!weekPoint) return;
    setOverrideUnits(weekPoint.predictedUnits);
    setOverrideHours(weekPoint.predictedMachineHours);
    setOverrideReason('');
  }, [weekPoint?.forecastId]);

  const switchProject = (nextId: number) => {
    const nextProject = projects.find((project) => project.projectId === nextId);
    setProjectId(nextId);
    setEquipmentType(nextProject?.equipmentTypes?.[0] ?? '');
    setForecast(null);
    setRecommendation(null);
  };

  const sendDecision = async (decision: 'ACCEPTED' | 'REJECTED' | 'MANUAL_REVIEW') => {
    if (!recommendation || !forecast || pendingAction) return;
    const pending: PendingAction =
      decision === 'ACCEPTED' ? 'accept' : decision === 'REJECTED' ? 'reject' : 'review';
    setPendingAction(pending);
    setError(null);
    setNotice(null);
    try {
      if (decision === 'MANUAL_REVIEW') {
        await demandApi.manualReview({
          forecastId: forecast.forecast[0].forecastId,
          reason: 'Customer requested a planning review before making a rental commitment.',
          urgency: 'STANDARD',
        });
      } else {
        await demandApi.feedback({
          recommendationId: recommendation.recommendationId,
          forecastId: forecast.forecast[0].forecastId,
          decision,
          rejectionReason:
            decision === 'REJECTED'
              ? 'Customer prefers to continue the current plan and review after the next project update.'
              : undefined,
        });
      }
      setRecommendation((current) => current ? { ...current, decision } : current);
      setNotice(
        decision === 'ACCEPTED'
          ? 'Planning intent recorded. No rental was placed automatically.'
          : decision === 'REJECTED'
            ? 'Current plan retained. No package was changed.'
            : 'Manual review requested. The forecast remains unchanged.',
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save the decision.');
    } finally {
      setPendingAction(null);
    }
  };

  const submitOverride = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!forecast || !weekPoint || pendingAction) return;
    setPendingAction('override');
    setError(null);
    setNotice(null);
    try {
      await demandApi.override({
        forecastId: weekPoint.forecastId,
        expectedVersion: weekPoint.version,
        adjustedUnits: overrideUnits,
        adjustedMachineHours: overrideHours,
        reason: overrideReason,
      });
      const [refreshedForecast, refreshedPackages] = await Promise.all([
        demandApi.equipmentForecast(forecast.project.projectId, equipmentType),
        demandApi.packages(forecast.project.projectId, equipmentType, preference),
      ]);
      setForecast(refreshedForecast);
      setRecommendation(refreshedPackages.recommendation);
      setSelectedWeek(Math.min(selectedWeek, refreshedForecast.forecast.length - 1));
      setNotice(`Week ${selectedWeek + 1} override saved and package comparison refreshed.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save the override.');
    } finally {
      setPendingAction(null);
    }
  };

  if (initialLoading) {
    return (
      <div className="demand-planning" aria-busy="true">
        <p className="dp-sr-only" role="status">Loading demand planning.</p>
        <div className="dp-skeleton"><span /><span /><span /></div>
      </div>
    );
  }

  if (!projects.length || !projectId || !equipmentType) {
    return (
      <div className="demand-planning">
        <section className="dp-empty">
          <h1>No active project forecast</h1>
          <p>Demand planning will appear when an active project has forecastable equipment.</p>
          {error && <div className="dp-message is-error" role="alert">{error}</div>}
        </section>
      </div>
    );
  }

  return (
    <div className="demand-planning" aria-busy={forecastLoading}>
      <header className="dp-page-heading">
        <div>
          <h1>Demand planning</h1>
          <p>Understand the need, uncertainty, and lowest-commitment safe option.</p>
        </div>
        <div className="dp-freshness">
          <span className={status?.ready ? 'is-ready' : 'is-warning'}>
            {status?.ready ? 'Forecast service ready' : 'Forecast service needs attention'}
          </span>
          <small>
            {forecast?.asOf ? `Updated ${dateLabel(forecast.asOf, true)}` : 'Waiting for forecast'}
            {' · '}
            {forecast?.dataMode ?? status?.dataMode ?? 'unknown'} data
          </small>
        </div>
      </header>

      <section className="dp-controls" aria-label="Planning context">
        <label>
          <span>Project</span>
          <select value={projectId} onChange={(event) => switchProject(Number(event.target.value))}>
            {projects.map((project) => (
              <option value={project.projectId} key={project.projectId}>
                {project.projectName} ({project.projectCode})
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Equipment</span>
          <select
            value={equipmentType}
            onChange={(event) => {
              setEquipmentType(event.target.value);
              setForecast(null);
              setRecommendation(null);
            }}
          >
            {(selectedProject?.equipmentTypes ?? []).map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Priority</span>
          <select
            value={preference}
            onChange={(event) => {
              setPreference(event.target.value);
              setRecommendation(null);
            }}
          >
            <option value="BALANCED">Balance cost and availability</option>
            <option value="COST">Prefer lower commitment</option>
            <option value="AVAILABILITY">Protect availability</option>
          </select>
        </label>
        {forecastLoading && <span className="dp-updating" role="status">Updating forecast…</span>}
      </section>

      {(status?.warning || forecast?.warning) && (
        <div className="dp-mode-notice" role="note">
          <strong>{forecast?.dataMode === 'synthetic' || status?.synthetic ? 'Synthetic planning data' : 'Planning notice'}</strong>
          <span>{forecast?.warning || status?.warning}</span>
        </div>
      )}
      {error && <div className="dp-message is-error" role="alert">{error}</div>}
      {notice && <div className="dp-message is-success" role="status">{notice}</div>}

      {!forecast ? (
        <div className="dp-skeleton" aria-label="Loading forecast">
          <p className="dp-sr-only" role="status">Loading forecast.</p>
          <span /><span /><span />
        </div>
      ) : (
        <>
          {weekPoint && (
            <section className="dp-plan-summary" aria-labelledby="dp-plan-title">
              <div>
                <p>
                  {selectedProject?.currentPhase ? `${selectedProject.currentPhase} · ` : ''}
                  Week of {dateLabel(weekPoint.forecastWeek, true)}
                </p>
                <h2 id="dp-plan-title">
                  Plan {weekPoint.safePlanningUnits} {equipmentType.toLowerCase()} unit
                  {weekPoint.safePlanningUnits === 1 ? '' : 's'}
                </h2>
                <span>
                  Expected {weekPoint.predictedUnits.toFixed(1)} · likely range{' '}
                  {weekPoint.lowerUnits.toFixed(1)}–{weekPoint.upperUnits.toFixed(1)}
                </span>
              </div>
              <dl>
                <div><dt>Machine-hours</dt><dd>{Math.round(weekPoint.predictedMachineHours)}</dd></div>
                <div><dt>Utilization</dt><dd>{percentage(weekPoint.predictedUtilization)}</dd></div>
                <div><dt>Confidence</dt><dd>{readable(weekPoint.confidence)}</dd></div>
                <div><dt>Direction</dt><dd>{readable(weekPoint.trend)}</dd></div>
              </dl>
            </section>
          )}

          <ForecastTimeline
            history={forecast.history}
            forecast={forecast.forecast}
            selectedWeek={selectedWeek}
            onSelectWeek={setSelectedWeek}
          />

          {weekPoint && (
            <section className="dp-week-summary" aria-labelledby="dp-week-summary-title">
              <div>
                <h2 id="dp-week-summary-title">Why Week {selectedWeek + 1} looks this way</h2>
                <p>{weekPoint.explanation}</p>
                {weekPoint.coldStart && (
                  <p className="dp-confidence-note">
                    Limited project history: this estimate also uses comparable projects
                    {weekPoint.comparableCohort ? ` (${weekPoint.comparableCohort})` : ''}.
                  </p>
                )}
              </div>
              <details className="dp-override">
                <summary>Adjust this week’s plan</summary>
                <form onSubmit={submitOverride}>
                  <label>
                    <span>Expected units</span>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={overrideUnits}
                      onChange={(event) => setOverrideUnits(Number(event.target.value))}
                    />
                  </label>
                  <label>
                    <span>Machine-hours</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={overrideHours}
                      onChange={(event) => setOverrideHours(Number(event.target.value))}
                    />
                  </label>
                  <label className="dp-override-reason">
                    <span>Reason for adjustment</span>
                    <textarea
                      required
                      minLength={8}
                      value={overrideReason}
                      onChange={(event) => setOverrideReason(event.target.value)}
                      placeholder="Describe the schedule, scope, or work change."
                    />
                  </label>
                  <button className="dp-secondary-button" type="submit" disabled={pendingAction != null}>
                    {pendingAction === 'override' ? 'Saving adjustment…' : 'Save adjustment'}
                  </button>
                </form>
              </details>
            </section>
          )}

          <section
            className="dp-recommendation"
            aria-labelledby="dp-recommendation-title"
            aria-busy={recommendationLoading}
          >
            {recommendationLoading && !recommendation ? (
              <p className="dp-updating" role="status">Comparing package options…</p>
            ) : recommendation ? (
              <>
                <div className="dp-recommendation-heading">
                  <div>
                    <span>
                      Recommended planning option
                      {recommendationLoading ? ' · updating' : ''}
                    </span>
                    <h2 id="dp-recommendation-title">{recommendation.recommended.packageName}</h2>
                    <p>{recommendation.customerBenefit}</p>
                  </div>
                </div>
                <PackageFacts candidate={recommendation.recommended} />
                <details className="dp-recommendation-reason">
                  <summary>Why this option</summary>
                  <p>{recommendation.explanation}</p>
                </details>
                <details className="dp-alternatives">
                  <summary>Compare {recommendation.alternatives.length} other option{recommendation.alternatives.length === 1 ? '' : 's'}</summary>
                  <div>
                    {recommendation.alternatives.map((candidate) => (
                      <article key={candidate.packageCode}>
                        <div>
                          <h3>{candidate.packageName}</h3>
                          <p>{candidate.description}</p>
                        </div>
                        <PackageFacts candidate={candidate} />
                      </article>
                    ))}
                  </div>
                </details>
                <div className="dp-decision-actions">
                  <button
                    className="dp-primary-button"
                    type="button"
                    disabled={
                      recommendationLoading || pendingAction != null || recommendation.decision != null
                    }
                    onClick={() => sendDecision('ACCEPTED')}
                  >
                    {pendingAction === 'accept' ? 'Recording…' : 'Accept as planning intent'}
                  </button>
                  <button
                    className="dp-secondary-button"
                    type="button"
                    disabled={
                      recommendationLoading || pendingAction != null || recommendation.decision != null
                    }
                    onClick={() => sendDecision('REJECTED')}
                  >
                    {pendingAction === 'reject' ? 'Recording…' : 'Keep current plan'}
                  </button>
                  <button
                    className="dp-text-button"
                    type="button"
                    disabled={
                      recommendationLoading || pendingAction != null || recommendation.decision != null
                    }
                    onClick={() => sendDecision('MANUAL_REVIEW')}
                  >
                    {pendingAction === 'review' ? 'Requesting…' : 'Request manual review'}
                  </button>
                  <span>
                    {recommendation.decision
                      ? `Decision recorded: ${readable(recommendation.decision)}.`
                      : 'No reservation or package change happens automatically.'}
                  </span>
                </div>
              </>
            ) : (
              <div className="dp-empty compact">
                <h2 id="dp-recommendation-title">No package comparison available</h2>
                <p>The forecast remains usable while package options are unavailable.</p>
              </div>
            )}
          </section>

          <details className="dp-data-disclosure">
            <summary>View exact forecast and history data</summary>
            <div className="dp-table-scroll">
              <table>
                <caption>Four-week {equipmentType} forecast</caption>
                <thead>
                  <tr>
                    <th scope="col">Week</th>
                    <th scope="col">Expected</th>
                    <th scope="col">Range</th>
                    <th scope="col">Safe plan</th>
                    <th scope="col">Machine-hours</th>
                    <th scope="col">Utilization</th>
                    <th scope="col">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {forecast.forecast.map((point) => (
                    <tr key={point.forecastId}>
                      <th scope="row">{dateLabel(point.forecastWeek, true)}</th>
                      <td>{point.predictedUnits.toFixed(2)}</td>
                      <td>{point.lowerUnits.toFixed(2)}–{point.upperUnits.toFixed(2)}</td>
                      <td>{point.safePlanningUnits}</td>
                      <td>{Math.round(point.predictedMachineHours)}</td>
                      <td>{percentage(point.predictedUtilization)}</td>
                      <td>{readable(point.confidence)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {forecast.history.length > 0 && (
              <div className="dp-table-scroll">
                <table>
                  <caption>Recent project demand and fulfillment history</caption>
                  <thead>
                    <tr>
                      <th scope="col">Week</th>
                      <th scope="col">Phase</th>
                      <th scope="col">Requested</th>
                      <th scope="col">Fulfilled</th>
                      <th scope="col">Unmet</th>
                      <th scope="col">Rented</th>
                      <th scope="col">Engine-hours</th>
                      <th scope="col">Idle hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.history.slice(-12).map((point) => (
                      <tr key={point.weekStart}>
                        <th scope="row">{dateLabel(point.weekStart, true)}</th>
                        <td>{readable(point.projectPhase)}</td>
                        <td>{point.requestedUnits}</td>
                        <td>{point.fulfilledUnits}</td>
                        <td>{point.unmetUnits}</td>
                        <td>{point.rentedUnits}</td>
                        <td>{Math.round(point.engineHours)}</td>
                        <td>{Math.round(point.idleHours)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </details>
        </>
      )}
    </div>
  );
}
