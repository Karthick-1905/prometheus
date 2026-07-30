import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';
import StatusBadge from '../../components/ui/StatusBadge';
import { siteEquipment } from '../../mock/data';

export default function SiteEquipmentPage() {
  return (
    <div>
      <PageHeader title="Site Equipment" subtitle="Runtime · idle · fuel on this site" />
      <Panel>
        <div className="overflow-x-auto -m-4">
          <table className="w-full text-left text-xs min-w-[480px]">
            <thead className="bg-surface-container text-[10px] uppercase text-on-surface-variant">
              <tr>
                {['Equipment', 'Runtime', 'Idle Time', 'Fuel', 'Status'].map((h) => (
                  <th key={h} className="px-3 py-3 font-bold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {siteEquipment.map((e) => (
                <tr key={e.id} className="border-t border-outline-variant/40">
                  <td className="px-3 py-3 font-mono font-bold">{e.id}</td>
                  <td className="px-3 py-3">{e.runtime} h</td>
                  <td className="px-3 py-3">{e.idle} h</td>
                  <td className="px-3 py-3">{e.fuel}%</td>
                  <td className="px-3 py-3">
                    <StatusBadge status={e.status} />
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
