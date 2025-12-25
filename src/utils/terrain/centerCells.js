// 各中心の陸セル一覧を集計（湖/高地で再利用）

export function buildCenterLandCells(vm, {
  centers,
  ownerCenterIdx,
  landMask,
  preLandMask
}) {
  const centerLandCells = Array.from({ length: centers.length }, () => []);
  const centerLandCellsPre = Array.from({ length: centers.length }, () => []);

  for (let gy = 0; gy < vm.gridHeight; gy++) {
    for (let gx = 0; gx < vm.gridWidth; gx++) {
      const idx = gy * vm.gridWidth + gx;
      if (landMask[idx]) {
        const ciOwner = ownerCenterIdx[idx];
        if (ciOwner >= 0) centerLandCells[ciOwner].push({ x: gx, y: gy, idx });
      }
      if (preLandMask[idx]) {
        const ciOwner2 = ownerCenterIdx[idx];
        if (ciOwner2 >= 0) centerLandCellsPre[ciOwner2].push({ x: gx, y: gy, idx });
      }
    }
  }

  return { centerLandCells, centerLandCellsPre };
}


