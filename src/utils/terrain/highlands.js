const HIGHLAND_START_ATTEMPTS = 10;
const HIGHLAND_SIZE_BASE = 30;
const HIGHLAND_SIZE_RANGE = 121;
const SPREAD_INTENSITY_BASE = 0.5;
const SPREAD_INTENSITY_RANGE = 1.0;
const CLUSTER_NOISE_SCALE = 2.0;
const LAND_RATIO_DEFAULT = 0.3;

const defaultRng = (rng) => (rng || Math.random);
export function generateHighlands(ctx, centers, centerLandCellsPre, preLandMask, lakeMask, colors, highlandColor, seededRng, seededLog) {
  const N = ctx.gridWidth * ctx.gridHeight;
  const highlandMask = new Array(N).fill(false);
  const seedStrict = (ctx.era === '文明時代' || ctx.era === '海棲文明時代') && !!seededRng;

  for (let ci = 0; ci < centers.length; ci++) {
    const centerRng = ctx._getDerivedRng('highland-center', ci);
    const landRatioForHighlands = (typeof ctx.seaLandRatio === 'number') ? Number(ctx.seaLandRatio) : LAND_RATIO_DEFAULT;
    const lambda = 0.5 + 11 * landRatioForHighlands;
    const numHighlands = ctx._poissonSample(lambda, 20, centerRng || seededRng);

    if (seededLog && seededLog[ci]) {
      seededLog[ci].highlandsCount = numHighlands;
      if (!Array.isArray(seededLog[ci].highlandClusters)) seededLog[ci].highlandClusters = [];
    }

    const centerLandGrids = centerLandCellsPre[ci] || [];
    if (centerLandGrids.length === 0) continue;

    for (let highlandIdx = 0; highlandIdx < numHighlands; highlandIdx++) {
      const clusterRng = ctx._getDerivedRng('highland-cluster', ci, highlandIdx);
      let start = null;
      for (let attempt = 0; attempt < HIGHLAND_START_ATTEMPTS; attempt++) {
        const r = seedStrict ? (clusterRng || seededRng) : defaultRng(clusterRng || seededRng);
        const startIdx = Math.floor(r() * centerLandGrids.length);
        const cand = centerLandGrids[startIdx];
        if (preLandMask[cand.idx] && !lakeMask[cand.idx] && !highlandMask[cand.idx]) { start = cand; break; }
      }
      if (!start) continue;

      const rForSize = seedStrict ? (clusterRng || seededRng) : defaultRng(clusterRng || seededRng);
      const targetSize = HIGHLAND_SIZE_BASE + Math.floor(rForSize() * HIGHLAND_SIZE_RANGE);
      if (seededLog && seededLog[ci]) {
        seededLog[ci].highlandClusters.push({ x: start.x, y: start.y, size: targetSize });
      }

      const rDir = seedStrict ? (clusterRng || seededRng) : defaultRng(clusterRng || seededRng);
      const mainAngle = rDir() * Math.PI * 2;
      const mainDx = Math.cos(mainAngle);
      const mainDy = Math.sin(mainAngle);
      const rSpread = seedStrict ? (clusterRng || seededRng) : defaultRng(clusterRng || seededRng);
      const spreadIntensity = SPREAD_INTENSITY_BASE + rSpread() * SPREAD_INTENSITY_RANGE;
      const perpDx = -mainDy;
      const perpDy = mainDx;

      const highlandCells = [start.idx];
      const visited = new Set([start.idx]);
      const queue = [{ x: start.x, y: start.y, idx: start.idx, dist: 0 }];
      const mainProgress = new Map();
      mainProgress.set(start.idx, 0);
      let qi = 0;

      while (qi < queue.length && highlandCells.length < targetSize) {
        const current = queue[qi++];
        const currentProgress = mainProgress.get(current.idx) || 0;
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue;
            const wrapped = ctx.torusWrap(current.x + dx, current.y + dy);
            if (!wrapped) continue;
            const nIdx = wrapped.y * ctx.gridWidth + wrapped.x;
            if (visited.has(nIdx)) continue;
            if (!preLandMask[nIdx]) continue;
            if (lakeMask[nIdx]) continue;
            const relX = wrapped.x - start.x;
            const relY = wrapped.y - start.y;
            const progress = relX * mainDx + relY * mainDy;
            const perpOffset = relX * perpDx + relY * perpDy;
            const rNoise = seedStrict ? (clusterRng || seededRng) : defaultRng(clusterRng || seededRng);
            const noise = (rNoise() * 2 - 1) * CLUSTER_NOISE_SCALE;
            const allowedPerpSpread = spreadIntensity * (1 + Math.abs(noise));
            if (progress >= currentProgress - 0.5 && Math.abs(perpOffset) <= allowedPerpSpread) {
              visited.add(nIdx);
              highlandCells.push(nIdx);
              mainProgress.set(nIdx, progress);
              queue.push({ x: wrapped.x, y: wrapped.y, idx: nIdx, dist: current.dist + 1 });
            }
          }
        }
      }

      for (const cellIdx of highlandCells) {
        highlandMask[cellIdx] = true;
      }
    }
  }

  for (let i = 0; i < N; i++) {
    if (highlandMask[i]) {
      colors[i] = highlandColor;
    }
  }
  return highlandMask;
}


