// gridData の組み立て（terrain判定＋各種フラグ埋め込み）

export function buildGridData(vm, {
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
  for (let gy = 0; gy < vm.gridHeight; gy++) {
    for (let gx = 0; gx < vm.gridWidth; gx++) {
      const idx = gy * vm.gridWidth + gx;
      const temperature = null;
      const precipitation = null;
      let terrain = { type: 'sea', sea: 'deep' };
      const col = colors[idx];
      if (!landMask[idx]) {
        if (col === glacierColor) terrain = { type: 'sea', sea: 'glacier' };
        else if (col === shallowSeaColor) terrain = { type: 'sea', sea: 'shallow' };
        else terrain = { type: 'sea', sea: 'deep' };
      } else {
        if (col === glacierColor) terrain = { type: 'land', land: 'glacier' };
        else if (col === tundraColor) terrain = { type: 'land', land: 'tundra' };
        else if (typeof lakeMask !== 'undefined' && lakeMask[idx]) terrain = { type: 'land', land: 'lake' };
        else if (col === lowlandColor) terrain = { type: 'land', land: 'lowland' };
        else if (col === highlandColor) terrain = { type: 'land', land: 'highland' };
        else if (col === alpineColor) terrain = { type: 'land', land: 'alpine' };
        else if (col === desertColor) terrain = { type: 'land', land: 'desert' };
        else terrain = { type: 'land', land: 'lowland' };
      }
      gridData[idx] = {
        temperature,
        precipitation,
        terrain,
        colorHex: col,
        // 都市/耕作地/汚染地フラグ（色は colors.js でパレットから解決）
        city: !!cityMask[idx],
        // 苔類進出地フラグ（苔類進出時代のみ生成）
        bryophyte: !!bryophyteMask[idx],
        cultivated: !!cultivatedMask[idx],
        polluted: !!pollutedMask[idx],
        // 海棲都市/海棲耕作地/海棲汚染地フラグ（色は colors.js でパレットから解決）
        seaCity: !!seaCityMask[idx],
        seaCultivated: !!seaCultivatedMask[idx],
        seaPolluted: !!seaPollutedMask[idx]
      };
    }
  }
  return gridData;
}

export function markCentersOnGridData(vm, { gridData, centers }) {
  // 中心点セルを赤で表示（フラグ埋め込み）
  if (!vm.showCentersRed) return;
  if (!Array.isArray(centers)) return;
  for (let ci = 0; ci < centers.length; ci++) {
    const c = centers[ci];
    if (!c) continue;
    const cx = Math.max(0, Math.min(vm.gridWidth - 1, Math.floor(c.x)));
    const cy = Math.max(0, Math.min(vm.gridHeight - 1, Math.floor(c.y)));
    const idx = cy * vm.gridWidth + cx;
    if (gridData[idx]) {
      gridData[idx].center = true;
    }
  }
}


