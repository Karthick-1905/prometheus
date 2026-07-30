import { useParams, Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

export default function EquipmentDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const machineId = id || 'CAT-EX-1001';

  return (
    <div style={{ backgroundColor: '#fff8f0', color: '#1f1b10' }} className="min-h-screen flex overflow-hidden font-sans">
      <Sidebar />
      <main className="flex-1 ml-64 flex flex-col h-screen overflow-hidden">
        <Header title={`Equipment Telemetry & Details: ${machineId}`} subtitle="Deep Diagnostic Telemetry & Operational Analytics" />

        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6 custom-scrollbar">
          {/* Top Unit Banner */}
          <div style={{ backgroundColor: '#ffffff', borderColor: '#d1c5ab' }} className="border rounded-xl p-6 shadow-xs flex justify-between items-center">
            <div className="flex items-center gap-5">
              <div style={{ backgroundColor: '#ffcd11', color: '#6f5800' }} className="w-16 h-16 rounded-xl flex items-center justify-center font-black text-xl border">
                336
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-black">{machineId} · CAT 336 Excavator</h3>
                  <span style={{ backgroundColor: '#ffcd11', color: '#6f5800' }} className="px-3 py-0.5 rounded text-[10px] font-bold uppercase">
                    Status: WORKING
                  </span>
                </div>
                <p style={{ color: '#4e4632' }} className="text-xs mt-1">
                  Site Location: Mining Site S003 · Operator: Marcus Vance (OP101) · Firmware v2.4.1
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Link to="/anomalies" style={{ backgroundColor: '#745b00', color: '#ffffff' }} className="px-4 py-2 rounded-lg font-bold text-xs uppercase no-underline shadow-xs">
                Check Anomalies
              </Link>
              <Link to="/equipment" style={{ borderColor: '#d1c5ab', color: '#1f1b10' }} className="border px-4 py-2 rounded-lg font-bold text-xs uppercase no-underline hover:bg-[#f7eddb]">
                Back to Catalog
              </Link>
            </div>
          </div>

          {/* Telemetry Gauge Cards */}
          <div className="grid grid-cols-4 gap-6">
            <div style={{ backgroundColor: '#ffffff', borderColor: '#d1c5ab' }} className="border rounded-xl p-5 shadow-xs flex flex-col gap-2">
              <span style={{ color: '#4e4632' }} className="text-xs font-bold uppercase">Engine Temperature</span>
              <p className="text-2xl font-black text-[#1f1b10]">83.5 °C</p>
              <span style={{ color: '#2e7d32' }} className="text-[11px] font-bold">🟢 Normal Operating Band</span>
            </div>

            <div style={{ backgroundColor: '#ffffff', borderColor: '#d1c5ab' }} className="border rounded-xl p-5 shadow-xs flex flex-col gap-2">
              <span style={{ color: '#4e4632' }} className="text-xs font-bold uppercase">Hydraulic Pressure</span>
              <p className="text-2xl font-black text-[#1f1b10]">165.0 PSI</p>
              <span style={{ color: '#2e7d32' }} className="text-[11px] font-bold">🟢 Optimal Pressure</span>
            </div>

            <div style={{ backgroundColor: '#ffffff', borderColor: '#d1c5ab' }} className="border rounded-xl p-5 shadow-xs flex flex-col gap-2">
              <span style={{ color: '#4e4632' }} className="text-xs font-bold uppercase">Vibration Level</span>
              <p className="text-2xl font-black text-[#1f1b10]">2.5 mm/s</p>
              <span style={{ color: '#2e7d32' }} className="text-[11px] font-bold">🟢 Low Mechanical Noise</span>
            </div>

            <div style={{ backgroundColor: '#ffffff', borderColor: '#d1c5ab' }} className="border rounded-xl p-5 shadow-xs flex flex-col gap-2">
              <span style={{ color: '#4e4632' }} className="text-xs font-bold uppercase">Battery Voltage</span>
              <p className="text-2xl font-black text-[#1f1b10]">13.6 V</p>
              <span style={{ color: '#2e7d32' }} className="text-[11px] font-bold">🟢 Charging Normal</span>
            </div>
          </div>

          {/* Diagnostic Log */}
          <div style={{ backgroundColor: '#ffffff', borderColor: '#d1c5ab' }} className="border rounded-xl p-6 shadow-xs flex flex-col gap-4">
            <h4 className="text-base font-bold">Historical Maintenance & Inspection Logs</h4>
            <div className="divide-y divide-[#d1c5ab]/40 text-xs">
              <div className="py-3 flex justify-between">
                <div>
                  <p className="font-bold">Scheduled 500-Hour Hydraulic Fluid Replacement</p>
                  <p style={{ color: '#4e4632' }}>Completed at Site S003 by Field Tech Team Alpha</p>
                </div>
                <span style={{ color: '#80765f' }} className="font-bold">2026-07-15</span>
              </div>
              <div className="py-3 flex justify-between">
                <div>
                  <p className="font-bold">Vibration Sensor Calibration Check</p>
                  <p style={{ color: '#4e4632' }}>Telemetry node SN-442 recalibrated</p>
                </div>
                <span style={{ color: '#80765f' }} className="font-bold">2026-06-28</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
