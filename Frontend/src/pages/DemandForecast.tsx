import { useEffect, useMemo, useState } from 'react';
import Link from '../components/AppLink';
import {
  demandApi,
  type ForecastPoint,
  type ForecastResponse,
  type PackageCandidate,
  type ProjectSummary,
  type Recommendation,
} from '../api/demand';
import '../styles/demand.css';

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function dateLabel(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
  });
}

function confidenceLabel(value: string) {
  return value.replaceAll('_', ' ').toLowerCase();
}

function ForecastRange({ points }: { points: ForecastPoint[] }) {
  const maximum = Math.max(1, ...points.map((point) => point.upperUnits));
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
              <time dateTime={point.forecastWeek}>{dateLabel(point.forecastWeek)}</time>
            </div>
            <div className="range-scale" aria-hidden="true">
              <div className="range-band" style={{ left: `${lower}%`, width: `${Math.max(4, upper - lower)}%` }} />
              <div className="range-expected" style={{ left: `${expected}%` }} />
            </div>
            <div className="forecast-unit-value">
              <strong>{point.predictedUnits.toFixed(1)}</strong>
              <span>expected · {point.safePlanningUnits} safe</span>
            </div>
            <div className="forecast-week-meta">
              <span>{point.lowerUnits.toFixed(1)}–{point.upperUnits.toFixed(1)} units</span>
              <span>{Math.round(point.predictedMachineHours)} machine-hours</span>
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
      </div>
      <dl className="package-facts">
        <div><dt>Simulated cost</dt><dd>{currency.format(candidate.estimatedCost)}</dd></div>
        <div><dt>Units / hours</dt><dd>{candidate.includedUnits} / {candidate.includedHours}</dd></div>
        <div><dt>Unused hours</dt><dd>{Math.round(candidate.estimatedUnusedCapacity)}</dd></div>
        <div><dt>Shortage risk</dt><dd>{Math.round(candidate.shortageRisk * 100)}% band</dd></div>
      </dl>
    </div>
  );
}

