import { Link } from 'react-router-dom';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

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

// ── Presets ──────────────────────────────────────────────────────────────────

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

// ── Component ────────────────────────────────────────────────────────────────

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
    <div style={{ backgroundColor: '#fff8f0', color: '#1f1b10' }} className="min-h-screen flex overflow-hidden font-sans">
      
      {/* ── Side Navigation Shell ── */}
      <aside style={{ backgroundColor: '#fdf3e1', borderColor: '#d1c5ab' }} className="h-screen w-64 fixed left-0 top-0 border-r flex flex-col py-6 px-4 gap-2 z-40">
        <div className="mb-6 px-2">
          <h1 style={{ color: '#1f1b10' }} className="text-2xl font-black tracking-tight flex items-center gap-2">
            <span className="material-symbols-outlined text-3xl" style={{ color: '#745b00' }}>construction</span>
            Nexus
          </h1>
          <p style={{ color: '#4e4632' }} className="text-[11px] font-bold uppercase tracking-wider opacity-80">Industrial Fleet Hub</p>
        </div>

        <nav className="flex-1 flex flex-col gap-1 overflow-y-auto custom-scrollbar">
          <Link
            to="/"
            style={{ color: '#4e4632' }}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-xs uppercase font-semibold hover:bg-[#f7eddb] transition-all"
          >
            <span className="material-symbols-outlined">warning</span>
            AI Anomalies
          </Link>
          <Link
            to="/ml-lab"
            style={{ backgroundColor: '#ffcd11', color: '#6f5800', borderColor: '#745b00' }}
            className="flex items-center gap-3 px-4 py-3 rounded-lg border font-bold text-xs uppercase transition-all shadow-sm"
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>science</span>
            ML Isolation Lab
          </Link>
        </nav>

        {/* User Profile */}
        <div style={{ borderColor: '#d1c5ab' }} className="mt-auto p-3 flex items-center gap-3 border-t pt-4">
          <div style={{ backgroundColor: '#ffcd11', color: '#6f5800' }} className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm">
            MC
          </div>
          <div>
            <p style={{ color: '#1f1b10' }} className="text-sm font-bold leading-tight">Marcus Chen</p>
            <p style={{ color: '#4e4632' }} className="text-[10px] font-semibold uppercase">Fleet Director</p>
          </div>
        </div>
      </aside>

      {/* ── Main Canvas ── */}
      <main className="flex-1 ml-64 flex flex-col h-screen overflow-hidden">
        
        {/* Top Header */}
        <header style={{ backgroundColor: '#fff8f0', borderColor: '#d1c5ab' }} className="flex justify-between items-center px-8 w-full h-16 border-b sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <h2 style={{ color: '#745b00' }} className="text-xl font-bold tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-2xl">science</span>
              Isolation Forest ML Model Lab
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <div
              style={{
                backgroundColor: health?.reachable && health?.model_loaded ? '#fdf3e1' : '#ffdad6',
                color: health?.reachable && health?.model_loaded ? '#006874' : '#ba1a1a',
                borderColor: '#d1c5ab',
              }}
              className="flex items-center gap-2 px-3 py-1 rounded border text-xs font-bold"
            >
              <span className={`w-2 h-2 rounded-full ${health?.reachable && health?.model_loaded ? 'bg-emerald-600' : 'bg-red-600'}`} />
              {health?.reachable ? (health.model_loaded ? 'Isolation Forest Ready' : 'Model Missing') : 'ML Server Offline'}
            </div>

            <button
              onClick={refreshHealth}
              style={{ backgroundColor: '#f7eddb', borderColor: '#d1c5ab', color: '#4e4632' }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border hover:bg-[#f1e7d5] transition-colors text-xs font-bold uppercase cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">sync</span>
              Refresh Status
            </button>
          </div>
        </header>

        {/* Content Workspace */}
        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6 custom-scrollbar">
          
          {/* Model Status Metrics Bar */}
          <div className="grid grid-cols-4 gap-6">
            <div style={{ backgroundColor: '#ffffff', borderColor: '#d1c5ab' }} className="border rounded-xl p-4 shadow-xs flex items-center gap-4">
              <div style={{ backgroundColor: health?.reachable ? '#ffcd11' : '#ffdad6' }} className="w-12 h-12 rounded-lg flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-2xl" style={{ color: health?.reachable ? '#6f5800' : '#ba1a1a' }}>dns</span>
              </div>
              <div>
                <p style={{ color: '#4e4632' }} className="text-[10px] font-bold uppercase">ML Server :8000</p>
                <p className="text-base font-extrabold">{health?.reachable ? 'Online' : 'Offline'}</p>
              </div>
            </div>

            <div style={{ backgroundColor: '#ffffff', borderColor: '#d1c5ab' }} className="border rounded-xl p-4 shadow-xs flex items-center gap-4">
              <div style={{ backgroundColor: '#f7eddb' }} className="w-12 h-12 rounded-lg flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-2xl" style={{ color: '#745b00' }}>park</span>
              </div>
              <div>
                <p style={{ color: '#4e4632' }} className="text-[10px] font-bold uppercase">Isolation Forest</p>
                <p className="text-base font-extrabold">{health?.model_loaded ? 'Model Loaded' : 'Not Loaded'}</p>
              </div>
            </div>

            <div style={{ backgroundColor: '#ffffff', borderColor: '#d1c5ab' }} className="border rounded-xl p-4 shadow-xs flex items-center gap-4">
              <div style={{ backgroundColor: '#f7eddb' }} className="w-12 h-12 rounded-lg flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-2xl" style={{ color: '#006874' }}>analytics</span>
              </div>
              <div>
                <p style={{ color: '#4e4632' }} className="text-[10px] font-bold uppercase">Training Samples</p>
                <p className="text-base font-extrabold">{typeof meta?.n_samples === 'number' ? meta.n_samples : '—'}</p>
              </div>
            </div>

            <div style={{ backgroundColor: '#ffffff', borderColor: '#d1c5ab' }} className="border rounded-xl p-4 shadow-xs flex items-center gap-4">
              <div style={{ backgroundColor: '#f7eddb' }} className="w-12 h-12 rounded-lg flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-2xl" style={{ color: '#745b00' }}>account_tree</span>
              </div>
              <div>
                <p style={{ color: '#4e4632' }} className="text-[10px] font-bold uppercase">Trees / Contamination</p>
                <p className="text-base font-extrabold">{typeof meta?.n_estimators === 'number' ? meta.n_estimators : '100'} ({String(meta?.contamination ?? '0.05')})</p>
              </div>
            </div>
          </div>

          {/* Form & Score Results Layout */}
          <div className="grid grid-cols-12 gap-6">
            
            {/* 6-Feature Form */}
            <div style={{ backgroundColor: '#ffffff', borderColor: '#d1c5ab' }} className="col-span-7 border rounded-xl p-6 shadow-xs flex flex-col gap-4">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined" style={{ color: '#745b00' }}>tune</span>
                  Feature Vector Input (6 Dimensions)
                </h3>
                <p style={{ color: '#4e4632' }} className="text-xs">
                  Model features extracted from rental usage patterns. Score feature vectors against the trained scikit-learn model.
                </p>
              </div>

              {/* Presets */}
              <div className="flex flex-wrap gap-2">
                {Object.entries(PRESETS).map(([key, p]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => loadPreset(key)}
                    style={{
                      backgroundColor: preset === key ? '#ffcd11' : '#f7eddb',
                      borderColor: preset === key ? '#745b00' : '#d1c5ab',
                      color: preset === key ? '#6f5800' : '#1f1b10',
                    }}
                    className="px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer"
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <form onSubmit={handleScore} className="grid grid-cols-2 gap-4 text-xs mt-2">
                <div>
                  <label style={{ color: '#4e4632' }} className="font-bold block mb-1">Equipment ID</label>
                  <input
                    type="text"
                    value={form.equipmentId}
                    onChange={(e) => setField('equipmentId', e.target.value)}
                    style={{ backgroundColor: '#fdf3e1', borderColor: '#d1c5ab' }}
                    className="w-full p-2 border rounded focus:outline-none"
                  />
                </div>

                <div>
                  <label style={{ color: '#4e4632' }} className="font-bold block mb-1">Equipment Type</label>
                  <select
                    value={form.equipmentType}
                    onChange={(e) => setField('equipmentType', e.target.value)}
                    style={{ backgroundColor: '#fdf3e1', borderColor: '#d1c5ab' }}
                    className="w-full p-2 border rounded focus:outline-none"
                  >
                    <option>Excavator</option>
                    <option>Bulldozer</option>
                    <option>Dump Truck</option>
                    <option>Wheel Loader</option>
                    <option>Crane</option>
                  </select>
                </div>

                <div>
                  <label style={{ color: '#4e4632' }} className="font-bold block mb-1">Has Operator</label>
                  <select
                    value={form.hasOperator}
                    onChange={(e) => setField('hasOperator', Number(e.target.value))}
                    style={{ backgroundColor: '#fdf3e1', borderColor: '#d1c5ab' }}
                    className="w-full p-2 border rounded focus:outline-none"
                  >
                    <option value={1}>Yes (1)</option>
                    <option value={0}>No (0)</option>
                  </select>
                </div>

                <div>
                  <label style={{ color: '#4e4632' }} className="font-bold block mb-1">Has Site</label>
                  <select
                    value={form.hasSite}
                    onChange={(e) => setField('hasSite', Number(e.target.value))}
                    style={{ backgroundColor: '#fdf3e1', borderColor: '#d1c5ab' }}
                    className="w-full p-2 border rounded focus:outline-none"
                  >
                    <option value={1}>Yes (1)</option>
                    <option value={0}>No (0)</option>
                  </select>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <label style={{ color: '#4e4632' }} className="font-bold">Engine Hrs / Day</label>
                    <span style={{ color: '#745b00' }} className="font-bold">{form.engineHoursPerDay.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={30}
                    step={0.1}
                    value={form.engineHoursPerDay}
                    onChange={(e) => setField('engineHoursPerDay', Number(e.target.value))}
                    className="w-full accent-[#745b00]"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <label style={{ color: '#4e4632' }} className="font-bold">Idle Hrs / Day</label>
                    <span style={{ color: '#745b00' }} className="font-bold">{form.idleHoursPerDay.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={20}
                    step={0.1}
                    value={form.idleHoursPerDay}
                    onChange={(e) => setField('idleHoursPerDay', Number(e.target.value))}
                    className="w-full accent-[#745b00]"
                  />
                </div>

                <div className="col-span-2 pt-2 flex justify-between items-center">
                  <p style={{ color: '#80765f' }} className="text-[11px]">
                    POST /api/ml/predict → Ingests vector into FastAPI Python service.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleScore()}
                    disabled={scoring || !health?.model_loaded}
                    style={{ backgroundColor: '#745b00', color: '#ffffff' }}
                    className="px-6 py-2.5 rounded-lg font-bold uppercase text-xs hover:opacity-90 cursor-pointer shadow-xs"
                  >
                    {scoring ? 'Scoring Vector...' : '🎯 Score Feature Vector'}
                  </button>
                </div>
              </form>
            </div>

            {/* Score Output & Metadata */}
            <div className="col-span-5 flex flex-col gap-6">
              
              {/* Score Gauge Result */}
              <div style={{ backgroundColor: '#ffffff', borderColor: '#d1c5ab' }} className="border rounded-xl p-6 shadow-xs flex flex-col gap-4">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined" style={{ color: '#745b00' }}>assessment</span>
                  Prediction Output
                </h3>

                {result ? (
                  <div style={{ backgroundColor: '#fdf3e1', borderColor: '#d1c5ab' }} className="p-5 border rounded-xl flex flex-col items-center gap-3">
                    <div
                      style={{
                        backgroundColor: result.isAnomaly ? '#ffdad6' : '#f7eddb',
                        borderColor: result.isAnomaly ? '#ba1a1a' : '#2e7d32',
                        color: result.isAnomaly ? '#ba1a1a' : '#2e7d32',
                      }}
                      className="w-24 h-24 rounded-full border-4 flex flex-col items-center justify-center shadow-xs"
                    >
                      <span className="text-3xl font-black">{scorePct}%</span>
                      <span className="text-[9px] font-bold uppercase tracking-wider">Score</span>
                    </div>

                    <div className="text-center">
                      <span
                        style={{
                          backgroundColor: result.isAnomaly ? '#ba1a1a' : '#2e7d32',
                          color: '#ffffff',
                        }}
                        className="px-3 py-1 rounded text-xs font-black uppercase"
                      >
                        {result.isAnomaly ? 'ANOMALY DETECTED' : 'NORMAL PATTERN'}
                      </span>
                      <p className="text-xs font-bold mt-2 text-[#1f1b10]">{result.message}</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-[#80765f]">
                    <span className="material-symbols-outlined text-4xl mb-1 text-[#d1c5ab]">radar</span>
                    <p className="font-bold">No prediction score yet</p>
                    <p className="text-[10px] mt-0.5">Select a feature preset and click Score Feature Vector.</p>
                  </div>
                )}
              </div>

            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
