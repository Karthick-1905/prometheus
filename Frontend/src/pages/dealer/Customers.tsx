import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';
import { customers } from '../../mock/data';

export default function DealerCustomers() {
  return (
    <div>
      <PageHeader title="Customers" subtitle="Rental accounts" />
      <Panel>
        <div className="overflow-x-auto -m-4">
          <table className="w-full text-left text-xs min-w-[560px]">
            <thead className="bg-surface-container text-[10px] uppercase text-on-surface-variant">
              <tr>
                {['ID', 'Name', 'Contact', 'Phone', 'Active rentals'].map((h) => (
                  <th key={h} className="px-3 py-3 font-bold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-t border-outline-variant/40">
                  <td className="px-3 py-3 font-mono font-bold">{c.id}</td>
                  <td className="px-3 py-3 font-semibold">{c.name}</td>
                  <td className="px-3 py-3">{c.contact}</td>
                  <td className="px-3 py-3">{c.phone}</td>
                  <td className="px-3 py-3">{c.activeRentals}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
