import { useEffect, useState } from 'react';
import { demandPlatformApi, systemApi } from '../../api/platform';
import type { JsonRecord } from '../../api/types';
import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';
import { FeedbackBanner, PageSkeleton } from '../../components/ui/Feedback';
import { getErrorMessage } from '../../hooks/useAsync';

function JsonResult({ value }: { value: unknown }) {
  if (!value) return null;
  return <pre className="json-result">{JSON.stringify(value, null, 2)}</pre>;
}

function OperationForm({
  title,
  description,
  initial,
  actionLabel,
  run,
}: {
  title: string;
  description: string;
  initial: JsonRecord;
  actionLabel: string;
  run: (body: JsonRecord) => Promise<unknown>;
}) {
  const [body, setBody] = useState(() => JSON.stringify(initial, null, 2));
  const [result, setResult] = useState<unknown>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const execute = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const parsed = JSON.parse(body) as JsonRecord;
      const response = await run(parsed);
      setResult(response);
      setMessage({ tone: 'success', text: `${title} completed successfully.` });
    } catch (error) {
      setMessage({ tone: 'error', text: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="operation-block">
      <div><h3>{title}</h3><p>{description}</p></div>
      <label className="field">
        <span>Request body</span>
        <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={7} spellCheck={false} />
      </label>
      <button type="button" className="btn-primary" onClick={execute} disabled={loading}>
        {loading ? 'Working…' : actionLabel}
      </button>
      {message && <FeedbackBanner tone={message.tone}>{message.text}</FeedbackBanner>}
      <JsonResult value={result} />
    </section>
  );
}

export default function SystemOperations() {
  const [checks, setChecks] = useState<Array<{ name: string; ok: boolean; detail: unknown }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [legacyType, setLegacyType] = useState('Excavator');
  const [legacyHorizon, setLegacyHorizon] = useState(7);
  const [legacy, setLegacy] = useState<unknown>(null);

  const loadChecks = async () => {
    setLoading(true);
    setError(null);
    const operations = [
      ['Service catalog', systemApi.root],
      ['Application health', systemApi.health],
      ['Anomaly model health', systemApi.mlHealth],
      ['Anomaly model status', systemApi.mlStatus],
      ['Demand service status', demandPlatformApi.status],
      ['Demand model metrics', demandPlatformApi.metrics],
    ] as const;
    const settled = await Promise.allSettled(operations.map(([, loader]) => loader()));
    setChecks(
      settled.map((item, index) => ({
        name: operations[index][0],
        ok: item.status === 'fulfilled',
        detail: item.status === 'fulfilled' ? item.value : getErrorMessage(item.reason),
      })),
    );
    if (settled.every((item) => item.status === 'rejected')) {
      setError('No backend system endpoint could be reached. Confirm the API server is running.');
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadChecks();
  }, []);

  const runLegacy = async () => {
    setError(null);
    try {
      setLegacy(await demandPlatformApi.legacyForecast(legacyType, legacyHorizon));
    } catch (reason) {
      setError(getErrorMessage(reason));
    }
  };

  return (
    <div>
      <PageHeader
        title="System & ML Operations"
        subtitle="Service health, anomaly inference, telemetry simulation, and model lifecycle"
        actions={<button className="btn-secondary" type="button" onClick={loadChecks}>Run all checks</button>}
      />
      {error && <FeedbackBanner tone="error">{error}</FeedbackBanner>}
      <Panel title="Backend readiness">
        {loading ? <PageSkeleton rows={6} /> : (
          <div className="readiness-grid">
            {checks.map((check) => (
              <details key={check.name} className={check.ok ? 'check-ok' : 'check-error'}>
                <summary>
                  <span className="material-symbols-outlined">{check.ok ? 'check_circle' : 'error'}</span>
                  <strong>{check.name}</strong>
                  <span>{check.ok ? 'Available' : 'Needs attention'}</span>
                </summary>
                <JsonResult value={check.detail} />
              </details>
            ))}
          </div>
        )}
      </Panel>

      <div className="operations-grid">
        <Panel title="Anomaly inference">
          <OperationForm
            title="Predict anomaly"
            description="Run the loaded Isolation Forest against a six-feature rental usage vector."
            actionLabel="Run prediction"
            initial={{ engineHoursPerDay: 8, idleHoursPerDay: 1, rentalDays: 12, hasOperator: 1, hasSite: 1, idleRatio: 0.11, equipmentId: '1', equipmentType: 'Excavator' }}
            run={systemApi.predict}
          />
        </Panel>
        <Panel title="Telemetry ingestion">
          <OperationForm
            title="Simulate telemetry"
            description="Send a complete telemetry sample through storage and anomaly evaluation."
            actionLabel="Send telemetry"
            initial={{ equipmentId: '1', equipmentType: 'Excavator', engineStatus: 'ON', fuelLevel: 72, engineHours: 1280, idleHours: 114, speed: 3, engineTemperature: 84, hydraulicPressure: 230, batteryVoltage: 24.2, loadPercentage: 61, vibrationLevel: 2.1, rentalStatus: 'Working' }}
            run={systemApi.simulate}
          />
        </Panel>
        <Panel title="Anomaly model lifecycle">
          <OperationForm
            title="Train anomaly model"
            description="Train and atomically reload the anomaly model. The backend validates sample and contamination limits."
            actionLabel="Train model"
            initial={{ csv_path: null, n_estimators: 200, contamination: 0.02, random_state: 42 }}
            run={systemApi.train}
          />
        </Panel>
        <Panel title="Demand data lifecycle">
          <OperationForm
            title="Generate synthetic demand data"
            description="Create a deterministic planning dataset for demos and verification."
            actionLabel="Generate dataset"
            initial={{ seed: 20260730, projectCount: 28, weeks: 52 }}
            run={demandPlatformApi.generateSynthetic}
          />
          <OperationForm
            title="Retrain demand model"
            description="Benchmark and promote demand forecasting models using the current dataset."
            actionLabel="Retrain demand model"
            initial={{ seed: 20260730, nEstimators: 160, randomState: 42 }}
            run={demandPlatformApi.retrain}
          />
        </Panel>
      </div>

      <Panel title="Legacy forecast compatibility" className="mt-4">
        <div className="inline-form">
          <label className="field"><span>Equipment type</span><input value={legacyType} onChange={(event) => setLegacyType(event.target.value)} /></label>
          <label className="field"><span>Horizon (days)</span><input type="number" min={1} max={28} value={legacyHorizon} onChange={(event) => setLegacyHorizon(Number(event.target.value))} /></label>
          <button className="btn-secondary" type="button" onClick={runLegacy}>Run compatibility forecast</button>
        </div>
        <JsonResult value={legacy} />
      </Panel>
    </div>
  );
}
