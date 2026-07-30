'use client';

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

type SeverityFilter = 'ALL' | 'CRITICAL' | 'WARNING' | 'INFO';

// ─── Helpers ─────────────────────────────────────────────
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function formatAnomalyType(type: string): string {
  return type.replace(/_/g, ' ');
}

function getStatusColor(status: string | null): string {
  switch (status) {
    case 'RENTED':      return 'RENTED';
    case 'AVAILABLE':   return 'AVAILABLE';
    case 'MAINTENANCE': return 'MAINTENANCE';
    default:            return 'AVAILABLE';
  }
}

// ─── Component ───────────────────────────────────────────
export default function DashboardPage() {
  const [alerts, setAlerts] = useState<AnomalyAlert[]>([]);
  const [fleet, setFleet] = useState<TelemetrySnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<SeverityFilter>('ALL');
  const [showResolved, setShowResolved] = useState(false);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

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
  const [engineTemp, setEngineTemp] = useState(83);
  const [hydraulicPressure, setHydraulicPressure] = useState(165);
  const [batteryVoltage, setBatteryVoltage] = useState(13.6);
  const [loadPercentage, setLoadPercentage] = useState(60);
  const [vibrationLevel, setVibrationLevel] = useState(2.5);
  const [rentalStatus, setRentalStatus] = useState('Working');
  const [operatorId, setOperatorId] = useState('OP101');
  const [latitude, setLatitude] = useState(11.02453);
  const [longitude, setLongitude] = useState(76.93531);

  // ── Data fetching ────────────────────────────────────
  const fetchAlerts = useCallback(async (resolved = false) => {
    const res = await fetch(`/api/alerts?resolved=${resolved}&limit=100`);
    const data = await res.json();
    if (data.success) setAlerts(data.alerts ?? []);
  }, []);

  const fetchFleet = useCallback(async () => {
    const res = await fetch('/api/telemetry');
    const data = await res.json();
    if (data.success) setFleet(data.snapshot ?? []);
  }, []);

  const refresh = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      await Promise.all([fetchAlerts(showResolved), fetchFleet()]);
      setLastUpdated(new Date());
    } finally {
      if (manual) setRefreshing(false);
      setLoading(false);
    }
  }, [fetchAlerts, fetchFleet, showResolved]);

  // Initial load
  useEffect(() => { refresh(); }, []);

  // Auto-refresh every 5s
  useEffect(() => {
    const interval = setInterval(() => refresh(), 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Re-fetch when resolved filter changes
  useEffect(() => { fetchAlerts(showResolved); }, [showResolved, fetchAlerts]);

  // ── Resolve alert ────────────────────────────────────
  const resolveAlert = async (alertId: number) => {
    setResolvingId(alertId);
    try {
      await fetch('/api/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId }),
      });
      setAlerts((prev) =>
        prev.map((a) =>
          a.alertId === alertId
            ? { ...a, isResolved: true, resolvedAt: new Date().toISOString() }
            : a
        )
      );
    } finally {
      setResolvingId(null);
    }
  };

  // ── Load scenario preset ─────────────────────────────
  const loadPreset = (name: string) => {
    setActiveScenario(name);
    const presets: Record<string, any> = {
      normal: {
        equipmentId: 'CAT-EX-1001',
        equipmentType: 'Excavator',
        engineStatus: 'ON',
        fuelLevel: 85.0,
        engineHours: 452.4,
        idleHours: 12.5,
        speed: 12,
        engineTemperature: 83,
        hydraulicPressure: 165,
        batteryVoltage: 13.6,
        loadPercentage: 60,
        vibrationLevel: 2.5,
        rentalStatus: 'Working',
        operatorId: 'OP101',
        latitude: 11.02453,
        longitude: 76.93531,
      },
      overheat: {
        equipmentId: 'CAT-EX-1001',
        equipmentType: 'Excavator',
        engineStatus: 'ON',
        fuelLevel: 72.0,
        engineHours: 453.1,
        idleHours: 12.5,
        speed: 15,
        engineTemperature: 112, // Engine overheat threshold is 105
        hydraulicPressure: 210,
        batteryVoltage: 13.1,
        loadPercentage: 92,
        vibrationLevel: 8.5,
        rentalStatus: 'Working',
        operatorId: 'OP101',
        latitude: 11.02453,
        longitude: 76.93531,
      },
      vibration: {
        equipmentId: 'CAT-EX-1001',
        equipmentType: 'Excavator',
        engineStatus: 'ON',
        fuelLevel: 68.0,
        engineHours: 453.5,
        idleHours: 12.5,
        speed: 8,
        engineTemperature: 98,
        hydraulicPressure: 220,
        batteryVoltage: 13.2,
        loadPercentage: 95, // vibration trigger needs load >= 90 and vib > 15
        vibrationLevel: 22.4, // severe vibration threshold
        rentalStatus: 'Working',
        operatorId: 'OP101',
        latitude: 11.02453,
        longitude: 76.93531,
      },
      fuel_theft: {
        equipmentId: 'CAT-EX-1001',
        equipmentType: 'Excavator',
        engineStatus: 'OFF',
        fuelLevel: 15.0, // fuel drop > 10%
        engineHours: 452.4,
        idleHours: 12.5,
        speed: 0,
        engineTemperature: 35,
        hydraulicPressure: 10,
        batteryVoltage: 12.4,
        loadPercentage: 0,
        vibrationLevel: 0.2,
        rentalStatus: 'Working',
        operatorId: 'OP101',
        latitude: 11.02453,
        longitude: 76.93531,
      },
      geofence: {
        equipmentId: 'CAT-EX-1001',
        equipmentType: 'Excavator',
        engineStatus: 'ON',
        fuelLevel: 81.0,
        engineHours: 454.0,
        idleHours: 12.5,
        speed: 22,
        engineTemperature: 85,
        hydraulicPressure: 170,
        batteryVoltage: 13.5,
        loadPercentage: 55,
        vibrationLevel: 2.1,
        rentalStatus: 'Working',
        operatorId: 'OP101',
        latitude: 11.15000, // outside geofence radius
        longitude: 76.80000,
      },
      unassigned: {
        equipmentId: 'CAT-EX-1001',
        equipmentType: 'Excavator',
        engineStatus: 'ON',
        fuelLevel: 84.5,
        engineHours: 452.8,
        idleHours: 12.5,
        speed: 5,
        engineTemperature: 78,
        hydraulicPressure: 150,
        batteryVoltage: 13.6,
        loadPercentage: 40,
        vibrationLevel: 1.8,
        rentalStatus: 'Working',
        operatorId: '', // Engine on, no operator
        latitude: 11.02453,
        longitude: 76.93531,
      },
    };

    const p = presets[name];
    if (!p) return;
    setEqId(p.equipmentId);
    setEqType(p.equipmentType);
    setEngineStatus(p.engineStatus);
    setFuelLevel(p.fuelLevel);
    setEngineHours(p.engineHours);
    setIdleHours(p.idleHours);
    setSpeed(p.speed);
    setEngineTemp(p.engineTemperature);
    setHydraulicPressure(p.hydraulicPressure);
    setBatteryVoltage(p.batteryVoltage);
    setLoadPercentage(p.loadPercentage);
    setVibrationLevel(p.vibrationLevel);
    setRentalStatus(p.rentalStatus);
    setOperatorId(p.operatorId);
    setLatitude(p.latitude);
    setLongitude(p.longitude);
  };

  // ── Ingest Simulation Telemetry ───────────────────────
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

  // ── Derived stats ─────────────────────────────────────
  const activeAlerts    = alerts.filter((a) => !a.isResolved);
  const criticalAlerts  = activeAlerts.filter((a) => a.severity === 'CRITICAL');
  const idleEquipment   = fleet.filter((f) => f.status === 'AVAILABLE');

  const filteredAlerts = activeAlerts.filter(
    (a) => filter === 'ALL' || a.severity === filter
  );

  return (
    <div className="dashboard animate-in">

      {/* ── Header ── */}
      <header className="dashboard-header">
        <div className="header-brand">
          <div className="header-logo">CAT</div>
          <div>
            <div className="header-title">Fleet Anomaly Monitor</div>
            <div className="header-subtitle">
              Smart Rental Tracking · Real-Time Detection ·{' '}
              {lastUpdated ? `Last updated: ${formatTime(lastUpdated.toISOString())}` : 'Connecting...'}
            </div>
          </div>
        </div>
        <div className="header-right">
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

      {/* ── Stats Bar ── */}
      <div className="stats-bar">
        <div className="stat-card success">
          <div className="stat-icon success">🚛</div>
          <div className="stat-content">
            <div className="stat-value">{fleet.length}</div>
            <div className="stat-label">Total Equipment</div>
          </div>
        </div>
        <div className="stat-card critical">
          <div className="stat-icon critical">🚨</div>
          <div className="stat-content">
            <div className="stat-value">{activeAlerts.length}</div>
            <div className="stat-label">Active Alerts</div>
          </div>
        </div>
        <div className="stat-card warning">
          <div className="stat-icon warning">⚠️</div>
          <div className="stat-content">
            <div className="stat-value">{criticalAlerts.length}</div>
            <div className="stat-label">Critical Alerts</div>
          </div>
        </div>
        <div className="stat-card info">
          <div className="stat-icon info">⏸️</div>
          <div className="stat-content">
            <div className="stat-value">{idleEquipment.length}</div>
            <div className="stat-label">Idle / Available</div>
          </div>
        </div>
      </div>

      {/* ── Alerts Panel ── */}
      <section>
        <div className="section-header">
          <div className="section-title">
            🚨 Anomaly Alerts
            <span>{filteredAlerts.length} {showResolved ? 'resolved' : 'active'}</span>
          </div>
          <div className="section-actions">
            <div className="filter-tabs">
              {(['ALL', 'CRITICAL', 'WARNING', 'INFO'] as SeverityFilter[]).map((f) => (
                <button
                  key={f}
                  className={`filter-tab ${filter === f ? 'active' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>
            <button
              className={`filter-tab ${showResolved ? 'active' : ''}`}
              onClick={() => setShowResolved((v) => !v)}
              style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}
            >
              {showResolved ? '✅ Resolved' : '⏳ Active'}
            </button>
          </div>
        </div>

        <div className="alerts-panel">
          <div className="alerts-table-wrapper">
            <table className="alerts-table">
              <thead>
                <tr>
                  <th>Equipment</th>
                  <th>Severity</th>
                  <th>Anomaly Type</th>
                  <th>Description</th>
                  <th>Recommendation</th>
                  <th>Trigger</th>
                  <th>Site</th>
                  <th>Detected</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr className="loading-row">
                    <td colSpan={9}>⏳ Loading alerts...</td>
                  </tr>
                ) : filteredAlerts.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <div className="empty-state">
                        <div className="empty-state-icon">✅</div>
                        <div className="empty-state-title">No {filter !== 'ALL' ? filter.toLowerCase() : ''} alerts</div>
                        <div className="empty-state-desc">
                          All equipment is operating within normal parameters.
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredAlerts.map((alert) => (
                    <tr key={alert.alertId} className={alert.isResolved ? 'resolved' : ''}>
                      <td>
                        <div className="equipment-cell">
                          <div className="equipment-id">{alert.equipmentId}</div>
                          <div className="equipment-type">{alert.equipmentType ?? '—'}</div>
                        </div>
                      </td>
                      <td>
                        <span className={`severity-badge ${alert.severity}`}>
                          <span className="badge-dot" />
                          {alert.severity}
                        </span>
                      </td>
                      <td>
                        <span className="anomaly-type-tag">
                          {formatAnomalyType(alert.anomalyType)}
                        </span>
                      </td>
                      <td>
                        <div className="alert-description">{alert.description}</div>
                      </td>
                      <td>
                        <div className="alert-recommendation">{alert.recommendation}</div>
                      </td>
                      <td>
                        <div className="trigger-value">{alert.triggerValue ?? '—'}</div>
                      </td>
                      <td>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                          {alert.siteId ?? 'N/A'}
                        </span>
                      </td>
                      <td>
                        <div className="timestamp">
                          <div>{formatDate(alert.detectedAt)}</div>
                          <div>{formatTime(alert.detectedAt)}</div>
                        </div>
                      </td>
                      <td>
                        <button
                          className="resolve-btn"
                          disabled={alert.isResolved || resolvingId === alert.alertId}
                          onClick={() => resolveAlert(alert.alertId)}
                        >
                          {resolvingId === alert.alertId ? '...' : alert.isResolved ? 'Resolved' : 'Resolve'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Fleet Simulator & ML Testing Panel ── */}
      <section className="simulator-card">
        <div className="simulator-title">
          🧪 Fleet Simulator & ML Testing Panel
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0' }}>
          Instantly publish custom telemetry payloads. Checks deterministic boundaries and invokes the Python Isolation Forest ML model in real-time.
        </p>

        {/* Preset scenario tabs */}
        <div className="scenario-buttons">
          <button
            type="button"
            className={`scenario-btn ${activeScenario === 'normal' ? 'active' : ''}`}
            onClick={() => loadPreset('normal')}
          >
            🟢 Normal Excavator
          </button>
          <button
            type="button"
            className={`scenario-btn ${activeScenario === 'overheat' ? 'active' : ''}`}
            onClick={() => loadPreset('overheat')}
          >
            🔥 Overheat Anomaly (Rule + ML)
          </button>
          <button
            type="button"
            className={`scenario-btn ${activeScenario === 'vibration' ? 'active' : ''}`}
            onClick={() => loadPreset('vibration')}
          >
            ⚡ Severe Vibration (Rule + ML)
          </button>
          <button
            type="button"
            className={`scenario-btn ${activeScenario === 'fuel_theft' ? 'active' : ''}`}
            onClick={() => loadPreset('fuel_theft')}
          >
            ⛽ Fuel Theft Anomaly (Rule + ML)
          </button>
          <button
            type="button"
            className={`scenario-btn ${activeScenario === 'geofence' ? 'active' : ''}`}
            onClick={() => loadPreset('geofence')}
          >
            🗺️ Geofence Violation (Rule)
          </button>
          <button
            type="button"
            className={`scenario-btn ${activeScenario === 'unassigned' ? 'active' : ''}`}
            onClick={() => loadPreset('unassigned')}
          >
            👤 Unassigned Operator (Rule)
          </button>
        </div>

        {/* Form controls */}
        <form onSubmit={handleSimulateSubmit} className="simulator-form-grid">
          <div className="form-group">
            <label>Equipment ID</label>
            <input type="text" value={eqId} onChange={(e) => setEqId(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Equipment Type</label>
            <select value={eqType} onChange={(e) => setEqType(e.target.value)}>
              <option value="Excavator">Excavator</option>
              <option value="Bulldozer">Bulldozer</option>
              <option value="Dump Truck">Dump Truck</option>
              <option value="Crane">Crane</option>
            </select>
          </div>
          <div className="form-group">
            <label>Engine Status</label>
            <select value={engineStatus} onChange={(e) => setEngineStatus(e.target.value)}>
              <option value="ON">ON</option>
              <option value="OFF">OFF</option>
            </select>
          </div>
          <div className="form-group">
            <label>Operator ID</label>
            <input type="text" value={operatorId} onChange={(e) => setOperatorId(e.target.value)} placeholder="None" />
          </div>

          <div className="form-group">
            <label>
              Temperature
              <span className="val">{engineTemp} °C</span>
            </label>
            <input
              type="range"
              min="20"
              max="150"
              value={engineTemp}
              onChange={(e) => setEngineTemp(Number(e.target.value))}
            />
          </div>
          <div className="form-group">
            <label>
              Vibration Level
              <span className="val">{vibrationLevel} mm/s</span>
            </label>
            <input
              type="range"
              min="0"
              max="35"
              step="0.1"
              value={vibrationLevel}
              onChange={(e) => setVibrationLevel(Number(e.target.value))}
            />
          </div>
          <div className="form-group">
            <label>
              Fuel Level
              <span className="val">{fuelLevel} %</span>
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="0.5"
              value={fuelLevel}
              onChange={(e) => setFuelLevel(Number(e.target.value))}
            />
          </div>
          <div className="form-group">
            <label>
              Engine Load
              <span className="val">{loadPercentage} %</span>
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={loadPercentage}
              onChange={(e) => setLoadPercentage(Number(e.target.value))}
            />
          </div>

          <div className="form-group">
            <label>Hydraulic Pressure (PSI)</label>
            <input type="number" value={hydraulicPressure} onChange={(e) => setHydraulicPressure(Number(e.target.value))} />
          </div>
          <div className="form-group">
            <label>Battery Voltage (V)</label>
            <input type="number" step="0.1" value={batteryVoltage} onChange={(e) => setBatteryVoltage(Number(e.target.value))} />
          </div>
          <div className="form-group">
            <label>Latitude</label>
            <input type="number" step="0.00001" value={latitude} onChange={(e) => setLatitude(Number(e.target.value))} />
          </div>
          <div className="form-group">
            <label>Longitude</label>
            <input type="number" step="0.00001" value={longitude} onChange={(e) => setLongitude(Number(e.target.value))} />
          </div>
        </form>

        <div className="simulator-actions">
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            *Publish simulates MQTT topic telemetry/CAT-EX-1001 (falls back to direct DB/ML ingestion if broker is offline).
          </div>
          <button
            type="submit"
            onClick={handleSimulateSubmit}
            disabled={simulating}
            className="simulator-submit-btn"
          >
            {simulating ? 'Processing...' : '🚀 Ingest & Test Telemetry'}
          </button>
        </div>

        {/* Results output */}
        {simulationResult && (
          <div className="simulator-results-panel">
            <div className="result-header">
              <span>Simulation Ingestion Report</span>
              <span className={`result-badge ${simulationResult.success ? 'normal' : 'anomaly'}`}>
                {simulationResult.success ? 'Success' : 'Ingestion Error'}
              </span>
            </div>

            <div className="result-details">
              <div className="result-field">
                <span className="result-field-label">MQTT Broker Pub</span>
                <span className="result-field-value">
                  {simulationResult.mqttPublished ? '🟢 Online & Sent' : '🔴 Offline (Direct fallback)'}
                </span>
              </div>
              <div className="result-field">
                <span className="result-field-label">Parser & Zod Status</span>
                <span className="result-field-value">
                  {simulationResult.success ? '✅ Passed Validation' : `❌ Validation Failed: ${simulationResult.error}`}
                </span>
              </div>
              <div className="result-field">
                <span className="result-field-label">Prisma Neon DB Sync</span>
                <span className="result-field-value">
                  {simulationResult.success && simulationResult.result?.equipmentId ? 'Stored to Neon DB' : 'Skipped / DB Error'}
                </span>
              </div>
              <div className="result-field">
                <span className="result-field-label">Anomaly Pipeline</span>
                <span className="result-field-value" style={{ color: 'var(--cat-yellow)', fontWeight: 'bold' }}>
                  Triggered Hybrid Checks
                </span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Fleet Status Grid ── */}
      <section>
        <div className="section-header">
          <div className="section-title">
            🚛 Fleet Status
            <span>{fleet.length} machines</span>
          </div>
        </div>

        {fleet.length === 0 && !loading ? (
          <div className="empty-state" style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>
            <div className="empty-state-icon">📡</div>
            <div className="empty-state-title">No telemetry data yet</div>
            <div className="empty-state-desc">
              Start the MQTT publisher and ingestion service to see live fleet data here.
            </div>
          </div>
        ) : (
          <div className="fleet-grid">
            {fleet.map((eq) => {
              const fuelPct = eq.fuelLevel ? Math.min(100, parseFloat(eq.fuelLevel)) : 0;
              const alertsForEq = activeAlerts.filter((a) => a.equipmentId === String(eq.equipmentId));
              const hasCritical = alertsForEq.some((a) => a.severity === 'CRITICAL');

              return (
                <div
                  key={eq.equipmentId}
                  className="fleet-card"
                  style={{
                    ['--card-accent' as any]: hasCritical ? 'var(--severity-critical)' : 'var(--cat-yellow)',
                    borderColor: hasCritical ? 'var(--severity-critical-border)' : undefined,
                  }}
                >
                  <div className="fleet-card-header">
                    <div>
                      <div className="fleet-eq-id">EQ-{eq.equipmentId}</div>
                      <div className="fleet-eq-type">{eq.equipmentType ?? 'Unknown'}</div>
                    </div>
                    <span className={`status-pill ${getStatusColor(eq.status)}`}>
                      {eq.status ?? 'UNKNOWN'}
                    </span>
                  </div>

                  <div className="fleet-metrics">
                    <div className="fleet-metric">
                      <div className="fleet-metric-label">Runtime Hrs</div>
                      <div className="fleet-metric-value">
                        {eq.runtimeHours ? parseFloat(eq.runtimeHours).toFixed(1) : '—'}
                      </div>
                    </div>
                    <div className="fleet-metric">
                      <div className="fleet-metric-label">Idle Hrs</div>
                      <div className="fleet-metric-value">
                        {eq.idleHours ? parseFloat(eq.idleHours).toFixed(1) : '—'}
                      </div>
                    </div>
                    <div className="fleet-metric">
                      <div className="fleet-metric-label">Site</div>
                      <div className="fleet-metric-value" style={{ fontSize: '0.75rem' }}>
                        {eq.siteName}
                      </div>
                    </div>
                    <div className="fleet-metric">
                      <div className="fleet-metric-label">Alerts</div>
                      <div className="fleet-metric-value" style={{ color: hasCritical ? 'var(--severity-critical)' : 'var(--text-secondary)' }}>
                        {alertsForEq.length > 0 ? `⚠ ${alertsForEq.length}` : '✓ Clear'}
                      </div>
                    </div>
                  </div>

                  <div className="fuel-bar-wrapper">
                    <div className="fuel-bar-label">
                      <span>Fuel Consumed</span>
                      <span>{fuelPct.toFixed(1)} L</span>
                    </div>
                    <div className="fuel-bar-track">
                      <div
                        className="fuel-bar-fill"
                        style={{ width: `${Math.min(100, fuelPct)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

    </div>
  );
}
