// 地形カラー定義と displayColors 導出の共通ユーティリティ

export function getDefaultTerrainColors() {
    return {
        deepSea: '#1E508C',
        shallowSea: '#3C78B4',
        lake: '#3C78B4',
        lowland: '#228B22',
        desert: '#96826E',
        highland: '#91644B',
        alpine: '#5F5046',
        tundra: '#7ea836',
        glacier: '#FFFFFF',
        border: '#000000',
        city: '#F15A22',
        cultivated: '#ffff00',
        bryophyte: '#76A543',
        polluted: '#800080',
        seaCity: '#1A1F3A',
        seaCultivated: '#2E8B57',
        seaPolluted: '#800080'
    };
}

// --- Era-based color factories (each era has its own function to tweak later) ---
// 爆撃時代時代
export function getEraColors_Bombardment() {
    return {
        deepSea: '#0f3b2e',
        shallowSea: '#2a6461',
        // 爆撃時代: 湖をマグマ色に
        lake: '#FF4500',
        lowland: '#3b3b3b',
        desert: '#4A4A4A',
        highland: '#3E2F1F',
        alpine: '#2B2B2B',
        tundra: '#474747',
        glacier: '#A59A8A',
        border: '#000000'
    };
}

// 生命発生前時代（プリバイオティック期）
export function getEraColors_PreLife() {
    return {
        deepSea: '#0f3b2e',
        shallowSea: '#2a6461',
        lowland: '#3b3b3b',
        desert: '#4A4A4A',
        highland: '#3E2F1F',
        alpine: '#2B2B2B',
        tundra: '#474747',
        glacier: '#e0dac5',
        border: '#000000'
    };
}

