import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import Panel from '../../components/ui/Panel';
import StatusBadge from '../../components/ui/StatusBadge';
import { operators, siteEquipment, siteStats } from '../../mock/data';

export default function SiteDashboard() {
  return (
    <div>
      <PageHeader title="Site Manager Dashboard" subtitle="Mining Site S003" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Equipment on Site" value={siteStats.equipmentOnSite} icon="construction" />
        <StatCard label="Operators" value={siteStats.operators} icon="groups" />
        <StatCard label="Running" value={siteStats.running} icon="play_circle" accent="success" />
        <StatCard label="Waiting" value={siteStats.waiting} icon="hourglass_top" accent="warning" />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Panel title="Operators on duty">
          {operators
            .filter((o) => o.status === 'ON SHIFT')
            .map((o) => (
              <div key={o.name} className="flex justify-between py-2 border-b border-outline-variant/30 last:border-0 text-sm">
                <span className="font-semibold">{o.name}</span>
                <span className="font-mono text-xs">{o.equipment}</span>
              </div>
            ))}
        </Panel>
        <Panel title="Site equipment status">
          {siteEquipment.map((e) => (
            <div key={e.id} className="flex justify-between items-center py-2 border-b border-outline-variant/30 last:border-0 text-sm">
              <span className="font-mono font-bold text-xs">{e.id}</span>
              <StatusBadge status={e.status} />
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}
