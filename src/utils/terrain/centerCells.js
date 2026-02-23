export function buildCenterLandCells(ctx, {
  centers,
  ownerCenterIdx,
  landMask,
  preLandMask
}) {
  const centerLandCells = Array.from({ length: centers.length }, () => []);
  const centerLandCellsPre = Array.from({ length: centers.length }, () => []);
  const gridWidth = ctx.gridWidth;
  const gridHeight = ctx.gridHeight;

  for (let gy = 0; gy < gridHeight; gy++) {
    for (let gx = 0; gx < gridWidth; gx++) {
      const idx = gy * gridWidth + gx;
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


