const SEED_STRICT_ERAS = new Set(['文明時代', '海棲文明時代']);
const FALLBACK_DIRS_8 = [
  { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
  { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
  { dx: -1, dy: 1 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }
];

const isSeedStrictEra = (era) => SEED_STRICT_ERAS.has(era);

export function getDirections8() {
  try {
    const { DIRS8 } = require('./features/constants');
    if (Array.isArray(DIRS8) && DIRS8.length > 0) return DIRS8;
  } catch (e) {
    // fallback to local definition
  }
  return FALLBACK_DIRS_8;
}

export function buildVisualNoiseGrid({
  gridWidth,
  gridHeight,
  era,
  derivedRng
}, {
  N,
  seededRng
}) {
  const noiseGrid = new Array(N);
  const getRng = derivedRng || null;
  for (let gy = 0; gy < gridHeight; gy++) {
    for (let gx = 0; gx < gridWidth; gx++) {
      const idx = gy * gridWidth + gx;
      const strict = isSeedStrictEra(era) && !!seededRng;
      const vrng = strict
        ? ((getRng && getRng('vis-noise', gx, gy)) || seededRng)
        : Math.random;
      noiseGrid[idx] = (vrng() * 2 - 1);
    }
  }
  return noiseGrid;
}
