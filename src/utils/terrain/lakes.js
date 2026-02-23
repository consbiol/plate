import { bestEffort } from '../bestEffort.js';

const LAKE_DIRS_8 = [
  { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
  { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
  { dx: -1, dy: -1 }, { dx: 1, dy: -1 },
  { dx: -1, dy: 1 }, { dx: 1, dy: 1 }
];
const LAKE_START_ATTEMPTS = 10;
const LAKE_TARGET_SIZE_BASE = 3;
const LAKE_TARGET_SIZE_RANGE = 13;
const LAKE_STEP_PROBABILITY = 0.4;
const LOWLAND_RADIUS_DIVISOR = 5;

const calcLakeRadius = (threshold) => Math.ceil(Number(threshold || 0) / LOWLAND_RADIUS_DIVISOR);
const defaultRng = (seededRng) => (seededRng || Math.random);

const findLakeStart = ({
  centerLandGrids,
  landMask,
  lakeMask,
  rng,
  maxAttempts
}) => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const startIdx = Math.floor(rng() * centerLandGrids.length);
    const cand = centerLandGrids[startIdx];
    if (landMask[cand.idx] && !lakeMask[cand.idx]) return cand;
  }
  return null;
};
export function generateLakes(ctx, centers, centerLandCells, landMask, colors, shallowSeaColor, lowlandColor, desertColor, seededRng, seededLog) {
  const N = ctx.gridWidth * ctx.gridHeight;
  const lakeMask = new Array(N).fill(false);
  const lakesList = [];
  const seedStrict = (ctx.era === '文明時代' || ctx.era === '海棲文明時代') && !!seededRng;

  for (let ci = 0; ci < centers.length; ci++) {
    const lambda = ctx.averageLakesPerCenter;
    const countRng = seedStrict ? (ctx._getDerivedRng('lake-count', ci) || seededRng) : null;
    const numLakes = ctx._poissonSample(lambda, 20, countRng || defaultRng(seededRng));
    const centerLandGrids = centerLandCells[ci] || [];
    if (centerLandGrids.length === 0) continue;

    for (let lakeIdx = 0; lakeIdx < numLakes; lakeIdx++) {
      const start = findLakeStart({
        centerLandGrids,
        landMask,
        lakeMask,
        rng: defaultRng(seededRng),
        maxAttempts: LAKE_START_ATTEMPTS
      });
      if (!start) continue;

      if (seededLog && seededLog[ci]) {
        if (!Array.isArray(seededLog[ci].lakeStarts)) seededLog[ci].lakeStarts = [];
        seededLog[ci].lakeStarts.push({ x: start.x, y: start.y });
      }

      const sizeRng = seedStrict ? (ctx._getDerivedRng('lake-size', ci, lakeIdx) || seededRng) : null;
      const targetSize = LAKE_TARGET_SIZE_BASE + Math.floor((sizeRng || Math.random)() * LAKE_TARGET_SIZE_RANGE);
      const lakeQueue = [{ x: start.x, y: start.y, idx: start.idx }];
      const visited = new Set([start.idx]);
      const lakeCells = [start.idx];
      let q = 0;
      const stepRng = seedStrict ? (ctx._getDerivedRng('lake-expand', ci, lakeIdx) || seededRng) : null;

      while (q < lakeQueue.length && lakeCells.length < targetSize) {
        const cur = lakeQueue[q++];
        for (const d of LAKE_DIRS_8) {
          const rr = (stepRng || Math.random)();
          if (rr > LAKE_STEP_PROBABILITY) continue;
          const wrapped = ctx.torusWrap(cur.x + d.dx, cur.y + d.dy);
          if (!wrapped) continue;
          const nIdx = wrapped.y * ctx.gridWidth + wrapped.x;
          if (visited.has(nIdx)) continue;
          if (!landMask[nIdx]) continue;
          visited.add(nIdx);
          lakeCells.push(nIdx);
          lakeQueue.push({ x: wrapped.x, y: wrapped.y, idx: nIdx });
          if (lakeCells.length >= targetSize) break;
        }
      }

      for (const cellIdx of lakeCells) {
        lakeMask[cellIdx] = true;
      }

      let bandThreshold = 0;
      if (typeof ctx._getLandDistanceThresholdForRow === 'function') {
        try { bandThreshold = Number(ctx._getLandDistanceThresholdForRow(start.y, start.x)) || 0; } catch (e) { bandThreshold = 0; }
      }
      const radiusForThisLake = calcLakeRadius(bandThreshold);
      lakesList.push({
        startX: start.x,
        startY: start.y,
        startIdx: start.idx,
        cells: lakeCells.slice(),
        radius: radiusForThisLake
      });
    }
  }

  for (let i = 0; i < lakeMask.length; i++) {
    if (lakeMask[i]) colors[i] = shallowSeaColor;
  }

  bestEffort(() => {
    applyLowlandAroundLakes(ctx, {
      colors,
      lakesList,
      lakeMask,
      baseLandThr: ctx.baseLandDistanceThreshold,
      desertColor,
      lowlandColor
    });
  });

  bestEffort(() => { ctx._lastLakesList = lakesList; });
  return lakeMask;
}

