// ツンドラの適用（上端/下端）
// - Grids_Calculation.vue から切り出し（機能不変）

function isSeedStrictEra(vm) {
  return (vm.era === '文明時代' || vm.era === '海棲文明時代');
}

export function applyTundra(vm, {
  colors,
  landNoiseAmplitude,
  lowlandColor,
  tundraColor,
  // 追加（高頻度更新用）:
  // 乱数由来の揺らぎを「Generate時に固定」したい場合は [-1,1] のテーブルを渡す。
  // 未指定なら従来通り（文明時代系はderivedRng、それ以外はMath.random）で毎回揺らぐ。
  tundraNoiseTableTop = null,
  tundraNoiseTableBottom = null
}) {
  // 基準が0以下ならツンドラは生成しない（氷河と同様の扱い）
  if (!(vm.topTundraRows > 0)) return;

  for (let gy = 0; gy < vm.gridHeight; gy++) {
    for (let gx = 0; gx < vm.gridWidth; gx++) {
      const idx = gy * vm.gridWidth + gx;
      if (colors[idx] !== lowlandColor) continue;
      const distanceFromTop = gy;
      let noise = 0;
      if (tundraNoiseTableTop && Number.isFinite(tundraNoiseTableTop[idx])) {
        noise = tundraNoiseTableTop[idx] * landNoiseAmplitude;
      } else {
        // 文明時代・海棲文明時代のみシード固定のノイズを使用
        const rTop = isSeedStrictEra(vm) ? (vm._getDerivedRng('tundra-top', gx, gy) || Math.random) : Math.random;
        noise = (rTop() * 2 - 1) * landNoiseAmplitude;
      }
      const base = vm.topTundraRows;
      const threshold = base > 0 ? Math.max(0, base + noise) : 0;
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
      let noise = 0;
      if (tundraNoiseTableBottom && Number.isFinite(tundraNoiseTableBottom[idx])) {
        noise = tundraNoiseTableBottom[idx] * landNoiseAmplitude;
      } else {
        const rBot = isSeedStrictEra(vm) ? (vm._getDerivedRng('tundra-bottom', gx, gy) || Math.random) : Math.random;
        noise = (rBot() * 2 - 1) * landNoiseAmplitude;
      }
      const base = vm.topTundraRows;
      const threshold = base > 0 ? Math.max(0, base + noise) : 0;
      if (distanceFromBottom < threshold) {
        colors[idx] = tundraColor;
      }
    }
  }
}


