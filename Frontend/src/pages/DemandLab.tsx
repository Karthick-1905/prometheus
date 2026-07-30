import { useMemo, useState } from 'react';
import '../styles/demand-lab.css';

type Phase = 'Site prep' | 'Earthwork' | 'Structure' | 'Finishing';
type Equipment = 'Excavator' | 'Wheel loader' | 'Crane';

const HISTORY = [3, 4, 4, 5, 4, 6, 7, 7];
const WEEKS = ['06 Jun', '13 Jun', '20 Jun', '27 Jun', '04 Jul', '11 Jul', '18 Jul', '25 Jul'];
const FUTURE_WEEKS = ['01 Aug', '08 Aug', '15 Aug', '22 Aug'];

const PHASE_EFFECT: Record<Phase, Record<Equipment, number>> = {
  'Site prep': { Excavator: 1.18, 'Wheel loader': 1.08, Crane: 0.72 },
  Earthwork: { Excavator: 1.28, 'Wheel loader': 1.2, Crane: 0.82 },
  Structure: { Excavator: 0.92, 'Wheel loader': 0.88, Crane: 1.3 },
  Finishing: { Excavator: 0.68, 'Wheel loader': 0.72, Crane: 0.84 },
};

const EQUIPMENT_BASE: Record<Equipment, number> = {
  Excavator: 1,
  'Wheel loader': 0.82,
  Crane: 0.68,
};

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

