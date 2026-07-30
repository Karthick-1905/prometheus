import {
  FeatureVector,
  IsolationForestConfig,
  IsolationForestModel,
  IsolationForestScore,
  IsolationForestTrainResult,
  DEFAULT_IF_CONFIG,
} from './types';
import {
  averagePathLength,
  buildIsolationTree,
  createRng,
  pathLength,
} from './isolation-tree';

/**
 * IsolationForest
 * ---------------
 * Unsupervised ensemble of random isolation trees.
 * Short average path lengths → higher anomaly scores.
 *
 * Reference: Liu, Ting, Zhou — Isolation Forest (ICDM 2008).
 */
export class IsolationForest {
  private config: IsolationForestConfig;
  private model: IsolationForestModel | null = null;

  constructor(config: Partial<IsolationForestConfig> = {}) {
    this.config = { ...DEFAULT_IF_CONFIG, ...config };
  }

  /**
   * Fit trees on a training matrix of feature vectors.
   * Prefer "mostly normal" historical telemetry for best thresholds.
   */
  public fit(data: FeatureVector[]): IsolationForestTrainResult {
    if (data.length === 0) {
      throw new Error('IsolationForest.fit requires at least one sample');
    }

    const featureCount = data[0].length;
    for (const row of data) {
      if (row.length !== featureCount) {
        throw new Error('All feature vectors must have the same length');
      }
    }

    const sampleSize = Math.min(this.config.sampleSize, data.length);
    const maxDepth =
      this.config.maxDepth ?? Math.ceil(Math.log2(Math.max(sampleSize, 2)));

    const rng = createRng(this.config.seed);
    const trees = [];

    for (let t = 0; t < this.config.nTrees; t++) {
      const subsample = sampleWithoutReplacement(data, sampleSize, rng);
      trees.push(buildIsolationTree(subsample, 0, maxDepth, rng));
    }

    this.model = {
      version: 1,
      trainedAt: new Date().toISOString(),
      config: { ...this.config, sampleSize, maxDepth },
      trees,
      nSamples: data.length,
      featureCount,
    };

    return {
      model: this.model,
      nSamples: data.length,
      nTrees: trees.length,
    };
  }

  /** Load a previously trained / serialized model. */
  public load(model: IsolationForestModel): void {
    this.model = model;
    this.config = { ...this.config, ...model.config };
  }

  public getModel(): IsolationForestModel | null {
    return this.model;
  }

  public isTrained(): boolean {
    return this.model !== null && this.model.trees.length > 0;
  }

  /**
   * Score one feature vector.
   * score = 2^(-E(h(x)) / c(n))  — closer to 1 = more anomalous.
   */
  public score(point: FeatureVector): IsolationForestScore {
    if (!this.model) {
      throw new Error('IsolationForest is not trained. Call fit() or load() first.');
    }
    if (point.length !== this.model.featureCount) {
      throw new Error(
        `Feature count mismatch: got ${point.length}, model expects ${this.model.featureCount}`
      );
    }

    const n = this.model.config.sampleSize;
    const c = averagePathLength(n);
    if (c === 0) {
      return { score: 0.5, isAnomaly: false, meanPathLength: 0 };
    }

    let pathSum = 0;
    for (const tree of this.model.trees) {
      pathSum += pathLength(point, tree, 0);
    }
    const meanPathLength = pathSum / this.model.trees.length;
    const score = Math.pow(2, -meanPathLength / c);
    const threshold = this.model.config.contaminationThreshold;

    return {
      score,
      isAnomaly: score >= threshold,
      meanPathLength,
    };
  }

  public scoreBatch(points: FeatureVector[]): IsolationForestScore[] {
    return points.map((p) => this.score(p));
  }
}

function sampleWithoutReplacement(
  data: FeatureVector[],
  k: number,
  rng: () => number
): FeatureVector[] {
  const n = data.length;
  if (k >= n) return data.slice();

  // Partial Fisher–Yates
  const indices = Array.from({ length: n }, (_, i) => i);
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(rng() * (n - i));
    const tmp = indices[i];
    indices[i] = indices[j];
    indices[j] = tmp;
  }
  return indices.slice(0, k).map((i) => data[i]);
}
