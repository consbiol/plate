function isSeedStrictEra(era) {
  return (era === '文明時代' || era === '海棲文明時代');
}

function getGridContext(ctx) {
  const { gridWidth, gridHeight, torusWrap, _getDerivedRng, era } = ctx;
  return { gridWidth, gridHeight, torusWrap, _getDerivedRng, era };
}

function countLandNeighbors(x, y, landMask, gridWidth, torusWrap) {
  let count = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const wrapped = torusWrap(x + dx, y + dy);
      if (!wrapped) continue;
      if (landMask[wrapped.y * gridWidth + wrapped.x]) count++;
    }
  }
  return count;
}

export function dilateLandMask(ctx, {
  landMask,
  scores,
  threshold,
  expansionBias = 0.12,
  maxIterations = 10
}) {
  const { gridWidth, gridHeight, torusWrap } = getGridContext(ctx);
  for (let iter = 0; iter < maxIterations; iter++) {
    const newLandMask = landMask.slice();
    let changed = false;
    for (let gy = 0; gy < gridHeight; gy++) {
      for (let gx = 0; gx < gridWidth; gx++) {
        const idx = gy * gridWidth + gx;
        if (landMask[idx]) continue;
        const landNeighborCount = countLandNeighbors(gx, gy, landMask, gridWidth, torusWrap);
        const scoreClose = scores[idx] >= threshold - expansionBias;
        if ((landNeighborCount >= 3 && scoreClose) || landNeighborCount >= 4) {
          newLandMask[idx] = true;
          changed = true;
        }
      }
    }
    for (let i = 0; i < landMask.length; i++) landMask[i] = newLandMask[i];
    if (!changed) break;
  }
}

export function removeSingleCellIslands(ctx, {
  landMask,
  seededRng,
  singleCellRemovalProb = 0.5
}) {
  const { gridWidth, gridHeight, torusWrap, _getDerivedRng } = getGridContext(ctx);
  const singleCellRemovalProbClamped = Math.max(0, Math.min(1, singleCellRemovalProb));
  for (let gy = 0; gy < gridHeight; gy++) {
    for (let gx = 0; gx < gridWidth; gx++) {
      const idx = gy * gridWidth + gx;
      if (!landMask[idx]) continue;
      const hasLandNeighbor = countLandNeighbors(gx, gy, landMask, gridWidth, torusWrap) > 0;
      if (!hasLandNeighbor) {
        const pickRng = _getDerivedRng('coast-island', gx, gy) || seededRng || Math.random;
        if (pickRng() < singleCellRemovalProbClamped) landMask[idx] = false;
      }
    }
  }
}

export function jitterCoastline(ctx, {
  landMask,
  scores,
  threshold,
  seededRng
}) {
  const { gridWidth, gridHeight, torusWrap, _getDerivedRng, era } = getGridContext(ctx);
  let minScore = Infinity, maxScore = -Infinity;
  for (let i = 0; i < scores.length; i++) {
    const s = scores[i];
    if (s < minScore) minScore = s;
    if (s > maxScore) maxScore = s;
  }
  const scoreBand = Math.max(1e-6, (maxScore - minScore) * 0.05);
  const flipProb = 0.30;

  const hasOppNeighbor = (x, y) => {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const w = torusWrap(x + dx, y + dy);
        if (!w) continue;
        const a = y * gridWidth + x;
        const b = w.y * gridWidth + w.x;
        if (landMask[a] !== landMask[b]) return true;
      }
    }
    return false;
  };

  for (let gy = 0; gy < gridHeight; gy++) {
    for (let gx = 0; gx < gridWidth; gx++) {
      const idx = gy * gridWidth + gx;
      const s = scores[idx];
      if (Math.abs(s - threshold) <= scoreBand && hasOppNeighbor(gx, gy)) {
        const strict = isSeedStrictEra(era) && !!seededRng;
        const r = strict ? (_getDerivedRng('coast-flip', gx, gy) || seededRng) : Math.random;
        if (r() < flipProb) {
          landMask[idx] = !landMask[idx];
        }
      }
    }
  }
}