export default function DemandLab() {
  const [equipment, setEquipment] = useState<Equipment>('Excavator');
  const [phase, setPhase] = useState<Phase>('Earthwork');
  const [scheduleChange, setScheduleChange] = useState(10);
  const [utilization, setUtilization] = useState(78);
  const [weatherRisk, setWeatherRisk] = useState(15);
  const [selectedWeek, setSelectedWeek] = useState(0);

  const forecast = useMemo(() => {
    const lastObserved = HISTORY[HISTORY.length - 1] * EQUIPMENT_BASE[equipment];
    const phaseMultiplier = PHASE_EFFECT[phase][equipment];
    const scheduleMultiplier = 1 + scheduleChange / 100;
    const utilizationEffect = 1 + Math.max(0, utilization - 70) * 0.004;
    const weatherMultiplier = 1 - weatherRisk * 0.0025;
    const horizonShape = [1, 0.96, 0.91, 0.87];

    return horizonShape.map((shape, index) => {
      const expected = Math.max(
        0,
        lastObserved * phaseMultiplier * scheduleMultiplier * utilizationEffect * weatherMultiplier * shape,
      );
      const spread = 0.75 + index * 0.38 + weatherRisk * 0.015;
      return {
        expected: roundOne(expected),
        lower: roundOne(Math.max(0, expected - spread)),
        upper: roundOne(expected + spread),
        safe: Math.ceil(expected + spread * 0.62),
        hours: Math.round(expected * (36 + utilization * 0.11)),
      };
    });
  }, [equipment, phase, scheduleChange, utilization, weatherRisk]);

  const chart = useMemo(() => {
    const width = 920;
    const height = 330;
    const pad = { left: 48, right: 30, top: 28, bottom: 48 };
    const history = HISTORY.map((value) => roundOne(value * EQUIPMENT_BASE[equipment]));
    const allValues = [...history, ...forecast.flatMap((point) => [point.upper, point.safe])];
    const maxY = Math.max(10, Math.ceil(Math.max(...allValues) / 2) * 2);
    const x = (index: number) =>
      pad.left + (index / 11) * (width - pad.left - pad.right);
    const y = (value: number) =>
      pad.top + (1 - value / maxY) * (height - pad.top - pad.bottom);
    const historyPath = history
      .map((value, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(value)}`)
      .join(' ');
    const forecastPath = forecast
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(index + 8)} ${y(point.expected)}`)
      .join(' ');
    const upperPath = forecast.map((point, index) => `${x(index + 8)},${y(point.upper)}`).join(' ');
    const lowerPath = [...forecast]
      .reverse()
      .map((point, reverseIndex) => {
        const index = forecast.length - 1 - reverseIndex;
        return `${x(index + 8)},${y(point.lower)}`;
      })
      .join(' ');

    return { width, height, pad, history, maxY, x, y, historyPath, forecastPath, band: `${upperPath} ${lowerPath}` };
  }, [equipment, forecast]);

  const selected = forecast[selectedWeek];
  const baseline = roundOne(HISTORY[HISTORY.length - 1] * EQUIPMENT_BASE[equipment]);
  const phaseDelta = roundOne(baseline * (PHASE_EFFECT[phase][equipment] - 1));
  const scheduleDelta = roundOne((baseline + phaseDelta) * (scheduleChange / 100));
  const operationsDelta = roundOne(selected.expected - baseline - phaseDelta - scheduleDelta);

  return (
    <div className="forecast-lab">
      <header className="lab-heading">
        <div>
          <div className="lab-title-row">
            <h1>Demand forecast lab</h1>
            <span className="lab-badge">Synthetic demo</span>
          </div>
          <p>
            Explore how project signals become a four-week equipment plan. No reservation is made from this screen.
          </p>
        </div>
        <div className="model-status" aria-label="Current serving methods">
          <span>Current model</span>
          <strong>Units: last observed · Hours: gradient boosting</strong>
        </div>
      </header>

      <section className="lab-workspace" aria-label="Interactive demand forecast">
        <div className="lab-controls">
          <div className="control-intro">
            <h2>Change the inputs</h2>
            <p>The chart recalculates immediately. These controls demonstrate signal direction, not production accuracy.</p>
          </div>

          <label>
            Equipment
            <select value={equipment} onChange={(event) => setEquipment(event.target.value as Equipment)}>
              <option>Excavator</option>
              <option>Wheel loader</option>
              <option>Crane</option>
            </select>
          </label>

          <label>
            Project phase
            <select value={phase} onChange={(event) => setPhase(event.target.value as Phase)}>
              <option>Site prep</option>
              <option>Earthwork</option>
              <option>Structure</option>
              <option>Finishing</option>
            </select>
          </label>

          <label>
            <span><span>Schedule change</span><strong>{scheduleChange > 0 ? '+' : ''}{scheduleChange}%</strong></span>
            <input
              type="range"
              min="-25"
              max="35"
              step="5"
              value={scheduleChange}
              onChange={(event) => setScheduleChange(Number(event.target.value))}
            />
          </label>

          <label>
            <span><span>Recent utilization</span><strong>{utilization}%</strong></span>
            <input
              type="range"
              min="35"
              max="98"
              value={utilization}
              onChange={(event) => setUtilization(Number(event.target.value))}
            />
          </label>

          <label>
            <span><span>Weather disruption risk</span><strong>{weatherRisk}%</strong></span>
            <input
              type="range"
              min="0"
              max="60"
              step="5"
              value={weatherRisk}
              onChange={(event) => setWeatherRisk(Number(event.target.value))}
            />
          </label>

          <button
            className="lab-reset"
            type="button"
            onClick={() => {
              setEquipment('Excavator');
              setPhase('Earthwork');
              setScheduleChange(10);
              setUtilization(78);
              setWeatherRisk(15);
              setSelectedWeek(0);
            }}
          >
            Reset scenario
          </button>
        </div>

        <div className="forecast-visual">
          <div className="chart-heading">
            <div>
              <h2>{equipment} demand</h2>
              <p>Requested units per week</p>
            </div>
            <div className="chart-legend" aria-label="Chart legend">
              <span><i className="legend-history" />Observed</span>
              <span><i className="legend-forecast" />Expected</span>
              <span><i className="legend-range" />Planning range</span>
            </div>
          </div>

          <div className="chart-scroll">
            <svg
              className="forecast-chart"
              viewBox={`0 0 ${chart.width} ${chart.height}`}
              role="img"
              aria-labelledby="forecast-chart-title forecast-chart-desc"
            >
              <title id="forecast-chart-title">Historical requested demand and four-week forecast</title>
              <desc id="forecast-chart-desc">
                Eight weeks of observed demand followed by four independent weekly estimates with uncertainty bounds.
              </desc>

              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const value = chart.maxY * ratio;
                return (
                  <g key={ratio}>
                    <line
                      className="chart-grid"
                      x1={chart.pad.left}
                      x2={chart.width - chart.pad.right}
                      y1={chart.y(value)}
                      y2={chart.y(value)}
                    />
                    <text className="chart-axis" x={chart.pad.left - 12} y={chart.y(value) + 4} textAnchor="end">
                      {value}
                    </text>
                  </g>
                );
              })}

              <line
                className="forecast-divider"
                x1={chart.x(7.5)}
                x2={chart.x(7.5)}
                y1={chart.pad.top}
                y2={chart.height - chart.pad.bottom}
              />
              <text className="divider-label" x={chart.x(7.5) + 8} y={chart.pad.top + 3}>Forecast begins</text>
              <polygon className="forecast-band" points={chart.band} />
              <path className="history-line" d={chart.historyPath} />
              <path className="expected-line" d={chart.forecastPath} />
              <line
                className="bridge-line"
                x1={chart.x(7)}
                y1={chart.y(chart.history[7])}
                x2={chart.x(8)}
                y2={chart.y(forecast[0].expected)}
              />

              {chart.history.map((value, index) => (
                <circle className="history-point" cx={chart.x(index)} cy={chart.y(value)} r="4" key={`h-${index}`} />
              ))}
              {forecast.map((point, index) => (
                <g key={`f-${index}`}>
                  <circle
                    className={selectedWeek === index ? 'forecast-point is-selected' : 'forecast-point'}
                    cx={chart.x(index + 8)}
                    cy={chart.y(point.expected)}
                    r={selectedWeek === index ? 7 : 5}
                  />
                  <text className="point-value" x={chart.x(index + 8)} y={chart.y(point.expected) - 14} textAnchor="middle">
                    {point.expected}
                  </text>
                </g>
              ))}

              {[...WEEKS, ...FUTURE_WEEKS].map((label, index) => (
                <text className="chart-axis" x={chart.x(index)} y={chart.height - 18} textAnchor="middle" key={label}>
                  {label}
                </text>
              ))}
            </svg>
          </div>

          <div className="week-selector" aria-label="Select a forecast week">
            {forecast.map((point, index) => (
              <button
                type="button"
                className={selectedWeek === index ? 'is-current' : ''}
                aria-pressed={selectedWeek === index}
                onClick={() => setSelectedWeek(index)}
                key={FUTURE_WEEKS[index]}
              >
                <span>Week {index + 1}</span>
                <strong>{point.expected} expected</strong>
                <small>{point.lower}–{point.upper} range</small>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="explanation-grid">
        <div className="contribution-panel">
          <div className="section-heading">
            <div>
              <h2>Why Week {selectedWeek + 1} is {selected.expected} units</h2>
              <p>A plain-language decomposition of the selected estimate.</p>
            </div>
            <span className="safe-quantity">Plan safely for <strong>{selected.safe}</strong></span>
          </div>

          <div className="contribution-list">
            {[
              { label: 'Last observed demand', value: baseline, note: 'The current promoted unit baseline' },
              { label: `${phase} phase`, value: phaseDelta, note: `Typical ${equipment.toLowerCase()} need in this phase` },
              { label: 'Schedule movement', value: scheduleDelta, note: `${scheduleChange}% change to planned work` },
              { label: 'Utilization, weather & horizon', value: operationsDelta, note: 'Operational pressure and uncertainty' },
            ].map((item) => {
              const max = Math.max(1, baseline, Math.abs(phaseDelta), Math.abs(scheduleDelta), Math.abs(operationsDelta));
              return (
                <div className="contribution-row" key={item.label}>
                  <div>
                    <strong>{item.label}</strong>
                    <span>{item.note}</span>
                  </div>
                  <div className="contribution-track" aria-hidden="true">
                    <i
                      className={item.value < 0 ? 'is-negative' : ''}
                      style={{ width: `${Math.max(5, Math.abs(item.value) / max * 100)}%` }}
                    />
                  </div>
                  <b>{item.value > 0 && item.label !== 'Last observed demand' ? '+' : ''}{item.value}</b>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="decision-panel">
          <h2>How to read the result</h2>
          <dl>
            <div>
              <dt>Expected</dt>
              <dd>{selected.expected} units — the center estimate, not a promise.</dd>
            </div>
            <div>
              <dt>Planning range</dt>
              <dd>{selected.lower}–{selected.upper} units — uncertainty grows further into the future.</dd>
            </div>
            <div>
              <dt>Safe quantity</dt>
              <dd>{selected.safe} units — a cautious planning point inside the upper range.</dd>
            </div>
            <div>
              <dt>Machine-hours</dt>
              <dd>{selected.hours} hours — predicted separately from unit count.</dd>
            </div>
          </dl>
        </aside>
      </section>

      <section className="forecast-process" aria-labelledby="process-title">
        <div className="section-heading">
          <div>
            <h2 id="process-title">From demand signal to human decision</h2>
            <p>The production pipeline keeps measured demand, model selection, and action separate.</p>
          </div>
        </div>
        <ol>
          <li>
            <span>1</span>
            <div><strong>Collect requested demand</strong><p>Requests, unmet need, project phase, utilization, engine-hours, and seasonality.</p></div>
          </li>
          <li>
            <span>2</span>
            <div><strong>Build leakage-safe features</strong><p>Only information available before each forecast week is used.</p></div>
          </li>
          <li>
            <span>3</span>
            <div><strong>Run the model tournament</strong><p>Statistical baselines and ML candidates compete on chronological holdouts.</p></div>
          </li>
          <li>
            <span>4</span>
            <div><strong>Apply the promotion gate</strong><p>A candidate serves only if it meets or beats the selected baseline on unseen data.</p></div>
          </li>
          <li>
            <span>5</span>
            <div><strong>Review range and alternatives</strong><p>A person accepts, adjusts, or rejects the plan. Nothing is booked automatically.</p></div>
          </li>
        </ol>
      </section>

      <details className="accessible-data">
        <summary>View chart data as a table</summary>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Week</th><th>Type</th><th>Expected units</th><th>Lower</th><th>Upper</th><th>Safe plan</th><th>Machine-hours</th></tr>
            </thead>
            <tbody>
              {chart.history.map((value, index) => (
                <tr key={WEEKS[index]}><td>{WEEKS[index]}</td><td>Observed</td><td>{value}</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>
              ))}
              {forecast.map((point, index) => (
                <tr key={FUTURE_WEEKS[index]}>
                  <td>{FUTURE_WEEKS[index]}</td><td>Forecast</td><td>{point.expected}</td><td>{point.lower}</td>
                  <td>{point.upper}</td><td>{point.safe}</td><td>{point.hours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
