export function buildGridData(ctx, {
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
  const gridWidth = ctx.gridWidth;
  const gridHeight = ctx.gridHeight;
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
      // 氷河の上書き元（描画用）
      let glacierKind = null;
      if (col === glacierColor) {
        // “水域扱い”にしたい条件: 海セル / 湖 / 海棲フラグ
        glacierKind = (!isLand || isLake || isSeaCity || isSeaCultivated || isSeaPolluted) ? 'sea' : 'land';
      }
      gridData[idx] = {
        temperature,
        precipitation,
        terrain,
        colorHex: col,
        glacierKind,
        // 都市/耕作地/汚染地フラグ（色は colors.js でパレットから解決）
        city: !!cityMask[idx],
        // 苔類進出地フラグ（苔類進出時代のみ生成）
        bryophyte: !!bryophyteMask[idx],
        cultivated: !!cultivatedMask[idx],
        polluted: !!pollutedMask[idx],
        // 海棲都市/海棲耕作地/海棲汚染地フラグ（色は colors.js でパレットから解決）
        seaCity: isSeaCity,
        seaCultivated: isSeaCultivated,
        seaPolluted: isSeaPolluted
      };
    }
  }
  return gridData;
}

export function markCentersOnGridData(ctx, { gridData, centers }) {
  if (!ctx.showCentersRed) return;
  if (!Array.isArray(centers)) return;
  const gridWidth = ctx.gridWidth;
  const gridHeight = ctx.gridHeight;
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


