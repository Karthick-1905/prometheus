import { useEffect, useMemo, useRef, useState } from 'react';
import { demandApi, type DealerAction, type DealerRow } from '../api/demand';
import '../styles/dealer-demand-planning.css';

type DealerPositionRow = DealerRow;

type Position =
  | { kind: 'shortage'; units: number; label: string }
  | { kind: 'surplus'; units: number; label: string }
  | { kind: 'balanced'; units: 0; label: string }
  | { kind: 'unknown'; units: null; label: string };

type Decision = 'APPROVED' | 'REJECTED';

function dateLabel(value?: string | null, includeYear = false) {
  if (!value) return 'Not available';
  const raw = value.includes('T') ? value : `${value}T00:00:00`;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    ...(includeYear ? { year: 'numeric' } : {}),
  });
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function nonNegative(value: unknown) {
  return isFiniteNumber(value) && value >= 0 ? value : null;
}

function positionFor(row: DealerPositionRow): Position {
  const explicitShortage = nonNegative(row.shortageUnits);
  const explicitSurplus = nonNegative(row.surplusUnits);

  if (explicitShortage !== null || explicitSurplus !== null) {
    const shortage = explicitShortage ?? 0;
    const surplus = explicitSurplus ?? 0;
    if (shortage > 0) {
      return {
        kind: 'shortage',
        units: shortage,
        label: `${shortage} ${shortage === 1 ? 'unit' : 'units'} short`,
      };
    }
    if (surplus > 0) {
      return {
        kind: 'surplus',
        units: surplus,
        label: `${surplus} ${surplus === 1 ? 'unit' : 'units'} surplus`,
      };
    }
    if (explicitShortage !== null && explicitSurplus !== null) {
      return { kind: 'balanced', units: 0, label: 'Supply covers safe demand' };
    }
    return { kind: 'unknown', units: null, label: 'Position unknown' };
  }

  const signedPosition = (row as { shortageOrSurplus?: unknown }).shortageOrSurplus;
  if (!isFiniteNumber(signedPosition)) {
    return { kind: 'unknown', units: null, label: 'Position unknown' };
  }
  if (signedPosition > 0) {
    return {
      kind: 'shortage',
      units: signedPosition,
      label: `${signedPosition} ${signedPosition === 1 ? 'unit' : 'units'} short`,
    };
  }
  if (signedPosition < 0) {
    const surplus = Math.abs(signedPosition);
    return {
      kind: 'surplus',
      units: surplus,
      label: `${surplus} ${surplus === 1 ? 'unit' : 'units'} surplus`,
    };
  }
  return { kind: 'balanced', units: 0, label: 'Supply covers safe demand' };
}

function demandValue(value: unknown, digits = 0) {
  if (!isFiniteNumber(value)) return 'Unknown';
  return value.toFixed(digits);
}

function readable(value?: string | null) {
  if (!value) return 'Unknown';
  return value.replaceAll('_', ' ').toLowerCase();
}

