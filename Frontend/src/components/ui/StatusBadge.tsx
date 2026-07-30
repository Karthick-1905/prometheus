const styles: Record<string, string> = {
  WORKING: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  AVAILABLE: 'bg-sky-100 text-sky-800 border-sky-300',
  IDLE: 'bg-amber-100 text-amber-900 border-amber-300',
  MAINTENANCE: 'bg-violet-100 text-violet-800 border-violet-300',
  ACTIVE: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  OVERDUE: 'bg-red-100 text-red-800 border-red-300',
  RETURNED: 'bg-slate-100 text-slate-700 border-slate-300',
  CRITICAL: 'bg-red-100 text-red-800 border-red-300',
  WARNING: 'bg-amber-100 text-amber-900 border-amber-300',
  INFO: 'bg-sky-100 text-sky-800 border-sky-300',
  'ON SHIFT': 'bg-emerald-100 text-emerald-800 border-emerald-300',
  'OFF SHIFT': 'bg-slate-100 text-slate-600 border-slate-300',
  STANDBY: 'bg-amber-100 text-amber-900 border-amber-300',
  ON: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  OFF: 'bg-slate-100 text-slate-600 border-slate-300',
};

export default function StatusBadge({ status }: { status: string }) {
  const cls = styles[status] ?? 'bg-surface-container text-on-surface-variant border-outline-variant';
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${cls}`}>
      {status}
    </span>
  );
}
