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
        cultivated: '#ffff00',
        polluted: '#800080'
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
        cultivated: '#ffff00',
        polluted: '#800080'
    };
}

// 生命発生前時代（プリバイオティック期）
export function getEraColors_PreLife() {
    return {
        deepSea: '#ffff00',
        shallowSea: '#3C78B4',
        lowland: '#228B22',
        desert: '#96826E',
        highland: '#91644B',
        alpine: '#5F5046',
        tundra: '#7ea836',
        glacier: '#FFFFFF',
        border: '#000000',
        city: '#F15A22',
        cultivated: '#ffff00',
        polluted: '#800080'
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
        cultivated: '#ffff00',
        polluted: '#800080'
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
        cultivated: '#ffff00',
        polluted: '#800080'
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
        cultivated: '#ffff00',
        polluted: '#800080'
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
        cultivated: '#ffff00',
        polluted: '#800080'
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
        cultivated: '#ffff00',
        polluted: '#800080'
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
        cultivated: '#ffff00',
        polluted: '#800080'
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
        cultivated: '#ffff00',
        polluted: '#800080'
    };
}
// 新名称対応: PteridophyteExpansion（表示名: シダ植物時代）
export function getEraColors_PteridophyteExpansion() {
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
        cultivated: '#ffff00',
        polluted: '#800080'
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
        cultivated: '#ffff00',
        polluted: '#800080'
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
        cultivated: '#ffff00',
        polluted: '#800080'
    };
}

const ERA_COLOR_FACTORIES = {
    '爆撃時代': getEraColors_Bombardment,
    '生命発生前時代': getEraColors_PreLife,
    '嫌気性細菌誕生時代': getEraColors_AnaerobicBacteria,
    '光合成細菌誕生時代': getEraColors_PhotosyntheticBacteria,
    '真核生物誕生時代': getEraColors_Eukaryotes,
    '多細胞生物誕生時代': getEraColors_Multicellular,
    '海洋生物多様化時代': getEraColors_MarineDiversification,
    '苔類進出時代': getEraColors_BryophyteExpansion,
    'シダ植物時代': getEraColors_PteridophyteExpansion,
    '大森林時代': getEraColors_GreatForest,
    '文明時代': getEraColors_Civilization
};

export function getEraTerrainColors(era) {
    const def = getDefaultTerrainColors();
    const factory = era && Object.prototype.hasOwnProperty.call(ERA_COLOR_FACTORIES, era) ? ERA_COLOR_FACTORIES[era] : null;
    return factory ? factory() : def;
}

// Sphere 用: 時代別の陸トーン（既定は大森林時代と同じ値）
// 時代別の陸トーン色（Sphere の陸に貼るトーン）。初期値は全時代とも #96A5B9。
// 後で個別に変更したい場合は、このマップの値を編集してください。
const ERA_LAND_TINTS = {
    '爆撃時代': '#96A5B9',
    '生命発生前時代': '#96A5B9',
    '嫌気性細菌誕生時代': '#96A5B9',
    '光合成細菌誕生時代': '#FF0000',
    '真核生物誕生時代': '#96A5B9',
    '多細胞生物誕生時代': '#96A5B9',
    '海洋生物多様化時代': '#96A5B9',
    '苔類進出時代': '#96A5B9',
    'シダ植物時代': '#96A5B9',
    '大森林時代': '#96A5B9',
    '文明時代': '#96A5B9'
};
export function getEraLandTint(era) {
    const def = '#96A5B9';
    if (era && Object.prototype.hasOwnProperty.call(ERA_LAND_TINTS, era)) {
        return ERA_LAND_TINTS[era];
    }
    return def;
}

// 時代別の雲トーン色（Sphere の雲レイヤに貼る色）。初期値は全時代とも #FFFFFF。
// 後で個別に変更したい場合は、このマップの値を編集してください。
const ERA_CLOUD_TINTS = {
    '爆撃時代': '#FFFFFF',
    '生命発生前時代': '#5E7C85',
    '嫌気性細菌誕生時代': '#FFFFFF',
    '光合成細菌誕生時代': '#FFFFFF',
    '真核生物誕生時代': '#ED1A3D',
    '多細胞生物誕生時代': '#ED1A3D',
    '海洋生物多様化時代': '#FFFFFF',
    '苔類進出時代': '#FFFFFF',
    'シダ植物時代': '#FFFFFF',
    '大森林時代': '#FFFFFF',
    '文明時代': '#FFFFFF'
};
export function getEraCloudTint(era) {
    const def = '#FFFFFF';
    if (era && Object.prototype.hasOwnProperty.call(ERA_CLOUD_TINTS, era)) {
        return ERA_CLOUD_TINTS[era];
    }
    return def;
}

function cellToColor(cell, tc, preferPalette) {
    // preferPalette が true の場合は、colorHex を無視してパレットに従う
    if (!preferPalette && cell && typeof cell.colorHex === 'string') {
        return cell.colorHex;
    }
    // 基礎色（地形種）を決定
    let base = tc.lowland;
    if (cell && cell.terrain) {
        if (cell.terrain.type === 'sea') {
            if (cell.terrain.sea === 'shallow') base = tc.shallowSea;
            else if (cell.terrain.sea === 'glacier') base = tc.glacier;
            else base = tc.deepSea;
        } else if (cell.terrain.type === 'land') {
            const l = cell.terrain.land;
            if (l === 'tundra') base = tc.tundra;
            else if (l === 'glacier') base = tc.glacier;
            else if (l === 'lake') base = tc.shallowSea;
            else if (l === 'highland') base = tc.highland;
            else if (l === 'alpine') base = tc.alpine;
            else if (l === 'desert') base = tc.desert;
            else base = tc.lowland;
        }
    }
    // 上書き優先度: polluted > city > cultivated
    if (cell && cell.polluted) {
        return (tc && tc.polluted) ? tc.polluted : '#800080';
    }
    if (cell && cell.city) {
        return (tc && tc.city) ? tc.city : '#808080';
    }
    if (cell && cell.cultivated) {
        return (tc && tc.cultivated) ? tc.cultivated : '#556655';
    }
    return base;
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


