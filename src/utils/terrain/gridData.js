export function buildGridData({
  gridWidth,
  gridHeight
}, {
  N,
  colors,
  landMask,
  lakeMask,
  shallowSeaColor,
  lowlandColor,
  highlandColor,
  alpineColor,
  tundraColor,
  glacierColor,
  desertColor,
  cityMask,
  cultivatedMask,
  bryophyteMask,
  pollutedMask,
  seaCityMask,
  seaCultivatedMask,
  seaPollutedMask
}) {
  const gridData = new Array(N);
  for (let gy = 0; gy < gridHeight; gy++) {
    for (let gx = 0; gx < gridWidth; gx++) {
      const idx = gy * gridWidth + gx;
      const temperature = null;
      const precipitation = null;
      const isLand = !!landMask[idx];
      const isLake = (typeof lakeMask !== 'undefined') ? !!lakeMask[idx] : false;
      const isSeaCity = !!seaCityMask[idx];
      const isSeaCultivated = !!seaCultivatedMask[idx];
      const isSeaPolluted = !!seaPollutedMask[idx];
      let terrain = { type: 'sea', sea: 'deep' };
      const col = colors[idx];
      if (!isLand) {
        if (col === glacierColor) terrain = { type: 'sea', sea: 'glacier' };
        else if (col === shallowSeaColor) terrain = { type: 'sea', sea: 'shallow' };
        else terrain = { type: 'sea', sea: 'deep' };
      } else {
        if (col === glacierColor) terrain = { type: 'land', land: 'glacier' };
        else if (col === tundraColor) terrain = { type: 'land', land: 'tundra' };
        else if (isLake) terrain = { type: 'land', land: 'lake' };
        else if (col === lowlandColor) terrain = { type: 'land', land: 'lowland' };
        else if (col === highlandColor) terrain = { type: 'land', land: 'highland' };
        else if (col === alpineColor) terrain = { type: 'land', land: 'alpine' };
        else if (col === desertColor) terrain = { type: 'land', land: 'desert' };
        else terrain = { type: 'land', land: 'lowland' };
      }
      let glacierKind = null;
      if (col === glacierColor) {
        glacierKind = (!isLand || isLake || isSeaCity || isSeaCultivated || isSeaPolluted) ? 'sea' : 'land';
      }
      gridData[idx] = {
        temperature,
        precipitation,
        terrain,
        colorHex: col,
        glacierKind,
        city: !!cityMask[idx],
        bryophyte: !!bryophyteMask[idx],
        cultivated: !!cultivatedMask[idx],
        polluted: !!pollutedMask[idx],
        seaCity: isSeaCity,
        seaCultivated: isSeaCultivated,
        seaPolluted: isSeaPolluted
      };
    }
  }
  return gridData;
}

export function markCentersOnGridData({ gridWidth, gridHeight, showCentersRed }, { gridData, centers }) {
  if (!showCentersRed) return;
  if (!Array.isArray(centers)) return;
  for (let ci = 0; ci < centers.length; ci++) {
    const c = centers[ci];
    if (!c) continue;
    const cx = Math.max(0, Math.min(gridWidth - 1, Math.floor(c.x)));
    const cy = Math.max(0, Math.min(gridHeight - 1, Math.floor(c.y)));
    const idx = cy * gridWidth + cx;
    if (gridData[idx]) {
      gridData[idx].center = true;
    }
  }
}
