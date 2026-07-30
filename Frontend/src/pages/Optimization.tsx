import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

export default function OptimizationPage() {
  return (
    <div style={{ backgroundColor: '#fff8f0', color: '#1f1b10' }} className="min-h-screen flex overflow-hidden font-sans">
      <Sidebar />
      <main className="flex-1 ml-64 flex flex-col h-screen overflow-hidden">
        <Header title="Fleet Optimization Dashboard" subtitle="Idle Reduction & Site Dispatch Optimization Engine" />

        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6 custom-scrollbar">
          {/* Optimization Banners */}
          <div style={{ backgroundColor: '#ffcd11', borderColor: '#745b00', color: '#6f5800' }} className="p-6 rounded-xl border-2 shadow-xs flex justify-between items-center">
            <div>
              <h3 style={{ color: '#241a00' }} className="text-lg font-black uppercase">Fleet Fuel Efficiency Score: 89.4 / 100</h3>
              <p style={{ color: '#574400' }} className="text-xs font-medium mt-1">
                AI optimization engine identified 14.5 hours of unnecessary idling at Site S003. Potential fuel savings: 120 Gallons/week.
              </p>
            </div>

            <button style={{ backgroundColor: '#6f5800', color: '#ffffff' }} className="px-5 py-2.5 rounded-lg font-bold uppercase text-xs hover:opacity-90 cursor-pointer shadow-xs">
              Apply Optimization Plan
            </button>
          </div>

          {/* Recommendations Table */}
          <div style={{ backgroundColor: '#ffffff', borderColor: '#d1c5ab' }} className="border rounded-xl p-6 shadow-xs flex flex-col gap-4">
            <h4 className="text-base font-bold">AI Optimization Actions</h4>

            <div className="divide-y divide-[#d1c5ab]/40 text-xs">
              <div className="py-3 flex justify-between items-center">
                <div>
                  <p className="font-extrabold text-[#1f1b10]">Re-route Dump Truck CAT-DT-1003 to Mining Site S001</p>
                  <p style={{ color: '#4e4632' }}>Balances hauling load and reduces cycle wait time by 18 minutes per shift.</p>
                </div>
                <span style={{ backgroundColor: '#ffcd11', color: '#6f5800' }} className="px-3 py-1 rounded font-bold uppercase text-[10px]">
                  High Priority
                </span>
              </div>

              <div className="py-3 flex justify-between items-center">
                <div>
                  <p className="font-extrabold text-[#1f1b10]">Auto Shutdown Trigger on Excavator CAT-EX-1001</p>
                  <p style={{ color: '#4e4632' }}>Set engine shutoff threshold to 8 minutes during extended idle pauses.</p>
                </div>
                <span style={{ backgroundColor: '#f7eddb', color: '#006874' }} className="px-3 py-1 rounded font-bold uppercase text-[10px]">
                  Medium Priority
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
