// 地形カラー定義（パレット）と時代（era）ごとのパレット切替
// ※ `src/utils/colors.js` から再exportされる前提

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
    const factory = era && Object.prototype.hasOwnProperty.call(ERA_COLOR_FACTORIES, era)
        ? ERA_COLOR_FACTORIES[era]
        : null;
    return factory ? factory() : def;
}


