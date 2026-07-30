import { useState } from 'react';

// ─── Mock Data ───────────────────────────────────────────────────────────────

const KPI_CARDS = [
  {
    label: 'ACTIVE RENTALS',
    value: '142',
    sub: '+12% FROM LAST MONTH',
    subPositive: true,
    icon: 'assignment',
    color: '#F5C518',
  },
  {
    label: 'TOTAL REVENUE',
    value: '$2.4M',
    sub: 'MTD TARGET ACHIEVED',
    subPositive: true,
    icon: 'account_balance_wallet',
    color: '#F5C518',
  },
  {
    label: 'UPCOMING RETURNS',
    value: '28',
    sub: 'NEXT 48 HOURS',
    subPositive: null,
    icon: 'schedule',
    color: '#F5C518',
  },
  {
    label: 'NEW REQUESTS',
    value: '14',
    sub: '4 REQUIRE IMMEDIATE ACTION',
    subPositive: false,
    icon: 'inbox',
    color: '#F5C518',
  },
];

// Equipment Schedule — each row spans OCT dates 12–21
// startCol / endCol = 0-indexed within [12,13,14,15,16,17,18,19,20,21]
const SCHEDULE_DATA = [
  {
    id: 'Excavator EX-400',
    serial: 'ID: #FL-0021',
    color: '#F5C518',
    textColor: '#1a1a1a',
    startCol: 0,
    endCol: 5,
    label: 'BUILD-CORP | PROJECT ZEPHYR',
  },
  {
    id: 'Loader LD-820',
    serial: 'ID: #FL-5312',
    color: '#555577',
    textColor: '#ffffff',
    startCol: 3,
    endCol: 7,
    label: 'METRO INFRA | CITY HUB',
  },
  {
    id: 'Crane CR-90',
    serial: 'ID: #FL-1105',
    color: '#F5C518',
    textColor: '#1a1a1a',
    startCol: 0,
    endCol: 9,
    label: 'SKYLINE REALTORS | TOWER A',
  },
];

const OCT_DAYS = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21];

