import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';
import StatusBadge from '../../components/ui/StatusBadge';
import { assets } from '../../mock/data';

const dealerOwned = assets.filter((a) => a.dealer === 'Midwest CAT');

export default function DealerInventory() {
  return (
    <div>
      <PageHeader title="Equipment Inventory" subtitle="Dealer-owned fleet (Midwest CAT)" />
      <Panel>
        <div className="overflow-x-auto -m-4">
          <table className="w-full text-left text-xs min-w-[600px]">
            <thead className="bg-surface-container text-[10px] uppercase text-on-surface-variant">
              <tr>
                {['ID', 'Name', 'Type', 'Status', 'Site', 'Fuel', 'Hours'].map((h) => (
                  <th key={h} className="px-3 py-3 font-bold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dealerOwned.map((a) => (
                <tr key={a.id} className="border-t border-outline-variant/40">
                  <td className="px-3 py-3 font-mono font-bold">{a.id}</td>
                  <td className="px-3 py-3">{a.name}</td>
                  <td className="px-3 py-3">{a.type}</td>
                  <td className="px-3 py-3">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="px-3 py-3">{a.site}</td>
                  <td className="px-3 py-3">{a.fuel}%</td>
                  <td className="px-3 py-3">{a.engineHours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
