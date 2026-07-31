import { useCallback, useEffect, useState } from 'react';
import { demandPlatformApi } from '../../api/platform';
import type { JsonRecord } from '../../api/types';
import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';
import { FeedbackBanner, PageSkeleton } from '../../components/ui/Feedback';
import { getErrorMessage } from '../../hooks/useAsync';
import '../../styles/demand-operations.css';

type OperationMessage = {
  tone: 'success' | 'error';
  text: string;
};

function recordValue(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function textValue(value: unknown, fallback = 'Not reported') {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function stateLabel(value: unknown, yes: string, no: string) {
  return value === true ? yes : no;
}

export default function DemandOperations() {
  const [status, setStatus] = useState<JsonRecord | null>(null);
  const [metrics, setMetrics] = useState<JsonRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [operation, setOperation] = useState<'generate' | 'retrain' | null>(null);
  const [message, setMessage] = useState<OperationMessage | null>(null);

  const [generation, setGeneration] = useState({
    seed: 20260730,
    projectCount: 28,
    weeks: 52,
  });
  const [training, setTraining] = useState({
    seed: 20260730,
    nEstimators: 160,
    randomState: 42,
  });

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    const [statusResult, metricsResult] = await Promise.allSettled([
      demandPlatformApi.status(),
      demandPlatformApi.metrics(),
    ]);

    setStatus(statusResult.status === 'fulfilled' ? statusResult.value : null);
    setMetrics(metricsResult.status === 'fulfilled' ? metricsResult.value : null);

    if (statusResult.status === 'rejected' && metricsResult.status === 'rejected') {
      setLoadError(
        `Demand operations are unavailable. ${getErrorMessage(statusResult.reason)}`,
      );
    } else if (statusResult.status === 'rejected') {
      setLoadError(`Service status could not be loaded. ${getErrorMessage(statusResult.reason)}`);
    } else if (metricsResult.status === 'rejected') {
      setLoadError(
        `Model metrics could not be loaded. ${getErrorMessage(metricsResult.reason)}`,
      );
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  const generateSynthetic = async (event: React.FormEvent) => {
    event.preventDefault();
    setOperation('generate');
    setMessage(null);
    try {
      await demandPlatformApi.generateSynthetic(generation);
      setMessage({
        tone: 'success',
        text: 'Synthetic demand data generated. Service state has been refreshed.',
      });
      await loadSnapshot();
    } catch (error) {
      setMessage({ tone: 'error', text: getErrorMessage(error) });
    } finally {
      setOperation(null);
    }
  };

  const retrainModel = async (event: React.FormEvent) => {
    event.preventDefault();
    setOperation('retrain');
    setMessage(null);
    try {
      await demandPlatformApi.retrain(training);
      setMessage({
        tone: 'success',
        text: 'Demand model retraining completed. Model state has been refreshed.',
      });
      await loadSnapshot();
    } catch (error) {
      setMessage({ tone: 'error', text: getErrorMessage(error) });
    } finally {
      setOperation(null);
    }
  };

  const servingMethods = recordValue(status?.servingMethods ?? metrics?.servingMethods);
  const metricDetails = recordValue(metrics?.metrics);
  const warning = textValue(status?.warning ?? metricDetails.warning, '');
  const ready = status?.ready === true;

  return (
    <div className="demand-operations">
      <PageHeader
        title="Demand Operations"
        subtitle="Forecast service state, evidence, and controlled model lifecycle"
        actions={
          <button
            className="btn-secondary"
            type="button"
            onClick={() => void loadSnapshot()}
            disabled={loading || operation !== null}
          >
            {loading ? 'Refreshing…' : 'Refresh state'}
          </button>
        }
      />

      {loadError && <FeedbackBanner tone="error">{loadError}</FeedbackBanner>}
      {message && <FeedbackBanner tone={message.tone}>{message.text}</FeedbackBanner>}

      <Panel title="Operational state">
        {loading && !status && !metrics ? (
          <PageSkeleton rows={5} />
        ) : (
          <div aria-live="polite">
            <div className={`demand-operations__health ${ready ? 'is-ready' : 'is-attention'}`}>
              <span className="material-symbols-outlined" aria-hidden="true">
                {ready ? 'check_circle' : 'error'}
              </span>
              <div>
                <strong>{ready ? 'Forecast service ready' : 'Forecast service needs attention'}</strong>
                <span>{textValue(status?.service, 'Demand forecasting service')}</span>
              </div>
            </div>

            <dl className="demand-operations__state-list">
              <div>
                <dt>Data mode</dt>
                <dd>{textValue(status?.dataMode)}</dd>
              </div>
              <div>
                <dt>Model version</dt>
                <dd>{textValue(status?.modelVersion ?? metrics?.modelVersion)}</dd>
              </div>
              <div>
                <dt>Model artifact</dt>
                <dd>{stateLabel(status?.modelLoaded, 'Loaded', 'Not loaded')}</dd>
              </div>
              <div>
                <dt>Promotion state</dt>
                <dd>{stateLabel(status?.modelPromoted ?? metrics?.promoted, 'Promoted', 'Baseline or gated')}</dd>
              </div>
              <div>
                <dt>Units method</dt>
                <dd>{textValue(servingMethods.units)}</dd>
              </div>
              <div>
                <dt>Machine-hours method</dt>
                <dd>{textValue(servingMethods.machineHours)}</dd>
              </div>
              <div>
                <dt>Verification</dt>
                <dd>{textValue(metricDetails.verificationStatus, 'No verification status')}</dd>
              </div>
            </dl>
          </div>
        )}
      </Panel>

      {warning && (
        <FeedbackBanner tone="warning">
          <strong>Evidence boundary:</strong> {warning}
        </FeedbackBanner>
      )}

      <details className="demand-operations__maintenance">
        <summary>
          <span>
            <strong>Data and model maintenance</strong>
            <small>Generate deterministic demo data or retrain the demand artifact.</small>
          </span>
          <span className="material-symbols-outlined" aria-hidden="true">expand_more</span>
        </summary>

        <div className="demand-operations__actions">
          <form onSubmit={generateSynthetic}>
            <div>
              <h2>Generate synthetic demand data</h2>
              <p>
                Replaces the in-memory demo dataset used for planning verification. This does
                not create production customer-demand evidence.
              </p>
            </div>
            <div className="demand-operations__fields">
              <label className="field">
                <span>Seed</span>
                <input
                  type="number"
                  min={0}
                  value={generation.seed}
                  onChange={(event) =>
                    setGeneration((current) => ({
                      ...current,
                      seed: Number(event.target.value),
                    }))
                  }
                  required
                />
              </label>
              <label className="field">
                <span>Projects</span>
                <input
                  type="number"
                  min={20}
                  max={60}
                  value={generation.projectCount}
                  onChange={(event) =>
                    setGeneration((current) => ({
                      ...current,
                      projectCount: Number(event.target.value),
                    }))
                  }
                  required
                />
              </label>
              <label className="field">
                <span>History weeks</span>
                <input
                  type="number"
                  min={26}
                  max={104}
                  value={generation.weeks}
                  onChange={(event) =>
                    setGeneration((current) => ({
                      ...current,
                      weeks: Number(event.target.value),
                    }))
                  }
                  required
                />
              </label>
            </div>
            <button
              className="btn-secondary"
              type="submit"
              disabled={operation !== null || loading}
            >
              {operation === 'generate' ? 'Generating…' : 'Generate synthetic dataset'}
            </button>
          </form>

          <form onSubmit={retrainModel}>
            <div>
              <h2>Retrain demand model</h2>
              <p>
                Runs the model tournament and promotion gate against the configured demo data.
                Serving methods may remain on a baseline when a candidate does not pass.
              </p>
            </div>
            <div className="demand-operations__fields">
              <label className="field">
                <span>Seed</span>
                <input
                  type="number"
                  min={0}
                  value={training.seed}
                  onChange={(event) =>
                    setTraining((current) => ({
                      ...current,
                      seed: Number(event.target.value),
                    }))
                  }
                  required
                />
              </label>
              <label className="field">
                <span>Estimators</span>
                <input
                  type="number"
                  min={40}
                  max={500}
                  value={training.nEstimators}
                  onChange={(event) =>
                    setTraining((current) => ({
                      ...current,
                      nEstimators: Number(event.target.value),
                    }))
                  }
                  required
                />
              </label>
              <label className="field">
                <span>Random state</span>
                <input
                  type="number"
                  value={training.randomState}
                  onChange={(event) =>
                    setTraining((current) => ({
                      ...current,
                      randomState: Number(event.target.value),
                    }))
                  }
                  required
                />
              </label>
            </div>
            <button
              className="btn-primary"
              type="submit"
              disabled={operation !== null || loading}
            >
              {operation === 'retrain' ? 'Retraining…' : 'Retrain demand model'}
            </button>
          </form>
        </div>
      </details>
    </div>
  );
}
