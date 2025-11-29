// 地形カラー定義と displayColors 導出の共通ユーティリティ

export function getDefaultTerrainColors() {
    return {
        deepSea: '#1E508C',
        shallowSea: '#3C78B4',
        lowland: '#228B22',
        desert: '#96826E',
        highland: '#91644B',
        alpine: '#5F5046',
        tundra: '#7ea836',
        glacier: '#FFFFFF',
        border: '#000000'
    };
}

function cellToColor(cell, tc) {
    let col = tc.lowland;
    if (cell && cell.terrain) {
        if (cell.terrain.type === 'sea') {
            if (cell.terrain.sea === 'shallow') col = tc.shallowSea;
            else if (cell.terrain.sea === 'glacier') col = tc.glacier;
            else col = tc.deepSea;
        } else if (cell.terrain.type === 'land') {
            const l = cell.terrain.land;
            if (l === 'tundra') col = tc.tundra;
            else if (l === 'glacier') col = tc.glacier;
            else if (l === 'lake') col = tc.shallowSea;
            else if (l === 'highland') col = tc.highland;
            else if (l === 'alpine') col = tc.alpine;
            else if (l === 'desert') col = tc.desert;
            else col = tc.lowland;
        }
    }
    return col;
}

// gridData -> display color array (+2 border)
export function deriveDisplayColorsFromGridData(gridData, width, height, borderColor, defaultColors) {
    const tc = defaultColors || getDefaultTerrainColors();
    const border = borderColor || (tc.border || '#000000');
    const displayWidth = width + 2;
    const displayHeight = height + 2;
    const displayColors = new Array(displayWidth * displayHeight);
    for (let gy = 0; gy < displayHeight; gy++) {
        for (let gx = 0; gx < displayWidth; gx++) {
            const displayIdx = gy * displayWidth + gx;
            if (gy === 0 || gy === displayHeight - 1 || gx === 0 || gx === displayWidth - 1) {
                displayColors[displayIdx] = border;
            } else {
                const originalGy = gy - 1;
                const originalGx = gx - 1;
                const idx = originalGy * width + originalGx;
                const cell = gridData[idx];
                displayColors[displayIdx] = cellToColor(cell, tc);
            }
        }
    }
    return displayColors;
}


