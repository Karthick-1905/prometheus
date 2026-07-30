import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

export default function AnalyticsPage() {
  return (
    <div style={{ backgroundColor: '#fff8f0', color: '#1f1b10' }} className="min-h-screen flex overflow-hidden font-sans">
      <Sidebar />
      <main className="flex-1 ml-64 flex flex-col h-screen overflow-hidden">
        <Header title="Reports & Analytics Dashboard" subtitle="Fleet ROI, Operational Downtime & Maintenance Financials" />

        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6 custom-scrollbar">
          {/* Export Header */}
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold">Executive Financial & Reliability Reports</h3>
            <button style={{ backgroundColor: '#745b00', color: '#ffffff' }} className="px-4 py-2 rounded-lg font-bold text-xs uppercase cursor-pointer hover:opacity-90 shadow-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">download</span>
              Export PDF / CSV Report
            </button>
          </div>

          {/* Key Analytics Metrics */}
          <div className="grid grid-cols-4 gap-6">
            <div style={{ backgroundColor: '#ffffff', borderColor: '#d1c5ab' }} className="border rounded-xl p-5 shadow-xs">
              <p style={{ color: '#4e4632' }} className="text-xs font-bold uppercase">Total Fleet Net ROI</p>
              <p style={{ color: '#2e7d32' }} className="text-2xl font-black mt-1">+24.5 %</p>
              <p style={{ color: '#2e7d32' }} className="text-[11px] font-bold mt-1">Exceeds target by 4.2%</p>
            </div>
            <div style={{ backgroundColor: '#ffffff', borderColor: '#d1c5ab' }} className="border rounded-xl p-5 shadow-xs">
              <p style={{ color: '#4e4632' }} className="text-xs font-bold uppercase">Total Unplanned Downtime</p>
              <p style={{ color: '#ba1a1a' }} className="text-2xl font-black mt-1">12.4 Hours</p>
              <p style={{ color: '#2e7d32' }} className="text-[11px] font-bold mt-1">📉 -45% vs last month</p>
            </div>
            <div style={{ backgroundColor: '#ffffff', borderColor: '#d1c5ab' }} className="border rounded-xl p-5 shadow-xs">
              <p style={{ color: '#4e4632' }} className="text-xs font-bold uppercase">Maintenance Spend</p>
              <p style={{ color: '#1f1b10' }} className="text-2xl font-black mt-1">$14,280</p>
              <p style={{ color: '#4e4632' }} className="text-[11px] font-bold mt-1">Within Q3 Budget</p>
            </div>
            <div style={{ backgroundColor: '#ffffff', borderColor: '#d1c5ab' }} className="border rounded-xl p-5 shadow-xs">
              <p style={{ color: '#4e4632' }} className="text-xs font-bold uppercase">Mean Time Between Failures</p>
              <p style={{ color: '#745b00' }} className="text-2xl font-black mt-1">420 Hours</p>
              <p style={{ color: '#2e7d32' }} className="text-[11px] font-bold mt-1">High Reliability Index</p>
            </div>
          </div>

          {/* Analytics Visual Distribution */}
          <div style={{ backgroundColor: '#ffffff', borderColor: '#d1c5ab' }} className="border rounded-xl p-6 shadow-xs flex flex-col gap-4">
            <h4 className="text-base font-bold">Monthly Operational Cost vs Maintenance Savings</h4>
            <div className="h-44 flex items-end gap-4 pt-4 border-b border-[#d1c5ab]">
              {[
                { month: 'Jan', cost: 18, saved: 8 },
                { month: 'Feb', cost: 16, saved: 10 },
                { month: 'Mar', cost: 22, saved: 14 },
                { month: 'Apr', cost: 15, saved: 12 },
                { month: 'May', cost: 14, saved: 16 },
                { month: 'Jun', cost: 12, saved: 18 },
              ].map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <div className="w-full flex gap-1 items-end h-full">
                    <div style={{ height: `${d.cost * 4}%`, backgroundColor: '#4e4632' }} className="flex-1 rounded-t-xs" title={`Cost: $${d.cost}k`} />
                    <div style={{ height: `${d.saved * 4}%`, backgroundColor: '#ffcd11' }} className="flex-1 rounded-t-xs" title={`Saved: $${d.saved}k`} />
                  </div>
                  <span style={{ color: '#4e4632' }} className="text-[10px] font-bold uppercase">{d.month}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
