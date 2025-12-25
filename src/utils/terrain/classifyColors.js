// distanceToSea / distanceToLand とノイズから、色（地形カテゴリ）を分類する

export function classifyBaseColors(vm, {
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
  for (let gy = 0; gy < vm.gridHeight; gy++) {
    for (let gx = 0; gx < vm.gridWidth; gx++) {
      const idx = gy * vm.gridWidth + gx;
      const n = noiseGrid[idx];
      if (landMask[idx]) {
        const bandThreshold = vm._getLandDistanceThresholdForRow(gy, gx);
        const landThreshold = bandThreshold + n * landNoiseAmplitude;
        colors[idx] = distanceToSea[idx] > landThreshold ? desertColor : lowlandColor;
      } else {
        const seaThreshold = vm.baseSeaDistanceThreshold + n * seaNoiseAmplitude;
        colors[idx] = distanceToLand[idx] > seaThreshold ? deepSeaColor : shallowSeaColor;
      }
    }
  }
  return colors;
}


