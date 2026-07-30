import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'INFO'>('ALL');

  const fetchAlerts = async () => {
    try {
      const res = await fetch('/api/alerts?resolved=false&limit=100');
      const data = await res.json();
      if (data.success) setAlerts(data.alerts ?? []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const resolveAlert = async (id: number) => {
    await fetch('/api/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertId: id }),
    });
    setAlerts((prev) => prev.filter((a) => a.alertId !== id));
  };

  const filtered = alerts.filter((a) => filter === 'ALL' || a.severity === filter);

  return (
    <div style={{ backgroundColor: '#fff8f0', color: '#1f1b10' }} className="min-h-screen flex overflow-hidden font-sans">
      <Sidebar />
      <main className="flex-1 ml-64 flex flex-col h-screen overflow-hidden">
        <Header title="Alerts & Notifications Center" subtitle="Real-time Alert Escalation & Diagnostic Management" onRefresh={fetchAlerts} />

        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6 custom-scrollbar">
          {/* Controls Bar */}
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              {['ALL', 'CRITICAL', 'WARNING', 'INFO'].map((f: any) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    backgroundColor: filter === f ? '#ffcd11' : '#f7eddb',
                    color: filter === f ? '#6f5800' : '#1f1b10',
                    borderColor: '#d1c5ab',
                  }}
                  className="px-3 py-1.5 rounded-lg border text-xs font-bold uppercase cursor-pointer"
                >
                  {f}
                </button>
              ))}
            </div>

            <span style={{ color: '#4e4632' }} className="text-xs font-bold">{filtered.length} Active Notifications</span>
          </div>

          {/* Alerts Feed List */}
          <div style={{ backgroundColor: '#ffffff', borderColor: '#d1c5ab' }} className="border rounded-xl p-6 shadow-xs flex flex-col gap-4">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#80765f]">
                <span className="material-symbols-outlined text-4xl mb-1 text-emerald-600">notifications_active</span>
                <p className="font-bold">No active alerts</p>
                <p className="text-[10px] mt-0.5">All machines are operating within expected parameters.</p>
              </div>
            ) : (
              filtered.map((a) => (
                <div key={a.alertId} style={{ backgroundColor: '#fdf3e1', borderColor: a.severity === 'CRITICAL' ? '#ba1a1a' : '#d1c5ab' }} className="p-4 border rounded-lg flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-3">
                      <span
                        style={{
                          backgroundColor: a.severity === 'CRITICAL' ? '#ba1a1a' : '#ed6c02',
                          color: '#ffffff',
                        }}
                        className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase"
                      >
                        {a.severity}
                      </span>
                      <span className="font-extrabold text-sm">{a.equipmentId} · {a.anomalyType}</span>
                    </div>
                    <p style={{ color: '#4e4632' }} className="text-xs mt-1.5">{a.description}</p>
                    <p style={{ color: '#745b00' }} className="text-[11px] font-bold mt-1">Recommendation: {a.recommendation}</p>
                  </div>

                  <button
                    onClick={() => resolveAlert(a.alertId)}
                    style={{ backgroundColor: '#ffcd11', color: '#6f5800' }}
                    className="px-4 py-2 rounded-lg font-bold text-xs uppercase cursor-pointer hover:opacity-90 shadow-xs"
                  >
                    Acknowledge & Resolve
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
