interface StatCardProps {
  label: string;
  value: string | number;
  icon?: string;
  accent?: 'default' | 'warning' | 'critical' | 'success';
  hint?: string;
}

const accentMap = {
  default: 'border-outline-variant',
  warning: 'border-amber-400/50',
  critical: 'border-error/40',
  success: 'border-emerald-500/40',
};

export default function StatCard({
  label,
  value,
  icon = 'analytics',
  accent = 'default',
  hint,
}: StatCardProps) {
  return (
    <div
      className={`bg-surface-container-lowest border ${accentMap[accent]} rounded-xl p-4 shadow-sm flex flex-col gap-2`}
    >
      <div className="flex items-center justify-between">
        <span className="font-label-md text-[10px] uppercase tracking-wider text-on-surface-variant">
          {label}
        </span>
        <span className="material-symbols-outlined text-primary text-xl">{icon}</span>
      </div>
      <div className="font-headline-lg text-2xl font-black text-on-surface">{value}</div>
      {hint && <p className="text-[11px] text-on-surface-variant">{hint}</p>}
    </div>
  );
}
