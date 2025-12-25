// 氷河の適用（上端/下端）
// - Grids_Calculation.vue から切り出し（機能不変）

function getAdditionalGlacierRowsForCell(vm, col, {
  shallowSeaColor,
  deepSeaColor,
  lowlandColor,
  tundraColor,
  desertColor,
  highlandColor,
  alpineColor
}) {
  if (col === shallowSeaColor || col === deepSeaColor) return 0;
  if (col === lowlandColor) return vm.landGlacierExtraRows;
  if (col === tundraColor) return vm.landGlacierExtraRows;
  if (col === desertColor) return vm.landGlacierExtraRows;
  if (col === highlandColor) return vm.highlandGlacierExtraRows;
  if (col === alpineColor) return vm.alpineGlacierExtraRows;
  return 0;
}

function applyGlacierPass(vm, {
  colors,
  glacierNoiseTable,
  landNoiseAmplitude,
  computedTopGlacierRows,
  shallowSeaColor,
  deepSeaColor,
  lowlandColor,
  tundraColor,
  desertColor,
  highlandColor,
  alpineColor,
  glacierColor,
  fromTop
}) {
  for (let gy = 0; gy < vm.gridHeight; gy++) {
    for (let gx = 0; gx < vm.gridWidth; gx++) {
      const idx = gy * vm.gridWidth + gx;
      const distance = fromTop ? gy : (vm.gridHeight - 1 - gy);
      const noise = glacierNoiseTable[idx] * landNoiseAmplitude;
      const additionalGrids = getAdditionalGlacierRowsForCell(vm, colors[idx], {
        shallowSeaColor,
        deepSeaColor,
        lowlandColor,
        tundraColor,
        desertColor,
        highlandColor,
        alpineColor
      });
      const base = computedTopGlacierRows + additionalGrids;
      const threshold = base > 0 ? Math.max(0, base + noise) : 0;
      if (distance < threshold) {
        colors[idx] = glacierColor;
      }
    }
  }
}

export function applyGlaciers(vm, {
  colors,
  glacierNoiseTable,
  landNoiseAmplitude,
  computedTopGlacierRows,
  shallowSeaColor,
  deepSeaColor,
  lowlandColor,
  tundraColor,
  desertColor,
  highlandColor,
  alpineColor,
  glacierColor
}) {
  // --- 氷河の適用（上端） ---
  applyGlacierPass(vm, {
    colors,
    glacierNoiseTable,
    landNoiseAmplitude,
    computedTopGlacierRows,
    shallowSeaColor,
    deepSeaColor,
    lowlandColor,
    tundraColor,
    desertColor,
    highlandColor,
    alpineColor,
    glacierColor,
    fromTop: true
  });

  // --- 氷河の適用（下端） ---
  applyGlacierPass(vm, {
    colors,
    glacierNoiseTable,
    landNoiseAmplitude,
    computedTopGlacierRows,
    shallowSeaColor,
    deepSeaColor,
    lowlandColor,
    tundraColor,
    desertColor,
    highlandColor,
    alpineColor,
    glacierColor,
    fromTop: false
  });
}


