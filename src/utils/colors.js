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
        border: '#000000',
        city: '#F15A22',
        cultivated: '#ffff00'
    };
}

// --- Era-based color factories (each era has its own function to tweak later) ---
export function getEraColors_Bombardment() {
    return {
        deepSea: '#ED1A3D',
        shallowSea: '#3C78B4',
        lowland: '#228B22',
        desert: '#96826E',
        highland: '#91644B',
        alpine: '#5F5046',
        tundra: '#7ea836',
        glacier: '#FFFFFF',
        border: '#000000',
        city: '#F15A22',
        cultivated: '#ffff00'
    };
}
export function getEraColors_AnaerobicBacteria() {
    return {
        deepSea: '#1E508C',
        shallowSea: '#ED1A3D',
        lowland: '#228B22',
        desert: '#96826E',
        highland: '#91644B',
        alpine: '#5F5046',
        tundra: '#7ea836',
        glacier: '#FFFFFF',
        border: '#000000',
        city: '#F15A22',
        cultivated: '#ffff00'
    };
}
export function getEraColors_PhotosyntheticBacteria() {
    return {
        deepSea: '#1E508C',
        shallowSea: '#3C78B4',
        lowland: '#228B22',
        desert: '#96826E',
        highland: '#91644B',
        alpine: '#5F5046',
        tundra: '#7ea836',
        glacier: '#FFFFFF',
        border: '#000000',
        city: '#F15A22',
        cultivated: '#ffff00'
    };
}
export function getEraColors_Eukaryotes() {
    return {
        deepSea: '#1E508C',
        shallowSea: '#3C78B4',
        lowland: '#228B22',
        desert: '#96826E',
        highland: '#91644B',
        alpine: '#5F5046',
        tundra: '#7ea836',
        glacier: '#FFFFFF',
        border: '#000000',
        city: '#F15A22',
        cultivated: '#ffff00'
    };
}
export function getEraColors_Multicellular() {
    return {
        deepSea: '#1E508C',
        shallowSea: '#3C78B4',
        lowland: '#228B22',
        desert: '#96826E',
        highland: '#91644B',
        alpine: '#5F5046',
        tundra: '#7ea836',
        glacier: '#FFFFFF',
        border: '#000000',
        city: '#F15A22',
        cultivated: '#ffff00'
    };
}
export function getEraColors_MarineDiversification() {
    return {
        deepSea: '#1E508C',
        shallowSea: '#3C78B4',
        lowland: '#228B22',
        desert: '#96826E',
        highland: '#91644B',
        alpine: '#5F5046',
        tundra: '#7ea836',
        glacier: '#FFFFFF',
        border: '#000000',
        city: '#F15A22',
        cultivated: '#ffff00'
    };
}
export function getEraColors_BryophyteExpansion() {
    return {
        deepSea: '#1E508C',
        shallowSea: '#3C78B4',
        lowland: '#228B22',
        desert: '#96826E',
        highland: '#91644B',
        alpine: '#5F5046',
        tundra: '#7ea836',
        glacier: '#FFFFFF',
        border: '#000000',
        city: '#F15A22',
        cultivated: '#ffff00'
    };
}
export function getEraColors_PteridophyteGymnospermExpansion() {
    return {
        deepSea: '#1E508C',
        shallowSea: '#3C78B4',
        lowland: '#228B22',
        desert: '#96826E',
        highland: '#91644B',
        alpine: '#5F5046',
        tundra: '#7ea836',
        glacier: '#FFFFFF',
        border: '#000000',
        city: '#F15A22',
        cultivated: '#ffff00'
    };
}
export function getEraColors_GreatForest() {
    return {
        deepSea: '#1E508C',
        shallowSea: '#3C78B4',
        lowland: '#228B22',
        desert: '#96826E',
        highland: '#91644B',
        alpine: '#5F5046',
        tundra: '#7ea836',
        glacier: '#FFFFFF',
        border: '#000000',
        city: '#F15A22',
        cultivated: '#ffff00'
    };
}
export function getEraColors_Civilization() {
    return {
        deepSea: '#1E508C',
        shallowSea: '#3C78B4',
        lowland: '#228B22',
        desert: '#96826E',
        highland: '#91644B',
        alpine: '#5F5046',
        tundra: '#7ea836',
        glacier: '#FFFFFF',
        border: '#000000',
        city: '#F15A22',
        cultivated: '#ffff00'
    };
}

const ERA_COLOR_FACTORIES = {
    '爆撃時代': getEraColors_Bombardment,
    '嫌気性細菌誕生時代': getEraColors_AnaerobicBacteria,
    '光合成細菌誕生時代': getEraColors_PhotosyntheticBacteria,
    '真核生物誕生時代': getEraColors_Eukaryotes,
    '多細胞生物誕生時代': getEraColors_Multicellular,
    '海洋生物多様化時代': getEraColors_MarineDiversification,
    '苔類進出時代': getEraColors_BryophyteExpansion,
    'シダ類・裸子植物進出時代': getEraColors_PteridophyteGymnospermExpansion,
    '大森林時代': getEraColors_GreatForest,
    '文明時代': getEraColors_Civilization
};

export function getEraTerrainColors(era) {
    const def = getDefaultTerrainColors();
    const factory = era && Object.prototype.hasOwnProperty.call(ERA_COLOR_FACTORIES, era) ? ERA_COLOR_FACTORIES[era] : null;
    return factory ? factory() : def;
}

// Sphere 用: 時代別の陸トーン（既定は大森林時代と同じ値）
export function getEraLandTint(era) {
    const def = 'rgb(150, 165, 185)';
    const ERA_TINT_FACTORIES = {
        '爆撃時代': () => def,
        '嫌気性細菌誕生時代': () => def,
        '光合成細菌誕生時代': () => def,
        '真核生物誕生時代': () => def,
        '多細胞生物誕生時代': () => def,
        '海洋生物多様化時代': () => def,
        '苔類進出時代': () => def,
        'シダ類・裸子植物進出時代': () => def,
        '大森林時代': () => def,
        '文明時代': () => def
    };
    const fn = era && Object.prototype.hasOwnProperty.call(ERA_TINT_FACTORIES, era) ? ERA_TINT_FACTORIES[era] : null;
    return fn ? fn() : def;
}

function cellToColor(cell, tc, preferPalette) {
    // preferPalette が true の場合は、colorHex を無視してパレットに従う
    if (!preferPalette && cell && typeof cell.colorHex === 'string') {
        return cell.colorHex;
    }
    // 城市エリアの色設定: city 名称がある場合は中間灰色で表示
    if (cell && cell.city) {
        return (tc && tc.city) ? tc.city : '#808080';
    }
    // 農耕地/耕作地の色設定
    if (cell && cell.cultivated) {
        return (tc && tc.cultivated) ? tc.cultivated : '#556655';
    }
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
export function deriveDisplayColorsFromGridData(gridData, width, height, borderColor, defaultColors, preferPalette) {
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
                displayColors[displayIdx] = cellToColor(cell, tc, !!preferPalette);
            }
        }
    }
    return displayColors;
}


