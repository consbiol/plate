export function classifyBaseColors(ctx, {
  N,
  landMask,
  noiseGrid,
  distanceToSea,
  distanceToLand,
  seaNoiseAmplitude,
  landNoiseAmplitude,
  deepSeaColor,
  shallowSeaColor,
  lowlandColor,
  desertColor
}) {
  const colors = new Array(N);
  const gridWidth = ctx.gridWidth;
  const gridHeight = ctx.gridHeight;
  for (let gy = 0; gy < gridHeight; gy++) {
    for (let gx = 0; gx < gridWidth; gx++) {
      const idx = gy * gridWidth + gx;
      const n = noiseGrid[idx];
      if (landMask[idx]) {
        const bandThreshold = ctx.getLandDistanceThresholdForRow(gy, gx);
        const landThreshold = bandThreshold + n * landNoiseAmplitude;
        colors[idx] = distanceToSea[idx] > landThreshold ? desertColor : lowlandColor;
      } else {
        const seaThreshold = ctx.baseSeaDistanceThreshold + n * seaNoiseAmplitude;
        colors[idx] = distanceToLand[idx] > seaThreshold ? deepSeaColor : shallowSeaColor;
      }
    }
  }
  return colors;
}
