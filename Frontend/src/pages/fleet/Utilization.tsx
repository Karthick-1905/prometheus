import { useMemo, useState } from 'react';
import { analyticsApi } from '../../api/platform';
import PageHeader from '../../components/ui/PageHeader';
import { EmptyState, FeedbackBanner, PageSkeleton } from '../../components/ui/Feedback';
import { useAsync } from '../../hooks/useAsync';
import '../../styles/utilization.css';

const n = (value: unknown) => Number(value ?? 0);

type ActivityKind = 'runtime' | 'idle' | 'downtime';

type ActivitySegment = {
  kind: ActivityKind;
  label: string;
  hours: number;
  width: number;
};

const activityMeta: Record<ActivityKind, { label: string; className: string }> = {
  runtime: { label: 'Runtime', className: 'is-runtime' },
  idle: { label: 'Idle', className: 'is-idle' },
  downtime: { label: 'Downtime', className: 'is-downtime' },
};

function segmentsFor(row: Record<string, unknown>, windowHours: number): ActivitySegment[] {
  const values: Array<{ kind: ActivityKind; hours: number }> = [
    { kind: 'runtime', hours: Math.max(0, n(row.runtimeHours)) },
    { kind: 'idle', hours: Math.max(0, n(row.idleHours)) },
    { kind: 'downtime', hours: Math.max(0, n(row.downtimeHours)) },
  ];
  const total = Math.max(1, windowHours);

  return values
    .filter(({ hours }) => hours > 0)
    .map(({ kind, hours }) => ({
      kind,
      label: activityMeta[kind].label,
      hours,
      width: Math.min(100, (hours / total) * 100),
    }));
}

