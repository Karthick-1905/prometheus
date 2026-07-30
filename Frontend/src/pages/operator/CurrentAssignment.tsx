import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';
import { currentAssignment } from '../../mock/data';

export default function OperatorCurrentAssignment() {
  const a = currentAssignment;
  return (
    <div className="max-w-md mx-auto md:max-w-lg">
      <PageHeader title="Current Assignment" subtitle="Active job ticket" />
      <Panel>
        <dl className="space-y-4">
          {[
            ['Equipment', a.equipment],
            ['Site', a.site],
            ['Runtime', `${a.runtime} h`],
            ['Fuel', `${a.fuel}%`],
            ['Assignment Time', a.assignmentTime],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between items-center border-b border-outline-variant/40 pb-3 last:border-0">
              <dt className="text-xs uppercase font-bold text-on-surface-variant">{k}</dt>
              <dd className="font-black text-on-surface text-sm">{v}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    </div>
  );
}
