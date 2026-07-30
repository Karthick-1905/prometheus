import { useState } from 'react';
import { alertApi } from '../../api/platform';
import type { Alert } from '../../api/types';
import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';
import StatusBadge from '../../components/ui/StatusBadge';
import { EmptyState, FeedbackBanner, PageSkeleton } from '../../components/ui/Feedback';
import { getErrorMessage, useAsync } from '../../hooks/useAsync';

export default function FleetAnomalyDetection() {
  const [resolved, setResolved] = useState(false);
  const [severity, setSeverity] = useState('');
  const [selected, setSelected] = useState<Alert | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const resource = useAsync(async () => {
    const [list, summary, legacy, legacySummary] = await Promise.all([
      alertApi.list({ resolved, severity: severity || undefined, limit: 200 }),
      alertApi.summary(),
      alertApi.legacyList(resolved, 200),
      alertApi.legacySummary(),
    ]);
    return { alerts: list.data, summary, legacyCount: legacy.alerts.length, legacySummary };
  }, [resolved, severity]);

  const inspect = async (alert: Alert) => {
    setActionError(null);
    try {
      setSelected((await alertApi.detail(alert.alertId)).data);
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  };

  const resolve = async (alert: Alert, legacy = false) => {
    setActionError(null);
    try {
      if (legacy) await alertApi.legacyResolve(alert.alertId);
      else await alertApi.resolve(alert.alertId);
      setNotice(`Alert #${alert.alertId} resolved${legacy ? ' through the compatibility API' : ''}.`);
      setSelected(null);
      await resource.reload();
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  };

  return (
    <div>
      <PageHeader title="Anomaly Detection" subtitle="Open-alert triage, detail, recommendations, and resolution" />
      {notice && <FeedbackBanner tone="success" onDismiss={() => setNotice(null)}>{notice}</FeedbackBanner>}
      {(resource.error || actionError) && <FeedbackBanner tone="error">{resource.error ?? actionError}</FeedbackBanner>}
      <div className="toolbar">
        <label className="field"><span>Resolution state</span><select value={resolved ? 'resolved' : 'open'} onChange={(event) => setResolved(event.target.value === 'resolved')}><option value="open">Open</option><option value="resolved">Resolved</option></select></label>
        <label className="field"><span>Severity</span><select value={severity} onChange={(event) => setSeverity(event.target.value)}><option value="">All severities</option><option>CRITICAL</option><option>WARNING</option><option>INFO</option></select></label>
        <div className="toolbar-summary"><strong>{String(resource.data?.summary.open ?? '—')}</strong><span>open alerts</span></div>
        <div className="toolbar-summary"><strong>{String(resource.data?.summary.critical ?? '—')}</strong><span>critical</span></div>
        <div className="toolbar-summary"><strong>{resource.data?.legacyCount ?? '—'}</strong><span>legacy parity rows</span></div>
      </div>
      {resource.loading ? <PageSkeleton rows={8} /> : (
        <Panel>
          {!resource.data?.alerts.length ? <EmptyState title={resolved ? 'No resolved alerts' : 'No open alerts'} message="Change the filters or wait for anomaly detection to produce a new alert." /> : (
            <div className="data-list">{resource.data.alerts.map((alert) => <article className="alert-row" key={alert.alertId}><div className="alert-row-head"><StatusBadge status={alert.severity ?? 'INFO'} /><span>Alert #{alert.alertId}</span><time>{alert.detectedAt ? new Date(alert.detectedAt).toLocaleString() : 'Unknown time'}</time></div><h3>{alert.description ?? alert.anomalyType ?? 'Anomaly alert'}</h3><p>{alert.recommendation ?? 'Inspect the equipment and telemetry context before acting.'}</p><footer><span>Equipment {alert.equipmentId} · {alert.equipmentType ?? 'Unknown type'}</span><div><button className="btn-secondary" type="button" onClick={() => void inspect(alert)}>View details</button>{!alert.isResolved && <><button className="btn-primary" type="button" onClick={() => void resolve(alert)}>Resolve</button><button className="btn-secondary" type="button" onClick={() => void resolve(alert, true)}>Legacy resolve</button></>}</div></footer></article>)}</div>
          )}
        </Panel>
      )}
      {selected && <div className="drawer-backdrop" onMouseDown={() => setSelected(null)}><aside className="detail-drawer" onMouseDown={(event) => event.stopPropagation()}><header><div><h2>Alert #{selected.alertId}</h2><p>{selected.anomalyType ?? 'Anomaly detail'}</p></div><button type="button" onClick={() => setSelected(null)} aria-label="Close"><span className="material-symbols-outlined">close</span></button></header><dl className="detail-grid"><div><dt>Severity</dt><dd><StatusBadge status={selected.severity ?? 'INFO'} /></dd></div><div><dt>Equipment</dt><dd>{selected.equipmentId}</dd></div><div><dt>Trigger value</dt><dd>{selected.triggerValue ?? '—'}</dd></div><div><dt>Threshold</dt><dd>{selected.thresholdValue ?? '—'}</dd></div></dl><h3>Finding</h3><p>{selected.description}</p><h3>Recommended response</h3><p>{selected.recommendation ?? 'No recommendation was provided.'}</p></aside></div>}
    </div>
  );
}
