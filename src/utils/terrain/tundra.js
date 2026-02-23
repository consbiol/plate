const SEED_STRICT_ERAS = new Set(['文明時代', '海棲文明時代']);

const isSeedStrictEra = (vm) => SEED_STRICT_ERAS.has(vm.era);

const pickNoise = (vm, table, idx, rngKey, gx, gy, amplitude) => {
  if (table && Number.isFinite(table[idx])) {
    return table[idx] * amplitude;
  }
  const rng = isSeedStrictEra(vm) ? (vm._getDerivedRng(rngKey, gx, gy) || Math.random) : Math.random;
  return (rng() * 2 - 1) * amplitude;
};

export function applyTundra(vm, {
  colors,
  landNoiseAmplitude,
  lowlandColor,
  tundraColor,
  computedTopTundraRows = null,
  tundraNoiseTableTop = null,
  tundraNoiseTableBottom = null
}) {
  const baseRows = (typeof computedTopTundraRows === 'number') ? computedTopTundraRows : vm.topTundraRows;
  if (!(baseRows > 0)) return;

  for (let gy = 0; gy < vm.gridHeight; gy++) {
    for (let gx = 0; gx < vm.gridWidth; gx++) {
      const idx = gy * vm.gridWidth + gx;
      if (colors[idx] !== lowlandColor) continue;
      const distanceFromTop = gy;
      const noise = pickNoise(vm, tundraNoiseTableTop, idx, 'tundra-top', gx, gy, landNoiseAmplitude);
      const threshold = baseRows > 0 ? Math.max(0, baseRows + noise) : 0;
      if (distanceFromTop < threshold) {
        colors[idx] = tundraColor;
      }
    }
  }

  for (let gy = 0; gy < vm.gridHeight; gy++) {
    for (let gx = 0; gx < vm.gridWidth; gx++) {
      const idx = gy * vm.gridWidth + gx;
      if (colors[idx] !== lowlandColor) continue;
      const distanceFromBottom = vm.gridHeight - 1 - gy;
      const noise = pickNoise(vm, tundraNoiseTableBottom, idx, 'tundra-bottom', gx, gy, landNoiseAmplitude);
      const threshold = baseRows > 0 ? Math.max(0, baseRows + noise) : 0;
      if (distanceFromBottom < threshold) {
        colors[idx] = tundraColor;
      }
    }
  }
}
