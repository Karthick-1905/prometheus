import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';
import StatusBadge from '../../components/ui/StatusBadge';
import { anomalyAlerts } from '../../mock/data';

export default function FleetAnomalyDetection() {
  return (
    <div>
      <PageHeader
        title="Anomaly Detection"
        subtitle="Rule + ML style alerts · mock catalog"
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {['High Idle Time', 'High Temperature', 'Fuel Drop', 'Offline Equipment', 'Missing Operator', 'Equipment Outside Site'].map(
          (type) => {
            const count = anomalyAlerts.filter((a) => a.type === type).length;
            return (
              <div
                key={type}
                className="bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-3 flex items-center justify-between"
              >
                <span className="text-xs font-bold text-on-surface">{type}</span>
                <span className="text-lg font-black text-primary">{count}</span>
              </div>
            );
          }
        )}
      </div>

      <Panel title="Active alerts">
        <div className="space-y-3">
          {anomalyAlerts.map((a) => (
            <div
              key={a.id}
              className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 rounded-lg border border-outline-variant/50 bg-surface"
            >
              <StatusBadge status={a.severity} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-on-surface">
                  {a.type} · <span className="font-mono">{a.equipmentId}</span>
                </p>
                <p className="text-xs text-on-surface-variant">{a.description}</p>
              </div>
              <span className="text-[10px] font-bold text-on-surface-variant uppercase shrink-0">
                {a.detectedAt}
              </span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
