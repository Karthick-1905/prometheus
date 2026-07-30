import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';
import { utilizationChart, utilizationRows } from '../../mock/data';

export default function FleetUtilization() {
  const maxVal = Math.max(...utilizationChart.map((d) => d.runtime + d.idle));

  return (
    <div>
      <PageHeader title="Utilization" subtitle="Runtime, idle, fuel & downtime" />

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <Panel title="Weekly runtime vs idle (mock chart)">
          <div className="flex items-end gap-2 h-48 pt-4">
            {utilizationChart.map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                <div className="w-full flex flex-col-reverse gap-0.5" style={{ height: '100%' }}>
                  <div
                    className="w-full bg-primary-container rounded-t"
                    style={{ height: `${(d.runtime / maxVal) * 100}%` }}
                    title={`Runtime ${d.runtime}h`}
                  />
                  <div
                    className="w-full bg-amber-300/80 rounded-t"
                    style={{ height: `${(d.idle / maxVal) * 100}%` }}
                    title={`Idle ${d.idle}h`}
                  />
                </div>
                <span className="text-[10px] font-bold text-on-surface-variant">{d.day}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-3 text-[10px] uppercase font-bold text-on-surface-variant">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-primary-container" /> Runtime
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-amber-300" /> Idle
            </span>
          </div>
        </Panel>

        <Panel title="Fleet averages">
          <div className="grid grid-cols-2 gap-3">
            {[
              { l: 'Avg Runtime', v: '33.1 h', i: 'schedule' },
              { l: 'Avg Idle', v: '7.4 h', i: 'hourglass_empty' },
              { l: 'Fuel used', v: '1,750 L', i: 'local_gas_station' },
              { l: 'Avg utilization', v: '65%', i: 'speed' },
            ].map((x) => (
              <div key={x.l} className="bg-surface-container rounded-lg p-3 border border-outline-variant/40">
                <span className="material-symbols-outlined text-primary text-xl">{x.i}</span>
                <p className="text-[10px] uppercase font-bold text-on-surface-variant mt-1">{x.l}</p>
                <p className="text-xl font-black">{x.v}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="By equipment">
        <div className="overflow-x-auto -m-4">
          <table className="w-full text-left text-xs min-w-[640px]">
            <thead className="bg-surface-container text-[10px] uppercase text-on-surface-variant">
              <tr>
                {['Equipment', 'Runtime Hrs', 'Idle Hrs', 'Fuel Usage', 'Downtime', 'Utilization %'].map((h) => (
                  <th key={h} className="px-3 py-3 font-bold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {utilizationRows.map((r) => (
                <tr key={r.id} className="border-t border-outline-variant/40">
                  <td className="px-3 py-3 font-mono font-bold">{r.id}</td>
                  <td className="px-3 py-3">{r.runtime}</td>
                  <td className="px-3 py-3">{r.idle}</td>
                  <td className="px-3 py-3">{r.fuel} L</td>
                  <td className="px-3 py-3">{r.downtime} h</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-surface-container rounded-full overflow-hidden max-w-[100px]">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${r.utilization}%` }}
                        />
                      </div>
                      <span className="font-bold">{r.utilization}%</span>
                    </div>
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
