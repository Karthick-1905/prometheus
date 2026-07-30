/**
 * Train + evaluate Isolation Forest against pipeline/telemetry.csv
 *
 * Usage:
 *   npx tsx scripts/test_isolation_forest.ts
 *
 * Env (optional):
 *   IF_TRAIN_SIZE=8000
 *   IF_TEST_SIZE=20000
 *   IF_MAX_ROWS=0          # 0 = full file stream
 *   IF_SAMPLE_EVERY=50    # take every Nth row while streaming
 */
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { IsolationForest } from '../src/services/anomaly/isolation-forest/isolation-forest';
import { ModelStore } from '../src/services/anomaly/isolation-forest/model-store';
import {
  FEATURE_NAMES,
  FeatureVector,
  DEFAULT_IF_CONFIG,
} from '../src/services/anomaly/isolation-forest/types';
import { RuleDetector } from '../src/services/anomaly/rule-detector';
import { FeatureEngineeringLayer } from '../src/services/anomaly/feature-engineering';
import { ValidatedTelemetry } from '../src/schemas/telemetry.schema';

const CSV_PATH = path.join(process.cwd(), 'pipeline', 'telemetry.csv');

const TRAIN_SIZE = parseInt(process.env.IF_TRAIN_SIZE ?? '8000', 10);
const TEST_SIZE = parseInt(process.env.IF_TEST_SIZE ?? '20000', 10);
const MAX_ROWS = parseInt(process.env.IF_MAX_ROWS ?? '0', 10); // 0 = unlimited
const SAMPLE_EVERY = parseInt(process.env.IF_SAMPLE_EVERY ?? '40', 10);

const HEADERS = [
  'Timestamp',
  'EquipmentID',
  'EquipmentType',
  'DealerID',
  'SiteID',
  'OperatorID',
  'Latitude',
  'Longitude',
  'EngineStatus',
  'Speed',
  'EngineHours',
  'IdleHours',
  'FuelLevel',
  'FuelConsumed',
  'HydraulicPressure',
  'EngineTemperature',
  'BatteryVoltage',
  'VibrationLevel',
  'LoadPercentage',
  'RentalStatus',
] as const;

interface SampleRow {
  vector: FeatureVector;
  telemetry: ValidatedTelemetry;
  proxyAnomaly: boolean;
  proxyReasons: string[];
}

