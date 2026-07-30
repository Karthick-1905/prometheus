import { useEffect, useMemo, useState } from 'react';
import Link from '../components/AppLink';
import { demandApi, type DealerAction, type DealerRow } from '../api/demand';
import '../styles/demand.css';

const regions = ['All regions', 'North', 'South', 'East', 'West'];

function dateLabel(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
  });
}

export default function DealerDemandPage() {
  const [rows, setRows] = useState<DealerRow[]>([]);
  const [actions, setActions] = useState<DealerAction[]>([]);
  const [region, setRegion] = useState('All regions');
  const [equipmentType, setEquipmentType] = useState('All equipment');
  const [week, setWeek] = useState('All weeks');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [inventoryAsOf, setInventoryAsOf] = useState('');

  const load = () => {
    setLoading(true);
    demandApi
      .dealer()
      .then((result) => {
        setRows(result.rows);
        setActions(result.actions);
        setInventoryAsOf(result.inventoryAsOf);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load dealer forecast.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const equipmentTypes = useMemo(
    () => ['All equipment', ...Array.from(new Set(rows.map((row) => row.equipmentType))).sort()],
    [rows],
  );
  const weeks = useMemo(
    () => ['All weeks', ...Array.from(new Set(rows.map((row) => row.forecastWeek))).sort()],
    [rows],
  );
  const filtered = rows.filter(
    (row) =>
      (region === 'All regions' || row.region === region) &&
      (equipmentType === 'All equipment' || row.equipmentType === equipmentType) &&
      (week === 'All weeks' || row.forecastWeek === week),
  );
  const weekOne = weeks[1];
  const heatRows = rows.filter((row) => row.forecastWeek === weekOne);
  const shortageUnits = filtered.reduce((sum, row) => sum + Math.max(0, row.shortageOrSurplus), 0);
  const surplusUnits = filtered.reduce((sum, row) => sum + Math.max(0, -row.shortageOrSurplus), 0);
  const criticalRows = filtered.filter((row) => row.severity === 'CRITICAL').length;

  const decide = async (action: DealerAction, decision: 'APPROVED' | 'REJECTED') => {
    try {
      const result = await demandApi.decideDealerAction(action, decision);
      setActions((current) =>
        current.map((item) =>
          item.actionId === action.actionId ? { ...item, status: result.status, version: (item.version ?? 1) + 1 } : item,
        ),
      );
      setNotice(
        decision === 'APPROVED'
          ? 'Transfer proposal approved as a planning action. Dispatch remains outside this MVP.'
          : 'Transfer proposal rejected and retained in the audit history.',
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save the decision.');
    }
  };

  return (
    <main className="demand-shell">
      <header className="demand-header">
        <div className="demand-brand">
          <div className="header-logo">CAT</div>
          <div><h1>Regional positioning</h1><p>Protect customer commitments while balancing fleet supply</p></div>
        </div>
        <nav className="demand-nav" aria-label="Primary navigation">
          <Link to="/dealer/dashboard">Dealer</Link><Link to="/dealer/inventory">Inventory</Link>
          <Link className="is-current" to="/dealer/demand">Dealer view</Link>
        </nav>
      </header>

      <div className="mode-notice" role="note">
        <strong>Demonstration mode</strong>
        <span>Synthetic customer forecasts and fleet availability. Every movement requires fleet-manager approval.</span>
      </div>

      <section className="dealer-overview">
        <div className="dealer-headline">
          <span>Week 1 fleet position</span>
          <h2>{shortageUnits ? `${shortageUnits} protected units need attention` : 'No protected shortage in this view'}</h2>
          <p>Inventory as of {inventoryAsOf ? dateLabel(inventoryAsOf) : '—'}. Reserved and unavailable units are excluded.</p>
        </div>
        <dl className="dealer-totals">
          <div><dt>Shortage units</dt><dd>{shortageUnits}</dd></div>
          <div><dt>Genuine surplus</dt><dd>{surplusUnits}</dd></div>
          <div><dt>Critical rows</dt><dd>{criticalRows}</dd></div>
          <div><dt>Proposed moves</dt><dd>{actions.filter((action) => action.status === 'PROPOSED').length}</dd></div>
        </dl>
      </section>

      <section className="planning-toolbar dealer-filters" aria-label="Dealer forecast filters">
        <label>Region<select value={region} onChange={(event) => setRegion(event.target.value)}>{regions.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Equipment<select value={equipmentType} onChange={(event) => setEquipmentType(event.target.value)}>{equipmentTypes.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Forecast week<select value={week} onChange={(event) => setWeek(event.target.value)}>{weeks.map((item) => <option key={item} value={item}>{item === 'All weeks' ? item : dateLabel(item)}</option>)}</select></label>
        <button className="secondary-action" type="button" onClick={load}>Refresh inventory</button>
      </section>

      {error && <div className="demand-message is-error" role="alert">{error}</div>}
      {notice && <div className="demand-message is-success" role="status">{notice}</div>}

      {loading ? (
        <div className="forecast-skeleton"><div /><div /><div /></div>
      ) : (
        <>
          <section className="heatmap-section">
            <div className="panel-heading"><div><h2>Week 1 demand pressure</h2><p>Safe forecast minus expected compatible availability</p></div></div>
            <div className="demand-heatmap">
              {regions.slice(1).map((regionName) => (
                <div className="heatmap-row" key={regionName}>
                  <strong>{regionName}</strong>
                  {equipmentTypes.slice(1).map((type) => {
                    const item = heatRows.find((row) => row.region === regionName && row.equipmentType === type);
                    const balance = item?.shortageOrSurplus ?? 0;
                    return (
                      <div
                        className={`heat-cell ${balance > 0 ? 'is-shortage' : balance < -1 ? 'is-surplus' : 'is-balanced'}`}
                        key={type}
                        title={`${regionName} · ${type}: ${balance > 0 ? `${balance} shortage` : `${Math.abs(balance)} surplus`}`}
                      >
                        <span>{type}</span><strong>{balance > 0 ? `−${balance}` : `+${Math.abs(balance)}`}</strong>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>

          <section className="history-section">
            <div className="panel-heading"><div><h2>Demand versus availability</h2><p>Positive balance means safe demand exceeds expected supply.</p></div></div>
            <div className="demand-table-wrap">
              <table className="demand-table">
                <thead><tr><th>Week</th><th>Region</th><th>Equipment</th><th>Expected</th><th>Safe</th><th>Available</th><th>Balance</th><th>Confidence</th></tr></thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={`${row.region}-${row.equipmentType}-${row.forecastWeek}`}>
                      <td>{dateLabel(row.forecastWeek)}</td><td>{row.region}</td><td>{row.equipmentType}</td>
                      <td>{row.expectedDemand.toFixed(1)}</td><td>{row.safeDemand}</td><td>{row.expectedAvailable}</td>
                      <td><span className={`balance-pill ${row.shortageOrSurplus > 0 ? 'is-shortage' : 'is-surplus'}`}>{row.shortageOrSurplus > 0 ? `${row.shortageOrSurplus} short` : `${Math.abs(row.shortageOrSurplus)} surplus`}</span></td>
                      <td>{row.confidence.toLowerCase()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="positioning-section">
            <div className="panel-heading"><div><h2>Guarded pre-positioning</h2><p>Proposals preserve a source-region safety buffer and exclude reserved equipment.</p></div></div>
            {actions.length ? actions.map((action) => (
              <article className="positioning-row" key={action.actionId}>
                <div className="move-path">
                  <span>{action.sourceRegion}</span><strong aria-label="to">→</strong><span>{action.destinationRegion}</span>
                </div>
                <div className="move-copy">
                  <h3>Move {action.recommendedUnits} {action.equipmentType.toLowerCase()} unit{action.recommendedUnits === 1 ? '' : 's'} before {dateLabel(action.forecastWeek)}</h3>
                  <p>{action.rationale}</p><span>{action.customerImpact} · {action.transferLeadDays}-day estimated lead time.</span>
                </div>
                <div className="move-actions">
                  <span className={`decision-tag status-${action.status.toLowerCase()}`}>{action.status.toLowerCase()}</span>
                  {action.status === 'PROPOSED' && <>
                    <button className="primary-action" type="button" onClick={() => decide(action, 'APPROVED')}>Approve</button>
                    <button className="secondary-action" type="button" onClick={() => decide(action, 'REJECTED')}>Reject</button>
                  </>}
                </div>
              </article>
            )) : <div className="forecast-empty compact"><h3>No safe transfer available</h3><p>Contact affected customers or reserve equipment externally.</p></div>}
          </section>
        </>
      )}
    </main>
  );
}
