const pickRowValue = (preferred, fallback, lastFallback) => (
  (typeof preferred === 'number')
    ? preferred
    : (typeof fallback === 'number' ? fallback : lastFallback)
);

const isWaterCell = (colors, idx, landMask, lakeMask, shallowSeaColor, deepSeaColor) => (
  Array.isArray(landMask)
    ? (!landMask[idx] || (Array.isArray(lakeMask) && lakeMask[idx]))
    : (colors[idx] === shallowSeaColor || colors[idx] === deepSeaColor)
);

const getAdditionalGlacierRowsForCell = ({
  landGlacierExtraRows,
  highlandGlacierExtraRows,
  alpineGlacierExtraRows
}, col, {
  shallowSeaColor,
  deepSeaColor,
  lowlandColor,
  tundraColor,
  desertColor,
  highlandColor,
  alpineColor
}) => {
  if (col === shallowSeaColor || col === deepSeaColor) return 0;
  if (col === lowlandColor) return landGlacierExtraRows;
  if (col === tundraColor) return landGlacierExtraRows;
  if (col === desertColor) return landGlacierExtraRows;
  if (col === highlandColor) return highlandGlacierExtraRows;
  if (col === alpineColor) return alpineGlacierExtraRows;
  return 0;
};

function applyGlacierPass({
  gridWidth,
  gridHeight,
  landGlacierExtraRows,
  highlandGlacierExtraRows,
  alpineGlacierExtraRows
}, {
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
  for (let gy = 0; gy < gridHeight; gy++) {
    for (let gx = 0; gx < gridWidth; gx++) {
      const idx = gy * gridWidth + gx;
      const distance = fromTop ? gy : (gridHeight - 1 - gy);
      const noise = glacierNoiseTable[idx] * landNoiseAmplitude;

      const isWater = isWaterCell(colors, idx, landMask, lakeMask, shallowSeaColor, deepSeaColor);

      const additionalGrids = isWater
        ? 0
        : getAdditionalGlacierRowsForCell({
          landGlacierExtraRows,
          highlandGlacierExtraRows,
          alpineGlacierExtraRows
        }, colors[idx], {
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

export function applyGlaciers({
  gridWidth,
  gridHeight,
  landGlacierExtraRows,
  highlandGlacierExtraRows,
  alpineGlacierExtraRows
}, {
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
  const landRows = pickRowValue(
    computedSmoothedTopGlacierRowsLand,
    computedTopGlacierRowsLand,
    (typeof computedTopGlacierRows === 'number') ? computedTopGlacierRows : 0
  );
  const waterRows = pickRowValue(
    computedSmoothedTopGlacierRowsWater,
    computedTopGlacierRowsWater,
    (typeof computedTopGlacierRows === 'number') ? computedTopGlacierRows : landRows
  );

  applyGlacierPass({
    gridWidth,
    gridHeight,
    landGlacierExtraRows,
    highlandGlacierExtraRows,
    alpineGlacierExtraRows
  }, {
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

  applyGlacierPass({
    gridWidth,
    gridHeight,
    landGlacierExtraRows,
    highlandGlacierExtraRows,
    alpineGlacierExtraRows
  }, {
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