export function applyLowlandAroundLakes(ctx, options) {
  const colors = options.colors;
  const lakesList = options.lakesList;
  const lakeMask = options.lakeMask;
  const baseLandThr = options.baseLandThr || 0;
  const desertColor = options.desertColor;
  const lowlandColor = options.lowlandColor;

  if (Array.isArray(lakesList) && lakesList.length === 0) {
    const lakeLowlandRadius = Math.floor(Number(baseLandThr || 0) / LOWLAND_RADIUS_DIVISOR);
    if (lakeLowlandRadius > 0 && lakeMask) {
      for (let gy = 0; gy < ctx.gridHeight; gy++) {
        for (let gx = 0; gx < ctx.gridWidth; gx++) {
          const idx = gy * ctx.gridWidth + gx;
          if (!lakeMask[idx]) continue;
          for (let dy = -lakeLowlandRadius; dy <= lakeLowlandRadius; dy++) {
            for (let dx = -lakeLowlandRadius; dx <= lakeLowlandRadius; dx++) {
              const wrapped = ctx.torusWrap(gx + dx, gy + dy);
              if (!wrapped) continue;
              const d = Math.hypot(dx, dy);
              if (d > lakeLowlandRadius) continue;
              const nIdx = wrapped.y * ctx.gridWidth + wrapped.x;
              if (colors[nIdx] === desertColor) {
                colors[nIdx] = lowlandColor;
              }
            }
          }
        }
      }
    }
    return;
  }

  for (const lake of (lakesList || [])) {
    let R = lake && Number.isFinite(lake.radius) ? Number(lake.radius) : 0;
    if (lake && typeof ctx._getLandDistanceThresholdForRow === 'function' && typeof lake.startY === 'number' && typeof lake.startX === 'number') {
      try {
        const bandThreshold = Number(ctx._getLandDistanceThresholdForRow(lake.startY, lake.startX)) || baseLandThr || 0;
        R = calcLakeRadius(bandThreshold);
      } catch (e) {
        // fallback to precomputed radius
      }
    }
    if (!Number.isFinite(R) || R <= 0) continue;
    for (const cellIdx of (lake.cells || [])) {
      const gx = cellIdx % ctx.gridWidth;
      const gy = Math.floor(cellIdx / ctx.gridWidth);
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          const wrapped = ctx.torusWrap(gx + dx, gy + dy);
          if (!wrapped) continue;
          const d = Math.hypot(dx, dy);
          if (d > R) continue;
          const nIdx = wrapped.y * ctx.gridWidth + wrapped.x;
          if (colors[nIdx] === desertColor) {
            colors[nIdx] = lowlandColor;
          }
        }
      }
    }
  }
}