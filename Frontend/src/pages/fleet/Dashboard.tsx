import { analyticsApi, fleetApi } from '../../api/platform';
import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';
import StatCard from '../../components/ui/StatCard';
import StatusBadge from '../../components/ui/StatusBadge';
import { EmptyState, FeedbackBanner, PageSkeleton } from '../../components/ui/Feedback';
import { useAsync } from '../../hooks/useAsync';

const n = (value: unknown) => Number(value ?? 0);
const text = (value: unknown) => String(value ?? '—');

export default function FleetDashboard() {
  const resource = useAsync(async () => {
    const [overview, usage, sites, expiring, overdue] = await Promise.all([
      fleetApi.overview(),
      analyticsApi.summary(7),
      analyticsApi.bySite(7),
      fleetApi.expiringContracts(7),
      fleetApi.overdueContracts(),
    ]);
    return { overview, usage: usage.data, sites: sites.data, expiring: expiring.data, overdue: overdue.data };
  }, []);

  const totals = (resource.data?.overview.totals ?? {}) as Record<string, unknown>;
  const usage = resource.data?.usage ?? {};
  const sites = resource.data?.sites ?? [];

  return (
    <div>
      <PageHeader
        title="Fleet Manager Dashboard"
        subtitle="Live rental commitments and seven-day operating performance"
        actions={<button type="button" className="btn-secondary" onClick={() => void resource.reload()}>Refresh data</button>}
      />
      {resource.error && <FeedbackBanner tone="error">{resource.error}</FeedbackBanner>}
      {resource.loading ? <PageSkeleton rows={8} /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard label="Rented machines" value={n(totals.machinesRented)} icon="construction" />
            <StatCard label="Working" value={n(totals.working)} icon="play_circle" accent="success" />
            <StatCard label="Open alerts" value={n(totals.withOpenAlerts)} icon="warning" accent="warning" />
            <StatCard label="Overdue" value={n(totals.overdue)} icon="event_busy" accent="warning" />
            <StatCard label="Utilization" value={`${n(usage.utilizationPct).toFixed(1)}%`} icon="monitoring" />
            <StatCard label="Runtime" value={`${n(usage.totalRuntimeHours).toFixed(1)} h`} icon="timer" />
            <StatCard label="Idle" value={`${n(usage.totalIdleHours).toFixed(1)} h`} icon="hourglass_top" />
            <StatCard label="Due in 7 days" value={resource.data?.expiring.length ?? 0} icon="calendar_clock" />
          </div>

          <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4">
            <Panel title="Utilization by site">
              {sites.length === 0 ? (
                <EmptyState title="No operating data" message="Site utilization appears after usage logs or telemetry are received." />
              ) : (
                <div className="data-list">
                  {sites.map((site, index) => {
                    const pct = n(site.utilizationPct);
                    return (
                      <div className="data-list-row" key={String(site.siteId ?? index)}>
                        <div><strong>{text(site.siteName)}</strong><span>{n(site.machineCount)} machines · {n(site.runtimeHours).toFixed(1)} runtime hours</span></div>
                        <div className="meter" aria-label={`${pct}% utilized`}><span style={{ width: `${Math.min(100, pct)}%` }} /></div>
                        <strong>{pct.toFixed(1)}%</strong>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
            <Panel title="Contract attention">
              {(resource.data?.overdue.length ?? 0) === 0 && (resource.data?.expiring.length ?? 0) === 0 ? (
                <EmptyState title="No near-term returns" message="There are no overdue or seven-day return commitments." />
              ) : (
                <div className="data-list">
                  {resource.data?.overdue.map((row, index) => (
                    <div className="data-list-row compact" key={`overdue-${index}`}>
                      <div><strong>{text(row.equipmentName)}</strong><span>Contract #{text(row.contractId)}</span></div>
                      <StatusBadge status="OVERDUE" />
                    </div>
                  ))}
                  {resource.data?.expiring.map((row, index) => (
                    <div className="data-list-row compact" key={`due-${index}`}>
                      <div><strong>{text(row.equipmentName)}</strong><span>Due {new Date(String(row.expectedReturn)).toLocaleDateString()}</span></div>
                      <StatusBadge status="DUE SOON" />
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
