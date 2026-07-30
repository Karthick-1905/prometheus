import { useState } from 'react';
import { analyticsApi } from '../../api/platform';
import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';
import StatCard from '../../components/ui/StatCard';
import { EmptyState, FeedbackBanner, PageSkeleton } from '../../components/ui/Feedback';
import { useAsync } from '../../hooks/useAsync';

const n = (value: unknown) => Number(value ?? 0);

export default function FleetUtilization() {
  const [days, setDays] = useState(7);
  const [threshold, setThreshold] = useState(35);
  const resource = useAsync(async () => {
    const [summary, sites, equipment, types, utilization, underutilized] = await Promise.all([
      analyticsApi.summary(days),
      analyticsApi.bySite(days),
      analyticsApi.byEquipment(days),
      analyticsApi.byType(days),
      analyticsApi.utilization(days),
      analyticsApi.underutilized(days, threshold / 100),
    ]);
    return { summary: summary.data, sites: sites.data, equipment: equipment.data, types: types.data, utilization: utilization.data, underutilized: underutilized.data };
  }, [days, threshold]);
  const summary = resource.data?.summary ?? {};

  return (
    <div>
      <PageHeader title="Fleet Utilization" subtitle="Runtime, idle capacity, fuel, downtime, and reallocation candidates" />
      <div className="toolbar">
        <label className="field"><span>Lookback</span><select value={days} onChange={(event) => setDays(Number(event.target.value))}>{[7, 14, 30, 60, 90].map((value) => <option key={value} value={value}>{value} days</option>)}</select></label>
        <label className="field"><span>Underutilized below</span><input type="number" min={0} max={100} value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} /></label>
      </div>
      {resource.error && <FeedbackBanner tone="error">{resource.error}</FeedbackBanner>}
      {resource.loading ? <PageSkeleton rows={8} /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard label="Fleet utilization" value={`${n(summary.utilizationPct).toFixed(1)}%`} icon="monitoring" />
            <StatCard label="Runtime hours" value={n(summary.totalRuntimeHours).toFixed(1)} icon="timer" />
            <StatCard label="Idle hours" value={n(summary.totalIdleHours).toFixed(1)} icon="hourglass_top" accent="warning" />
            <StatCard label="Underutilized" value={resource.data?.underutilized.length ?? 0} icon="low_priority" accent="warning" />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <Panel title="Underutilized assets">
              {!resource.data?.underutilized.length ? <EmptyState title="No assets below threshold" message={`No equipment is below ${threshold}% utilization in this window.`} /> : (
                <div className="data-list">{resource.data.underutilized.map((row) => <div className="data-list-row" key={String(row.equipmentId)}><div><strong>{String(row.equipmentName ?? row.equipmentId)}</strong><span>{String(row.siteName ?? 'Unassigned')} · {String(row.reason ?? '')}</span></div><strong>{n(row.utilizationPct).toFixed(1)}%</strong></div>)}</div>
              )}
            </Panel>
            <Panel title="Performance by equipment type">
              <div className="data-list">{resource.data?.types.map((row) => <div className="data-list-row" key={String(row.equipmentType)}><div><strong>{String(row.equipmentType)}</strong><span>{n(row.machineCount)} machines · {n(row.runtimeHours).toFixed(1)} runtime hours</span></div><strong>{n(row.utilizationPct).toFixed(1)}%</strong></div>)}</div>
            </Panel>
          </div>
          <Panel title="Equipment utilization detail" className="mt-4">
            <div className="table-wrap"><table className="data-table"><thead><tr><th>Asset</th><th>Site</th><th>Runtime</th><th>Idle</th><th>Downtime</th><th>Utilization</th><th>Source</th></tr></thead><tbody>{resource.data?.equipment.map((row) => <tr key={String(row.equipmentId)}><td><strong>{String(row.equipmentName ?? row.equipmentId)}</strong><small>{String(row.equipmentType ?? '')}</small></td><td>{String(row.siteName ?? 'Unassigned')}</td><td>{n(row.runtimeHours).toFixed(1)} h</td><td>{n(row.idleHours).toFixed(1)} h</td><td>{n(row.downtimeHours).toFixed(1)} h</td><td><strong>{n(row.utilizationPct).toFixed(1)}%</strong></td><td>{String(row.source ?? '—')}</td></tr>)}</tbody></table></div>
          </Panel>
          <Panel title="Site comparison" className="mt-4">
            <div className="data-list">{resource.data?.sites.map((row, index) => <div className="data-list-row" key={String(row.siteId ?? index)}><div><strong>{String(row.siteName ?? 'Unassigned')}</strong><span>{n(row.runtimeHours).toFixed(1)} runtime · {n(row.idleHours).toFixed(1)} idle · {n(row.fuelConsumed).toFixed(1)} fuel</span></div><strong>{n(row.utilizationPct).toFixed(1)}%</strong></div>)}</div>
          </Panel>
        </>
      )}
    </div>
  );
}
