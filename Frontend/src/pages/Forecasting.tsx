import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

export default function ForecastingPage() {
  return (
    <div style={{ backgroundColor: '#fff8f0', color: '#1f1b10' }} className="min-h-screen flex overflow-hidden font-sans">
      <Sidebar />
      <main className="flex-1 ml-64 flex flex-col h-screen overflow-hidden">
        <Header title="Demand Forecasting" subtitle="Predictive Analytics & Capacity Projection Engine" />

        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6 custom-scrollbar">
          {/* Forecast Summary Cards */}
          <div className="grid grid-cols-4 gap-6">
            <div style={{ backgroundColor: '#ffffff', borderColor: '#d1c5ab' }} className="border rounded-xl p-5 shadow-xs">
              <p style={{ color: '#4e4632' }} className="text-xs font-bold uppercase">Projected Q3 Demand</p>
              <p style={{ color: '#2e7d32' }} className="text-2xl font-black mt-1">+18.4 %</p>
              <p style={{ color: '#4e4632' }} className="text-[11px] font-bold mt-1">High Excavator Demand</p>
            </div>
            <div style={{ backgroundColor: '#ffffff', borderColor: '#d1c5ab' }} className="border rounded-xl p-5 shadow-xs">
              <p style={{ color: '#4e4632' }} className="text-xs font-bold uppercase">Fleet Shortage Risk</p>
              <p style={{ color: '#ba1a1a' }} className="text-2xl font-black mt-1">4 Units</p>
              <p style={{ color: '#ba1a1a' }} className="text-[11px] font-bold mt-1">Bulldozer deficit in August</p>
            </div>
            <div style={{ backgroundColor: '#ffffff', borderColor: '#d1c5ab' }} className="border rounded-xl p-5 shadow-xs">
              <p style={{ color: '#4e4632' }} className="text-xs font-bold uppercase">Predicted Revenue</p>
              <p style={{ color: '#745b00' }} className="text-2xl font-black mt-1">$312,000</p>
              <p style={{ color: '#2e7d32' }} className="text-[11px] font-bold mt-1">📈 Next quarter estimate</p>
            </div>
            <div style={{ backgroundColor: '#ffffff', borderColor: '#d1c5ab' }} className="border rounded-xl p-5 shadow-xs">
              <p style={{ color: '#4e4632' }} className="text-xs font-bold uppercase">Model Confidence</p>
              <p style={{ color: '#006874' }} className="text-2xl font-black mt-1">92.8 %</p>
              <p style={{ color: '#4e4632' }} className="text-[11px] font-bold mt-1">ARIMA + LSTM Hybrid Model</p>
            </div>
          </div>

          {/* Machine Demand Projections Chart Box */}
          <div style={{ backgroundColor: '#ffffff', borderColor: '#d1c5ab' }} className="border rounded-xl p-6 shadow-xs flex flex-col gap-4">
            <h4 className="text-base font-bold">Machine Category Demand Projections (6-Month Horizon)</h4>
            
            <div className="flex items-end gap-6 h-48 pt-4 border-b border-[#d1c5ab]">
              {[
                { month: 'May', val: 65 },
                { month: 'Jun', val: 72 },
                { month: 'Jul', val: 84 },
                { month: 'Aug (Pred)', val: 95 },
                { month: 'Sep (Pred)', val: 88 },
                { month: 'Oct (Pred)', val: 78 },
              ].map((m, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                  <span className="text-xs font-bold">{m.val}%</span>
                  <div
                    style={{
                      height: `${m.val}%`,
                      backgroundColor: m.month.includes('Pred') ? '#ffcd11' : '#745b00',
                    }}
                    className="w-full rounded-t-md transition-all shadow-xs"
                  />
                  <span style={{ color: '#4e4632' }} className="text-[11px] font-bold uppercase">{m.month}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
