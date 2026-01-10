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
      // 氷河の“上書き元”種別（描画用）
      // - landGlacier: 低地/乾燥/高地/高山/ツンドラ/都市/耕作/苔/汚染 など陸域を上書き
      // - seaGlacier : 深海/浅瀬/湖/海棲都市/海棲耕作/海棲汚染 など水域を上書き
      // NOTE: terrain 自体の sea/land は既存仕様のまま（面積計算/既存ロジック互換のため）。
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


