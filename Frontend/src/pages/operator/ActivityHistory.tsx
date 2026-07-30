import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';
import { activityHistory } from '../../mock/data';

export default function OperatorActivityHistory() {
  return (
    <div className="max-w-md mx-auto md:max-w-2xl">
      <PageHeader title="Activity History" subtitle="Previous assignments" />
      <Panel>
        <div className="space-y-3">
          {activityHistory.map((h) => (
            <div
              key={h.date + h.equipment}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 p-3 rounded-lg bg-surface-container border border-outline-variant/40"
            >
              <div>
                <p className="font-mono font-bold text-sm">{h.equipment}</p>
                <p className="text-xs text-on-surface-variant">
                  {h.site} · {h.action}
                </p>
              </div>
              <div className="text-right text-xs">
                <p className="font-bold">{h.date}</p>
                <p className="text-on-surface-variant">{h.hours} h</p>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
