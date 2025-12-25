// 見た目ノイズ（乾燥地・海エッジなど）の前計算

function isSeedStrictEra(vm) {
  return (vm.era === '文明時代' || vm.era === '海棲文明時代');
}

export function getDirections8() {
  return [
    { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
    { dx: -1, dy: 0 },                     { dx: 1, dy: 0 },
    { dx: -1, dy: 1 },  { dx: 0, dy: 1 },  { dx: 1, dy: 1 }
  ];
}

export function buildVisualNoiseGrid(vm, {
  N,
  seededRng
}) {
  const noiseGrid = new Array(N);
  for (let gy = 0; gy < vm.gridHeight; gy++) {
    for (let gx = 0; gx < vm.gridWidth; gx++) {
      const idx = gy * vm.gridWidth + gx;
      // 乾燥地・海エッジなど「見た目ノイズ」
      // 文明時代・海棲文明時代のみシードで固定（浅瀬/深海境界・砂漠/低地境界を決定論化）
      const strict = isSeedStrictEra(vm) && !!seededRng;
      const vrng = strict ? (vm._getDerivedRng('vis-noise', gx, gy) || seededRng) : Math.random;
      noiseGrid[idx] = (vrng() * 2 - 1);
    }
  }
  return noiseGrid;
}