function ActivityBar({ row, windowHours }: { row: Record<string, unknown>; windowHours: number }) {
  const segments = segmentsFor(row, windowHours);
  const name = String(row.equipmentName ?? row.equipmentId ?? 'Unknown asset');

  if (!segments.length) {
    return <div className="ut-track-empty">No usage recorded</div>;
  }

  return (
    <div className="ut-track" aria-label={`${name} activity allocation`}>
      <div className="ut-track-grid" aria-hidden="true" />
      <div className="ut-track-segments">
        {segments.map((segment) => {
          const meta = activityMeta[segment.kind];
          return (
            <div
              className="ut-segment-wrap"
              key={segment.kind}
              style={{ width: `${segment.width}%` }}
            >
              <button
                className={`ut-segment ${meta.className}`}
                type="button"
                aria-label={`${meta.label}: ${segment.hours.toFixed(1)} hours`}
              />
              <span className="ut-segment-tooltip" role="tooltip">
                <strong>{meta.label}</strong>
                <span>{segment.hours.toFixed(1)} hours</span>
                <small>Proportional to selected window</small>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function FleetUtilization() {
  const [days, setDays] = useState(7);
  const [threshold, setThreshold] = useState(35);
  const [onlyUnderutilized, setOnlyUnderutilized] = useState(false);
  const resource = useAsync(async () => {
    const [summary, sites, equipment, types, utilization, underutilized] = await Promise.all([
      analyticsApi.summary(days),
      analyticsApi.bySite(days),
      analyticsApi.byEquipment(days),
      analyticsApi.byType(days),
      analyticsApi.utilization(days),
      analyticsApi.underutilized(days, threshold / 100),
    ]);
    return {
      summary: summary.data,
      sites: sites.data,
      equipment: equipment.data,
      types: types.data,
      utilization: utilization.data,
      underutilized: underutilized.data,
    };
  }, [days, threshold]);

  const summary = resource.data?.summary ?? {};
  const utilization = resource.data?.utilization ?? {};
  const machineRows = useMemo(
    () => (Array.isArray(utilization.machines) ? utilization.machines : resource.data?.equipment ?? []),
    [resource.data?.equipment, utilization.machines],
  );
  const underutilizedIds = useMemo(
    () => new Set((resource.data?.underutilized ?? []).map((row) => String(row.equipmentId))),
    [resource.data?.underutilized],
  );
  const visibleRows = onlyUnderutilized
    ? machineRows.filter((row) => underutilizedIds.has(String(row.equipmentId)))
    : machineRows;
  const windowHours = Math.max(1, days * 24);
  const fleetUtilization = n(summary.utilizationPct || utilization.fleetUtilizationPct);
  const runtimeHours = n(summary.totalRuntimeHours);
  const idleHours = n(summary.totalIdleHours);
  const downtimeHours = n(summary.totalDowntimeHours);

  return (
    <div className="utilization-page">
      <PageHeader
        title="Fleet utilization"
        subtitle="See where capacity is working, waiting, or unavailable across the selected window"
      />

      <section className="ut-control-bar" aria-label="Utilization controls">
        <div className="ut-window-label">
          <span className="material-symbols-outlined" aria-hidden="true">calendar_today</span>
          <div>
            <strong>{days}-day activity window</strong>
            <span>Aggregated from usage logs and telemetry</span>
          </div>
        </div>
        <div className="ut-controls">
          <label className="ut-control">
            <span>Lookback</span>
            <select value={days} onChange={(event) => setDays(Number(event.target.value))}>
              {[7, 14, 30, 60, 90].map((value) => <option key={value} value={value}>{value} days</option>)}
            </select>
          </label>
          <label className="ut-control ut-threshold-control">
            <span>Flag below</span>
            <span className="ut-input-suffix">
              <input
                type="number"
                min={0}
                max={100}
                value={threshold}
                onChange={(event) => setThreshold(Number(event.target.value))}
                aria-label="Underutilized threshold percentage"
              />
              <b>%</b>
            </span>
          </label>
          <button
            className={`ut-filter-button ${onlyUnderutilized ? 'is-active' : ''}`}
            type="button"
            onClick={() => setOnlyUnderutilized((value) => !value)}
            aria-pressed={onlyUnderutilized}
          >
            <span className="material-symbols-outlined" aria-hidden="true">filter_alt</span>
            {onlyUnderutilized ? 'Showing flagged' : 'Show underutilized'}
          </button>
        </div>
      </section>

      {resource.error && <FeedbackBanner tone="error">{resource.error}</FeedbackBanner>}

      {resource.loading ? <PageSkeleton rows={8} /> : (
        <>
          <section className="ut-summary-strip" aria-label="Fleet utilization summary">
            <div className="ut-summary-primary">
              <span>Fleet utilization</span>
              <strong>{fleetUtilization.toFixed(1)}%</strong>
              <i style={{ '--progress': `${Math.min(100, Math.max(0, fleetUtilization))}%` } as React.CSSProperties} />
            </div>
            <div className="ut-summary-stat"><span>Runtime</span><strong>{runtimeHours.toFixed(1)} <small>hrs</small></strong></div>
            <div className="ut-summary-stat"><span>Idle</span><strong>{idleHours.toFixed(1)} <small>hrs</small></strong></div>
            <div className="ut-summary-stat"><span>Downtime</span><strong>{downtimeHours.toFixed(1)} <small>hrs</small></strong></div>
            <div className="ut-summary-stat"><span>Assets</span><strong>{n(summary.machineCount || utilization.machineCount)}</strong></div>
          </section>

          <section className="ut-panel ut-timeline-panel" aria-labelledby="activity-title">
            <header className="ut-panel-header">
              <div>
                <div className="ut-panel-kicker">Asset activity</div>
                <h2 id="activity-title">Relative allocation in selected window</h2>
              </div>
              <div className="ut-legend" aria-label="Activity legend">
                {(Object.keys(activityMeta) as ActivityKind[]).map((kind) => (
                  <span key={kind}><i className={activityMeta[kind].className} />{activityMeta[kind].label}</span>
                ))}
              </div>
            </header>
            <div className="ut-disclosure">
              <span className="material-symbols-outlined" aria-hidden="true">info</span>
              Bands show proportional hours in the selected window; they are not timestamped event intervals.
            </div>

            <div className="ut-timeline-scroll">
              <div className="ut-timeline" style={{ '--asset-count': Math.max(1, visibleRows.length) } as React.CSSProperties}>
                <div className="ut-timeline-axis">
                  <span className="ut-axis-asset">Asset</span>
                  <div className="ut-axis-scale" aria-hidden="true">
                    <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
                  </div>
                  <span className="ut-axis-util">Util.</span>
                </div>
                {visibleRows.length ? visibleRows.map((row, index) => {
                  const utilizationPct = n(row.utilizationPct);
                  const isFlagged = utilizationPct < threshold;
                  return (
                    <div
                      className={`ut-asset-row ${isFlagged ? 'is-flagged' : ''}`}
                      key={String(row.equipmentId ?? index)}
                      style={{ '--row-index': index } as React.CSSProperties}
                    >
                      <div className="ut-asset-cell">
                        <span className="ut-asset-icon material-symbols-outlined" aria-hidden="true">construction</span>
                        <div>
                          <strong>{String(row.equipmentName ?? row.equipmentId ?? 'Unknown asset')}</strong>
                          <span>{String(row.equipmentType ?? 'Equipment')} · {String(row.siteName ?? 'Unassigned')}</span>
                        </div>
                      </div>
                      <ActivityBar row={row} windowHours={windowHours} />
                      <div className="ut-utilization-value">
                        <strong>{utilizationPct.toFixed(1)}%</strong>
                        {isFlagged && <span>Below {threshold}%</span>}
                      </div>
                    </div>
                  );
                }) : <EmptyState title="No activity in this window" message="Try a longer lookback or turn off the underutilized filter." />}
              </div>
            </div>
          </section>

          <div className="ut-secondary-grid">
            <section className="ut-panel" aria-labelledby="underutilized-title">
              <header className="ut-panel-header ut-panel-header-compact">
                <div><div className="ut-panel-kicker">Reallocation candidates</div><h2 id="underutilized-title">Underutilized assets</h2></div>
                <span className="ut-count-badge">{resource.data?.underutilized.length ?? 0}</span>
              </header>
              {!resource.data?.underutilized.length ? <EmptyState title="No assets below threshold" message={`No equipment is below ${threshold}% utilization in this window.`} /> : (
                <div className="ut-compact-list">{resource.data.underutilized.map((row) => <div className="ut-compact-row" key={String(row.equipmentId)}><div><strong>{String(row.equipmentName ?? row.equipmentId)}</strong><span>{String(row.siteName ?? 'Unassigned')} · {String(row.reason ?? '')}</span></div><strong>{n(row.utilizationPct).toFixed(1)}%</strong></div>)}</div>
              )}
            </section>
            <section className="ut-panel" aria-labelledby="type-title">
              <header className="ut-panel-header ut-panel-header-compact">
                <div><div className="ut-panel-kicker">Mix by category</div><h2 id="type-title">Equipment type performance</h2></div>
              </header>
              <div className="ut-compact-list">{resource.data?.types.map((row) => <div className="ut-compact-row" key={String(row.equipmentType)}><div><strong>{String(row.equipmentType)}</strong><span>{n(row.machineCount)} machines · {n(row.runtimeHours).toFixed(1)} runtime hours</span></div><strong>{n(row.utilizationPct).toFixed(1)}%</strong></div>)}</div>
            </section>
          </div>

          <section className="ut-panel ut-detail-panel" aria-labelledby="detail-title">
            <header className="ut-panel-header ut-panel-header-compact"><div><div className="ut-panel-kicker">Source detail</div><h2 id="detail-title">Equipment utilization detail</h2></div><span className="ut-muted-note">{machineRows.length} assets</span></header>
            <div className="table-wrap"><table className="data-table ut-detail-table"><thead><tr><th>Asset</th><th>Site</th><th>Runtime</th><th>Idle</th><th>Downtime</th><th>Utilization</th><th>Source</th></tr></thead><tbody>{resource.data?.equipment.map((row) => <tr key={String(row.equipmentId)}><td><strong>{String(row.equipmentName ?? row.equipmentId)}</strong><small>{String(row.equipmentType ?? '')}</small></td><td>{String(row.siteName ?? 'Unassigned')}</td><td>{n(row.runtimeHours).toFixed(1)} h</td><td>{n(row.idleHours).toFixed(1)} h</td><td>{n(row.downtimeHours).toFixed(1)} h</td><td><strong>{n(row.utilizationPct).toFixed(1)}%</strong></td><td>{String(row.source ?? '—')}</td></tr>)}</tbody></table></div>
          </section>

          <details className="ut-site-details">
            <summary>View site comparison</summary>
            <div className="ut-site-list">{resource.data?.sites.map((row, index) => <div className="ut-compact-row" key={String(row.siteId ?? index)}><div><strong>{String(row.siteName ?? 'Unassigned')}</strong><span>{n(row.runtimeHours).toFixed(1)} runtime · {n(row.idleHours).toFixed(1)} idle · {n(row.fuelConsumed).toFixed(1)} fuel</span></div><strong>{n(row.utilizationPct).toFixed(1)}%</strong></div>)}</div>
          </details>
        </>
      )}
    </div>
  );
}
