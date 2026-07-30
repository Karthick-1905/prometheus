import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import { telemetryCards } from '../../mock/data';

export default function FleetLiveTelemetry() {
  return (
    <div>
      <PageHeader
        title="Live Telemetry"
        subtitle="Mock stream · MQTT integration later"
        actions={
          <span className="flex items-center gap-2 text-xs font-bold uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            Simulated live
          </span>
        }
      />

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {telemetryCards.map((t) => (
          <article
            key={t.id}
            className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-sm"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-mono font-black text-sm">{t.id}</p>
                <p className="text-[10px] text-on-surface-variant uppercase font-bold">
                  Updated {t.lastUpdated}
                </p>
              </div>
              <StatusBadge status={t.engineStatus} />
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <Metric icon="local_gas_station" label="Fuel" value={`${t.fuel}%`} />
              <Metric icon="thermostat" label="Temperature" value={`${t.temperature}°C`} />
              <Metric icon="speed" label="Speed" value={`${t.speed} km/h`} />
              <Metric icon="location_on" label="GPS" value={t.gps} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="bg-surface-container rounded-lg p-2.5 border border-outline-variant/30">
      <div className="flex items-center gap-1 text-on-surface-variant mb-0.5">
        <span className="material-symbols-outlined text-sm">{icon}</span>
        <span className="text-[10px] uppercase font-bold">{label}</span>
      </div>
      <p className="font-bold text-on-surface truncate" title={value}>
        {value}
      </p>
    </div>
  );
}
