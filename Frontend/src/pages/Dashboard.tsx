import { Link } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────
interface AnomalyAlert {
  alertId: number;
  equipmentId: string;
  equipmentType: string | null;
  siteId: string | null;
  operatorId: string | null;
  anomalyType: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  description: string;
  recommendation: string;
  triggerValue: string | null;
  thresholdValue: string | null;
  isResolved: boolean;
  resolvedAt: string | null;
  detectedAt: string;
}

interface TelemetrySnapshot {
  equipmentId: number;
  equipmentType: string | null;
  status: string | null;
  siteName: string;
  runtimeHours: string | null;
  idleHours: string | null;
  fuelLevel: string | null;
  recordedAt: string | null;
}

export default function DashboardPage() {
  const [alerts, setAlerts] = useState<AnomalyAlert[]>([]);
  const [fleet, setFleet] = useState<TelemetrySnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState('NX-8802');

  // ── Simulator state ──────────────────────────────────
  const [activeScenario, setActiveScenario] = useState<string>('normal');
  const [simulating, setSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any>(null);

  // Form parameters
  const [eqId, setEqId] = useState('CAT-EX-1001');
  const [eqType, setEqType] = useState('Excavator');
  const [engineStatus, setEngineStatus] = useState('ON');
  const [fuelLevel, setFuelLevel] = useState(85.0);
  const [engineHours, setEngineHours] = useState(452.4);
  const [idleHours, setIdleHours] = useState(12.5);
  const [speed, setSpeed] = useState(12);
  const [engineTemp, setEngineTemp] = useState(112.4);
  const [hydraulicPressure, setHydraulicPressure] = useState(42.1);
  const [batteryVoltage, setBatteryVoltage] = useState(13.6);
  const [loadPercentage, setLoadPercentage] = useState(60);
  const [vibrationLevel, setVibrationLevel] = useState(2.5);
  const [rentalStatus, setRentalStatus] = useState('Working');
  const [operatorId, setOperatorId] = useState('OP101');
  const [latitude, setLatitude] = useState(11.02453);
  const [longitude, setLongitude] = useState(76.93531);

  // ── Data fetching ────────────────────────────────────
  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch(`/api/alerts?resolved=false&limit=100`);
      const data = await res.json();
      if (data.success) setAlerts(data.alerts ?? []);
    } catch (e) {
      console.error('Failed to fetch alerts', e);
    }
  }, []);

  const fetchFleet = useCallback(async () => {
    try {
      const res = await fetch('/api/telemetry');
      const data = await res.json();
      if (data.success) setFleet(data.snapshot ?? []);
    } catch (e) {
      console.error('Failed to fetch telemetry', e);
    }
  }, []);

  const refresh = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      await Promise.all([fetchAlerts(), fetchFleet()]);
    } finally {
      if (manual) setRefreshing(false);
      setLoading(false);
    }
  }, [fetchAlerts, fetchFleet]);

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    const interval = setInterval(() => refresh(), 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  const resolveAlert = async (alertId: number) => {
    setResolvingId(alertId);
    try {
      await fetch('/api/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId }),
      });
      setAlerts((prev) => prev.filter((a) => a.alertId !== alertId));
    } finally {
      setResolvingId(null);
    }
  };

  const handleSimulateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSimulating(true);
    setSimulationResult(null);

    const payload = {
      timestamp: new Date().toISOString(),
      equipmentId: eqId,
      equipmentType: eqType,
      dealerId: 'D001',
      siteId: 'S003',
      operatorId: operatorId || null,
      engineStatus,
      fuelLevel: Number(fuelLevel),
      engineHours: Number(engineHours),
      idleHours: Number(idleHours),
      speed: Number(speed),
      latitude: Number(latitude),
      longitude: Number(longitude),
      engineTemperature: Number(engineTemp),
      hydraulicPressure: Number(hydraulicPressure),
      batteryVoltage: Number(batteryVoltage),
      loadPercentage: Number(loadPercentage),
      vibrationLevel: Number(vibrationLevel),
      rentalStatus,
    };

    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setSimulationResult(data);
      refresh(true);
    } catch (err: any) {
      setSimulationResult({ success: false, error: err.message });
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="bg-surface text-on-surface min-h-screen flex overflow-hidden w-full font-sans">
      <Sidebar />

      {/* Main Content Canvas */}
      <main className="flex-1 ml-64 flex flex-col h-screen overflow-hidden">

        {/* Top Navigation Bar */}
        <header className="flex justify-between items-center px-margin_desktop w-full h-16 border-b border-outline-variant bg-surface sticky top-0 z-50">
          <div className="flex items-center gap-6">
            <h2 className="font-headline-lg text-title-md font-bold text-primary tracking-tight">AI Anomaly Detection</h2>
            <div className="flex items-center gap-2 bg-surface-container px-3 py-1.5 rounded-lg border border-outline-variant">
              <span className="material-symbols-outlined text-primary text-sm">search</span>
              <input
                className="bg-transparent border-none focus:ring-0 text-body-md w-64 p-0 text-on-surface placeholder:text-on-surface-variant focus:outline-none"
                placeholder="Filter by Asset ID or Fleet..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="header-right">
          <Link to="/ml-lab" className="nav-link-btn">
            🌲 ML Lab
          </Link>
          <div className="live-badge">
            <div className="live-dot" />
            Live
          </div>
          <button
            className={`refresh-btn ${refreshing ? 'spinning' : ''}`}
            onClick={() => refresh(true)}
            title="Refresh now"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M8 16H3v5" />
            </svg>
            Refresh
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Center Analysis Area */}
        <section className="flex-1 overflow-y-auto p-8 flex flex-col gap-gutter custom-scrollbar">

          {/* Telemetry Pipeline Architecture Header */}
          <div className="bg-surface-container border border-outline-variant rounded-xl p-6 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-label-md text-[10px] uppercase text-primary mb-1">Architecture Status</span>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1 bg-surface-container-lowest border border-outline-variant rounded">
                  <span className="w-2 h-2 rounded-full bg-[#2E7D32]" />
                  <span className="font-label-md text-[12px] uppercase">MQTT Broker</span>
                </div>
                <div className="text-outline-variant">
                  <span className="material-symbols-outlined">arrow_forward</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-surface-container-lowest border border-outline-variant rounded">
                  <span className="w-2 h-2 rounded-full bg-[#2E7D32]" />
                  <span className="font-label-md text-[12px] uppercase">Rule Engine</span>
                </div>
                <div className="text-outline-variant">
                  <span className="material-symbols-outlined">arrow_forward</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-primary-container border border-primary rounded">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="font-label-md text-[12px] uppercase font-bold text-on-primary-container">Anomaly Engine v4.2</span>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="text-right">
                <p className="font-label-md text-[10px] uppercase text-on-surface-variant">Throughput</p>
                <p className="font-title-md text-xl font-bold">12,402 msg/s</p>
              </div>
              <div className="text-right border-l border-outline-variant pl-4">
                <p className="font-label-md text-[10px] uppercase text-on-surface-variant">Latency</p>
                <p className="font-title-md text-xl font-bold text-tertiary">14ms</p>
              </div>
            </div>
          </div>

          {/* Dimensional Latent Space Visualization */}
          <div className="grid grid-cols-12 gap-gutter flex-1 min-h-[500px]">
            <div className="col-span-8 bg-surface-container-lowest border border-outline-variant rounded-xl relative overflow-hidden flex flex-col">
              <div className="absolute top-4 left-6 z-10">
                <h3 className="font-title-md text-lg font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">bubble_chart</span>
                  Dimensional Latent Space
                </h3>
                <p className="font-label-md text-[11px] text-on-surface-variant uppercase mt-1">Stochastic Neighbor Embedding Visualization</p>
              </div>

              <div className="latent-grid w-full h-full relative flex items-center justify-center p-12">
                <div className="relative w-full h-full opacity-90">
                  {/* Normal Clusters */}
                  <div className="absolute top-[20%] left-[30%] w-32 h-32 bg-primary/10 rounded-full blur-xl pointer-events-none" />
                  <div className="absolute bottom-[30%] right-[25%] w-40 h-40 bg-tertiary/10 rounded-full blur-xl pointer-events-none" />

                  {/* Individual Normal Points */}
                  <div className="absolute top-[25%] left-[32%] w-2 h-2 rounded-full bg-primary" />
                  <div className="absolute top-[22%] left-[35%] w-2 h-2 rounded-full bg-primary" />
                  <div className="absolute top-[28%] left-[38%] w-2 h-2 rounded-full bg-primary" />
                  <div className="absolute top-[40%] left-[45%] w-2 h-2 rounded-full bg-tertiary" />
                  <div className="absolute bottom-[35%] right-[28%] w-2 h-2 rounded-full bg-tertiary" />

                  {/* Anomalies (Highlighted) */}
                  <div className="absolute top-[60%] left-[15%] group cursor-pointer" onClick={() => setSelectedAssetId('NX-8802')}>
                    <div className="w-4 h-4 rounded-full bg-error animate-ping absolute opacity-75" />
                    <div className="w-4 h-4 rounded-full bg-error relative border-2 border-white shadow-lg" />
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-inverse-surface text-inverse-on-surface text-[10px] px-2 py-1 rounded whitespace-nowrap opacity-100 shadow-md">
                      Asset NX-8802 (Pressure)
                    </div>
                  </div>

                  <div className="absolute top-[15%] right-[15%] group cursor-pointer" onClick={() => setSelectedAssetId('NX-9124')}>
                    <div className="w-4 h-4 rounded-full bg-error animate-ping absolute opacity-75" />
                    <div className="w-4 h-4 rounded-full bg-error relative border-2 border-white shadow-lg" />
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-inverse-surface text-inverse-on-surface text-[10px] px-2 py-1 rounded whitespace-nowrap opacity-100 shadow-md">
                      Asset NX-9124 (Temp)
                    </div>
                  </div>

                  {/* Axis Labels */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 font-label-md text-[10px] text-outline uppercase tracking-widest">Dimension Alpha (Temporal)</div>
                  <div className="absolute left-4 top-1/2 -rotate-90 origin-left -translate-y-1/2 font-label-md text-[10px] text-outline uppercase tracking-widest">Dimension Beta (Mechanical)</div>
                </div>
              </div>

              <div className="absolute bottom-4 right-6 flex gap-2">
                <button className="bg-surface-container px-3 py-1.5 rounded text-[11px] font-bold uppercase border border-outline-variant hover:bg-surface-container-high transition-colors cursor-pointer text-on-surface-variant">2D View</button>
                <button className="bg-surface-container px-3 py-1.5 rounded text-[11px] font-bold uppercase border border-outline-variant hover:bg-surface-container-high transition-colors cursor-pointer text-on-surface-variant">3D Mesh</button>
                <button className="bg-primary-container px-3 py-1.5 rounded text-[11px] font-bold uppercase border border-primary transition-colors cursor-pointer text-on-primary-container">Latent Legend</button>
              </div>
            </div>

            {/* Sidebar: Detection Log */}
            <div className="col-span-4 bg-surface-container-lowest border border-outline-variant rounded-xl flex flex-col overflow-hidden">
              <div className="p-4 border-b border-outline-variant flex justify-between items-center">
                <h3 className="font-title-md text-sm font-bold uppercase tracking-tight">Detection Log</h3>
                <span className="bg-error-container text-on-error-container text-[10px] font-black px-2 py-0.5 rounded">
                  {alerts.length || 2} CRITICAL
                </span>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="p-4 flex flex-col gap-3">

                  {/* Log Item 1 */}
                  <div className="p-3 border border-error bg-error-container/10 rounded-lg cursor-pointer hover:bg-error-container/20 transition-all" onClick={() => setSelectedAssetId('NX-8802')}>
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-label-md text-[11px] font-bold text-error uppercase">Hydraulic Failure Risk</span>
                      <span className="font-label-md text-[10px] text-on-surface-variant">09:42:15</span>
                    </div>
                    <p className="font-body-md text-sm font-bold mb-1">Asset: Excavator NX-8802</p>
                    <p className="font-body-md text-[12px] text-on-surface-variant">Deviation detected in Oil Pressure vs. RPM baseline. Probability: 89.2%</p>
                  </div>

                  {/* Log Item 2 */}
                  <div className="p-3 border border-outline-variant rounded-lg cursor-pointer hover:bg-surface-container transition-all" onClick={() => setSelectedAssetId('NX-9124')}>
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-label-md text-[11px] font-bold text-tertiary uppercase">Thermal Anomaly</span>
                      <span className="font-label-md text-[10px] text-on-surface-variant">09:38:02</span>
                    </div>
                    <p className="font-body-md text-sm font-bold mb-1">Asset: Truck NX-9124</p>
                    <p className="font-body-md text-[12px] text-on-surface-variant">Bearing temperature +15°C above expected operating curve.</p>
                  </div>

                  {/* Log Item 3 */}
                  <div className="p-3 border border-outline-variant rounded-lg cursor-pointer hover:bg-surface-container transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-label-md text-[11px] font-bold text-secondary uppercase">Sensor Drift</span>
                      <span className="font-label-md text-[10px] text-on-surface-variant">09:12:44</span>
                    </div>
                    <p className="font-body-md text-sm font-bold mb-1">Asset: Generator G-002</p>
                    <p className="font-body-md text-[12px] text-on-surface-variant">Vibration sensor SN-442 reporting inconsistent null-state values.</p>
                  </div>

                </div>
              </div>
              <button className="m-4 bg-surface-container py-2 rounded font-label-md text-[12px] uppercase font-bold border border-outline-variant hover:bg-surface-container-high cursor-pointer text-on-surface-variant">
                Export Log Archive
              </button>
            </div>
          </div>

          {/* Detail View Section */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-surface-container border border-outline-variant rounded flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-3xl">construction</span>
                </div>
                <div>
                  <h3 className="font-title-md text-xl font-bold">In-Depth Analysis: {selectedAssetId}</h3>
                  <p className="font-label-md text-[12px] text-on-surface-variant uppercase">Last Update: Real-time Streaming</p>
                </div>
              </div>
              <div className="flex gap-2">
                <span className="px-3 py-1 bg-[#ED6C02] text-white font-label-md text-[10px] rounded uppercase font-bold">Predictive Maintenance Required</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-8">
              {/* Chart: Temperature */}
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-end">
                  <span className="font-label-md text-[12px] uppercase text-on-surface-variant">Engine Temperature (°C)</span>
                  <span className="font-title-md text-lg font-black text-on-surface">112.4</span>
                </div>
                <div className="h-24 flex items-end gap-1">
                  <div className="flex-1 bg-primary/20 h-[60%] rounded-t-sm" />
                  <div className="flex-1 bg-primary/20 h-[65%] rounded-t-sm" />
                  <div className="flex-1 bg-primary/20 h-[70%] rounded-t-sm" />
                  <div className="flex-1 bg-primary/20 h-[68%] rounded-t-sm" />
                  <div className="flex-1 bg-primary/20 h-[75%] rounded-t-sm" />
                  <div className="flex-1 bg-[#ED6C02] h-[85%] rounded-t-sm" />
                  <div className="flex-1 bg-[#ba1a1a] h-[95%] rounded-t-sm animate-pulse" />
                  <div className="flex-1 bg-[#ba1a1a] h-[92%] rounded-t-sm" />
                </div>
              </div>

              {/* Chart: RPM */}
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-end">
                  <span className="font-label-md text-[12px] uppercase text-on-surface-variant">Core RPM (x1000)</span>
                  <span className="font-title-md text-lg font-black text-on-surface">18.2</span>
                </div>
                <div className="h-24 flex items-end gap-1">
                  <div className="flex-1 bg-tertiary/20 h-[80%] rounded-t-sm" />
                  <div className="flex-1 bg-tertiary/20 h-[82%] rounded-t-sm" />
                  <div className="flex-1 bg-tertiary/20 h-[78%] rounded-t-sm" />
                  <div className="flex-1 bg-tertiary/20 h-[80%] rounded-t-sm" />
                  <div className="flex-1 bg-tertiary/20 h-[81%] rounded-t-sm" />
                  <div className="flex-1 bg-tertiary/20 h-[79%] rounded-t-sm" />
                  <div className="flex-1 bg-tertiary/20 h-[82%] rounded-t-sm" />
                  <div className="flex-1 bg-tertiary/20 h-[80%] rounded-t-sm" />
                </div>
              </div>

              {/* Chart: Oil Pressure */}
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-end">
                  <span className="font-label-md text-[12px] uppercase text-on-surface-variant">Oil Pressure (PSI)</span>
                  <span className="font-title-md text-lg font-black text-error">42.1</span>
                </div>
                <div className="h-24 flex items-end gap-1">
                  <div className="flex-1 bg-on-surface-variant/20 h-[90%] rounded-t-sm" />
                  <div className="flex-1 bg-on-surface-variant/20 h-[88%] rounded-t-sm" />
                  <div className="flex-1 bg-on-surface-variant/20 h-[85%] rounded-t-sm" />
                  <div className="flex-1 bg-[#ba1a1a] h-[60%] rounded-t-sm" />
                  <div className="flex-1 bg-[#ba1a1a] h-[55%] rounded-t-sm" />
                  <div className="flex-1 bg-[#ba1a1a] h-[50%] rounded-t-sm" />
                  <div className="flex-1 bg-[#ba1a1a] h-[45%] rounded-t-sm animate-pulse" />
                  <div className="flex-1 bg-[#ba1a1a] h-[40%] rounded-t-sm" />
                </div>
              </div>
            </div>
          </div>

          {/* AI Recommendation Banner */}
          <div className="bg-primary-container text-on-primary-container p-6 rounded-xl border-2 border-primary flex items-center justify-between shadow-lg mb-4">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-full flex items-center justify-center border border-white/50">
                <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
              </div>
              <div>
                <h4 className="font-title-md text-lg font-black uppercase">AI Intervention Recommendation</h4>
                <p className="font-body-md text-on-primary-fixed-variant max-w-2xl mt-1">
                  Based on latent space deviation, <strong>{selectedAssetId}</strong> is exhibiting symptoms of early-stage hydraulic pump cavitation. Recommend immediate shutdown and seal replacement within 12 operating hours to prevent catastrophic failure.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button className="bg-on-primary-container text-white px-6 py-3 rounded-xl font-bold uppercase text-[12px] hover:opacity-90 transition-all cursor-pointer">
                Schedule Repair
              </button>
              <button className="bg-transparent border-2 border-on-primary-container text-on-primary-container px-6 py-3 rounded-xl font-bold uppercase text-[12px] hover:bg-on-primary-container hover:text-white transition-all cursor-pointer">
                Ignore Alert
              </button>
            </div>
          </div>

          {/* Ingest Simulation Form Card */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-xs flex flex-col gap-4">
            <h3 className="font-title-md text-base font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">tune</span>
              Live Telemetry Ingestion Simulator & Rule Tester
            </h3>

            <form onSubmit={handleSimulateSubmit} className="grid grid-cols-4 gap-4 text-xs">
              <div>
                <label className="font-bold block mb-1 text-on-surface-variant">Equipment ID</label>
                <input
                  type="text"
                  value={eqId}
                  onChange={(e) => setEqId(e.target.value)}
                  className="w-full p-2 border border-outline-variant bg-surface-container-low rounded focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="font-bold block mb-1 text-on-surface-variant">Equipment Type</label>
                <select
                  value={eqType}
                  onChange={(e) => setEqType(e.target.value)}
                  className="w-full p-2 border border-outline-variant bg-surface-container-low rounded focus:outline-none"
                >
                  <option value="Excavator">Excavator</option>
                  <option value="Bulldozer">Bulldozer</option>
                  <option value="Dump Truck">Dump Truck</option>
                </select>
              </div>

              <div>
                <label className="font-bold block mb-1 text-on-surface-variant">Engine Temp (°C)</label>
                <input
                  type="number"
                  value={engineTemp}
                  onChange={(e) => setEngineTemp(Number(e.target.value))}
                  className="w-full p-2 border border-outline-variant bg-surface-container-low rounded focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold block mb-1 text-on-surface-variant">Oil Pressure (PSI)</label>
                <input
                  type="number"
                  value={hydraulicPressure}
                  onChange={(e) => setHydraulicPressure(Number(e.target.value))}
                  className="w-full p-2 border border-outline-variant bg-surface-container-low rounded focus:outline-none"
                />
              </div>

              <div className="col-span-4 flex justify-between items-center pt-2">
                <p className="text-[11px] text-on-surface-variant">
                  *Publishes payload to MQTT topic telemetry/CAT-EX-1001 and triggers hybrid isolation evaluation.
                </p>
                <button
                  type="submit"
                  disabled={simulating}
                  className="bg-primary text-white px-6 py-2.5 rounded-lg font-bold uppercase text-xs hover:opacity-90 cursor-pointer shadow-xs"
                >
                  {simulating ? 'Ingesting...' : '🚀 Ingest Payload'}
                </button>
              </div>
            </form>

            {simulationResult && (
              <div className="bg-surface-container-low border border-outline-variant p-4 rounded-lg text-xs">
                <p className="font-bold text-primary">Ingestion Result: {simulationResult.success ? '✅ Success' : '❌ Failed'}</p>
              </div>
            )}
          </div>

        </section>
      </div>
    </main>
    </div >
  );
}
