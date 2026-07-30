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

function getSeverityIcon(severity: string): string {
  switch (severity) {
    case 'CRITICAL': return '🔴';
    case 'WARNING':  return '🟡';
    case 'INFO':     return '🔵';
    default:         return '⚪';
  }
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

  // ── Derived stats ─────────────────────────────────────
  const activeAlerts    = alerts.filter((a) => !a.isResolved);
  const criticalAlerts  = activeAlerts.filter((a) => a.severity === 'CRITICAL');
  const idleEquipment   = fleet.filter((f) => f.status === 'AVAILABLE');

  const filteredAlerts = activeAlerts.filter(
    (a) => filter === 'ALL' || a.severity === filter
  );

  // ─── Render ──────────────────────────────────────────
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
            {/* Severity filter tabs */}
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
            {/* Resolved toggle */}
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
