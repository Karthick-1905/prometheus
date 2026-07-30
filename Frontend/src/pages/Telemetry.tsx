import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

export default function TelemetryPage() {
  const [telemetry, setTelemetry] = useState<any[]>([]);

  const fetchTelemetry = async () => {
    try {
      const res = await fetch('/api/telemetry');
      const data = await res.json();
      if (data.success) setTelemetry(data.snapshot ?? []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ backgroundColor: '#fff8f0', color: '#1f1b10' }} className="min-h-screen flex overflow-hidden font-sans">
      <Sidebar />
      <main className="flex-1 ml-64 flex flex-col h-screen overflow-hidden">
        <Header title="Live Telemetry Dashboard" subtitle="Real-time Streaming Sensor Telemetry & MQTT Broker Feed" onRefresh={fetchTelemetry} />

        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6 custom-scrollbar">
          {/* Telemetry Stream Status */}
          <div style={{ backgroundColor: '#ffffff', borderColor: '#d1c5ab' }} className="border rounded-xl p-5 shadow-xs flex justify-between items-center">
            <div className="flex items-center gap-4">
              <span className="w-3 h-3 rounded-full bg-emerald-600 animate-ping" />
              <div>
                <h4 className="font-extrabold text-base">MQTT Telemetry Topic Stream: active</h4>
                <p style={{ color: '#4e4632' }} className="text-xs">Broker: mqtt.cat.nexus:1883 · Active Subscription: telemetry/#</p>
              </div>
            </div>

            <div className="flex gap-4 text-xs font-bold">
              <div><span style={{ color: '#80765f' }}>Throughput:</span> 12,402 msg/s</div>
              <div><span style={{ color: '#80765f' }}>Broker Latency:</span> 14ms</div>
            </div>
          </div>

          {/* Telemetry Sensor Stream Grid */}
          <div className="grid grid-cols-2 gap-6">
            {telemetry.map((t) => (
              <div key={t.equipmentId} style={{ backgroundColor: '#ffffff', borderColor: '#d1c5ab' }} className="border rounded-xl p-5 shadow-xs flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-extrabold text-base text-[#745b00]">EQ-{t.equipmentId} Telemetry Stream</h4>
                  <span style={{ backgroundColor: '#f7eddb', color: '#6f5800' }} className="px-2.5 py-1 rounded text-[10px] font-bold uppercase">
                    STREAMING
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div style={{ backgroundColor: '#fdf3e1' }} className="p-3 rounded-lg border border-[#d1c5ab]">
                    <span style={{ color: '#4e4632' }} className="text-[10px] font-bold uppercase block">Runtime Hours</span>
                    <span className="text-base font-black">{t.runtimeHours ? parseFloat(t.runtimeHours).toFixed(1) : '452.4'} hrs</span>
                  </div>
                  <div style={{ backgroundColor: '#fdf3e1' }} className="p-3 rounded-lg border border-[#d1c5ab]">
                    <span style={{ color: '#4e4632' }} className="text-[10px] font-bold uppercase block">Fuel Level</span>
                    <span className="text-base font-black">{t.fuelLevel ? parseFloat(t.fuelLevel).toFixed(1) : '85.0'} %</span>
                  </div>
                  <div style={{ backgroundColor: '#fdf3e1' }} className="p-3 rounded-lg border border-[#d1c5ab]">
                    <span style={{ color: '#4e4632' }} className="text-[10px] font-bold uppercase block">Idle Hours</span>
                    <span className="text-base font-black">{t.idleHours ? parseFloat(t.idleHours).toFixed(1) : '12.5'} hrs</span>
                  </div>
                </div>

                {/* Animated Sensor Frequency Bar */}
                <div className="h-16 flex items-end gap-1 pt-2">
                  {[40, 55, 60, 75, 80, 65, 90, 85, 70, 95, 80, 85].map((h, i) => (
                    <div key={i} style={{ height: `${h}%`, backgroundColor: '#745b00' }} className="flex-1 rounded-t-xs opacity-75 animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