// 嫌気性細菌誕生時代
export function getEraColors_AnaerobicBacteria() {
    return {
        deepSea: '#214237',
        shallowSea: '#3a4430',
        lowland: '#3b3b3b',
        desert: '#4A4A4A',
        highland: '#3E2F1F',
        alpine: '#2B2B2B',
        tundra: '#474747',
        glacier: '#E6EEF2',
        border: '#000000'
    };
}
// 光合成細菌誕生時代
export function getEraColors_PhotosyntheticBacteria() {
    return {
        deepSea: '#1a4e84',
        shallowSea: '#226f8c',
        lowland: '#a13c2f',
        desert: '#C35A3B',
        highland: '#80421f',
        alpine: '#5a4a3a',
        tundra: '#a13c2f',
        glacier: '#E6EEF2',
        border: '#000000'
    };
}
// 真核生物誕生時代
export function getEraColors_Eukaryotes() {
    return {
        deepSea: '#1E508C',
        shallowSea: '#3070b0',
        lowland: '#B14A2F',
        desert: '#C35A3B',
        highland: '#80421f',
        alpine: '#5a4a3a',
        tundra: '#a13c2f',
        glacier: '#E6EEF2',
        border: '#000000'
    };
}
// 多細胞生物誕生時代
export function getEraColors_Multicellular() {
    return {
        deepSea: '#1E508C',
        shallowSea: '#3070b0',
        lowland: '#b1632f',
        desert: '#C35A3B',
        highland: '#80421f',
        alpine: '#5a4a3a',
        tundra: '#B14A2F',
        glacier: '#E6EEF2',
        border: '#000000'
    };
}
// 海洋生物多様化時代
export function getEraColors_MarineDiversification() {
    return {
        deepSea: '#1E508C',
        shallowSea: '#1d777d',
        lowland: '#b1742f',
        desert: '#B75E3B',
        highland: '#91644B',
        alpine: '#5F5046',
        tundra: '#b1742f',
        glacier: '#E6EEF2',
        border: '#000000'
    };
}
// 苔類進出時代
export function getEraColors_BryophyteExpansion() {
    return {
        deepSea: '#1E508C',
        shallowSea: '#3885ab',
        lowland: '#c88e6a',
        desert: '#d2a68c',
        highland: '#91644B',
        alpine: '#5F5046',
        tundra: '#c88e6a',
        bryophyte: '#7ea836',
        glacier: '#E6EEF2',
        border: '#000000'
    };
}
// シダ植物時代(石炭紀)
export function getEraColors_PteridophyteExpansion() {
    return {
        deepSea: '#1E508C',
        shallowSea: '#3070b0',
        lowland: '#228B22',
        desert: '#D2B48C',
        highland: '#91644B',
        alpine: '#5F5046',
        tundra: '#7ea836',
        glacier: '#E6EEF2',
        border: '#000000'
    };
}
// 大森林時代
export function getEraColors_GreatForest() {
    return {
        deepSea: '#1E508C',
        shallowSea: '#3070b0',
        lowland: '#228B22',
        desert: '#D2B48C',
        highland: '#91644B',
        alpine: '#5F5046',
        tundra: '#7ea836',
        glacier: '#E6EEF2',
        border: '#000000'
    };
}
// 文明時代
export function getEraColors_Civilization() {
    return {
        deepSea: '#1E508C',
        shallowSea: '#3070b0',
        lowland: '#228B22',
        desert: '#D2B48C',
        highland: '#91644B',
        alpine: '#5F5046',
        tundra: '#7ea836',
        glacier: '#E6EEF2',
        border: '#000000',
        city: '#9a9a9a',
        cultivated: '#6B8E23',
        polluted: '#4e4a57'
    };
}
// 海棲文明時代
export function getEraColors_SeaCivilization() {
    return {
        deepSea: '#1E508C',
        shallowSea: '#3070b0',
        lowland: '#228B22',
        desert: '#96826E',
        highland: '#91644B',
        alpine: '#5F5046',
        tundra: '#7ea836',
        glacier: '#E6EEF2',
        border: '#000000',
        seaCity: '#5C6B73',
        seaCultivated: '#51a69a',
        seaPolluted: '#786491'
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
    '文明時代': getEraColors_Civilization,
    '海棲文明時代': getEraColors_SeaCivilization
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
    '爆撃時代': '#2b1b0b',
    '生命発生前時代': '#2b1b0b',
    '嫌気性細菌誕生時代': '#261f15',
    '光合成細菌誕生時代': '#96A5B9',
    '真核生物誕生時代': '#96A5B9',
    '多細胞生物誕生時代': '#96A5B9',
    '海洋生物多様化時代': '#96A5B9',
    '苔類進出時代': '#96A5B9',
    'シダ植物時代': '#96A5B9',
    '大森林時代': '#96A5B9',
    '文明時代': '#96A5B9',
    '海棲文明時代': '#96A5B9'
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
    '爆撃時代': '#B0B0B0',
    '生命発生前時代': '#afa58f',
    '嫌気性細菌誕生時代': '#E0B878',
    '光合成細菌誕生時代': '#e5e5e5',
    '真核生物誕生時代': '#E7E9EA',
    '多細胞生物誕生時代': '#E7E9EA',
    '海洋生物多様化時代': '#E7E9EA',
    '苔類進出時代': '#E7E9EA',
    'シダ植物時代': '#E7E9EA',
    '大森林時代': '#E7E9EA',
    '文明時代': '#E7E9EA',
    '海棲文明時代': '#E7E9EA'
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
            else if (l === 'lake') base = (tc && tc.lake) ? tc.lake : tc.shallowSea;
            else if (l === 'highland') base = tc.highland;
            else if (l === 'alpine') base = tc.alpine;
            else if (l === 'desert') base = tc.desert;
            else base = tc.lowland;
        }
    }
    // 上書き優先度: center(red) > seaPolluted > seaCity > seaCultivated > polluted > city > cultivated
    if (cell && cell.center) {
        return '#FF0000';
    }
    // 海棲グリッドの処理（浅瀬の場合）
    if (cell && cell.terrain && cell.terrain.type === 'sea' && cell.terrain.sea === 'shallow') {
        if (cell.seaPolluted) {
            return (tc && tc.seaPolluted) ? tc.seaPolluted : '#800080';
        }
        if (cell.seaCity) {
            return (tc && tc.seaCity) ? tc.seaCity : '#1A1F3A';
        }
        if (cell.seaCultivated) {
            return (tc && tc.seaCultivated) ? tc.seaCultivated : '#2E8B57';
        }
    }
    // 陸地の汚染地・都市・農耕地
    if (cell && cell.polluted) {
        return (tc && tc.polluted) ? tc.polluted : '#800080';
    }
    if (cell && cell.city) {
        return (tc && tc.city) ? tc.city : '#808080';
    }
    if (cell && cell.bryophyte) {
        return (tc && tc.bryophyte) ? tc.bryophyte : '#76A543';
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


