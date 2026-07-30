import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from '../components/AppLink';

// ── Types ────────────────────────────────────────────────────────────────────

interface FeatureForm {
  engineHoursPerDay: number;
  idleHoursPerDay: number;
  rentalDays: number;
  hasOperator: number;
  hasSite: number;
  idleRatio: number;
  equipmentId: string;
  equipmentType: string;
}

interface PredictResult {
  equipmentId?: string;
  isAnomaly: boolean;
  anomalyScore: number;
  confidence: string;
  message: string;
}

interface HealthState {
  reachable: boolean;
  status?: string;
  model_loaded?: boolean;
  model_meta?: Record<string, unknown> | null;
  error?: string;
  hint?: string;
}

interface HistoryItem {
  id: number;
  label: string;
  result: PredictResult;
  at: string;
}

// ── Presets (aligned with annomoly/training-data.csv distribution) ───────────

const PRESETS: Record<string, { label: string; desc: string; form: FeatureForm }> = {
  normal: {
    label: '🟢 Typical rental',
    desc: 'Matches training-data mean (~21 eng hrs/day, operator + site)',
    form: {
      engineHoursPerDay: 20.95,
      idleHoursPerDay: 3.13,
      rentalDays: 25,
      hasOperator: 1,
      hasSite: 1,
      idleRatio: 0.13,
      equipmentId: 'CAT-EX-1001',
      equipmentType: 'Excavator',
    },
  },
  high_util: {
    label: '⚡ High utilization',
    desc: 'Busy machine — high engine hours, low idle',
    form: {
      engineHoursPerDay: 26.5,
      idleHoursPerDay: 1.8,
      rentalDays: 25,
      hasOperator: 1,
      hasSite: 1,
      idleRatio: 0.064,
      equipmentId: 'CAT-BD-1002',
      equipmentType: 'Bulldozer',
    },
  },
  excessive_idle: {
    label: '⏸️ Excessive idle',
    desc: 'Low engine hours + high idle ratio (outlier vs training)',
    form: {
      engineHoursPerDay: 5.0,
      idleHoursPerDay: 10.0,
      rentalDays: 25,
      hasOperator: 1,
      hasSite: 1,
      idleRatio: 0.667,
      equipmentId: 'CAT-EX-1002',
      equipmentType: 'Excavator',
    },
  },
  no_operator: {
    label: '👤 No operator',
    desc: 'hasOperator=0 — never seen in training (strong outlier)',
    form: {
      engineHoursPerDay: 20.0,
      idleHoursPerDay: 3.0,
      rentalDays: 25,
      hasOperator: 0,
      hasSite: 1,
      idleRatio: 0.13,
      equipmentId: 'CAT-BD-1004',
      equipmentType: 'Bulldozer',
    },
  },
  no_site: {
    label: '🗺️ No site',
    desc: 'hasSite=0 — never seen in training (strong outlier)',
    form: {
      engineHoursPerDay: 18.0,
      idleHoursPerDay: 4.0,
      rentalDays: 25,
      hasOperator: 1,
      hasSite: 0,
      idleRatio: 0.182,
      equipmentId: 'CAT-DT-1003',
      equipmentType: 'Dump Truck',
    },
  },
  short_rental: {
    label: '📅 Short rental',
    desc: 'Very few rental days vs training (~25 days)',
    form: {
      engineHoursPerDay: 21.0,
      idleHoursPerDay: 3.1,
      rentalDays: 3,
      hasOperator: 1,
      hasSite: 1,
      idleRatio: 0.129,
      equipmentId: 'CAT-WL-1005',
      equipmentType: 'Wheel Loader',
    },
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number, isAnomaly: boolean): string {
  if (!isAnomaly) return 'var(--severity-resolved)';
  if (score >= 0.75) return 'var(--severity-critical)';
  if (score >= 0.6) return 'var(--severity-warning)';
  return 'var(--severity-info)';
}

function confidenceClass(c: string): string {
  if (c === 'HIGH') return 'CRITICAL';
  if (c === 'MEDIUM') return 'WARNING';
  return 'INFO';
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MlLabPage() {
  const [form, setForm] = useState<FeatureForm>(PRESETS.normal.form);
  const [preset, setPreset] = useState('normal');
  const [health, setHealth] = useState<HealthState | null>(null);
  const [scoring, setScoring] = useState(false);
  const [result, setResult] = useState<PredictResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [autoIdleRatio, setAutoIdleRatio] = useState(true);

  const meta = health?.model_meta as Record<string, unknown> | null | undefined;

  // Keep idleRatio consistent when engine/idle change
  useEffect(() => {
    if (!autoIdleRatio) return;
    const total = form.engineHoursPerDay + form.idleHoursPerDay;
    const ratio = total > 0 ? form.idleHoursPerDay / total : 1;
    setForm((f) =>
      Math.abs(f.idleRatio - ratio) < 0.0001
        ? f
        : { ...f, idleRatio: Math.round(ratio * 10000) / 10000 }
    );
  }, [form.engineHoursPerDay, form.idleHoursPerDay, autoIdleRatio]);

  const refreshHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/ml/health', { cache: 'no-store' });
      const data = await res.json();
      setHealth(data);
    } catch (e: unknown) {
      setHealth({
        reachable: false,
        error: e instanceof Error ? e.message : 'Failed to reach proxy',
        hint: 'Start ML server: npm run ml:server',
      });
    }
  }, []);

  useEffect(() => {
    refreshHealth();
    const t = setInterval(refreshHealth, 10000);
    return () => clearInterval(t);
  }, [refreshHealth]);

  const loadPreset = (key: string) => {
    setPreset(key);
    setForm({ ...PRESETS[key].form });
    setResult(null);
    setError(null);
  };

  const setField = <K extends keyof FeatureForm>(key: K, value: FeatureForm[K]) => {
    setPreset('custom');
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleScore = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setScoring(true);
    setError(null);
    setResult(null);

    const payload = {
      engineHoursPerDay: Number(form.engineHoursPerDay),
      idleHoursPerDay: Number(form.idleHoursPerDay),
      rentalDays: Number(form.rentalDays),
      hasOperator: Number(form.hasOperator),
      hasSite: Number(form.hasSite),
      idleRatio: Number(form.idleRatio),
      equipmentId: form.equipmentId,
      equipmentType: form.equipmentType,
    };

    try {
      const res = await fetch('/api/ml/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error ?? 'Predict failed');
        await refreshHealth();
        return;
      }

      const r = data.result as PredictResult;
      setResult(r);
      setHistory((h) =>
        [
          {
            id: Date.now(),
            label: preset === 'custom' ? 'Custom' : PRESETS[preset]?.label ?? preset,
            result: r,
            at: new Date().toLocaleTimeString(),
          },
          ...h,
        ].slice(0, 12)
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setScoring(false);
    }
  };

  const scorePct = useMemo(
    () => Math.round((result?.anomalyScore ?? 0) * 100),
    [result]
  );

  return (
    <div className="dashboard animate-in">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-brand">
          <div className="header-logo">ML</div>
          <div>
            <div className="header-title">Isolation Forest Lab</div>
            <div className="header-subtitle">
              Score rental usage patterns against the trained 6-feature model ·{' '}
              <Link to="/" style={{ color: 'var(--cat-yellow)' }}>
                ← Fleet dashboard
              </Link>
            </div>
          </div>
        </div>
        <div className="header-right">
          <Link to="/demand" className="nav-link-btn">
            Demand plan
          </Link>
          <Link to="/dealer/demand" className="nav-link-btn">
            Dealer view
          </Link>
          <div className={`live-badge ${health?.reachable && health?.model_loaded ? '' : 'offline'}`}>
            <div className="live-dot" />
            {health?.reachable
              ? health.model_loaded
                ? 'Model ready'
                : 'Server up · no model'
              : 'ML offline'}
          </div>
          <button className="refresh-btn" onClick={refreshHealth} type="button">
            Refresh status
          </button>
        </div>
      </header>

      {/* Model status cards */}
      <div className="stats-bar">
        <div className={`stat-card ${health?.reachable ? 'success' : 'critical'}`}>
          <div className={`stat-icon ${health?.reachable ? 'success' : 'critical'}`}>
            {health?.reachable ? '🟢' : '🔴'}
          </div>
          <div className="stat-content">
            <div className="stat-value" style={{ fontSize: '1.1rem' }}>
              {health?.reachable ? 'Online' : 'Offline'}
            </div>
            <div className="stat-label">ML Server :8000</div>
          </div>
        </div>
        <div className={`stat-card ${health?.model_loaded ? 'success' : 'warning'}`}>
          <div className={`stat-icon ${health?.model_loaded ? 'success' : 'warning'}`}>🌲</div>
          <div className="stat-content">
            <div className="stat-value" style={{ fontSize: '1.1rem' }}>
              {health?.model_loaded ? 'Loaded' : 'Missing'}
            </div>
            <div className="stat-label">Isolation Forest</div>
          </div>
        </div>
        <div className="stat-card info">
          <div className="stat-icon info">📊</div>
          <div className="stat-content">
            <div className="stat-value">
              {typeof meta?.n_samples === 'number' ? meta.n_samples : '—'}
            </div>
            <div className="stat-label">Training samples</div>
          </div>
        </div>
        <div className="stat-card warning">
          <div className="stat-icon warning">🌳</div>
          <div className="stat-content">
            <div className="stat-value">
              {typeof meta?.n_estimators === 'number' ? meta.n_estimators : '—'}
            </div>
            <div className="stat-label">Trees · cont. {String(meta?.contamination ?? '—')}</div>
          </div>
        </div>
      </div>

      {!health?.reachable && (
        <div className="ml-banner warn">
          <strong>ML server not reachable.</strong> Run{' '}
          <code>npm run ml:server</code> in another terminal, then refresh.
          {health?.error ? <span> ({health.error})</span> : null}
        </div>
      )}

      {health?.reachable && !health.model_loaded && (
        <div className="ml-banner warn">
          <strong>Server is up but no model is loaded.</strong> Run{' '}
          <code>npm run ml:train</code> then restart the server.
        </div>
      )}

      <div className="ml-lab-grid">
        {/* Left: form */}
        <section className="simulator-card">
          <div className="simulator-title">🧪 Feature vector (6-dim)</div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
            Model features from rental usage (not live MQTT sensors). Training data is
            mostly ~21 engine hrs/day, always operator+site, rentalDays≈25.
          </p>

          <div className="scenario-buttons">
            {Object.entries(PRESETS).map(([key, p]) => (
              <button
                key={key}
                type="button"
                className={`scenario-btn ${preset === key ? 'active' : ''}`}
                onClick={() => loadPreset(key)}
                title={p.desc}
              >
                {p.label}
              </button>
            ))}
          </div>

          {preset !== 'custom' && PRESETS[preset] && (
            <p className="ml-preset-desc">{PRESETS[preset].desc}</p>
          )}

          <form onSubmit={handleScore} className="simulator-form-grid">
            <div className="form-group">
              <label>Equipment ID</label>
              <input
                type="text"
                value={form.equipmentId}
                onChange={(e) => setField('equipmentId', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Equipment Type</label>
              <select
                value={form.equipmentType}
                onChange={(e) => setField('equipmentType', e.target.value)}
              >
                <option>Excavator</option>
                <option>Bulldozer</option>
                <option>Dump Truck</option>
                <option>Wheel Loader</option>
                <option>Crane</option>
              </select>
            </div>
            <div className="form-group">
              <label>Has Operator</label>
              <select
                value={form.hasOperator}
                onChange={(e) => setField('hasOperator', Number(e.target.value))}
              >
                <option value={1}>Yes (1)</option>
                <option value={0}>No (0)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Has Site</label>
              <select
                value={form.hasSite}
                onChange={(e) => setField('hasSite', Number(e.target.value))}
              >
                <option value={1}>Yes (1)</option>
                <option value={0}>No (0)</option>
              </select>
            </div>

            <div className="form-group">
              <label>
                Engine hrs / day
                <span className="val">{form.engineHoursPerDay.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min={0}
                max={30}
                step={0.1}
                value={form.engineHoursPerDay}
                onChange={(e) => setField('engineHoursPerDay', Number(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label>
                Idle hrs / day
                <span className="val">{form.idleHoursPerDay.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min={0}
                max={20}
                step={0.1}
                value={form.idleHoursPerDay}
                onChange={(e) => setField('idleHoursPerDay', Number(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label>
                Rental days
                <span className="val">{form.rentalDays}</span>
              </label>
              <input
                type="range"
                min={1}
                max={60}
                step={1}
                value={form.rentalDays}
                onChange={(e) => setField('rentalDays', Number(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label>
                Idle ratio
                <span className="val">{form.idleRatio.toFixed(4)}</span>
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.001}
                value={form.idleRatio}
                disabled={autoIdleRatio}
                onChange={(e) => setField('idleRatio', Number(e.target.value))}
              />
              <label className="ml-check">
                <input
                  type="checkbox"
                  checked={autoIdleRatio}
                  onChange={(e) => setAutoIdleRatio(e.target.checked)}
                />
                Auto = idle / (engine + idle)
              </label>
            </div>
          </form>

          <div className="simulator-actions">
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              POST /api/ml/predict → Python Isolation Forest
            </div>
            <button
              type="button"
              className="simulator-submit-btn"
              disabled={scoring || !health?.model_loaded}
              onClick={() => handleScore()}
            >
              {scoring ? 'Scoring…' : '🎯 Score vector'}
            </button>
          </div>
        </section>

        {/* Right: result + meta */}
        <div className="ml-side-col">
          <section className="simulator-card">
            <div className="simulator-title">📈 Score result</div>

            {error && (
              <div className="ml-banner warn" style={{ margin: 0 }}>
                {error}
              </div>
            )}

            {!result && !error && (
              <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                <div className="empty-state-icon">🌲</div>
                <div className="empty-state-title">No score yet</div>
                <div className="empty-state-desc">
                  Pick a preset or tweak sliders, then hit Score vector.
                </div>
              </div>
            )}

            {result && (
              <>
                <div
                  className="ml-score-ring"
                  style={{
                    ['--score-color' as string]: scoreColor(
                      result.anomalyScore,
                      result.isAnomaly
                    ),
                  }}
                >
                  <div className="ml-score-value">{scorePct}</div>
                  <div className="ml-score-unit">anomaly %</div>
                </div>

                <div className="result-details">
                  <div className="result-field">
                    <span className="result-field-label">Classification</span>
                    <span
                      className={`result-badge ${result.isAnomaly ? 'anomaly' : 'normal'}`}
                    >
                      {result.isAnomaly ? 'ANOMALY' : 'NORMAL'}
                    </span>
                  </div>
                  <div className="result-field">
                    <span className="result-field-label">Confidence</span>
                    <span className={`severity-badge ${confidenceClass(result.confidence)}`}>
                      <span className="badge-dot" />
                      {result.confidence}
                    </span>
                  </div>
                  <div className="result-field">
                    <span className="result-field-label">Equipment</span>
                    <span className="result-field-value">
                      {result.equipmentId ?? form.equipmentId}
                    </span>
                  </div>
                  <div className="result-field">
                    <span className="result-field-label">Score [0–1]</span>
                    <span className="result-field-value" style={{ fontFamily: 'var(--font-mono)' }}>
                      {result.anomalyScore.toFixed(4)}
                    </span>
                  </div>
                </div>

                <p className="ml-message">{result.message}</p>
              </>
            )}
          </section>

          <section className="simulator-card">
            <div className="simulator-title">ℹ️ Model metadata</div>
            <div className="result-details">
              <div className="result-field">
                <span className="result-field-label">Trained at</span>
                <span className="result-field-value">
                  {typeof meta?.trained_at === 'string'
                    ? new Date(meta.trained_at).toLocaleString()
                    : '—'}
                </span>
              </div>
              <div className="result-field">
                <span className="result-field-label">Decision threshold</span>
                <span className="result-field-value" style={{ fontFamily: 'var(--font-mono)' }}>
                  {typeof meta?.decision_threshold === 'number'
                    ? meta.decision_threshold.toFixed(6)
                    : '—'}
                </span>
              </div>
              <div className="result-field">
                <span className="result-field-label">Feature dim</span>
                <span className="result-field-value">
                  {String(meta?.feature_dim ?? 6)} ·{' '}
                  {Array.isArray(meta?.feature_cols)
                    ? (meta.feature_cols as string[]).join(', ')
                    : 'engineHoursPerDay, …'}
                </span>
              </div>
              <div className="result-field">
                <span className="result-field-label">Hold-out accuracy</span>
                <span className="result-field-value">
                  {meta?.metrics &&
                  typeof (meta.metrics as { accuracy?: number }).accuracy === 'number'
                    ? `${(((meta.metrics as { accuracy: number }).accuracy) * 100).toFixed(1)}%`
                    : '—'}
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <section className="simulator-card">
          <div className="simulator-title">🕒 Recent scores</div>
          <div className="alerts-table-wrapper">
            <table className="alerts-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Preset</th>
                  <th>Equipment</th>
                  <th>Result</th>
                  <th>Score</th>
                  <th>Confidence</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="timestamp">{h.at}</td>
                    <td>{h.label}</td>
                    <td className="equipment-id">{h.result.equipmentId ?? '—'}</td>
                    <td>
                      <span
                        className={`result-badge ${h.result.isAnomaly ? 'anomaly' : 'normal'}`}
                      >
                        {h.result.isAnomaly ? 'ANOMALY' : 'NORMAL'}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>
                      {h.result.anomalyScore.toFixed(3)}
                    </td>
                    <td>
                      <span className={`severity-badge ${confidenceClass(h.result.confidence)}`}>
                        <span className="badge-dot" />
                        {h.result.confidence}
                      </span>
                    </td>
                    <td className="alert-description">{h.result.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