export default function DealerDemandPage() {
  const [rows, setRows] = useState<DealerPositionRow[]>([]);
  const [actions, setActions] = useState<DealerAction[]>([]);
  const [region, setRegion] = useState('All regions');
  const [equipmentType, setEquipmentType] = useState('All equipment');
  const [week, setWeek] = useState('');
  const [inventoryAsOf, setInventoryAsOf] = useState('');
  const [warning, setWarning] = useState('');
  const [modelVersion, setModelVersion] = useState('');
  const [decisionReason, setDecisionReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<{
    actionId: number;
    decision: Decision;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const loadRequest = useRef(0);

  const load = async () => {
    const requestId = ++loadRequest.current;
    setLoading(true);
    setError(null);
    try {
      const result = await demandApi.dealer();
      if (requestId !== loadRequest.current) return;
      const nextRows = result.rows as DealerPositionRow[];
      const nextWeeks = Array.from(new Set(nextRows.map((row) => row.forecastWeek))).sort();
      setRows(nextRows);
      setActions(result.actions);
      setInventoryAsOf(result.inventoryAsOf);
      setWarning(result.warning);
      setModelVersion(result.modelVersion ?? '');
      setWeek((current) => (current && nextWeeks.includes(current) ? current : nextWeeks[0] ?? ''));
    } catch (reason) {
      if (requestId !== loadRequest.current) return;
      setError(reason instanceof Error ? reason.message : 'Unable to load dealer forecast.');
    } finally {
      if (requestId === loadRequest.current) setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    return () => {
      loadRequest.current += 1;
    };
  }, []);

  const regions = useMemo(
    () => ['All regions', ...Array.from(new Set(rows.map((row) => row.region))).sort()],
    [rows],
  );
  const equipmentTypes = useMemo(
    () => ['All equipment', ...Array.from(new Set(rows.map((row) => row.equipmentType))).sort()],
    [rows],
  );
  const weeks = useMemo(
    () => Array.from(new Set(rows.map((row) => row.forecastWeek))).sort(),
    [rows],
  );

  const rankedRows = useMemo(() => {
    const kindRank: Record<Position['kind'], number> = {
      shortage: 4,
      unknown: 3,
      surplus: 2,
      balanced: 1,
    };
    return rows
      .filter(
        (row) =>
          row.forecastWeek === week &&
          (region === 'All regions' || row.region === region) &&
          (equipmentType === 'All equipment' || row.equipmentType === equipmentType),
      )
      .sort((left, right) => {
        const leftPosition = positionFor(left);
        const rightPosition = positionFor(right);
        const byKind = kindRank[rightPosition.kind] - kindRank[leftPosition.kind];
        if (byKind !== 0) return byKind;
        const byUnits = (rightPosition.units ?? -1) - (leftPosition.units ?? -1);
        if (byUnits !== 0) return byUnits;
        return `${left.region}-${left.equipmentType}`.localeCompare(
          `${right.region}-${right.equipmentType}`,
        );
      });
  }, [equipmentType, region, rows, week]);

  const visibleActions = useMemo(
    () =>
      actions.filter(
        (action) =>
          action.forecastWeek === week &&
          (equipmentType === 'All equipment' || action.equipmentType === equipmentType) &&
          (region === 'All regions' ||
            action.sourceRegion === region ||
            action.destinationRegion === region),
      ),
    [actions, equipmentType, region, week],
  );

  const proposedActions = visibleActions.filter((action) => action.status === 'PROPOSED');
  const decidedActions = visibleActions.filter((action) => action.status !== 'PROPOSED');
  const shortages = rankedRows.filter((row) => positionFor(row).kind === 'shortage');
  const shortageUnits = shortages.reduce(
    (sum, row) => sum + (positionFor(row).units ?? 0),
    0,
  );
  const unknownPositions = rankedRows.filter((row) => positionFor(row).kind === 'unknown').length;
  const reasonReady = decisionReason.trim().length >= 8;

  const decide = async (action: DealerAction, decision: Decision) => {
    if (pendingAction || action.status !== 'PROPOSED' || !reasonReady) return;
    setPendingAction({ actionId: action.actionId, decision });
    setError(null);
    setNotice(null);
    try {
      const result = await demandApi.decideDealerAction(
        action,
        decision,
        decisionReason.trim(),
      );
      setActions((current) =>
        current.map((item) =>
          item.actionId === action.actionId
            ? {
                ...item,
                status: result.status,
                version: result.version ?? (item.version ?? 1) + 1,
              }
            : item,
        ),
      );
      setNotice(
        decision === 'APPROVED'
          ? `Move from ${action.sourceRegion} to ${action.destinationRegion} approved for planning. Dispatch is still a separate operational step.`
          : `Move from ${action.sourceRegion} to ${action.destinationRegion} rejected and recorded.`,
      );
      setDecisionReason('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save the decision.');
    } finally {
      setPendingAction(null);
    }
  };

  if (loading && !rows.length) {
    return (
      <div className="dealer-demand-planning" aria-busy="true">
        <p className="ddp-sr-only" role="status">Loading regional demand positions.</p>
        <div className="ddp-skeleton"><span /><span /><span /></div>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="dealer-demand-planning">
        <section className="ddp-empty">
          <h1>No regional positions available</h1>
          <p>Refresh after customer forecasts and dealer inventory have been loaded.</p>
          {error && <div className="ddp-message is-error" role="alert">{error}</div>}
          <button className="ddp-secondary-button" type="button" onClick={() => void load()}>
            Refresh positions
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="dealer-demand-planning" aria-busy={loading}>
      <header className="ddp-page-heading">
        <div>
          <h1>Regional positioning</h1>
          <p>Find protected shortages first, then review moves that preserve source supply.</p>
        </div>
        <div className="ddp-freshness">
          <span>{loading ? 'Refreshing positions' : `Inventory ${dateLabel(inventoryAsOf, true)}`}</span>
          <small>{modelVersion ? `Forecast ${modelVersion}` : 'Forecast version unavailable'}</small>
        </div>
      </header>

      <section className="ddp-controls" aria-label="Regional position filters">
        <label>
          <span>Forecast week</span>
          <select value={week} onChange={(event) => setWeek(event.target.value)}>
            {weeks.map((item) => (
              <option key={item} value={item}>{dateLabel(item, true)}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Region</span>
          <select value={region} onChange={(event) => setRegion(event.target.value)}>
            {regions.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span>Equipment</span>
          <select value={equipmentType} onChange={(event) => setEquipmentType(event.target.value)}>
            {equipmentTypes.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <button
          className="ddp-secondary-button"
          type="button"
          onClick={() => void load()}
          disabled={loading || pendingAction !== null}
        >
          {loading ? 'Refreshing...' : 'Refresh inventory'}
        </button>
      </section>

      {warning && (
        <div className="ddp-mode-notice" role="note">
          <strong>Planning data notice</strong>
          <span>{warning}</span>
        </div>
      )}
      {error && <div className="ddp-message is-error" role="alert">{error}</div>}
      {notice && <div className="ddp-message is-success" role="status">{notice}</div>}

      <section className="ddp-positions" aria-labelledby="regional-positions-title">
        <div className="ddp-section-heading">
          <div>
            <h2 id="regional-positions-title">Ranked regional positions</h2>
            <p>
              {shortageUnits > 0
                ? `${shortageUnits} ${shortageUnits === 1 ? 'unit needs' : 'units need'} protected positioning across ${shortages.length} ${shortages.length === 1 ? 'region' : 'positions'}.`
                : 'No confirmed shortage in this filtered week.'}
              {unknownPositions > 0
                ? ` ${unknownPositions} ${unknownPositions === 1 ? 'position has' : 'positions have'} incomplete data.`
                : ''}
            </p>
          </div>
          <span>Week of {dateLabel(week, true)}</span>
        </div>

        {rankedRows.length ? (
          <div className="ddp-table-scroll">
            <table>
              <caption className="ddp-sr-only">
                Regional demand and available equipment ranked by planning attention
              </caption>
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  <th scope="col">Region and equipment</th>
                  <th scope="col">Expected</th>
                  <th scope="col">Safe plan</th>
                  <th scope="col">Available</th>
                  <th scope="col">Position</th>
                  <th scope="col">Context</th>
                </tr>
              </thead>
              <tbody>
                {rankedRows.map((row, index) => {
                  const position = positionFor(row);
                  return (
                    <tr key={`${row.region}-${row.equipmentType}-${row.forecastWeek}`}>
                      <td className="ddp-rank">{index + 1}</td>
                      <th scope="row">
                        <strong>{row.region}</strong>
                        <span>{row.equipmentType}</span>
                      </th>
                      <td>{demandValue(row.expectedDemand, 1)}</td>
                      <td>{demandValue(row.safeDemand)}</td>
                      <td>{demandValue(row.expectedAvailable)}</td>
                      <td>
                        <span className={`ddp-position is-${position.kind}`}>
                          {position.label}
                        </span>
                      </td>
                      <td>
                        <details className="ddp-row-details">
                          <summary>View</summary>
                          <dl>
                            <div><dt>Confidence</dt><dd>{readable(row.confidence)}</dd></div>
                            <div><dt>Projects</dt><dd>{demandValue(row.projectCount)}</dd></div>
                            <div><dt>Backend severity</dt><dd>{readable(row.severity)}</dd></div>
                          </dl>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="ddp-empty compact">
            <h3>No positions match these filters</h3>
            <p>Choose another region or equipment type for the selected week.</p>
          </div>
        )}
      </section>

      <section className="ddp-moves" aria-labelledby="proposed-moves-title">
        <div className="ddp-moves-heading">
          <div>
            <h2 id="proposed-moves-title">Proposed moves</h2>
            <p>Approval records a planning decision only. It does not dispatch equipment.</p>
          </div>
          {proposedActions.length > 0 && (
            <label className="ddp-reason">
              <span>Decision reason</span>
              <input
                value={decisionReason}
                onChange={(event) => setDecisionReason(event.target.value)}
                placeholder="Why is this move safe or unsuitable?"
                maxLength={500}
                disabled={pendingAction !== null}
                aria-describedby="decision-reason-help"
              />
              <small id="decision-reason-help">
                Enter at least 8 characters. The note is stored with the selected decision.
              </small>
            </label>
          )}
        </div>

        {proposedActions.length ? (
          <ol className="ddp-move-list">
            {proposedActions.map((action) => {
              const approving =
                pendingAction?.actionId === action.actionId &&
                pendingAction.decision === 'APPROVED';
              const rejecting =
                pendingAction?.actionId === action.actionId &&
                pendingAction.decision === 'REJECTED';
              return (
                <li key={action.actionId}>
                  <div className="ddp-move-route" aria-label={`${action.sourceRegion} to ${action.destinationRegion}`}>
                    <span>{action.sourceRegion}</span>
                    <span aria-hidden="true">to</span>
                    <strong>{action.destinationRegion}</strong>
                  </div>
                  <div className="ddp-move-copy">
                    <h3>
                      Move {action.recommendedUnits} {action.equipmentType.toLowerCase()}
                      {action.recommendedUnits === 1 ? ' unit' : ' units'}
                    </h3>
                    <p>Position before {dateLabel(action.forecastWeek, true)}.</p>
                    <details>
                      <summary>Why this move is proposed</summary>
                      <p>{action.rationale}</p>
                      <dl>
                        <div><dt>Customer protection</dt><dd>{action.customerImpact}</dd></div>
                        <div><dt>Source safety buffer</dt><dd>{action.sourceSafetyBuffer} unit{action.sourceSafetyBuffer === 1 ? '' : 's'}</dd></div>
                        <div><dt>Estimated lead time</dt><dd>{action.transferLeadDays} day{action.transferLeadDays === 1 ? '' : 's'}</dd></div>
                      </dl>
                    </details>
                  </div>
                  <div className="ddp-move-actions">
                    <button
                      className="ddp-primary-button"
                      type="button"
                      onClick={() => void decide(action, 'APPROVED')}
                      disabled={pendingAction !== null || !reasonReady}
                    >
                      {approving ? 'Approving...' : 'Approve move'}
                    </button>
                    <button
                      className="ddp-text-button"
                      type="button"
                      onClick={() => void decide(action, 'REJECTED')}
                      disabled={pendingAction !== null || !reasonReady}
                    >
                      {rejecting ? 'Rejecting...' : 'Reject'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="ddp-empty compact">
            <h3>No safe move is proposed</h3>
            <p>
              There may be no protected surplus for this view. Review customer commitments or
              source equipment externally rather than weakening another region.
            </p>
          </div>
        )}

        {decidedActions.length > 0 && (
          <details className="ddp-decided">
            <summary>Previously decided moves in this view ({decidedActions.length})</summary>
            <ul>
              {decidedActions.map((action) => (
                <li key={action.actionId}>
                  <span>{action.sourceRegion} to {action.destinationRegion}</span>
                  <strong>{readable(action.status)}</strong>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </div>
  );
}
