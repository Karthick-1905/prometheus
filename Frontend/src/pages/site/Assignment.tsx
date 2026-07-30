import { useState } from 'react';
import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';
import { operators, siteEquipment } from '../../mock/data';

export default function SiteAssignment() {
  const [msg, setMsg] = useState<string | null>(null);
  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 2200);
  };

  return (
    <div>
      <PageHeader title="Equipment Assignment" subtitle="Check-in / check-out / reassign (mock)" />
      {msg && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-primary-container text-on-primary-container text-sm font-bold">
          {msg}
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { l: 'Assign Equipment', i: 'person_add', m: 'Mock: Assign equipment flow' },
          { l: 'Check-In', i: 'login', m: 'Mock: Equipment checked in' },
          { l: 'Check-Out', i: 'logout', m: 'Mock: Equipment checked out' },
          { l: 'Reassign', i: 'swap_horiz', m: 'Mock: Reassignment completed' },
        ].map((b) => (
          <button
            key={b.l}
            type="button"
            onClick={() => flash(b.m)}
            className="flex flex-col items-center gap-2 p-5 rounded-xl border border-outline-variant bg-surface-container-lowest hover:bg-primary-container/30 transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-3xl text-primary">{b.i}</span>
            <span className="text-xs font-black uppercase">{b.l}</span>
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Panel title="Available operators">
          {operators.map((o) => (
            <div key={o.name} className="flex justify-between text-sm py-2 border-b border-outline-variant/30 last:border-0">
              <span className="font-semibold">{o.name}</span>
              <span className="text-xs text-on-surface-variant">{o.status}</span>
            </div>
          ))}
        </Panel>
        <Panel title="Site equipment">
          {siteEquipment.map((e) => (
            <div key={e.id} className="flex justify-between text-sm py-2 border-b border-outline-variant/30 last:border-0">
              <span className="font-mono font-bold text-xs">{e.id}</span>
              <span className="text-xs">{e.status}</span>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}