function parseNum(v: string | undefined, fallback = 0): number {
  if (v == null || v === '' || v.toUpperCase() === 'NULL') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseNullableNum(v: string | undefined): number | null {
  if (v == null || v === '' || v.toUpperCase() === 'NULL') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseNullableStr(v: string | undefined): string | null {
  if (v == null || v === '' || v.toUpperCase() === 'NULL') return null;
  return v;
}

function rowToTelemetry(cols: Record<string, string>): ValidatedTelemetry | null {
  const engineStatus = cols.EngineStatus === 'ON' ? 'ON' : 'OFF';
  const rentalRaw = cols.RentalStatus || 'Available';
  const allowed = [
    'Available',
    'Working',
    'Idle',
    'Maintenance',
    'Returned',
    'Overdue',
    'Assigned',
  ] as const;
  const rentalStatus = (allowed as readonly string[]).includes(rentalRaw)
    ? (rentalRaw as ValidatedTelemetry['rentalStatus'])
    : 'Available';

  // Schema requires lat/lng numbers; use 0 when missing so scoring still runs
  const lat = parseNullableNum(cols.Latitude);
  const lng = parseNullableNum(cols.Longitude);

  try {
    return {
      timestamp: cols.Timestamp?.replace(' ', 'T') ?? new Date().toISOString(),
      equipmentId: cols.EquipmentID,
      equipmentType: cols.EquipmentType,
      dealerId: cols.DealerID,
      siteId: parseNullableStr(cols.SiteID),
      operatorId: parseNullableStr(cols.OperatorID),
      engineStatus,
      fuelLevel: Math.min(100, Math.max(0, parseNum(cols.FuelLevel))),
      engineHours: Math.max(0, parseNum(cols.EngineHours)),
      idleHours: Math.max(0, parseNum(cols.IdleHours)),
      speed: Math.max(0, parseNum(cols.Speed)),
      latitude: lat ?? 0,
      longitude: lng ?? 0,
      engineTemperature: Math.min(120, Math.max(0, parseNum(cols.EngineTemperature))),
      hydraulicPressure: Math.max(0, parseNum(cols.HydraulicPressure)),
      batteryVoltage: Math.max(0.01, parseNum(cols.BatteryVoltage, 12)),
      loadPercentage: Math.min(100, Math.max(0, parseNum(cols.LoadPercentage))),
      vibrationLevel: Math.max(0, parseNum(cols.VibrationLevel)),
      rentalStatus,
    };
  } catch {
    return null;
  }
}

/**
 * Proxy labels approximating the anomaly types injected in generate_data.js.
 * Used only for offline evaluation (CSV has no isAnomaly column).
 */
function proxyLabel(
  t: ValidatedTelemetry,
  cols: Record<string, string>
): { isAnomaly: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const latMissing =
    cols.Latitude === '' ||
    cols.Latitude == null ||
    cols.Latitude.toUpperCase() === 'NULL';
  const lngMissing =
    cols.Longitude === '' ||
    cols.Longitude == null ||
    cols.Longitude.toUpperCase() === 'NULL';

  if (t.engineStatus === 'ON' && !t.operatorId) reasons.push('UNASSIGNED_OPERATOR');
  if (t.engineTemperature > 105) reasons.push('ENGINE_OVERHEAT');
  if (t.vibrationLevel > 15 && t.loadPercentage >= 90) reasons.push('SEVERE_VIBRATION');
  if (t.rentalStatus === 'Overdue') reasons.push('EXPIRED_RENTAL');
  if (t.engineStatus === 'ON' && (latMissing || lngMissing)) reasons.push('MISSING_GPS');
  if (t.batteryVoltage < 11) reasons.push('LOW_BATTERY');

  return { isAnomaly: reasons.length > 0, reasons };
}

function buildVectorFromTelemetry(t: ValidatedTelemetry): FeatureVector {
  const features = FeatureEngineeringLayer.compute(t);
  return [
    t.fuelLevel,
    t.engineHours,
    t.idleHours,
    t.speed,
    t.engineTemperature,
    t.hydraulicPressure,
    t.batteryVoltage,
    t.loadPercentage,
    t.vibrationLevel,
    features.fuelDelta,
    features.engineHoursDelta,
    features.idleHoursDelta,
    t.engineStatus === 'ON' ? 1 : 0,
    features.distanceFromSiteCenter ?? 0,
  ];
}

async function streamSamples(): Promise<{ train: SampleRow[]; test: SampleRow[]; scanned: number }> {
  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(
      `CSV not found at ${CSV_PATH}. Run: node scripts/generate_data.js`
    );
  }

  const needed = TRAIN_SIZE + TEST_SIZE;
  // Reservoir of size needed after warm-up of equipment state
  const reservoir: SampleRow[] = [];
  let scanned = 0;
  let sampled = 0;

  FeatureEngineeringLayer.reset();

  const rl = readline.createInterface({
    input: fs.createReadStream(CSV_PATH, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  let header: string[] | null = null;

  for await (const line of rl) {
    if (!line.trim()) continue;

    if (!header) {
      header = line.split(',').map((h) => h.trim());
      continue;
    }

    scanned++;
    if (MAX_ROWS > 0 && scanned > MAX_ROWS) break;

    // Always update feature state for deltas on every row we parse,
    // but only keep every SAMPLE_EVERY-th row for train/test pools.
    const parts = line.split(',');
    if (parts.length < HEADERS.length) continue;

    const cols: Record<string, string> = {};
    for (let i = 0; i < HEADERS.length; i++) {
      cols[HEADERS[i]] = (parts[i] ?? '').trim();
    }

    const telemetry = rowToTelemetry(cols);
    if (!telemetry || !telemetry.equipmentId) continue;

    const vector = buildVectorFromTelemetry(telemetry);
    const proxy = proxyLabel(telemetry, cols);

    // Skip first few packets per machine (zero deltas) by sampling later rows
    if (scanned % SAMPLE_EVERY !== 0) continue;

    sampled++;
    const row: SampleRow = {
      vector,
      telemetry,
      proxyAnomaly: proxy.isAnomaly,
      proxyReasons: proxy.reasons,
    };

    if (reservoir.length < needed) {
      reservoir.push(row);
    } else {
      // Reservoir sampling so later days are represented
      const j = Math.floor(Math.random() * sampled);
      if (j < needed) {
        reservoir[j] = row;
      }
    }

    if (scanned % 200_000 === 0) {
      console.log(
        `  …scanned ${scanned.toLocaleString()} rows | reservoir ${reservoir.length}/${needed}`
      );
    }
  }

  // Shuffle then split
  for (let i = reservoir.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [reservoir[i], reservoir[j]] = [reservoir[j], reservoir[i]];
  }

  const train = reservoir.slice(0, Math.min(TRAIN_SIZE, reservoir.length));
  const test = reservoir.slice(
    train.length,
    train.length + Math.min(TEST_SIZE, Math.max(0, reservoir.length - train.length))
  );

  return { train, test, scanned };
}

function printConfusion(
  title: string,
  tp: number,
  fp: number,
  tn: number,
  fn: number
) {
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  const accuracy = tp + tn + fp + fn === 0 ? 0 : (tp + tn) / (tp + tn + fp + fn);

  console.log(`\n── ${title} ──`);
  console.log(`  TP=${tp}  FP=${fp}  TN=${tn}  FN=${fn}`);
  console.log(`  Precision: ${(precision * 100).toFixed(2)}%`);
  console.log(`  Recall:    ${(recall * 100).toFixed(2)}%`);
  console.log(`  F1:        ${(f1 * 100).toFixed(2)}%`);
  console.log(`  Accuracy:  ${(accuracy * 100).toFixed(2)}%`);
}

async function main() {
  console.log('=====================================================');
  console.log(' Isolation Forest — CSV train & hybrid evaluation');
  console.log('=====================================================');
  console.log(`CSV:          ${CSV_PATH}`);
  console.log(`Train size:   ${TRAIN_SIZE}`);
  console.log(`Test size:    ${TEST_SIZE}`);
  console.log(`Sample every: ${SAMPLE_EVERY}th row`);
  console.log(`Features (${FEATURE_NAMES.length}): ${FEATURE_NAMES.join(', ')}`);
  console.log('');

  console.log('Streaming telemetry.csv and building feature vectors…');
  const t0 = Date.now();
  const { train, test, scanned } = await streamSamples();
  console.log(
    `Done in ${((Date.now() - t0) / 1000).toFixed(1)}s | scanned ${scanned.toLocaleString()} | train=${train.length} test=${test.length}`
  );

  if (train.length < 100) {
    throw new Error(`Not enough training samples (${train.length}). Check CSV / SAMPLE_EVERY.`);
  }

  // Prefer mostly-normal rows for training (proxy-negative), with a small mix of anomalies
  const normalTrain = train.filter((r) => !r.proxyAnomaly);
  const anomalyTrain = train.filter((r) => r.proxyAnomaly);
  const trainPool =
    normalTrain.length >= Math.floor(TRAIN_SIZE * 0.7)
      ? [
          ...normalTrain.slice(0, Math.floor(TRAIN_SIZE * 0.95)),
          ...anomalyTrain.slice(0, Math.floor(TRAIN_SIZE * 0.05)),
        ]
      : train;

  const trainVectors = trainPool.map((r) => r.vector);
  const trainAnomalyRate =
    trainPool.filter((r) => r.proxyAnomaly).length / Math.max(trainPool.length, 1);

  console.log(
    `\nTraining Isolation Forest on ${trainVectors.length} vectors (proxy-anomaly rate in train ≈ ${(trainAnomalyRate * 100).toFixed(2)}%)…`
  );

  const forest = new IsolationForest({
    ...DEFAULT_IF_CONFIG,
    nTrees: 100,
    sampleSize: Math.min(256, trainVectors.length),
    contaminationThreshold: 0.5, // temporary; replaced by adaptive quantile below
    seed: 42,
  });

  const fitStart = Date.now();
  const result = forest.fit(trainVectors);
  console.log(
    `Fit complete in ${Date.now() - fitStart}ms | trees=${result.nTrees} | samples=${result.nSamples}`
  );

  // Adaptive threshold: top ~5% of training scores (matches injected anomaly rate)
  const contamination = parseFloat(process.env.IF_CONTAMINATION ?? '0.05');
  const trainScores = trainVectors
    .map((v) => forest.score(v).score)
    .sort((a, b) => a - b);
  const qIndex = Math.min(
    trainScores.length - 1,
    Math.max(0, Math.floor(trainScores.length * (1 - contamination)))
  );
  const adaptiveThreshold = trainScores[qIndex];
  result.model.config.contaminationThreshold = adaptiveThreshold;
  forest.load(result.model);

  console.log(
    `Adaptive threshold @ ${(contamination * 100).toFixed(1)}% contamination: ${adaptiveThreshold.toFixed(4)}`
  );
  console.log(
    `  train score p50=${trainScores[Math.floor(trainScores.length * 0.5)].toFixed(4)} ` +
      `p90=${trainScores[Math.floor(trainScores.length * 0.9)].toFixed(4)} ` +
      `p95=${trainScores[Math.floor(trainScores.length * 0.95)].toFixed(4)} ` +
      `p99=${trainScores[Math.floor(trainScores.length * 0.99)].toFixed(4)} ` +
      `max=${trainScores[trainScores.length - 1].toFixed(4)}`
  );

  // Persist model for live ingestion hybrid phase
  const store = new ModelStore();
  store.save(result.model);
  console.log(`Model saved → ${store.getPath()}`);

  // ── Score test set ────────────────────────────────────────────────────────
  console.log(`\nScoring ${test.length} hold-out samples…`);
  FeatureEngineeringLayer.reset(); // rules need fresh state; re-compute features via stored telemetry

  let ifPos = 0;
  let rulePos = 0;
  let proxyPos = 0;
  let bothPos = 0;

  // IF vs proxy label
  let tp = 0,
    fp = 0,
    tn = 0,
    fn = 0;
  // IF vs rules
  let tpR = 0,
    fpR = 0,
    tnR = 0,
    fnR = 0;
  // Hybrid (rules OR IF) vs proxy
  let tpH = 0,
    fpH = 0,
    tnH = 0,
    fnH = 0;

  const scoreBuckets = { low: 0, mid: 0, high: 0, critical: 0 };
  const topOutliers: { score: number; id: string; proxy: boolean; rules: number }[] = [];

  for (const row of test) {
    const score = forest.score(row.vector);
    const ifHit = score.isAnomaly;

    // Re-run feature eng + rules on telemetry (stateful)
    const features = FeatureEngineeringLayer.compute(row.telemetry);
    const rules = RuleDetector.detect(row.telemetry, features);
    const ruleHit = rules.length > 0;
    const proxyHit = row.proxyAnomaly;
    const hybridHit = ruleHit || ifHit;

    if (ifHit) ifPos++;
    if (ruleHit) rulePos++;
    if (proxyHit) proxyPos++;
    if (ifHit && ruleHit) bothPos++;

    if (ifHit && proxyHit) tp++;
    else if (ifHit && !proxyHit) fp++;
    else if (!ifHit && !proxyHit) tn++;
    else fn++;

    if (ifHit && ruleHit) tpR++;
    else if (ifHit && !ruleHit) fpR++;
    else if (!ifHit && !ruleHit) tnR++;
    else fnR++;

    if (hybridHit && proxyHit) tpH++;
    else if (hybridHit && !proxyHit) fpH++;
    else if (!hybridHit && !proxyHit) tnH++;
    else fnH++;

    const thr = result.model.config.contaminationThreshold;
    if (score.score < thr - 0.05) scoreBuckets.low++;
    else if (score.score < thr) scoreBuckets.mid++;
    else if (score.score < thr + 0.05) scoreBuckets.high++;
    else scoreBuckets.critical++;

    if (ifHit) {
      topOutliers.push({
        score: score.score,
        id: row.telemetry.equipmentId,
        proxy: proxyHit,
        rules: rules.length,
      });
    }
  }

  topOutliers.sort((a, b) => b.score - a.score);

  console.log('\n=====================================================');
  console.log(' RESULTS');
  console.log('=====================================================');
  console.log(`Test samples:          ${test.length}`);
  console.log(
    `Proxy-labelled anomalies (CSV heuristics): ${proxyPos} (${((proxyPos / test.length) * 100).toFixed(2)}%)`
  );
  console.log(
    `Rule-based hits:       ${rulePos} (${((rulePos / test.length) * 100).toFixed(2)}%)`
  );
  console.log(
    `Isolation Forest hits: ${ifPos} (${((ifPos / test.length) * 100).toFixed(2)}%)`
  );
  console.log(
    `Both rule + IF:        ${bothPos} (${((bothPos / test.length) * 100).toFixed(2)}%)`
  );

  const thr = result.model.config.contaminationThreshold;
  console.log(`\nScore distribution (threshold=${thr.toFixed(4)}):`);
  console.log(`  well below thr:  ${scoreBuckets.low}`);
  console.log(`  near thr (below):${scoreBuckets.mid}`);
  console.log(`  just above thr:  ${scoreBuckets.high}`);
  console.log(`  strong outliers: ${scoreBuckets.critical}`);

  printConfusion('Isolation Forest vs proxy CSV labels', tp, fp, tn, fn);
  printConfusion('Isolation Forest vs Rule Detector', tpR, fpR, tnR, fnR);
  printConfusion('Hybrid (Rules OR IF) vs proxy labels', tpH, fpH, tnH, fnH);

  console.log('\nTop 10 Isolation Forest outliers:');
  for (const o of topOutliers.slice(0, 10)) {
    console.log(
      `  score=${o.score.toFixed(3)}  equipment=${o.id}  proxyLabel=${o.proxy}  ruleHits=${o.rules}`
    );
  }

  console.log('\n✓ Hybrid model ready for live ingest (models/isolation-forest.json)');
  console.log('=====================================================');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
