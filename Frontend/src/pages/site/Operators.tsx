import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';
import StatusBadge from '../../components/ui/StatusBadge';
import { operators } from '../../mock/data';

export default function SiteOperators() {
  return (
    <div>
      <PageHeader title="Operators" subtitle="Shift roster" />
      <Panel>
        <div className="overflow-x-auto -m-4">
          <table className="w-full text-left text-xs min-w-[520px]">
            <thead className="bg-surface-container text-[10px] uppercase text-on-surface-variant">
              <tr>
                {['Operator Name', 'Assigned Equipment', 'Shift', 'Status'].map((h) => (
                  <th key={h} className="px-3 py-3 font-bold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {operators.map((o) => (
                <tr key={o.name} className="border-t border-outline-variant/40">
                  <td className="px-3 py-3 font-semibold">{o.name}</td>
                  <td className="px-3 py-3 font-mono">{o.equipment}</td>
                  <td className="px-3 py-3">{o.shift}</td>
                  <td className="px-3 py-3">
                    <StatusBadge status={o.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
