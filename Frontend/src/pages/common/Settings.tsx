import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';

export default function SettingsPage() {
  return (
    <div className="max-w-lg">
      <PageHeader title="Settings" subtitle="Local preferences only" />
      <Panel title="Preferences">
        <div className="space-y-4 text-sm">
          {[
            { l: 'Push notifications', d: 'Mock toggle — not wired' },
            { l: 'Compact tables', d: 'UI density preference' },
            { l: 'Telemetry units', d: 'Metric (default)' },
          ].map((item) => (
            <label key={item.l} className="flex items-center justify-between gap-4 cursor-pointer">
              <span>
                <span className="block font-semibold">{item.l}</span>
                <span className="block text-xs text-on-surface-variant">{item.d}</span>
              </span>
              <input type="checkbox" defaultChecked className="w-4 h-4 accent-[#745b00]" />
            </label>
          ))}
        </div>
      </Panel>
      <Panel title="About" className="mt-4">
        <p className="text-xs text-on-surface-variant leading-relaxed">
          CAT Smart Rental Tracking — frontend demo with mock RBAC. JWT authentication, MQTT
          telemetry, and live anomaly APIs will replace local role selection and mock datasets.
        </p>
      </Panel>
    </div>
  );
}
