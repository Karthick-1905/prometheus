import { useEffect, useMemo, useState } from 'react';
import {
  demandApi,
  type ForecastPoint,
  type ForecastResponse,
  type PackageCandidate,
  type ProjectBundleResponse,
  type ProjectSummary,
  type Recommendation,
  type DemandStatus,
} from '../api/demand';
import '../styles/demand.css';

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function dateLabel(value?: string | null) {
  if (!value) return '—';
  const raw = value.includes('T') ? value : `${value}T00:00:00`;
  return new Date(raw).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function shortDate(value?: string | null) {
  if (!value) return '—';
  const raw = value.includes('T') ? value : `${value}T00:00:00`;
  return new Date(raw).toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

function pct(value: number | null | undefined, digits = 0) {
  if (value == null || Number.isNaN(value)) return '—';
  return `${(value * 100).toFixed(digits)}%`;
}

function confidenceLabel(value?: string) {
  return (value ?? '—').replaceAll('_', ' ').toLowerCase();
}

function TrendChip({ trend }: { trend?: string }) {
  const t = (trend ?? 'STABLE').toUpperCase();
  return <span className={`trend-chip trend-${t.toLowerCase()}`}>{t.toLowerCase()}</span>;
}

function ForecastRange({ points }: { points: ForecastPoint[] }) {
  const maximum = Math.max(1, ...points.map((p) => p.upperUnits));
  return (
    <div className="forecast-range" role="img" aria-label="Four-week equipment unit forecast">
      {points.map((point, index) => {
        const lower = (point.lowerUnits / maximum) * 100;
        const expected = (point.predictedUnits / maximum) * 100;
        const upper = (point.upperUnits / maximum) * 100;
        return (
          <div className={`forecast-week ${index === 0 ? 'is-primary' : ''}`} key={point.forecastId}>
            <div className="forecast-week-heading">
              <span>Week {index + 1}</span>
              <time dateTime={point.forecastWeek}>{shortDate(point.forecastWeek)}</time>
            </div>
            <div className="range-scale" aria-hidden="true">
              <div
                className="range-band"
                style={{ left: `${lower}%`, width: `${Math.max(4, upper - lower)}%` }}
              />
              <div className="range-expected" style={{ left: `${expected}%` }} />
            </div>
            <div className="forecast-unit-value">
              <strong>{point.predictedUnits.toFixed(1)}</strong>
              <span>expected · {point.safePlanningUnits} safe</span>
            </div>
            <div className="forecast-week-meta">
              <span>
                {point.lowerUnits.toFixed(1)}–{point.upperUnits.toFixed(1)} units
              </span>
              <span>{Math.round(point.predictedMachineHours)} machine-hrs</span>
            </div>
            <div className="forecast-week-meta">
              <span>Util {pct(point.predictedUtilization, 0)}</span>
              <TrendChip trend={point.trend} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PackageRow({
  candidate,
  selected,
}: {
  candidate: PackageCandidate;
  selected?: boolean;
}) {
  return (
    <div className={`package-row ${selected ? 'is-selected' : ''}`}>
      <div>
        <div className="package-title">
          {candidate.packageName}
          {selected && <span className="decision-tag">Recommended</span>}
        </div>
        <p>{candidate.description}</p>
        <p className="package-code">
          {candidate.packageCode} · {candidate.billingModel} · {candidate.durationDays} days ·{' '}
          {candidate.cancellationPolicy}
        </p>
      </div>
      <dl className="package-facts">
        <div>
          <dt>Simulated cost</dt>
          <dd>{currency.format(candidate.estimatedCost)}</dd>
        </div>
        <div>
          <dt>Units / hours</dt>
          <dd>
            {candidate.includedUnits} / {candidate.includedHours}
          </dd>
        </div>
        <div>
          <dt>Unused capacity</dt>
          <dd>{Math.round(candidate.estimatedUnusedCapacity)} hrs</dd>
        </div>
        <div>
          <dt>Shortage risk</dt>
          <dd>{Math.round(candidate.shortageRisk * 100)}%</dd>
        </div>
        <div>
          <dt>Commitment risk</dt>
          <dd>{Math.round(candidate.commitmentRisk * 100)}%</dd>
        </div>
        <div>
          <dt>Flexibility</dt>
          <dd>{Math.round(candidate.flexibilityScore * 100)}%</dd>
        </div>
        <div>
          <dt>Score</dt>
          <dd>{candidate.score.toFixed(2)}</dd>
        </div>
        {candidate.estimatedSavings != null && (
          <div>
            <dt>Est. savings</dt>
            <dd>{currency.format(candidate.estimatedSavings)}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

export default function DemandForecastPage() {
  const [status, setStatus] = useState<DemandStatus | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [equipmentType, setEquipmentType] = useState('');
  const [preference, setPreference] = useState('BALANCED');
  const [bundle, setBundle] = useState<ProjectBundleResponse | null>(null);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [facts, setFacts] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideUnits, setOverrideUnits] = useState(0);
  const [overrideHours, setOverrideHours] = useState(0);
  const [overrideReason, setOverrideReason] = useState('');
  const [selectedWeek, setSelectedWeek] = useState(0);

  const selectedProject = useMemo(
    () => projects.find((p) => p.projectId === projectId) ?? forecast?.project ?? null,
    [projects, projectId, forecast],
  );

  // Bootstrap: status + project list
  useEffect(() => {
    setLoading(true);
    Promise.all([demandApi.status(), demandApi.projects()])
      .then(([st, proj]) => {
        setStatus(st);
        setProjects(proj.projects ?? []);
        if (proj.projects?.length) {
          setProjectId(proj.projects[0].projectId);
          setEquipmentType(proj.projects[0].equipmentTypes?.[0] ?? '');
        }
      })
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : 'Unable to load demand service.'),
      )
      .finally(() => setLoading(false));
  }, []);

  // Load project bundle + equipment forecast + packages
  useEffect(() => {
    if (!projectId || !equipmentType) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    Promise.all([
      demandApi.project(projectId),
      demandApi.equipmentForecast(projectId, equipmentType),
      demandApi.packages(projectId, equipmentType, preference),
    ])
      .then(async ([projectBundle, forecastResult, packageResult]) => {
        setBundle(projectBundle);
        setForecast(forecastResult);
        setRecommendation(packageResult.recommendation);
        setSelectedWeek(0);
        const first = forecastResult.forecast[0];
        if (first) {
          const detail = await demandApi.explanation(first.forecastId);
          setExplanation(detail.explanation);
          setFacts(detail.facts ?? null);
          setOverrideUnits(first.predictedUnits);
          setOverrideHours(first.predictedMachineHours);
        }
      })
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : 'Forecast request failed.'),
      )
      .finally(() => setLoading(false));
  }, [projectId, equipmentType, preference]);

  const switchProject = (nextId: number) => {
    setProjectId(nextId);
    const project = projects.find((item) => item.projectId === nextId);
    setEquipmentType(project?.equipmentTypes?.[0] ?? '');
  };

  const weekPoint = forecast?.forecast[selectedWeek] ?? forecast?.forecast[0];

  const needNextDays = useMemo(() => {
    if (!bundle?.equipment?.length) return [];
    return bundle.equipment.map((row) => {
      const w1 = row.forecast?.[0];
      return {
        equipmentType: row.equipmentType,
        weekOneExpected: row.summary.weekOneExpectedUnits,
        weekOneSafe: row.summary.weekOneSafeUnits,
        hours: row.summary.fourWeekMachineHours,
        trend: row.summary.trend,
        confidence: row.summary.confidence,
        utilization: row.summary.currentUtilization,
        weekLabel: w1?.forecastWeek,
        explanation: w1?.explanation,
      };
    });
  }, [bundle]);

  const sendDecision = async (decision: 'ACCEPTED' | 'REJECTED' | 'MANUAL_REVIEW') => {
    if (!recommendation || !forecast) return;
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
      setNotice(
        decision === 'ACCEPTED'
          ? 'Recommendation accepted as planning intent. No rental was placed automatically.'
          : decision === 'REJECTED'
            ? 'Recommendation rejected. Your current package remains unchanged.'
            : 'Manual review requested. The original forecast remains visible.',
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save the decision.');
    }
  };

  const submitOverride = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!forecast) return;
    try {
      await demandApi.override({
        forecastId: forecast.forecast[0].forecastId,
        expectedVersion: forecast.forecast[0].version,
        adjustedUnits: overrideUnits,
        adjustedMachineHours: overrideHours,
        reason: overrideReason,
      });
      setOverrideOpen(false);
      setNotice('Planning override saved. Package comparisons recalculated.');
      const refreshed = await demandApi.equipmentForecast(
        forecast.project.projectId,
        equipmentType,
      );
      setForecast(refreshed);
      const packages = await demandApi.packages(
        forecast.project.projectId,
        equipmentType,
        preference,
      );
      setRecommendation(packages.recommendation);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save the override.');
    }
  };

  return (
    <main className="demand-shell demand-embedded">
      <header className="demand-page-header">
        <div>
          <p className="eyebrow">Demand forecasting</p>
          <h1>Machinery needed in the coming weeks</h1>
          <p>
            Live model output from the demand service — project phase, equipment demand, safe
            planning quantities, and package options.
          </p>
        </div>
        {/* {status && (
          <div className={`service-chip ${status.ready ? 'is-ready' : 'is-down'}`}>
            <strong>{status.ready ? 'Service ready' : 'Service not ready'}</strong>
            <span>
              {status.modelVersion || 'no model'} · {status.dataMode}
              {status.servingMethods?.units
                ? ` · units:${status.servingMethods.units}`
                : ''}
              {status.servingMethods?.machineHours
                ? ` · hours:${status.servingMethods.machineHours}`
                : ''}
            </span>
          </div>
        )} */}
      </header>

      {/* {(status?.warning || forecast?.warning) && (
        <div className="mode-notice" role="note">
          <strong>
            {forecast?.dataMode === 'synthetic' || status?.synthetic
              ? 'Synthetic demo data'
              : 'Live demand mode'}
          </strong>
          <span>{forecast?.warning || status?.warning}</span>
        </div>
      )} */}

      <section className="planning-toolbar" aria-label="Forecast selection">
        <label>
          Project
          <select
            value={projectId ?? ''}
            onChange={(e) => switchProject(Number(e.target.value))}
          >
            {projects.map((project) => (
              <option value={project.projectId} key={project.projectId}>
                {project.projectName} ({project.projectCode})
              </option>
            ))}
          </select>
        </label>
        <label>
          Equipment type
          <select value={equipmentType} onChange={(e) => setEquipmentType(e.target.value)}>
            {(selectedProject?.equipmentTypes ?? []).map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
        <label>
          Planning priority
          <select value={preference} onChange={(e) => setPreference(e.target.value)}>
            <option value="BALANCED">Balance cost and availability</option>
            <option value="COST">Prefer lower commitment</option>
            <option value="AVAILABILITY">Prefer availability protection</option>
          </select>
        </label>
        <div className="forecast-freshness">
          <span>As of</span>
          <strong>{forecast?.asOf ? dateLabel(forecast.asOf) : '—'}</strong>
          <span className="muted-meta">
            run {forecast?.forecastRunId?.slice(0, 12) || '—'} · model{' '}
            {forecast?.modelVersion || status?.modelVersion || '—'}
          </span>
        </div>
      </section>

      {error && (
        <div className="demand-message is-error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="demand-message is-success" role="status">
          {notice}
        </div>
      )}

      {loading && !forecast ? (
        <div className="forecast-skeleton" aria-label="Loading forecast">
          <div />
          <div />
          <div />
        </div>
      ) : !selectedProject || !forecast ? (
        <section className="forecast-empty">
          <h2>No active project forecast</h2>
          <p>
            The demand service returned no projects. Confirm the API is running and demo auth
            headers allow CUSTOMER_PROJECT_MANAGER / FLEET_MANAGER.
          </p>
        </section>
      ) : (
        <>
          {/* Need next weeks — all machine types on this project */}
          <section className="need-section">
            <div className="panel-heading">
              <div>
                <h2>Machinery needed next</h2>
                <p>
                  Week-1 expected units by equipment type for{' '}
                  <strong>{selectedProject.projectName}</strong> ({selectedProject.currentPhase})
                </p>
              </div>
            </div>
            <div className="need-grid">
              {needNextDays.map((row) => (
                <button
                  type="button"
                  key={row.equipmentType}
                  className={`need-card ${row.equipmentType === equipmentType ? 'is-active' : ''
                    }`}
                  onClick={() => setEquipmentType(row.equipmentType)}
                >
                  <header>
                    <strong>{row.equipmentType}</strong>
                    <TrendChip trend={row.trend} />
                  </header>
                  <div className="need-numbers">
                    <div>
                      <span>Week 1 expected</span>
                      <b>{row.weekOneExpected.toFixed(1)}</b>
                    </div>
                    <div>
                      <span>Safe plan</span>
                      <b>{row.weekOneSafe}</b>
                    </div>
                    <div>
                      <span>4-wk hours</span>
                      <b>{Math.round(row.hours)}</b>
                    </div>
                  </div>
                  <footer>
                    <span>{confidenceLabel(row.confidence)}</span>
                    <span>Util {pct(row.utilization, 0)}</span>
                  </footer>
                  {row.explanation && <p className="need-explain">{row.explanation}</p>}
                </button>
              ))}
            </div>
          </section>

          <section className="project-strip">
            <div>
              <span className="project-code">{selectedProject.projectCode}</span>
              <h2>{selectedProject.projectName}</h2>
              <p>
                {selectedProject.projectType} · {selectedProject.region} · site #
                {selectedProject.siteId} · customer #{selectedProject.customerId}
              </p>
            </div>
            <dl>
              <div>
                <dt>Phase</dt>
                <dd>{selectedProject.currentPhase}</dd>
              </div>
              <div>
                <dt>Phase window</dt>
                <dd>
                  {shortDate(selectedProject.phaseStartDate)} –{' '}
                  {shortDate(selectedProject.phaseEndDate)}
                </dd>
              </div>
              <div>
                <dt>Progress</dt>
                <dd>{selectedProject.progressPercentage}%</dd>
              </div>
              <div>
                <dt>Size</dt>
                <dd>
                  {selectedProject.projectSize} {selectedProject.projectSizeUnit}
                </dd>
              </div>
              <div>
                <dt>Expected end</dt>
                <dd>{dateLabel(selectedProject.expectedProjectEnd)}</dd>
              </div>
              <div>
                <dt>Priority</dt>
                <dd>{selectedProject.priority}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{selectedProject.projectStatus}</dd>
              </div>
              {selectedProject.scenario && (
                <div>
                  <dt>Scenario</dt>
                  <dd>{selectedProject.scenario.replaceAll('_', ' ')}</dd>
                </div>
              )}
            </dl>
          </section>

          <div className="forecast-layout">
            <section className="forecast-panel">
              <div className="panel-heading">
                <div>
                  <h2>{equipmentType} — 4-week outlook</h2>
                  <p>Expected units with lower / upper planning bounds and safe quantity</p>
                </div>
                <span
                  className={`confidence-chip confidence-${forecast.summary.confidence.toLowerCase()}`}
                >
                  {confidenceLabel(forecast.summary.confidence)}
                </span>
              </div>
              <ForecastRange points={forecast.forecast} />

              <div className="week-tabs" role="tablist">
                {forecast.forecast.map((point, index) => (
                  <button
                    key={point.forecastId}
                    type="button"
                    role="tab"
                    className={selectedWeek === index ? 'is-active' : ''}
                    onClick={() => setSelectedWeek(index)}
                  >
                    Week {index + 1}
                    <small>{shortDate(point.forecastWeek)}</small>
                  </button>
                ))}
              </div>

              {weekPoint && (
                <div className="week-detail-card">
                  <h3>
                    Week {selectedWeek + 1} detail · {shortDate(weekPoint.forecastWeek)}
                  </h3>
                  <dl className="detail-grid">
                    <div>
                      <dt>Predicted units</dt>
                      <dd>{weekPoint.predictedUnits.toFixed(2)}</dd>
                    </div>
                    <div>
                      <dt>Range</dt>
                      <dd>
                        {weekPoint.lowerUnits.toFixed(2)} – {weekPoint.upperUnits.toFixed(2)}
                      </dd>
                    </div>
                    <div>
                      <dt>Safe planning units</dt>
                      <dd>{weekPoint.safePlanningUnits}</dd>
                    </div>
                    <div>
                      <dt>Machine-hours</dt>
                      <dd>{weekPoint.predictedMachineHours.toFixed(1)}</dd>
                    </div>
                    <div>
                      <dt>Predicted utilization</dt>
                      <dd>{pct(weekPoint.predictedUtilization, 1)}</dd>
                    </div>
                    <div>
                      <dt>Trend</dt>
                      <dd>
                        <TrendChip trend={weekPoint.trend} />
                      </dd>
                    </div>
                    <div>
                      <dt>Confidence</dt>
                      <dd>{confidenceLabel(weekPoint.confidence)}</dd>
                    </div>
                    <div>
                      <dt>Cold start</dt>
                      <dd>{weekPoint.coldStart ? 'Yes' : 'No'}</dd>
                    </div>
                    <div className="span-2">
                      <dt>Method</dt>
                      <dd className="mono">{weekPoint.forecastMethod}</dd>
                    </div>
                    {weekPoint.comparableCohort && (
                      <div className="span-2">
                        <dt>Comparable cohort</dt>
                        <dd>{weekPoint.comparableCohort}</dd>
                      </div>
                    )}
                  </dl>
                  <div className="forecast-explanation">
                    <strong>Why this week</strong>
                    <p>{weekPoint.explanation}</p>
                  </div>
                </div>
              )}

              <div className="forecast-explanation">
                <strong>Why this forecast overall</strong>
                <p>{explanation ?? forecast.forecast[0]?.explanation}</p>
                {facts && (
                  <details className="facts-block">
                    <summary>Model facts</summary>
                    <pre>{JSON.stringify(facts, null, 2)}</pre>
                  </details>
                )}
              </div>

              <div className="demand-table-wrap">
                <table className="demand-table">
                  <thead>
                    <tr>
                      <th>Week</th>
                      <th>Expected units</th>
                      <th>Lower</th>
                      <th>Upper</th>
                      <th>Safe</th>
                      <th>Hours</th>
                      <th>Util</th>
                      <th>Trend</th>
                      <th>Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.forecast.map((row, index) => (
                      <tr
                        key={row.forecastId}
                        className={selectedWeek === index ? 'is-selected-row' : ''}
                        onClick={() => setSelectedWeek(index)}
                      >
                        <td>{shortDate(row.forecastWeek)}</td>
                        <td>{row.predictedUnits.toFixed(2)}</td>
                        <td>{row.lowerUnits.toFixed(2)}</td>
                        <td>{row.upperUnits.toFixed(2)}</td>
                        <td>{row.safePlanningUnits}</td>
                        <td>{Math.round(row.predictedMachineHours)}</td>
                        <td>{pct(row.predictedUtilization, 0)}</td>
                        <td>{row.trend}</td>
                        <td>{row.confidence}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <aside className="planning-summary">
              <h2>Planning signal</h2>
              <dl className="signal-list">
                <div>
                  <dt>Week 1 expected</dt>
                  <dd>{forecast.summary.weekOneExpectedUnits.toFixed(1)} units</dd>
                </div>
                <div>
                  <dt>Safe quantity</dt>
                  <dd>{forecast.summary.weekOneSafeUnits} units</dd>
                </div>
                <div>
                  <dt>Four-week use</dt>
                  <dd>{Math.round(forecast.summary.fourWeekMachineHours)} hours</dd>
                </div>
                <div>
                  <dt>Current utilization</dt>
                  <dd>{pct(forecast.summary.currentUtilization, 0)}</dd>
                </div>
                <div>
                  <dt>Idle capacity</dt>
                  <dd>{pct(forecast.summary.idleCapacity, 0)}</dd>
                </div>
                <div>
                  <dt>Demand trend</dt>
                  <dd>
                    <TrendChip trend={forecast.summary.trend} />
                  </dd>
                </div>
                <div>
                  <dt>Cold start</dt>
                  <dd>{forecast.summary.coldStart ? 'Yes' : 'No'}</dd>
                </div>
                <div>
                  <dt>Pricing mode</dt>
                  <dd>{forecast.pricingMode}</dd>
                </div>
                <div>
                  <dt>Data mode</dt>
                  <dd>{forecast.dataMode}</dd>
                </div>
              </dl>
              <button
                className="secondary-action"
                type="button"
                onClick={() => setOverrideOpen((v) => !v)}
              >
                Override Week 1 plan
              </button>
              {overrideOpen && (
                <form className="override-form" onSubmit={submitOverride}>
                  <label>
                    Expected units
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={overrideUnits}
                      onChange={(e) => setOverrideUnits(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    Machine-hours
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={overrideHours}
                      onChange={(e) => setOverrideHours(Number(e.target.value))}
                    />
                  </label>
                  <label className="override-reason">
                    Reason
                    <textarea
                      required
                      minLength={8}
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="Describe the schedule or work change."
                    />
                  </label>
                  <button className="primary-action" type="submit">
                    Save planning override
                  </button>
                </form>
              )}
            </aside>
          </div>

          {recommendation && (
            <section className="recommendation-section">
              <div className="recommendation-heading">
                <div>
                  <span className="decision-tag">
                    {recommendation.action.replaceAll('_', ' ').toLowerCase()}
                  </span>
                  <h2>{recommendation.recommended.packageName}</h2>
                  <p>{recommendation.explanation}</p>
                </div>
                <div className="benefit-statement">
                  <span>Customer benefit</span>
                  <strong>{recommendation.customerBenefit}</strong>
                </div>
              </div>
              <PackageRow candidate={recommendation.recommended} selected />
              <details className="alternative-packages" open>
                <summary>
                  Compare {recommendation.alternatives.length} alternatives
                </summary>
                {recommendation.alternatives.map((candidate) => (
                  <PackageRow candidate={candidate} key={candidate.packageCode} />
                ))}
              </details>
              <div className="decision-actions">
                <button
                  className="primary-action"
                  type="button"
                  onClick={() => sendDecision('ACCEPTED')}
                >
                  Accept as planning intent
                </button>
                <button
                  className="secondary-action"
                  type="button"
                  onClick={() => sendDecision('REJECTED')}
                >
                  Keep current plan
                </button>
                <button
                  className="text-action"
                  type="button"
                  onClick={() => sendDecision('MANUAL_REVIEW')}
                >
                  Request manual review
                </button>
                <span>No reservation or package change happens automatically.</span>
              </div>
            </section>
          )}

          <section className="history-section">
            <div className="panel-heading">
              <div>
                <h2>Recent demand & usage history</h2>
                <p>Requested demand stays separate from dealer fulfillment.</p>
              </div>
            </div>
            {forecast.history.length ? (
              <div className="demand-table-wrap">
                <table className="demand-table">
                  <thead>
                    <tr>
                      <th>Week</th>
                      <th>Phase</th>
                      <th>Requested</th>
                      <th>Fulfilled</th>
                      <th>Unmet</th>
                      <th>Rented</th>
                      <th>Engine hrs</th>
                      <th>Idle hrs</th>
                      <th>Utilization</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.history.slice(-12).map((row) => (
                      <tr key={row.weekStart}>
                        <td>{shortDate(row.weekStart)}</td>
                        <td>{row.projectPhase}</td>
                        <td>{row.requestedUnits}</td>
                        <td>{row.fulfilledUnits}</td>
                        <td>{row.unmetUnits}</td>
                        <td>{row.rentedUnits}</td>
                        <td>{Math.round(row.engineHours)}</td>
                        <td>{Math.round(row.idleHours)}</td>
                        <td>{pct(row.operatingUtilization, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="forecast-empty compact">
                <h3>No project-specific history</h3>
                <p>
                  The forecast uses similar completed projects and is marked as a cold-start
                  estimate.
                </p>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
