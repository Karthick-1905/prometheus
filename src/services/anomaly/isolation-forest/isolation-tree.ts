import { FeatureVector, IsolationTreeNode } from './types';

/**
 * Seeded mulberry32 PRNG — deterministic trees for reproducible models.
 */
export function createRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Average path length of unsuccessful search in a Binary Search Tree.
 * c(n) from the original Isolation Forest paper (Liu et al., 2008).
 */
export function averagePathLength(n: number): number {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  const H = Math.log(n - 1) + 0.5772156649; // harmonic number approx
  return 2 * H - (2 * (n - 1)) / n;
}

/**
 * Recursively builds one isolation tree on a subsample of the data.
 */
export function buildIsolationTree(
  data: FeatureVector[],
  depth: number,
  maxDepth: number,
  rng: () => number
): IsolationTreeNode {
  const size = data.length;

  // External node — fully isolated or depth limit reached
  if (depth >= maxDepth || size <= 1) {
    return {
      featureIndex: -1,
      splitValue: 0,
      size,
      left: null,
      right: null,
    };
  }

  const featureCount = data[0].length;
  const featureIndex = Math.floor(rng() * featureCount);

  let min = Infinity;
  let max = -Infinity;
  for (const row of data) {
    const v = row[featureIndex];
    if (v < min) min = v;
    if (v > max) max = v;
  }

  // Constant feature — cannot split further
  if (min === max || !Number.isFinite(min) || !Number.isFinite(max)) {
    return {
      featureIndex: -1,
      splitValue: 0,
      size,
      left: null,
      right: null,
    };
  }

  const splitValue = min + rng() * (max - min);
  const leftData: FeatureVector[] = [];
  const rightData: FeatureVector[] = [];

  for (const row of data) {
    if (row[featureIndex] < splitValue) {
      leftData.push(row);
    } else {
      rightData.push(row);
    }
  }

  // Degenerate split (all points same side) — stop
  if (leftData.length === 0 || rightData.length === 0) {
    return {
      featureIndex: -1,
      splitValue: 0,
      size,
      left: null,
      right: null,
    };
  }

  return {
    featureIndex,
    splitValue,
    size,
    left: buildIsolationTree(leftData, depth + 1, maxDepth, rng),
    right: buildIsolationTree(rightData, depth + 1, maxDepth, rng),
  };
}

/**
 * Path length of a single point through one tree.
 * Adds c(size) correction when terminating at an external node with size > 1.
 */
export function pathLength(
  point: FeatureVector,
  node: IsolationTreeNode,
  currentDepth: number
): number {
  if (node === null) {
    return currentDepth;
  }

  // External leaf (no children)
  if (node.left === null && node.right === null) {
    return currentDepth + averagePathLength(node.size);
  }

  if (point[node.featureIndex] < node.splitValue) {
    return pathLength(point, node.left, currentDepth + 1);
  }
  return pathLength(point, node.right, currentDepth + 1);
}
