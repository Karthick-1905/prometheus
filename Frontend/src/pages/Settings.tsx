import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

export default function SettingsPage() {
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [smsNotifs, setSmsNotifs] = useState(true);
  const [thresholdTemp, setThresholdTemp] = useState(105);

  return (
    <div style={{ backgroundColor: '#fff8f0', color: '#1f1b10' }} className="min-h-screen flex overflow-hidden font-sans">
      <Sidebar />
      <main className="flex-1 ml-64 flex flex-col h-screen overflow-hidden">
        <Header title="Platform Settings & Profile" subtitle="Marcus Chen · Operations & Telemetry Credentials" />

        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6 custom-scrollbar">
          {/* User Profile Info */}
          <div style={{ backgroundColor: '#ffffff', borderColor: '#d1c5ab' }} className="border rounded-xl p-6 shadow-xs flex items-center gap-5">
            <div style={{ backgroundColor: '#ffcd11', color: '#6f5800' }} className="w-16 h-16 rounded-full flex items-center justify-center font-black text-xl border">
              MC
            </div>
            <div>
              <h3 className="text-xl font-bold">Marcus Chen</h3>
              <p style={{ color: '#4e4632' }} className="text-xs">Fleet Operations Director · marcus.chen@nexus-fleet.com</p>
              <p style={{ color: '#80765f' }} className="text-[11px] font-bold mt-1">Role: Administrator · Access: Full Fleet Write</p>
            </div>
          </div>

          {/* Configuration Form Sections */}
          <div className="grid grid-cols-2 gap-6 text-xs">
            {/* Notification Preferences */}
            <div style={{ backgroundColor: '#ffffff', borderColor: '#d1c5ab' }} className="border rounded-xl p-6 shadow-xs flex flex-col gap-4">
              <h4 className="text-base font-bold">Notification & Escalation Preferences</h4>
              <div className="flex justify-between items-center py-2 border-b border-[#d1c5ab]/40">
                <div>
                  <p className="font-bold">Email Alerts for Critical Faults</p>
                  <p style={{ color: '#4e4632' }}>Instant notification on CRITICAL anomaly triggers</p>
                </div>
                <input
                  type="checkbox"
                  checked={emailNotifs}
                  onChange={(e) => setEmailNotifs(e.target.checked)}
                  className="accent-[#745b00] w-4 h-4"
                />
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[#d1c5ab]/40">
                <div>
                  <p className="font-bold">SMS Mobile Notifications</p>
                  <p style={{ color: '#4e4632' }}>Send SMS to +1 (555) 019-2831 on hydraulic alerts</p>
                </div>
                <input
                  type="checkbox"
                  checked={smsNotifs}
                  onChange={(e) => setSmsNotifs(e.target.checked)}
                  className="accent-[#745b00] w-4 h-4"
                />
              </div>
            </div>

            {/* Threshold Settings */}
            <div style={{ backgroundColor: '#ffffff', borderColor: '#d1c5ab' }} className="border rounded-xl p-6 shadow-xs flex flex-col gap-4">
              <h4 className="text-base font-bold">Global Anomaly Threshold Rules</h4>
              <div>
                <div className="flex justify-between mb-1">
                  <label style={{ color: '#4e4632' }} className="font-bold">Engine Overheat Threshold (°C)</label>
                  <span style={{ color: '#745b00' }} className="font-bold">{thresholdTemp} °C</span>
                </div>
                <input
                  type="range"
                  min="80"
                  max="130"
                  value={thresholdTemp}
                  onChange={(e) => setThresholdTemp(Number(e.target.value))}
                  className="w-full accent-[#745b00]"
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