const AGREEMENTS = [
  {
    initials: 'BC',
    bgColor: '#2a4a7f',
    client: 'BuildCorp International',
    reg: 'Reg #9928-TX',
    equipment: 'Excavator EX-400',
    serial: 'S/N: 9021-XJ',
    period: 'Oct 12 – Nov 12',
    duration: '30 Days Duration',
    status: 'ACTIVE',
    statusColor: '#2E7D32',
    billing: 'PAID',
    billingColor: '#1a3a2a',
    billingTextColor: '#4caf50',
    overdue: false,
    warn: false,
  },
  {
    initials: 'MI',
    bgColor: '#3a5a2a',
    client: 'Metro Infrastructure',
    reg: 'Reg #1922-CA',
    equipment: 'Loader LD-820',
    serial: 'S/N: 3312-FL',
    period: 'Sep 15 – Oct 14',
    duration: 'Due tomorrow',
    status: 'RETURNING',
    statusColor: '#ED6C02',
    billing: 'PROCESSING',
    billingColor: '#3a3a1a',
    billingTextColor: '#F5C518',
    overdue: false,
    warn: false,
  },
  {
    initials: 'SR',
    bgColor: '#5a2a2a',
    client: 'Skyline Realtors',
    reg: 'Reg #4451-NY',
    equipment: 'Crane CR-90',
    serial: 'S/N: 1105-ZZ',
    period: 'Aug 01 – Oct 01',
    duration: 'OVERDUE',
    status: 'OVERDUE',
    statusColor: '#c62828',
    billing: 'IN ARREARS',
    billingColor: '#3a1a1a',
    billingTextColor: '#ef5350',
    overdue: true,
    warn: true,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function RentalsPage() {
  const [scheduleView, setScheduleView] = useState<'week' | 'month'>('week');
  const [search, setSearch] = useState('');

  return (
    <div
      className="min-h-screen flex font-sans overflow-hidden"
      style={{ backgroundColor: '#111318', color: '#e8e8e8' }}
    >
      {/* ── Dark Sidebar ── */}
      <aside
        className="w-44 flex-shrink-0 flex flex-col py-5 px-0 border-r"
        style={{ backgroundColor: '#1a1c24', borderColor: '#2a2d3a' }}
      >
        {/* Logo */}
        <div className="px-4 mb-6">
          <p className="font-black text-sm leading-tight" style={{ color: '#F5C518' }}>Nexus Fleet</p>
          <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#888' }}>Industrial Control</p>
        </div>

        {/* Nav */}
        {[
          { icon: 'dashboard', label: 'Dashboard', active: false },
          { icon: 'construction', label: 'Equipment', active: false },
          { icon: 'assignment', label: 'Rentals', active: true },
          { icon: 'sensors', label: 'Telemetry', active: false },
          { icon: 'trending_up', label: 'Forecasting', active: false },
          { icon: 'warning', label: 'AI Anomalies', active: false },
          { icon: 'insights', label: 'Optimization', active: false },
          { icon: 'notifications_active', label: 'Alerts', active: false },
          { icon: 'leaderboard', label: 'Analytics', active: false },
          { icon: 'settings', label: 'Settings', active: false },
        ].map((item) => (
          <button
            key={item.label}
            className="flex items-center gap-3 px-4 py-2.5 text-xs font-bold cursor-pointer text-left w-full transition-colors"
            style={{
              backgroundColor: item.active ? '#2a2d3a' : 'transparent',
              color: item.active ? '#F5C518' : '#aaa',
              borderLeft: item.active ? '3px solid #F5C518' : '3px solid transparent',
            }}
          >
            <span className="material-symbols-outlined text-base">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── Top Header ── */}
        <header
          className="flex items-center justify-between px-8 py-3 border-b flex-shrink-0"
          style={{ backgroundColor: '#1a1c24', borderColor: '#2a2d3a' }}
        >
          {/* Search */}
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs w-72"
            style={{ backgroundColor: '#24262f', border: '1px solid #2a2d3a' }}
          >
            <span className="material-symbols-outlined text-sm" style={{ color: '#888' }}>search</span>
            <input
              type="text"
              placeholder="Search rental ID, client, or machine..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent border-none outline-none flex-1 placeholder-[#666]"
              style={{ color: '#e8e8e8', fontSize: '11px' }}
            />
          </div>

          {/* Right: Bell + User */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <span className="material-symbols-outlined text-xl cursor-pointer" style={{ color: '#aaa' }}>notifications</span>
              <span
                className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full text-[8px] font-black flex items-center justify-center"
                style={{ backgroundColor: '#F5C518', color: '#111' }}
              >4</span>
            </div>
            <div className="flex items-center gap-2">
              <div>
                <p className="text-xs font-bold text-right leading-tight" style={{ color: '#e8e8e8' }}>Alex Mercer</p>
                <p className="text-[10px] text-right" style={{ color: '#888' }}>FLEET MANAGER</p>
              </div>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center font-black text-xs"
                style={{ backgroundColor: '#F5C518', color: '#111' }}
              >AM</div>
            </div>
          </div>
        </header>

        {/* ── Page Body ── */}
        <main className="flex-1 overflow-y-auto p-8 flex flex-col gap-6 custom-scrollbar">

          {/* Page Title + CTA */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-black" style={{ color: '#e8e8e8' }}>Rental Operations</h1>
              <p className="text-xs mt-1" style={{ color: '#888' }}>Real-time oversight of equipment lifecycle and revenue streams.</p>
            </div>
            <button
              className="flex items-center gap-2 px-5 py-3 rounded-lg font-black text-xs cursor-pointer transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#F5C518', color: '#111318' }}
            >
              <span className="material-symbols-outlined text-sm">add_circle</span>
              Create Rental Agreement
            </button>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-4">
            {KPI_CARDS.map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-xl p-5 flex flex-col gap-2 border"
                style={{ backgroundColor: '#1a1c24', borderColor: '#2a2d3a' }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#888' }}>{kpi.label}</p>
                  <span className="material-symbols-outlined text-base" style={{ color: kpi.color }}>{kpi.icon}</span>
                </div>
                <p className="text-3xl font-black" style={{ color: '#e8e8e8' }}>{kpi.value}</p>
                <p
                  className="text-[10px] font-bold flex items-center gap-1"
                  style={{
                    color: kpi.subPositive === true ? '#4caf50' :
                           kpi.subPositive === false ? '#ef5350' : '#888',
                  }}
                >
                  {kpi.subPositive === true && <span className="material-symbols-outlined text-xs">trending_up</span>}
                  {kpi.subPositive === false && <span className="material-symbols-outlined text-xs">priority_high</span>}
                  {kpi.sub}
                </p>
              </div>
            ))}
          </div>

          {/* Equipment Schedule */}
          <div
            className="rounded-xl border overflow-hidden"
            style={{ backgroundColor: '#1a1c24', borderColor: '#2a2d3a' }}
          >
            {/* Schedule Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#2a2d3a' }}>
              <div>
                <p className="font-black text-sm" style={{ color: '#e8e8e8' }}>Equipment Schedule</p>
                <p className="text-[11px] mt-0.5" style={{ color: '#888' }}>Rental periods for heavy machinery – Oct 2023</p>
              </div>
              <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: '#2a2d3a' }}>
                {(['week', 'month'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setScheduleView(v)}
                    className="px-4 py-1.5 text-xs font-black uppercase cursor-pointer transition-colors"
                    style={{
                      backgroundColor: scheduleView === v ? '#F5C518' : '#24262f',
                      color: scheduleView === v ? '#111' : '#aaa',
                    }}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse" style={{ minWidth: '700px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #2a2d3a' }}>
                    <th className="px-6 py-2 font-bold uppercase text-[11px] w-44" style={{ color: '#888' }}>EQUIPMENT ID</th>
                    {OCT_DAYS.map((d) => (
                      <th key={d} className="text-center py-2 font-bold text-[10px] w-14" style={{ color: '#888' }}>
                        <div>{d}</div>
                        <div>OCT</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SCHEDULE_DATA.map((row) => (
                    <tr key={row.id} style={{ borderBottom: '1px solid #2a2d3a' }}>
                      {/* Asset label */}
                      <td className="px-6 py-3">
                        <p className="font-bold text-xs" style={{ color: '#e8e8e8' }}>{row.id}</p>
                        <p className="text-[10px]" style={{ color: '#888' }}>{row.serial}</p>
                      </td>

                      {/* Timeline cells */}
                      <td colSpan={OCT_DAYS.length} className="py-3 pr-4 relative" style={{ height: '48px' }}>
                        <div className="relative w-full h-full flex items-center">
                          {/* Empty timeline track */}
                          <div className="absolute inset-0 flex">
                            {OCT_DAYS.map((d) => (
                              <div key={d} className="flex-1 border-r" style={{ borderColor: '#2a2d3a22' }} />
                            ))}
                          </div>
                          {/* Rental bar */}
                          <div
                            className="absolute flex items-center px-3 rounded font-bold text-[11px] whitespace-nowrap z-10"
                            style={{
                              left: `${(row.startCol / OCT_DAYS.length) * 100}%`,
                              width: `${((row.endCol - row.startCol + 1) / OCT_DAYS.length) * 100}%`,
                              backgroundColor: row.color,
                              color: row.textColor,
                              height: '28px',
                            }}
                          >
                            {row.label}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Active Agreements */}
          <div
            className="rounded-xl border overflow-hidden"
            style={{ backgroundColor: '#1a1c24', borderColor: '#2a2d3a' }}
          >
            {/* Table Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#2a2d3a' }}>
              <p className="font-black text-sm" style={{ color: '#e8e8e8' }}>Active Agreements</p>
              <div className="flex items-center gap-3">
                <button className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded border cursor-pointer" style={{ color: '#aaa', borderColor: '#2a2d3a', backgroundColor: '#24262f' }}>
                  <span className="material-symbols-outlined text-sm">filter_list</span>
                  FILTER
                </button>
                <button className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded border cursor-pointer" style={{ color: '#aaa', borderColor: '#2a2d3a', backgroundColor: '#24262f' }}>
                  <span className="material-symbols-outlined text-sm">download</span>
                  EXPORT
                </button>
              </div>
            </div>

            <table className="w-full text-left text-xs border-collapse">
              <thead style={{ borderBottom: '1px solid #2a2d3a' }}>
                <tr>
                  {['CLIENT', 'EQUIPMENT', 'RENTAL PERIOD', 'STATUS', 'BILLING', 'ACTIONS'].map((h) => (
                    <th key={h} className="px-5 py-3 font-bold text-[10px] uppercase tracking-wider" style={{ color: '#666' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {AGREEMENTS.map((ag, idx) => (
                  <tr
                    key={idx}
                    className="transition-colors"
                    style={{ borderBottom: '1px solid #2a2d3a22' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#24262f')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    {/* Client */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded flex items-center justify-center font-black text-xs flex-shrink-0"
                          style={{ backgroundColor: ag.bgColor, color: '#fff' }}
                        >
                          {ag.initials}
                        </div>
                        <div>
                          <p className="font-bold text-xs" style={{ color: '#F5C518' }}>{ag.client}</p>
                          <p className="text-[10px]" style={{ color: '#666' }}>{ag.reg}</p>
                        </div>
                      </div>
                    </td>

                    {/* Equipment */}
                    <td className="px-5 py-4">
                      <p className="font-bold text-xs" style={{ color: '#e8e8e8' }}>{ag.equipment}</p>
                      <p className="text-[10px]" style={{ color: '#666' }}>{ag.serial}</p>
                    </td>

                    {/* Rental Period */}
                    <td className="px-5 py-4">
                      <p className="font-bold text-xs" style={{ color: '#e8e8e8' }}>{ag.period}</p>
                      <p
                        className="text-[10px] font-bold"
                        style={{ color: ag.overdue ? '#ef5350' : '#888' }}
                      >
                        {ag.duration}
                      </p>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4">
                      <span
                        className="px-2.5 py-1 rounded text-[10px] font-black uppercase"
                        style={{ backgroundColor: ag.statusColor + '33', color: ag.statusColor === '#c62828' ? '#ef5350' : ag.statusColor === '#ED6C02' ? '#F5C518' : '#4caf50' }}
                      >
                        {ag.status}
                      </span>
                    </td>

                    {/* Billing */}
                    <td className="px-5 py-4">
                      <span
                        className="px-2.5 py-1 rounded text-[10px] font-black uppercase"
                        style={{ backgroundColor: ag.billingColor, color: ag.billingTextColor }}
                      >
                        {ag.billing}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {ag.warn && (
                          <span className="material-symbols-outlined text-base cursor-pointer" style={{ color: '#F5C518' }}>warning</span>
                        )}
                        <button
                          className="w-7 h-7 flex items-center justify-center rounded cursor-pointer"
                          style={{ color: '#888' }}
                        >
                          <span className="material-symbols-outlined text-base">more_vert</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Table Footer */}
            <div
              className="flex items-center justify-between px-5 py-3 border-t text-xs"
              style={{ borderColor: '#2a2d3a', color: '#666' }}
            >
              <span>Showing 1-3 of 142 rentals</span>
              <div className="flex items-center gap-3">
                <button className="cursor-pointer hover:text-white">
                  <span className="material-symbols-outlined text-sm">chevron_left</span>
                </button>
                <span className="font-bold" style={{ color: '#e8e8e8' }}>1 / 48</span>
                <button className="cursor-pointer hover:text-white">
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
              </div>
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}
