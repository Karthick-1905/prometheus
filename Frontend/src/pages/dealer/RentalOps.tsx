import { useState } from 'react';
import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';
import StatusBadge from '../../components/ui/StatusBadge';
import { rentals } from '../../mock/data';

export default function DealerRentalOps() {
  const [toast, setToast] = useState<string | null>(null);
  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  return (
    <div>
      <PageHeader
        title="Rental Operations"
        subtitle="Contracts & returns"
        actions={
          <>
            <button type="button" onClick={() => flash('Mock: New rental form')} className="btn-primary">
              New Rental
            </button>
            <button type="button" onClick={() => flash('Mock: Return equipment')} className="btn-secondary">
              Return Equipment
            </button>
            <button type="button" onClick={() => flash('Mock: Extend rental')} className="btn-secondary">
              Extend Rental
            </button>
          </>
        }
      />
      {toast && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-primary-container text-on-primary-container text-sm font-bold">
          {toast}
        </div>
      )}
      <Panel title="Rental list">
        <div className="overflow-x-auto -m-4">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead className="bg-surface-container text-[10px] uppercase text-on-surface-variant">
              <tr>
                {['Rental', 'Customer', 'Equipment', 'Start', 'End', 'Status'].map((h) => (
                  <th key={h} className="px-3 py-3 font-bold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rentals.map((r) => (
                <tr key={r.id} className="border-t border-outline-variant/40">
                  <td className="px-3 py-3 font-bold font-mono">{r.id}</td>
                  <td className="px-3 py-3">{r.customer}</td>
                  <td className="px-3 py-3 font-mono">{r.equipment}</td>
                  <td className="px-3 py-3">{r.start}</td>
                  <td className="px-3 py-3">{r.end}</td>
                  <td className="px-3 py-3">
                    <StatusBadge status={r.status} />
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
