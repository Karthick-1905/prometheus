import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { Link } from 'react-router-dom';

export default function OverviewPage() {
  const [fleet, setFleet] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [fRes, aRes] = await Promise.all([
        fetch('/api/telemetry'),
        fetch('/api/alerts?resolved=false'),
      ]);
      const fData = await fRes.json();
      const aData = await aRes.json();
      if (fData.success) setFleet(fData.snapshot ?? []);
      if (aData.success) setAlerts(aData.alerts ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const activeAlerts = alerts.filter((a) => !a.isResolved);
  const criticalCount = activeAlerts.filter((a) => a.severity === 'CRITICAL').length;

  return (
    <div style={{ backgroundColor: '#fff8f0', color: '#1f1b10' }} className="min-h-screen flex overflow-hidden font-sans">
      <Sidebar />
      <main className="flex-1 ml-64 flex flex-col h-screen overflow-hidden">
        <Header title="Fleet Overview Dashboard" subtitle="Nexus Fleet Intelligence & Operational Health" onRefresh={fetchData} />

        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6 custom-scrollbar">
          {/* Executive Stats Bar */}
          <div className="grid grid-cols-4 gap-6">
            <div style={{ backgroundColor: '#ffffff', borderColor: '#d1c5ab' }} className="border rounded-xl p-5 shadow-xs flex justify-between items-center">
              <div>
                <p style={{ color: '#4e4632' }} className="text-xs font-bold uppercase">Total Fleet Asset Base</p>
                <p className="text-2xl font-black text-[#1f1b10] mt-1">{fleet.length || 24} Units</p>
                <p style={{ color: '#2e7d32' }} className="text-[11px] font-bold mt-1">🟢 92% Operational Availability</p>
              </div>
              <div style={{ backgroundColor: '#fdf3e1' }} className="w-12 h-12 rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl" style={{ color: '#745b00' }}>local_shipping</span>
              </div>
            </div>

            <div style={{ backgroundColor: '#ffffff', borderColor: '#d1c5ab' }} className="border rounded-xl p-5 shadow-xs flex justify-between items-center">
              <div>
                <p style={{ color: '#4e4632' }} className="text-xs font-bold uppercase">Active Anomaly Alerts</p>
                <p style={{ color: activeAlerts.length > 0 ? '#ba1a1a' : '#2e7d32' }} className="text-2xl font-black mt-1">
                  {activeAlerts.length} Active
                </p>
                <p style={{ color: '#ba1a1a' }} className="text-[11px] font-bold mt-1">
                  {criticalCount} Critical Action Required
                </p>
              </div>
              <div style={{ backgroundColor: '#ffdad6' }} className="w-12 h-12 rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl text-[#ba1a1a]">warning</span>
              </div>
            </div>

            <div style={{ backgroundColor: '#ffffff', borderColor: '#d1c5ab' }} className="border rounded-xl p-5 shadow-xs flex justify-between items-center">
              <div>
                <p style={{ color: '#4e4632' }} className="text-xs font-bold uppercase">Fleet Utilization</p>
                <p className="text-2xl font-black text-[#1f1b10] mt-1">84.6 %</p>
                <p style={{ color: '#006874' }} className="text-[11px] font-bold mt-1">📈 +3.2% vs last week</p>
              </div>
              <div style={{ backgroundColor: '#fdf3e1' }} className="w-12 h-12 rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl" style={{ color: '#006874' }}>trending_up</span>
              </div>
            </div>

            <div style={{ backgroundColor: '#ffffff', borderColor: '#d1c5ab' }} className="border rounded-xl p-5 shadow-xs flex justify-between items-center">
              <div>
                <p style={{ color: '#4e4632' }} className="text-xs font-bold uppercase">Health Index</p>
                <p style={{ color: '#745b00' }} className="text-2xl font-black mt-1">94.2 / 100</p>
                <p style={{ color: '#4e4632' }} className="text-[11px] font-bold mt-1">Optimal Fleet Health</p>
              </div>
              <div style={{ backgroundColor: '#ffcd11' }} className="w-12 h-12 rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl" style={{ color: '#6f5800' }}>health_metrics</span>
              </div>
            </div>
          </div>

          {/* Core Navigation Shortcuts */}
          <div style={{ backgroundColor: '#ffcd11', borderColor: '#745b00' }} className="p-6 rounded-xl border-2 flex justify-between items-center shadow-xs">
            <div>
              <h3 style={{ color: '#241a00' }} className="text-lg font-black uppercase">Nexus Fleet Command Center</h3>
              <p style={{ color: '#574400' }} className="text-xs font-medium mt-1">
                Real-time telemetric anomaly detection, predictive maintenance, and rental management.
              </p>
            </div>

            <div className="flex gap-3">
              <Link to="/anomalies" style={{ backgroundColor: '#6f5800', color: '#ffffff' }} className="px-5 py-2.5 rounded-lg font-bold uppercase text-xs hover:opacity-90 no-underline shadow-xs">
                AI Anomalies
              </Link>
              <Link to="/telemetry" style={{ borderColor: '#6f5800', color: '#6f5800' }} className="border-2 px-5 py-2.5 rounded-lg font-bold uppercase text-xs hover:bg-[#6f5800] hover:text-white transition-all no-underline">
                Live Telemetry
              </Link>
            </div>
          </div>

          {/* Fleet Grid */}
          <div className="flex flex-col gap-4">
            <h3 className="text-base font-bold">Current Machine Telemetry Status</h3>
            <div className="grid grid-cols-3 gap-6">
              {fleet.map((eq) => (
                <div key={eq.equipmentId} style={{ backgroundColor: '#ffffff', borderColor: '#d1c5ab' }} className="border rounded-xl p-5 shadow-xs flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-extrabold text-base">EQ-{eq.equipmentId}</h4>
                      <p style={{ color: '#4e4632' }} className="text-xs">{eq.equipmentType || 'Excavator'}</p>
                    </div>
                    <span style={{ backgroundColor: '#ffcd11', color: '#6f5800' }} className="px-2.5 py-1 rounded text-[10px] font-bold uppercase">
                      {eq.status || 'WORKING'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs border-t border-b border-[#d1c5ab]/50 py-3">
                    <div>
                      <span style={{ color: '#80765f' }} className="text-[10px] uppercase font-bold block">Runtime</span>
                      <span className="font-bold">{eq.runtimeHours ? parseFloat(eq.runtimeHours).toFixed(1) : '450.0'} hrs</span>
                    </div>
                    <div>
                      <span style={{ color: '#80765f' }} className="text-[10px] uppercase font-bold block">Location Site</span>
                      <span className="font-bold truncate block">{eq.siteName || 'Mining Site S003'}</span>
                    </div>
                  </div>

                  <Link to={`/equipment/${eq.equipmentId}`} style={{ color: '#745b00' }} className="text-xs font-bold uppercase no-underline hover:underline">
                    View Asset Telemetry →
                  </Link>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
