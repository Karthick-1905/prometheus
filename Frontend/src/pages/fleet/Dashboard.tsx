import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';
import StatCard from '../../components/ui/StatCard';
import {
  aiRecommendations,
  fleetHealth,
  fleetStats,
  recentActivities,
  recentTelemetry,
} from '../../mock/data';

export default function FleetDashboard() {
  const s = fleetStats;
  return (
    <div>
      <PageHeader
        title="Fleet Manager Dashboard"
        subtitle="Enterprise fleet overview · mock data"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Equipment" value={s.totalEquipment} icon="construction" />
        <StatCard label="Active Rentals" value={s.activeRentals} icon="assignment" accent="success" />
        <StatCard label="Available" value={s.available} icon="check_circle" />
        <StatCard label="Working" value={s.working} icon="play_circle" accent="success" />
        <StatCard label="Idle" value={s.idle} icon="pause_circle" accent="warning" />
        <StatCard label="Maintenance" value={s.maintenance} icon="build" />
        <StatCard label="Overdue Rentals" value={s.overdueRentals} icon="event_busy" accent="critical" />
        <StatCard label="Active Alerts" value={s.activeAlerts} icon="warning" accent="critical" />
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Panel title="Recent Telemetry" className="xl:col-span-1">
          <ul className="space-y-3">
            {recentTelemetry.map((t) => (
              <li key={t.id + t.time} className="flex justify-between gap-2 text-sm">
                <div>
                  <p className="font-bold text-on-surface text-xs">{t.id}</p>
                  <p className="text-xs text-on-surface-variant">{t.event}</p>
                </div>
                <span className="text-[10px] text-on-surface-variant shrink-0">{t.time}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Recent Activities" className="xl:col-span-1">
          <ul className="space-y-3">
            {recentActivities.map((a) => (
              <li key={a.text} className="flex justify-between gap-2 text-sm">
                <p className="text-xs text-on-surface">{a.text}</p>
                <span className="text-[10px] text-on-surface-variant shrink-0">{a.time}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="AI Recommendations" className="xl:col-span-1">
          <ul className="space-y-3">
            {aiRecommendations.map((r) => (
              <li key={r} className="flex gap-2 text-xs text-on-surface">
                <span className="material-symbols-outlined text-primary text-base">auto_awesome</span>
                {r}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Fleet Health Summary" className="xl:col-span-1">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-16 h-16 rounded-full border-4 border-primary-container flex items-center justify-center font-black text-xl text-primary">
              {fleetHealth.score}
            </div>
            <div>
              <p className="font-bold text-on-surface">{fleetHealth.label}</p>
              <p className="text-[11px] text-on-surface-variant">Composite health index</p>
            </div>
          </div>
          <ul className="space-y-1.5">
            {fleetHealth.notes.map((n) => (
              <li key={n} className="text-xs text-on-surface-variant flex gap-2">
                <span className="text-primary">•</span> {n}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
