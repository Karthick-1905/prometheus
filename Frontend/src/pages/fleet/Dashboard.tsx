import {
  aiRecommendations,
  fleetHealth,
  fleetStats,
  recentActivities,
  recentTelemetry,
  utilizationChart,
} from '../../mock/data';

// ─── Sparkline SVG ────────────────────────────────────────────────────────────
function Sparkline({ data, color = '#745b00', h = 32, w = 80 }: { data: number[]; color?: string; h?: number; w?: number }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => `${i * step},${h - ((v - min) / range) * h}`).join(' ');
  return (
    <svg width={w} height={h} className="opacity-80">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Donut Gauge ─────────────────────────────────────────────────────────────
function DonutGauge({ pct, size = 80, stroke = 10, color = '#745b00', label }: {
  pct: number; size?: number; stroke?: number; color?: string; label?: string;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const center = size / 2;
  return (
    <svg width={size} height={size}>
      <circle cx={center} cy={center} r={r} fill="none" stroke="#e8e0d4" strokeWidth={stroke} />
      <circle
        cx={center} cy={center} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'stroke-dashoffset 0.8s ease' }}
      />
      <text x={center} y={center - 4} textAnchor="middle" fontSize="16" fontWeight="900" fill={color}>{pct}</text>
      {label && <text x={center} y={center + 12} textAnchor="middle" fontSize="8" fontWeight="700" fill="#80765f" textDecoration="uppercase">{label}</text>}
    </svg>
  );
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────
function BarChart({ data }: { data: typeof utilizationChart }) {
  const maxR = Math.max(...data.map((d) => d.runtime));
  return (
    <div className="flex items-end gap-1 h-20 w-full">
      {data.map((d) => (
        <div key={d.day} className="flex-1 flex flex-col items-center gap-0.5">
          <div className="w-full flex flex-col items-center gap-px" style={{ height: '64px' }}>
            {/* idle on top */}
            <div
              className="w-full rounded-t-sm transition-all duration-700"
              style={{ height: `${(d.idle / maxR) * 64}px`, backgroundColor: '#d1c5ab' }}
            />
            {/* runtime below */}
            <div
              className="w-full transition-all duration-700"
              style={{ height: `${(d.runtime / maxR) * 64}px`, backgroundColor: '#745b00' }}
            />
          </div>
          <span className="text-[9px] font-bold text-on-surface-variant uppercase">{d.day.slice(0,1)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, icon, accent, sparkData, border,
}: {
  label: string; value: string | number; icon: string;
  accent?: 'warn' | 'crit' | 'ok' | 'default';
  sparkData?: number[]; border?: string;
}) {
  const accentColors = {
    warn: { bg: '#fffbeb', border: '#fbbf24', icon: '#d97706', text: '#92400e' },
    crit: { bg: '#fff1f2', border: '#fca5a5', icon: '#dc2626', text: '#991b1b' },
    ok:   { bg: '#f0fdf4', border: '#86efac', icon: '#16a34a', text: '#166534' },
    default: { bg: '#fff8f0', border: '#d1c5ab', icon: '#745b00', text: '#4e4632' },
  };
  const c = accentColors[accent ?? 'default'];
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-1 border shadow-sm transition-shadow hover:shadow-md"
      style={{ backgroundColor: c.bg, borderColor: border ?? c.border }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: c.text }}>{label}</span>
        <span className="material-symbols-outlined text-xl" style={{ color: c.icon }}>{icon}</span>
      </div>
      <span className="text-3xl font-black leading-none" style={{ color: '#1f1b10' }}>{value}</span>
      {sparkData && <Sparkline data={sparkData} color={c.icon} />}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function FleetDashboard() {
  const s = fleetStats;
  const h = fleetHealth;

  // Simulate sparkline trends for each KPI
  const trends = {
    equipment: [45, 46, 47, 47, 48, 48, 48],
    rentals:   [28, 29, 30, 31, 31, 30, 31],
    available: [14, 13, 12, 12, 11, 12, 12],
    working:   [20, 22, 23, 24, 24, 23, 24],
    idle:      [10, 9, 8, 7, 8, 7, 7],
    maint:     [4, 5, 5, 5, 5, 5, 5],
    overdue:   [2, 2, 3, 3, 3, 3, 3],
    alerts:    [6, 7, 8, 9, 8, 9, 9],
  };

  // Status distribution for donut bar
  const total = s.working + s.idle + s.maintenance + s.available;
  const statusBars = [
    { label: 'Working', pct: Math.round((s.working / total) * 100), color: '#745b00' },
    { label: 'Available', pct: Math.round((s.available / total) * 100), color: '#2e7d32' },
    { label: 'Idle', pct: Math.round((s.idle / total) * 100), color: '#d97706' },
    { label: 'Maintenance', pct: Math.round((s.maintenance / total) * 100), color: '#dc2626' },
  ];

  return (
    <div className="flex flex-col gap-6">

      {/* ── Page Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-on-surface tracking-tight">Fleet Manager Dashboard</h1>
          <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mt-0.5">
            Enterprise Fleet Overview · Mock Data
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-outline-variant bg-surface-container text-xs font-bold text-on-surface-variant">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Mock mode
          </div>
          <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-black text-xs">
            DU
          </div>
        </div>
      </div>

      {/* ── KPI Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total Equipment"  value={s.totalEquipment}  icon="construction"  accent="default" sparkData={trends.equipment} />
        <KpiCard label="Active Rentals"   value={s.activeRentals}   icon="assignment"    accent="ok"      sparkData={trends.rentals} />
        <KpiCard label="Available"        value={s.available}       icon="check_circle"  accent="default" sparkData={trends.available} />
        <KpiCard label="Working"          value={s.working}         icon="play_circle"   accent="ok"      sparkData={trends.working} />
        <KpiCard label="Idle"             value={s.idle}            icon="pause_circle"  accent="warn"    sparkData={trends.idle} />
        <KpiCard label="Maintenance"      value={s.maintenance}     icon="build"         accent="default" sparkData={trends.maint} />
        <KpiCard label="Overdue Rentals"  value={s.overdueRentals}  icon="event_busy"    accent="crit"    sparkData={trends.overdue} />
        <KpiCard label="Active Alerts"    value={s.activeAlerts}    icon="warning"       accent="crit"    sparkData={trends.alerts} />
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Weekly Utilization Bar Chart */}
        <div className="md:col-span-2 bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-on-surface">Weekly Utilization</p>
              <p className="text-[10px] text-on-surface-variant">Runtime vs Idle hours · Fleet-wide</p>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-bold">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: '#745b00' }} />Runtime</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: '#d1c5ab' }} />Idle</span>
            </div>
          </div>
          <BarChart data={utilizationChart} />
          <div className="flex items-center justify-between text-[10px] text-on-surface-variant pt-1 border-t border-outline-variant/30">
            <span>Peak: Thursday (145h runtime)</span>
            <span className="font-bold text-[#745b00]">Fleet avg utilization 65%</span>
          </div>
        </div>

        {/* Fleet Status Distribution */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-on-surface">Fleet Status</p>
            <p className="text-[10px] text-on-surface-variant">Distribution across {total} units</p>
          </div>
          <div className="flex flex-col gap-2.5">
            {statusBars.map((bar) => (
              <div key={bar.label} className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px] font-bold">
                  <span style={{ color: bar.color }}>{bar.label}</span>
                  <span className="text-on-surface-variant">{bar.pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-surface-container overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${bar.pct}%`, backgroundColor: bar.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom 4-Panel Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Recent Telemetry */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-wider text-on-surface">Recent Telemetry</p>
            <span className="material-symbols-outlined text-base text-on-surface-variant">sensors</span>
          </div>
          <div className="flex flex-col divide-y divide-outline-variant/30">
            {recentTelemetry.map((t) => (
              <div key={t.id} className="py-2.5 flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-black text-on-surface">{t.id}</p>
                  <p className="text-[10px] text-on-surface-variant leading-snug">{t.event}</p>
                </div>
                <span className="text-[10px] font-bold text-primary shrink-0">{t.time}m</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activities */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-wider text-on-surface">Recent Activities</p>
            <span className="material-symbols-outlined text-base text-on-surface-variant">history</span>
          </div>
          <div className="flex flex-col divide-y divide-outline-variant/30">
            {recentActivities.map((a, i) => (
              <div key={i} className="py-2.5 flex items-start justify-between gap-2">
                <p className="text-[11px] text-on-surface leading-snug">{a.text}</p>
                <span className="text-[10px] font-bold text-on-surface-variant shrink-0">{a.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* AI Recommendations */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-wider text-on-surface">AI Recommendations</p>
            <span className="material-symbols-outlined text-base text-primary">psychology</span>
          </div>
          <div className="flex flex-col gap-3">
            {aiRecommendations.map((r, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="material-symbols-outlined text-sm text-primary shrink-0 mt-0.5">arrow_right_alt</span>
                <p className="text-[11px] text-on-surface leading-snug">{r}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Fleet Health Score */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-wider text-on-surface">Fleet Health Summary</p>
            <span className="material-symbols-outlined text-base text-on-surface-variant">favorite</span>
          </div>
          <div className="flex items-center gap-4">
            <DonutGauge pct={h.score} size={72} stroke={8} color="#745b00" label="SCORE" />
            <div>
              <p className="text-base font-black text-on-surface">{h.label}</p>
              <p className="text-[10px] text-on-surface-variant">Composite health index</p>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 pt-1 border-t border-outline-variant/30">
            {h.notes.map((n, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px] text-on-surface">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: i === 0 ? '#dc2626' : i === 1 ? '#d97706' : '#16a34a' }} />
                {n}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
