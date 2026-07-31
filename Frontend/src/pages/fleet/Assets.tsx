import { useEffect, useState } from 'react';
import { fleetApi } from '../../api/platform';
import type { Alert, Machine, Telemetry } from '../../api/types';
import PageHeader from '../../components/ui/PageHeader';
import Panel from '../../components/ui/Panel';
import StatusBadge from '../../components/ui/StatusBadge';
import { EmptyState, FeedbackBanner, PageSkeleton } from '../../components/ui/Feedback';
import { getErrorMessage, useAsync } from '../../hooks/useAsync';

export default function FleetAssets() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<Machine | null>(null);
  const [history, setHistory] = useState<Telemetry[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const resource = useAsync(async () => {
    const [machines, map, unassigned, sites] = await Promise.all([
      fleetApi.machines({ q: query, liveStatus: status || undefined, limit: 500 }),
      fleetApi.map(),
      fleetApi.unassigned(),
      fleetApi.sites(),
    ]);
    return { machines: machines.data, map: map.data, unassigned: unassigned.data, sites: sites.data };
  }, [query, status]);

  useEffect(() => {
    if (!selected) return;
    setDetailLoading(true);
    setDetailError(null);
    Promise.all([
      fleetApi.machine(selected.equipmentId),
      fleetApi.telemetry(selected.equipmentId, 50),
      fleetApi.alerts(selected.equipmentId, 20),
    ])
      .then(([machine, telemetry, machineAlerts]) => {
        setSelected(machine.data);
        setHistory(telemetry.data);
        setAlerts(machineAlerts.data);
      })
      .catch((error) => setDetailError(getErrorMessage(error)))
      .finally(() => setDetailLoading(false));
  }, [selected?.equipmentId]);

  return (
    <div>
      <PageHeader title="Fleet Assets" subtitle="Search, scope, location, assignment, telemetry, and alert detail" />
      <div className="toolbar">
        <label className="field"><span>Search assets</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, type, site, or ID" /></label>
        <label className="field"><span>Live status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{['WORKING', 'IDLE', 'OFF', 'STALE', 'ALERT', 'OVERDUE', 'IN_TRANSIT'].map((value) => <option key={value}>{value}</option>)}</select></label>
        <div className="toolbar-summary"><strong>{resource.data?.machines.length ?? 0}</strong><span>visible assets</span></div>
        <div className="toolbar-summary"><strong>{resource.data?.unassigned.length ?? 0}</strong><span>need assignment</span></div>
        <div className="toolbar-summary"><strong>{resource.data?.map.length ?? 0}</strong><span>mapped positions</span></div>
      </div>
      {resource.error && <FeedbackBanner tone="error">{resource.error}</FeedbackBanner>}
      {resource.loading ? <PageSkeleton rows={8} /> : (
        <Panel>
          {!resource.data?.machines.length ? (
            <EmptyState title="No assets match" message="Clear filters or verify active rental contracts for this company." />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Asset</th><th>Site</th><th>Operator</th><th>Rental</th><th>Live status</th><th>Fuel</th><th>Alerts</th><th /></tr></thead>
                <tbody>{resource.data.machines.map((machine) => (
                  <tr key={machine.equipmentId}>
                    <td><strong>{machine.equipmentName ?? `Equipment ${machine.equipmentId}`}</strong><small>#{machine.equipmentId} · {machine.equipmentType ?? 'Unknown type'}</small></td>
                    <td>{machine.siteName ?? 'Unassigned'}</td>
                    <td>{machine.operatorId ?? 'Unassigned'}</td>
                    <td><StatusBadge status={machine.rentalStatus ?? 'UNKNOWN'} /></td>
                    <td><StatusBadge status={machine.liveStatus ?? 'UNKNOWN'} /></td>
                    <td>{machine.telemetry?.fuelLevel == null ? '—' : `${machine.telemetry.fuelLevel.toFixed(0)}%`}</td>
                    <td>{machine.openAlertCount ?? 0}</td>
                    <td><button className="btn-secondary" type="button" onClick={() => setSelected(machine)}>Inspect</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {selected && (
        <div className="drawer-backdrop" onMouseDown={() => setSelected(null)}>
          <aside className="detail-drawer" onMouseDown={(event) => event.stopPropagation()} aria-label="Asset detail">
            <header><div><h2>{selected.equipmentName ?? `Equipment ${selected.equipmentId}`}</h2><p>{selected.equipmentType} · #{selected.equipmentId}</p></div><button type="button" onClick={() => setSelected(null)} aria-label="Close detail"><span className="material-symbols-outlined">close</span></button></header>
            {detailError && <FeedbackBanner tone="error">{detailError}</FeedbackBanner>}
            {detailLoading ? <PageSkeleton rows={6} /> : (
              <>
                <dl className="detail-grid">
                  <div><dt>Live status</dt><dd><StatusBadge status={selected.liveStatus ?? 'UNKNOWN'} /></dd></div>
                  <div><dt>Site</dt><dd>{selected.siteName ?? 'Unassigned'}</dd></div>
                  <div><dt>Last operator</dt><dd>{selected.operatorId ?? 'Unassigned'}</dd></div>
                  <div><dt>Contract</dt><dd>#{selected.contractId ?? '—'}</dd></div>
                  <div><dt>Expected return</dt><dd>{selected.expectedReturn ? new Date(selected.expectedReturn).toLocaleDateString() : '—'}</dd></div>
                  <div><dt>Last seen</dt><dd>{selected.lastSeenAt ? new Date(selected.lastSeenAt).toLocaleString() : 'No telemetry'}</dd></div>
                  <div><dt>Coordinates</dt><dd>{selected.telemetry?.latitude == null ? 'Unavailable' : `${selected.telemetry.latitude.toFixed(4)}, ${selected.telemetry.longitude?.toFixed(4)}`}</dd></div>
                </dl>
                <h3>Telemetry history</h3>
                {history.length ? <div className="data-list">{history.slice(0, 8).map((item, index) => <div className="data-list-row compact" key={`${item.timestamp}-${index}`}><div><strong>{item.engineStatus ?? 'Unknown engine state'}</strong><span>{item.timestamp ? new Date(item.timestamp).toLocaleString() : 'No timestamp'}</span></div><span>{item.fuelLevel ?? '—'}% fuel · {item.loadPercentage ?? '—'}% load</span></div>)}</div> : <EmptyState title="No telemetry history" message="This asset has not sent telemetry samples." />}
                <h3>Asset alerts</h3>
                {alerts.length ? <div className="data-list">{alerts.map((alert) => <div className="data-list-row compact" key={alert.alertId}><div><strong>{alert.description ?? alert.anomalyType}</strong><span>{alert.detectedAt ? new Date(alert.detectedAt).toLocaleString() : 'Unknown time'}</span></div><StatusBadge status={alert.isResolved ? 'RESOLVED' : alert.severity ?? 'OPEN'} /></div>)}</div> : <EmptyState title="No asset alerts" message="No anomaly alerts are associated with this equipment." />}
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