export default function DemandForecastPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [equipmentType, setEquipmentType] = useState('');
  const [preference, setPreference] = useState('BALANCED');
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideUnits, setOverrideUnits] = useState(0);
  const [overrideHours, setOverrideHours] = useState(0);
  const [overrideReason, setOverrideReason] = useState('');

  const selectedProject = useMemo(
    () => projects.find((project) => project.projectId === projectId) ?? null,
    [projects, projectId],
  );

  useEffect(() => {
    demandApi
      .projects()
      .then(({ projects: items }) => {
        setProjects(items);
        if (items.length) {
          setProjectId(items[0].projectId);
          setEquipmentType(items[0].equipmentTypes[0]);
        }
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load projects.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!projectId || !equipmentType) return;
    setLoading(true);
    setError(null);
    Promise.all([
      demandApi.equipmentForecast(projectId, equipmentType),
      demandApi.packages(projectId, equipmentType, preference),
      demandApi.project(projectId),
    ])
      .then(async ([forecastResult, packageResult]) => {
        setForecast(forecastResult);
        setRecommendation(packageResult.recommendation);
        const first = forecastResult.forecast[0];
        const detail = await demandApi.explanation(first.forecastId);
        setExplanation(detail.explanation);
        setOverrideUnits(first.predictedUnits);
        setOverrideHours(first.predictedMachineHours);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Forecast request failed.'))
      .finally(() => setLoading(false));
  }, [projectId, equipmentType, preference]);

  const switchProject = (nextId: number) => {
    setProjectId(nextId);
    const project = projects.find((item) => item.projectId === nextId);
    setEquipmentType(project?.equipmentTypes[0] ?? '');
    setNotice(null);
  };

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
      setNotice('Planning override saved. Package comparisons are being recalculated.');
      const refreshed = await demandApi.equipmentForecast(forecast.project.projectId, equipmentType);
      setForecast(refreshed);
      const packages = await demandApi.packages(forecast.project.projectId, equipmentType, preference);
      setRecommendation(packages.recommendation);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save the override.');
    }
  };

  return (
    <main className="demand-shell">
      <header className="demand-header">
        <div className="demand-brand">
          <div className="header-logo">CAT</div>
          <div>
            <h1>Demand planning</h1>
            <p>Four-week equipment outlook with customer-first package options</p>
          </div>
        </div>
        <nav className="demand-nav" aria-label="Primary navigation">
          <Link to="/fleet/dashboard">Fleet</Link>
          <Link to="/admin/system">ML operations</Link>
          <Link className="is-current" to="/fleet/demand">Customer forecast</Link>
          <Link to="/dealer/demand">Dealer view</Link>
        </nav>
      </header>

      <div className="mode-notice" role="note">
        <strong>Demonstration mode</strong>
        <span>Synthetic project history and simulated pricing. Results are planning examples, not measured business performance.</span>
      </div>

      <section className="planning-toolbar" aria-label="Forecast selection">
        <label>
          Project
          <select value={projectId ?? ''} onChange={(event) => switchProject(Number(event.target.value))}>
            {projects.map((project) => (
              <option value={project.projectId} key={project.projectId}>{project.projectName}</option>
            ))}
          </select>
        </label>
        <label>
          Equipment
          <select value={equipmentType} onChange={(event) => setEquipmentType(event.target.value)}>
            {selectedProject?.equipmentTypes.map((type) => <option key={type}>{type}</option>)}
          </select>
        </label>
        <label>
          Planning priority
          <select value={preference} onChange={(event) => setPreference(event.target.value)}>
            <option value="BALANCED">Balance cost and availability</option>
            <option value="COST">Prefer lower commitment</option>
            <option value="AVAILABILITY">Prefer availability protection</option>
          </select>
        </label>
        <div className="forecast-freshness">
          <span>Forecast as of</span>
          <strong>{forecast?.asOf ? dateLabel(forecast.asOf) : '—'}</strong>
        </div>
      </section>

      {error && <div className="demand-message is-error" role="alert">{error}</div>}
      {notice && <div className="demand-message is-success" role="status">{notice}</div>}

      {loading && !forecast ? (
        <div className="forecast-skeleton" aria-label="Loading forecast">
          <div />
          <div />
          <div />
        </div>
      ) : !selectedProject || !forecast ? (
        <section className="forecast-empty">
          <h2>No active project forecast</h2>
          <p>Create or activate a project, then provide its site, phase, dates, and equipment needs.</p>
        </section>
      ) : (
        <>
          <section className="project-strip">
            <div>
              <span className="project-code">{selectedProject.projectCode}</span>
              <h2>{selectedProject.projectName}</h2>
              <p>{selectedProject.projectType} · {selectedProject.region} region</p>
            </div>
            <dl>
              <div><dt>Current phase</dt><dd>{selectedProject.currentPhase}</dd></div>
              <div><dt>Progress</dt><dd>{selectedProject.progressPercentage}%</dd></div>
              <div><dt>Expected end</dt><dd>{dateLabel(selectedProject.expectedProjectEnd)}</dd></div>
              <div><dt>Priority</dt><dd>{selectedProject.priority.toLowerCase()}</dd></div>
            </dl>
          </section>

          <div className="forecast-layout">
            <section className="forecast-panel">
              <div className="panel-heading">
                <div>
                  <h2>{equipmentType} outlook</h2>
                  <p>Expected units with lower and upper planning bounds</p>
                </div>
                <span className={`confidence-chip confidence-${forecast.summary.confidence.toLowerCase()}`}>
                  {confidenceLabel(forecast.summary.confidence)}
                </span>
              </div>
              <ForecastRange points={forecast.forecast} />
              <div className="forecast-explanation">
                <strong>Why this forecast</strong>
                <p>{explanation ?? forecast.forecast[0].explanation}</p>
                <span>Method: {forecast.forecast[0].forecastMethod.replaceAll('_', ' ').toLowerCase()}</span>
              </div>
            </section>

            <aside className="planning-summary">
              <h2>Planning signal</h2>
              <dl className="signal-list">
                <div><dt>Week 1 expected</dt><dd>{forecast.summary.weekOneExpectedUnits.toFixed(1)} units</dd></div>
                <div><dt>Safe quantity</dt><dd>{forecast.summary.weekOneSafeUnits} units</dd></div>
                <div><dt>Four-week use</dt><dd>{Math.round(forecast.summary.fourWeekMachineHours)} hours</dd></div>
                <div>
                  <dt>Current utilization</dt>
                  <dd>{forecast.summary.currentUtilization === null ? 'No verified usage' : `${Math.round(forecast.summary.currentUtilization * 100)}%`}</dd>
                </div>
                <div><dt>Demand trend</dt><dd>{forecast.summary.trend.toLowerCase()}</dd></div>
              </dl>
              <button className="secondary-action" type="button" onClick={() => setOverrideOpen((value) => !value)}>
                Override Week 1 plan
              </button>
              {overrideOpen && (
                <form className="override-form" onSubmit={submitOverride}>
                  <label>Expected units<input type="number" min="0" step="0.5" value={overrideUnits} onChange={(event) => setOverrideUnits(Number(event.target.value))} /></label>
                  <label>Machine-hours<input type="number" min="0" step="1" value={overrideHours} onChange={(event) => setOverrideHours(Number(event.target.value))} /></label>
                  <label className="override-reason">Reason<textarea required minLength={8} value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} placeholder="Describe the schedule or work change." /></label>
                  <button className="primary-action" type="submit">Save planning override</button>
                </form>
              )}
            </aside>
          </div>

          {recommendation && (
            <section className="recommendation-section">
              <div className="recommendation-heading">
                <div>
                  <span className="decision-tag">{recommendation.action.replaceAll('_', ' ').toLowerCase()}</span>
                  <h2>{recommendation.recommended.packageName}</h2>
                  <p>{recommendation.explanation}</p>
                </div>
                <div className="benefit-statement">
                  <span>Customer benefit</span>
                  <strong>{recommendation.customerBenefit}</strong>
                </div>
              </div>
              <PackageRow candidate={recommendation.recommended} selected />
              <details className="alternative-packages">
                <summary>Compare {recommendation.alternatives.length} alternatives</summary>
                {recommendation.alternatives.map((candidate) => (
                  <PackageRow candidate={candidate} key={candidate.packageCode} />
                ))}
              </details>
              <div className="decision-actions">
                <button className="primary-action" type="button" onClick={() => sendDecision('ACCEPTED')}>Accept as planning intent</button>
                <button className="secondary-action" type="button" onClick={() => sendDecision('REJECTED')}>Keep current plan</button>
                <button className="text-action" type="button" onClick={() => sendDecision('MANUAL_REVIEW')}>Request manual review</button>
                <span>No reservation or package change happens automatically.</span>
              </div>
            </section>
          )}

          <section className="history-section">
            <div className="panel-heading">
              <div><h2>Recent demand and use</h2><p>Requested demand remains separate from dealer fulfillment.</p></div>
            </div>
            {forecast.history.length ? (
              <div className="demand-table-wrap">
                <table className="demand-table">
                  <thead><tr><th>Week</th><th>Phase</th><th>Requested</th><th>Fulfilled</th><th>Unmet</th><th>Rented</th><th>Machine-hours</th><th>Utilization</th></tr></thead>
                  <tbody>
                    {forecast.history.slice(-8).map((row) => (
                      <tr key={row.weekStart}>
                        <td>{dateLabel(row.weekStart)}</td><td>{row.projectPhase}</td><td>{row.requestedUnits}</td><td>{row.fulfilledUnits}</td>
                        <td>{row.unmetUnits}</td><td>{row.rentedUnits}</td><td>{Math.round(row.engineHours)}</td>
                        <td>{row.operatingUtilization === null ? '—' : `${Math.round(row.operatingUtilization * 100)}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="forecast-empty compact">
                <h3>No project-specific history</h3>
                <p>The forecast uses similar completed projects and is marked as a cold-start estimate.</p>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
