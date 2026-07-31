import { Link } from 'react-router-dom';
import { alertApi, analyticsApi, fleetApi } from '../../api/platform';
import { demandApi, type DealerRow, type ProjectSummary } from '../../api/demand';
import type { Alert } from '../../api/types';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import { FeedbackBanner, PageSkeleton } from '../../components/ui/Feedback';
import { useAsync } from '../../hooks/useAsync';
import '../../styles/fleet-dashboard.css';

const n = (value: unknown) => Number(value ?? 0);
const text = (value: unknown) => String(value ?? '—');

function formatHours(value: unknown) {
  const hours = n(value);
  if (!Number.isFinite(hours)) return '—';
  if (hours >= 100) return `${Math.round(hours)} h`;
  return `${hours.toFixed(1)} h`;
}

function relativeTime(value?: string | null) {
  if (!value) return '—';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '—';
  const delta = Date.now() - then;
  const mins = Math.round(delta / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function shortLabel(value?: string | null, max = 10) {
  if (!value) return '—';
  const word = value.split(/[\s_/]+/)[0] ?? value;
  return word.length > max ? `${word.slice(0, max - 1)}…` : word;
}

function donutStroke(pct: number) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, pct));
  const filled = (clamped / 100) * circumference;
  return { circumference, filled, radius };
}

function buildDemandCards(rows: DealerRow[]) {
  const byType = new Map<string, DealerRow>();
  for (const row of rows) {
    const key = row.equipmentType;
    const existing = byType.get(key);
    if (!existing || row.expectedDemand > existing.expectedDemand) {
      byType.set(key, row);
    }
  }
  return [...byType.values()]
    .sort((a, b) => b.expectedDemand - a.expectedDemand || a.shortageOrSurplus - b.shortageOrSurplus)
    .slice(0, 6);
}

function demandFill(row: DealerRow) {
  const need = Math.max(row.expectedDemand, 0.01);
  const have = Math.max(row.expectedAvailable, 0);
  return Math.min(100, Math.round((have / need) * 100));
}

function projectDemandCards(projects: ProjectSummary[]) {
  return projects
    .filter((p) => p.projectStatus?.toUpperCase() !== 'COMPLETED')
    .slice(0, 6)
    .map((p) => ({
      key: String(p.projectId),
      title: p.equipmentTypes?.[0] ?? p.projectType ?? 'Equipment',
      subtitle: `${p.projectName} · ${p.region}`,
      value: p.equipmentTypes?.length ? `${p.equipmentTypes.length} types` : p.currentPhase,
      note: p.priority ?? p.currentPhase,
      fill: Math.min(100, Math.max(12, Math.round(p.progressPercentage || 20))),
    }));
}

