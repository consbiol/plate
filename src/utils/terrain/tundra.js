const SEED_STRICT_ERAS = new Set(['文明時代', '海棲文明時代']);

const isSeedStrictEra = (era) => SEED_STRICT_ERAS.has(era);

const pickNoise = ({ era, derivedRng }, table, idx, rngKey, gx, gy, amplitude) => {
  if (table && Number.isFinite(table[idx])) {
    return table[idx] * amplitude;
  }
  const rng = isSeedStrictEra(era)
    ? ((derivedRng && derivedRng(rngKey, gx, gy)) || Math.random)
    : Math.random;
  return (rng() * 2 - 1) * amplitude;
};

export function applyTundra({
  gridWidth,
  gridHeight,
  era,
  derivedRng,
  topTundraRows
}, {
  colors,
  landNoiseAmplitude,
  lowlandColor,
  tundraColor,
  computedTopTundraRows = null,
  tundraNoiseTableTop = null,
  tundraNoiseTableBottom = null
}) {
  const baseRows = (typeof computedTopTundraRows === 'number') ? computedTopTundraRows : topTundraRows;
  if (!(baseRows > 0)) return;

  for (let gy = 0; gy < gridHeight; gy++) {
    for (let gx = 0; gx < gridWidth; gx++) {
      const idx = gy * gridWidth + gx;
      if (colors[idx] !== lowlandColor) continue;
      const distanceFromTop = gy;
      const noise = pickNoise({ era, derivedRng }, tundraNoiseTableTop, idx, 'tundra-top', gx, gy, landNoiseAmplitude);
      const threshold = baseRows > 0 ? Math.max(0, baseRows + noise) : 0;
      if (distanceFromTop < threshold) {
        colors[idx] = tundraColor;
      }
    }
  }

  for (let gy = 0; gy < gridHeight; gy++) {
    for (let gx = 0; gx < gridWidth; gx++) {
      const idx = gy * gridWidth + gx;
      if (colors[idx] !== lowlandColor) continue;
      const distanceFromBottom = gridHeight - 1 - gy;
      const noise = pickNoise({ era, derivedRng }, tundraNoiseTableBottom, idx, 'tundra-bottom', gx, gy, landNoiseAmplitude);
      const threshold = baseRows > 0 ? Math.max(0, baseRows + noise) : 0;
      if (distanceFromBottom < threshold) {
        colors[idx] = tundraColor;
      }
    }
  }
}
