import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';
import StatCard from '../../components/ui/StatCard';
import StatusBadge from '../../components/ui/StatusBadge';
import { dealerStats, rentals } from '../../mock/data';

export default function DealerDashboard() {
  return (
    <div>
      <PageHeader title="Dealer Dashboard" subtitle="Rental portfolio snapshot" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <StatCard label="Active Rentals" value={dealerStats.activeRentals} icon="assignment" accent="success" />
        <StatCard label="Returned Equipment" value={dealerStats.returned} icon="keyboard_return" />
        <StatCard label="Available Equipment" value={dealerStats.available} icon="inventory" />
      </div>
      <Panel title="Recent rentals">
        <div className="space-y-2">
          {rentals.slice(0, 4).map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-outline-variant/30 last:border-0">
              <div>
                <p className="text-sm font-bold">{r.id} · {r.customer}</p>
                <p className="text-xs text-on-surface-variant font-mono">{r.equipment}</p>
              </div>
              <StatusBadge status={r.status} />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