export default function FleetDashboard() {
  const resource = useAsync(async () => {
    const [overview, usage, sites, underutilized, expiring, overdue, alerts, demand, projects] =
      await Promise.all([
        fleetApi.overview(),
        analyticsApi.summary(7),
        analyticsApi.bySite(7),
        analyticsApi.underutilized(7, 0.35),
        fleetApi.expiringContracts(7),
        fleetApi.overdueContracts(),
        alertApi.list({ resolved: false, limit: 8 }).catch(() => ({ data: [] as Alert[] })),
        demandApi
          .dealer()
          .catch(() => ({ rows: [] as DealerRow[], actions: [], inventoryAsOf: '', warning: '' })),
        demandApi
          .projects()
          .catch(() => ({ success: false, projects: [] as ProjectSummary[], warning: '' })),
      ]);

    return {
      overview,
      usage: usage.data,
      sites: sites.data ?? [],
      underutilized: underutilized.data ?? [],
      expiring: expiring.data ?? [],
      overdue: overdue.data ?? [],
      alerts: (alerts as { data: Alert[] }).data ?? [],
      demandRows: demand.rows ?? [],
      demandWarning: demand.warning ?? '',
      projects: projects.projects ?? [],
    };
  }, []);

  const totals = (resource.data?.overview.totals ?? {}) as Record<string, unknown>;
  const usage = resource.data?.usage ?? {};
  const sites = resource.data?.sites ?? [];
  const underutilized = resource.data?.underutilized ?? [];
  const alerts = resource.data?.alerts ?? [];
  const dealerCards = buildDemandCards(resource.data?.demandRows ?? []);
  const fallbackDemand = projectDemandCards(resource.data?.projects ?? []);
  const expiring = resource.data?.expiring ?? [];
  const overdue = resource.data?.overdue ?? [];

  const rented = n(totals.machinesRented);
  const openAlerts = n(totals.openAlerts);
  const machinesWithOpenAlerts = n(totals.machinesWithOpenAlerts ?? totals.withOpenAlerts);
  const criticalAlerts = n(resource.data?.overview.criticalAlerts);
  const utilPct = n(usage.utilizationPct);
  const runtimeH = n(usage.totalRuntimeHours);
  const idleH = n(usage.totalIdleHours);
  const downtimeH = n(usage.totalDowntimeHours);
  const dueSoon = expiring.length;
  // Render the complete backend status universe, including future statuses.
  const statusOrder = ['WORKING', 'IDLE', 'OFF', 'IN_TRANSIT', 'ALERT', 'STALE', 'OVERDUE', 'MAINTENANCE'];
  const statusBreakdown = (resource.data?.overview.statusBreakdown ?? {}) as Record<string, unknown>;
  const staleCount = n(statusBreakdown.STALE);
  const statusMix = Object.entries(statusBreakdown)
    .map(([status, value]) => ({
      status,
      label: status.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase()),
      value: n(value),
    }))
    .filter((row) => row.value > 0)
    .sort((a, b) => {
      const aIndex = statusOrder.indexOf(a.status);
      const bIndex = statusOrder.indexOf(b.status);
      return (aIndex < 0 ? statusOrder.length : aIndex) - (bIndex < 0 ? statusOrder.length : bIndex);
    });

  const reallocationCandidates = underutilized.slice(0, 5);
  const statusTotal = Math.max(1, rented);

  const topSites = [...sites]
    .sort((a, b) => n(b.utilizationPct) - n(a.utilizationPct))
    .slice(0, 5);

  const attention = [
    ...overdue.map((row, index) => ({
      key: `o-${index}`,
      name: text(row.equipmentName),
      detail: `Contract #${text(row.contractId)}`,
      status: 'OVERDUE',
    })),
    ...expiring.map((row, index) => ({
      key: `e-${index}`,
      name: text(row.equipmentName),
      detail: row.expectedReturn
        ? `Due ${new Date(String(row.expectedReturn)).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          })}`
        : 'Due soon',
      status: 'DUE SOON',
    })),
  ].slice(0, 8);

  return (
    <div className="fleet-dash">
      <PageHeader
        title="Dashboard"
        subtitle="Active rentals, utilization, anomalies, and near-term demand"
        actions={
          <button
            type="button"
            className="btn-secondary"
            onClick={() => void resource.reload()}
            disabled={resource.loading}
            aria-busy={resource.loading}
          >
            <span
              className={`material-symbols-outlined text-base ${resource.loading ? 'is-spinning' : ''}`}
              aria-hidden="true"
            >
              refresh
            </span>
            {resource.loading ? 'Refreshing' : 'Refresh'}
          </button>
        }
      />

      {resource.error && <FeedbackBanner tone="error">{resource.error}</FeedbackBanner>}

      {resource.loading && !resource.data ? (
        <PageSkeleton rows={10} />
      ) : (
        <div className="dashboard-content">
          {/* Metric strip — same language as other role pages */}
          <div className="fd-metrics">
            <article className="fd-metric">
              <div className="fd-metric-top">
                <span>Machines on rent</span>
                <span className="material-symbols-outlined" aria-hidden="true">
                  construction
                </span>
              </div>
              <strong>{rented}</strong>
              <p className="fd-metric-caption">Your company&apos;s active + overdue rentals</p>
              <div className="fd-status-mix" aria-label="Live status mix">
                {statusMix.length === 0 ? (
                  <span>No machines currently on rent</span>
                ) : (
                  statusMix.map((row) => (
                    <span key={row.label}>
                      {row.label} <strong>{row.value}</strong>
                    </span>
                  ))
                )}
              </div>
              {staleCount > 0 && (
                <p className="fd-metric-caption">
                  {staleCount} telemetry {staleCount === 1 ? 'feed is' : 'feeds are'} stale; live activity resumes when new samples arrive.
                </p>
              )}
            </article>

            <article className="fd-metric">
              <div className="fd-metric-top">
                <span>Utilization · 7d</span>
                <span className="material-symbols-outlined" aria-hidden="true">
                  monitoring
                </span>
              </div>
              <strong>{utilPct.toFixed(1)}%</strong>
              <p>
                <em>{formatHours(runtimeH)}</em> runtime · {formatHours(idleH)} idle
              </p>
            </article>

            <article className="fd-metric">
              <div className="fd-metric-top">
                <span>Open alerts</span>
                <span className="material-symbols-outlined" aria-hidden="true">
                  warning
                </span>
              </div>
              <strong>{openAlerts}</strong>
              <p>
                <em>{criticalAlerts}</em> critical · {machinesWithOpenAlerts} machines affected ·{' '}
                <Link to="/fleet/anomalies">Triage</Link>
              </p>
              <p className="fd-metric-caption">Info-only alerts do not change a machine&apos;s live status.</p>
            </article>

            <article className="fd-metric">
              <div className="fd-metric-top">
                <span>Returns to review</span>
                <span className="material-symbols-outlined" aria-hidden="true">
                  calendar_clock
                </span>
              </div>
              <strong>{dueSoon + overdue.length}</strong>
              <p>
                <em>{overdue.length}</em> overdue · {dueSoon} due within 7 days
              </p>
            </article>
          </div>

          {/* Two-column body: ops left, anomalies right */}
          <div className="fd-body">
            <div className="fd-stack">
              <section className="fd-panel" aria-label="Live fleet status">
                <div className="fd-panel-head">
                  <h2>Live fleet status</h2>
                  <Link to="/fleet/assets" className="fd-link">
                    View assets
                    <span className="material-symbols-outlined" aria-hidden="true">
                      chevron_right
                    </span>
                  </Link>
                </div>
                <div className="fd-panel-body">
                  {statusMix.length === 0 ? (
                    <div className="fd-empty">
                      <strong>No active fleet</strong>
                      Live machine status appears when rentals are assigned.
                    </div>
                  ) : (
                    <div className="fd-status-overview">
                      <div
                        className="fd-status-track"
                        role="img"
                        aria-label={`Live status across ${rented} machines`}
                      >
                        {statusMix.map((row) => (
                          <span
                            className={`fd-status-segment is-${row.status.toLowerCase()}`}
                            key={row.status}
                            style={{ width: `${(row.value / statusTotal) * 100}%` }}
                            title={`${row.label}: ${row.value}`}
                          />
                        ))}
                      </div>
                      <div className="fd-status-list">
                        {statusMix.map((row) => (
                          <div className="fd-status-row" key={row.status}>
                            <span>
                              <i className={`fd-status-dot is-${row.status.toLowerCase()}`} aria-hidden="true" />
                              {row.label}
                            </span>
                            <strong>{row.value}</strong>
                            <small>{Math.round((row.value / statusTotal) * 100)}%</small>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section className="fd-panel" aria-label="Underutilized assets">
                <div className="fd-panel-head">
                  <h2>Reallocation candidates</h2>
                  <Link to="/fleet/utilization" className="fd-link">
                    Review
                    <span className="material-symbols-outlined" aria-hidden="true">
                      chevron_right
                    </span>
                  </Link>
                </div>
                <div className="fd-panel-body">
                  {reallocationCandidates.length === 0 ? (
                    <div className="fd-empty">
                      <strong>No candidates below 35%</strong>
                      Current activity does not flag an asset for reallocation.
                    </div>
                  ) : (
                    <div className="fd-reallocation-list">
                      {reallocationCandidates.map((row, index) => {
                        const pct = n(row.utilizationPct);
                        return (
                          <div className="fd-reallocation-row" key={String(row.equipmentId ?? index)}>
                            <div>
                              <strong>{text(row.equipmentName ?? row.equipmentId)}</strong>
                              <span>{text(row.equipmentType)} · {text(row.siteName ?? 'Unassigned')}</span>
                            </div>
                            <div className="fd-reallocation-value">
                              <strong>{pct.toFixed(0)}%</strong>
                              <span>{formatHours(row.idleHours)} idle</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>

              <section className="fd-panel" aria-label="Site utilization">
                <div className="fd-panel-head">
                  <h2>Sites</h2>
                </div>
                <div className="fd-panel-body">
                  {topSites.length === 0 ? (
                    <div className="fd-empty">
                      <strong>No site usage</strong>
                      Site utilization appears after usage is received.
                    </div>
                  ) : (
                    <div className="fd-site-list">
                      {topSites.map((site, index) => {
                        const pct = n(site.utilizationPct);
                        return (
                          <div className="fd-site-row" key={String(site.siteId ?? index)}>
                            <span>{text(site.siteName)}</span>
                            <div className="fd-site-meter" aria-hidden="true">
                              <span style={{ width: `${Math.min(100, pct)}%` }} />
                            </div>
                            <strong>{pct.toFixed(0)}%</strong>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>

              {/* Demand sits under Sites so the left column fills next to Returns */}
              <section className="fd-panel fd-panel-demand" aria-label="Demand outlook">
                <div className="fd-panel-head">
                  <h2>Demand outlook</h2>
                  <Link to="/fleet/demand" className="fd-link">
                    Plan
                    <span className="material-symbols-outlined" aria-hidden="true">
                      chevron_right
                    </span>
                  </Link>
                </div>
                <div className="fd-panel-body">
                  {dealerCards.length > 0 ? (
                    <div className="fd-demand-list">
                      {dealerCards.map((row) => {
                        const gap = row.shortageOrSurplus;
                        const note =
                          gap < -0.5 ? 'Shortage risk' : gap > 1.5 ? 'Surplus' : 'Balanced';
                        return (
                          <Link
                            key={`${row.region}-${row.equipmentType}-${row.forecastWeek}`}
                            to="/fleet/demand"
                            className="fd-demand-card"
                          >
                            <div className="fd-demand-main">
                              <h3>{row.equipmentType}</h3>
                              <p>
                                {row.region}
                                {row.projectCount ? ` · ${row.projectCount} projects` : ''}
                              </p>
                              <div className="fd-demand-bar" aria-hidden="true">
                                <span style={{ width: `${demandFill(row)}%` }} />
                              </div>
                            </div>
                            <div className="fd-demand-foot">
                              <strong>{row.expectedDemand.toFixed(1)}</strong>
                              <span>{note}</span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  ) : fallbackDemand.length > 0 ? (
                    <div className="fd-demand-list">
                      {fallbackDemand.map((card) => (
                        <Link key={card.key} to="/fleet/demand" className="fd-demand-card">
                          <div className="fd-demand-main">
                            <h3>{card.title}</h3>
                            <p>{card.subtitle}</p>
                            <div className="fd-demand-bar" aria-hidden="true">
                              <span style={{ width: `${card.fill}%` }} />
                            </div>
                          </div>
                          <div className="fd-demand-foot">
                            <strong>{card.value}</strong>
                            <span>{card.note}</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="fd-empty">
                      <strong>No forecast rows</strong>
                      Demand signals appear once project forecasts are available.
                    </div>
                  )}
                  {resource.data?.demandWarning ? (
                    <p className="fd-demand-warning">{resource.data.demandWarning}</p>
                  ) : null}
                </div>
              </section>
            </div>

            <div className="fd-stack">
              <section className="fd-panel" aria-label="Recent anomalies">
                <div className="fd-panel-head">
                  <h2>Recent anomalies</h2>
                  <Link to="/fleet/anomalies" className="fd-link">
                    View all
                    <span className="material-symbols-outlined" aria-hidden="true">
                      chevron_right
                    </span>
                  </Link>
                </div>
                <div className="fd-panel-body" style={{ paddingTop: 4, paddingBottom: 4 }}>
                  {alerts.length === 0 ? (
                    <div className="fd-empty">
                      <strong>All clear</strong>
                      No open anomalies on the fleet right now.
                    </div>
                  ) : (
                    <div className="fd-anomaly-list">
                      {alerts.map((alert) => (
                        <Link
                          key={alert.alertId}
                          to="/fleet/anomalies"
                          className="fd-anomaly"
                        >
                          <div>
                            <h3>
                              {alert.description ??
                                alert.anomalyType ??
                                `Alert #${alert.alertId}`}
                            </h3>
                            <p>
                              {alert.equipmentType ?? `Equipment ${alert.equipmentId}`}
                              {alert.recommendation
                                ? ` · ${alert.recommendation}`
                                : ' · Inspect telemetry before acting'}
                            </p>
                          </div>
                          <div className="fd-anomaly-meta">
                            <StatusBadge status={alert.severity ?? 'INFO'} />
                            <time
                              className="fd-time"
                              dateTime={alert.detectedAt ?? undefined}
                            >
                              {relativeTime(alert.detectedAt)}
                            </time>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className="fd-panel" aria-label="Contract attention">
                <div className="fd-panel-head">
                  <h2>Returns</h2>
                </div>
                <div className="fd-panel-body" style={{ paddingTop: 4, paddingBottom: 4 }}>
                  {attention.length === 0 ? (
                    <div className="fd-empty">
                      <strong>No near-term returns</strong>
                      Nothing overdue or due in the next seven days.
                    </div>
                  ) : (
                    <div className="fd-contract-list">
                      {attention.map((row) => (
                        <div className="fd-contract-row" key={row.key}>
                          <div>
                            <strong>{row.name}</strong>
                            <span>{row.detail}</span>
                          </div>
                          <StatusBadge status={row.status} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
