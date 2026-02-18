// 氷河の適用（上端/下端）
// - Grids_Calculation.vue から切り出し（機能不変）

function getAdditionalGlacierRowsForCell(ctx, col, {
  shallowSeaColor,
  deepSeaColor,
  lowlandColor,
  tundraColor,
  desertColor,
  highlandColor,
  alpineColor
}) {
  if (col === shallowSeaColor || col === deepSeaColor) return 0;
  if (col === lowlandColor) return ctx.landGlacierExtraRows;
  if (col === tundraColor) return ctx.landGlacierExtraRows;
  if (col === desertColor) return ctx.landGlacierExtraRows;
  if (col === highlandColor) return ctx.highlandGlacierExtraRows;
  if (col === alpineColor) return ctx.alpineGlacierExtraRows;
  return 0;
}

function applyGlacierPass(ctx, {
  colors,
  glacierNoiseTable,
  landNoiseAmplitude,
  computedTopGlacierRowsLand,
  computedTopGlacierRowsWater,
  shallowSeaColor,
  deepSeaColor,
  lowlandColor,
  tundraColor,
  desertColor,
  highlandColor,
  alpineColor,
  glacierColor,
  landMask,
  lakeMask,
  fromTop
}) {
  for (let gy = 0; gy < ctx.gridHeight; gy++) {
    for (let gx = 0; gx < ctx.gridWidth; gx++) {
      const idx = gy * ctx.gridWidth + gx;
      const distance = fromTop ? gy : (ctx.gridHeight - 1 - gy);
      const noise = glacierNoiseTable[idx] * landNoiseAmplitude;

      // Water detection:
      // - Prefer masks (stable even after colors are overwritten by glacierColor)
      // - Fallback to color-based check when masks aren't provided
      const isWater = Array.isArray(landMask)
        ? (!landMask[idx] || (Array.isArray(lakeMask) && lakeMask[idx]))
        : (colors[idx] === shallowSeaColor || colors[idx] === deepSeaColor);

      const additionalGrids = isWater
        ? 0
        : getAdditionalGlacierRowsForCell(ctx, colors[idx], {
          shallowSeaColor,
          deepSeaColor,
          lowlandColor,
          tundraColor,
          desertColor,
          highlandColor,
          alpineColor
        });

      const baseRows = isWater ? computedTopGlacierRowsWater : computedTopGlacierRowsLand;
      const base = baseRows + additionalGrids;
      const threshold = base > 0 ? Math.max(0, base + noise) : 0;
      if (distance < threshold) {
        colors[idx] = glacierColor;
      }
    }
  }
}

export function applyGlaciers(ctx, {
  colors,
  glacierNoiseTable,
  landNoiseAmplitude,
  computedTopGlacierRows,
  computedTopGlacierRowsLand,
  computedTopGlacierRowsWater,
  computedSmoothedTopGlacierRowsLand,
  computedSmoothedTopGlacierRowsWater,
  shallowSeaColor,
  deepSeaColor,
  lowlandColor,
  tundraColor,
  desertColor,
  highlandColor,
  alpineColor,
  glacierColor,
  landMask,
  lakeMask
}) {
  // 優先順: smoothed（glacier_alpha 適用後の内部値） > computedTopGlacierRows...（既存の戻り値）> computedTopGlacierRows（汎用）
  const landRows = (typeof computedSmoothedTopGlacierRowsLand === 'number')
    ? computedSmoothedTopGlacierRowsLand
    : (typeof computedTopGlacierRowsLand === 'number'
      ? computedTopGlacierRowsLand
      : (typeof computedTopGlacierRows === 'number' ? computedTopGlacierRows : 0));
  const waterRows = (typeof computedSmoothedTopGlacierRowsWater === 'number')
    ? computedSmoothedTopGlacierRowsWater
    : (typeof computedTopGlacierRowsWater === 'number'
      ? computedTopGlacierRowsWater
      : (typeof computedTopGlacierRows === 'number' ? computedTopGlacierRows : landRows));

  // --- 氷河の適用（上端） ---
  applyGlacierPass(ctx, {
    colors,
    glacierNoiseTable,
    landNoiseAmplitude,
    computedTopGlacierRowsLand: landRows,
    computedTopGlacierRowsWater: waterRows,
    shallowSeaColor,
    deepSeaColor,
    lowlandColor,
    tundraColor,
    desertColor,
    highlandColor,
    alpineColor,
    glacierColor,
    landMask,
    lakeMask,
    fromTop: true
  });

  // --- 氷河の適用（下端） ---
  applyGlacierPass(ctx, {
    colors,
    glacierNoiseTable,
    landNoiseAmplitude,
    computedTopGlacierRowsLand: landRows,
    computedTopGlacierRowsWater: waterRows,
    shallowSeaColor,
    deepSeaColor,
    lowlandColor,
    tundraColor,
    desertColor,
    highlandColor,
    alpineColor,
    glacierColor,
    landMask,
    lakeMask,
    fromTop: false
  });
}


