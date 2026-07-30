import { useEffect, useRef, useState } from 'react';

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
  const previousValue = useRef(value);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (Object.is(previousValue.current, value)) return;
    previousValue.current = value;
    setIsUpdating(true);
    const timer = window.setTimeout(() => setIsUpdating(false), 420);
    return () => window.clearTimeout(timer);
  }, [value]);

  return (
    <div
      className={`stat-card bg-surface-container-lowest border ${accentMap[accent]} rounded-xl p-4 shadow-sm flex flex-col gap-2 ${isUpdating ? 'is-updating' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className="font-label-md text-[10px] uppercase tracking-wider text-on-surface-variant">
          {label}
        </span>
        <span className={`stat-card-icon material-symbols-outlined text-primary text-xl ${icon === 'sensors' ? 'is-live-sensor' : ''}`}>
          {icon}
        </span>
      </div>
      <div className="stat-card-value font-headline-lg text-2xl font-black text-on-surface" aria-live="polite">
        {value}
      </div>
      {hint && <p className="text-[11px] text-on-surface-variant">{hint}</p>}
    </div>
  );
}
