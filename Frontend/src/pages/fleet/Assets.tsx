import { useMemo, useState } from 'react';
import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';
import StatusBadge from '../../components/ui/StatusBadge';
import { assets } from '../../mock/data';

export default function FleetAssets() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('ALL');
  const [selected, setSelected] = useState<string | null>(null);

  const rows = useMemo(() => {
    return assets.filter((a) => {
      const matchQ =
        !q ||
        a.id.toLowerCase().includes(q.toLowerCase()) ||
        a.name.toLowerCase().includes(q.toLowerCase()) ||
        a.type.toLowerCase().includes(q.toLowerCase());
      const matchS = status === 'ALL' || a.status === status;
      return matchQ && matchS;
    });
  }, [q, status]);

  const detail = assets.find((a) => a.id === selected);

  return (
    <div>
      <PageHeader title="Assets" subtitle="Full equipment inventory" />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex-1 flex items-center gap-2 bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2">
          <span className="material-symbols-outlined text-on-surface-variant text-lg">search</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search ID, name, type…"
            className="bg-transparent border-none outline-none w-full text-sm text-on-surface"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-sm font-semibold text-on-surface"
        >
          <option value="ALL">All statuses</option>
          <option value="WORKING">Working</option>
          <option value="AVAILABLE">Available</option>
          <option value="IDLE">Idle</option>
          <option value="MAINTENANCE">Maintenance</option>
        </select>
      </div>

      <Panel className="overflow-hidden">
        <div className="overflow-x-auto -m-4">
          <table className="w-full text-left text-xs min-w-[900px]">
            <thead className="bg-surface-container text-[10px] uppercase tracking-wide text-on-surface-variant">
              <tr>
                {[
                  'Equipment ID',
                  'Name',
                  'Type',
                  'Dealer',
                  'Site',
                  'Operator',
                  'Status',
                  'Availability',
                  'Fuel',
                  'Engine Hours',
                  'Last Updated',
                  'Actions',
                ].map((h) => (
                  <th key={h} className="px-3 py-3 font-bold whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="border-t border-outline-variant/40 hover:bg-surface-container/50">
                  <td className="px-3 py-3 font-bold font-mono">{a.id}</td>
                  <td className="px-3 py-3">{a.name}</td>
                  <td className="px-3 py-3">{a.type}</td>
                  <td className="px-3 py-3">{a.dealer}</td>
                  <td className="px-3 py-3">{a.site}</td>
                  <td className="px-3 py-3">{a.operator}</td>
                  <td className="px-3 py-3">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="px-3 py-3">{a.availability}</td>
                  <td className="px-3 py-3">{a.fuel}%</td>
                  <td className="px-3 py-3">{a.engineHours.toLocaleString()}</td>
                  <td className="px-3 py-3 text-on-surface-variant">{a.lastUpdated}</td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => setSelected(a.id)}
                      className="text-[10px] font-bold uppercase px-2 py-1 rounded border border-outline-variant hover:bg-primary-container cursor-pointer"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setSelected(null)}>
          <div
            className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 max-w-md w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-black text-lg">{detail.id}</h3>
                <p className="text-sm text-on-surface-variant">{detail.name}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="material-symbols-outlined cursor-pointer">
                close
              </button>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-xs">
              {[
                ['Type', detail.type],
                ['Dealer', detail.dealer],
                ['Site', detail.site],
                ['Operator', detail.operator],
                ['Status', detail.status],
                ['Fuel', `${detail.fuel}%`],
                ['Engine hours', String(detail.engineHours)],
                ['Updated', detail.lastUpdated],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-on-surface-variant uppercase text-[10px] font-bold">{k}</dt>
                  <dd className="font-semibold text-on-surface mt-0.5">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
