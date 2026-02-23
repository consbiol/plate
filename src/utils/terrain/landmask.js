import { pickRng } from '../rng.js';

const SEED_STRICT_ERAS = new Set(['文明時代', '海棲文明時代']);
const DIRS_8 = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], /*0,0*/ [1, 0],
  [-1, 1], [0, 1], [1, 1]
];
const DEFAULT_EXPANSION_BIAS = 0.12;
const DEFAULT_MAX_ITERATIONS = 10;
const FLIP_PROB = 0.30;
const SCORE_BAND_RATIO = 0.05;

const isSeedStrictEra = (era) => SEED_STRICT_ERAS.has(era);

function getGridContext(ctx) {
  const { gridWidth, gridHeight, torusWrap, _getDerivedRng, era } = ctx;
  return { gridWidth, gridHeight, torusWrap, _getDerivedRng, era };
}

function countLandNeighbors(x, y, landMask, gridWidth, torusWrap) {
  let count = 0;
  for (const [dx, dy] of DIRS_8) {
    const wrapped = torusWrap(x + dx, y + dy);
    if (!wrapped) continue;
    if (landMask[wrapped.y * gridWidth + wrapped.x]) count++;
  }
  return count;
}

export function dilateLandMask(ctx, {
  landMask,
  scores,
  threshold,
  expansionBias = DEFAULT_EXPANSION_BIAS,
  maxIterations = DEFAULT_MAX_ITERATIONS
}) {
  const { gridWidth, gridHeight, torusWrap } = getGridContext(ctx);
  let current = landMask.slice();
  for (let iter = 0; iter < maxIterations; iter++) {
    const newLandMask = current.slice();
    let changed = false;
    for (let gy = 0; gy < gridHeight; gy++) {
      for (let gx = 0; gx < gridWidth; gx++) {
        const idx = gy * gridWidth + gx;
        if (current[idx]) continue;
        const landNeighborCount = countLandNeighbors(gx, gy, current, gridWidth, torusWrap);
        const scoreClose = scores[idx] >= threshold - expansionBias;
        if ((landNeighborCount >= 3 && scoreClose) || landNeighborCount >= 4) {
          newLandMask[idx] = true;
          changed = true;
        }
      }
    }
    current = newLandMask;
    if (!changed) break;
  }
  return current;
}

export function removeSingleCellIslands(ctx, {
  landMask,
  seededRng,
  singleCellRemovalProb = 0.5
}) {
  const { gridWidth, gridHeight, torusWrap, _getDerivedRng } = getGridContext(ctx);
  const singleCellRemovalProbClamped = Math.max(0, Math.min(1, singleCellRemovalProb));
  const next = landMask.slice();
  for (let gy = 0; gy < gridHeight; gy++) {
    for (let gx = 0; gx < gridWidth; gx++) {
      const idx = gy * gridWidth + gx;
      if (!next[idx]) continue;
      const hasLandNeighbor = countLandNeighbors(gx, gy, next, gridWidth, torusWrap) > 0;
      if (!hasLandNeighbor) {
        const pick = pickRng(_getDerivedRng('coast-island', gx, gy), seededRng);
        if (pick() < singleCellRemovalProbClamped) next[idx] = false;
      }
    }
  }
  return next;
}

export function jitterCoastline(ctx, {
  landMask,
  scores,
  threshold,
  seededRng
}) {
  const { gridWidth, gridHeight, torusWrap, _getDerivedRng, era } = getGridContext(ctx);
  const next = landMask.slice();
  let minScore = Infinity, maxScore = -Infinity;
  for (let i = 0; i < scores.length; i++) {
    const s = scores[i];
    if (s < minScore) minScore = s;
    if (s > maxScore) maxScore = s;
  }
  const scoreBand = Math.max(1e-6, (maxScore - minScore) * SCORE_BAND_RATIO);

  const hasOppNeighbor = (x, y) => {
    const a = y * gridWidth + x;
    for (const [dx, dy] of DIRS_8) {
      const w = torusWrap(x + dx, y + dy);
      if (!w) continue;
      const b = w.y * gridWidth + w.x;
      if (next[a] !== next[b]) return true;
    }
    return false;
  };

  for (let gy = 0; gy < gridHeight; gy++) {
    for (let gx = 0; gx < gridWidth; gx++) {
      const idx = gy * gridWidth + gx;
      const s = scores[idx];
      if (Math.abs(s - threshold) <= scoreBand && hasOppNeighbor(gx, gy)) {
        const strict = isSeedStrictEra(era) && !!seededRng;
        const r = strict
          ? pickRng(_getDerivedRng('coast-flip', gx, gy), seededRng)
          : pickRng();
        if (r() < FLIP_PROB) {
          next[idx] = !next[idx];
        }
      }
    }
  }
  return next;
}
