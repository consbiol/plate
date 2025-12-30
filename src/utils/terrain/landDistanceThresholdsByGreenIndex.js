import { PARAM_DEFAULTS } from '../paramsDefaults.js';

function clamp(num, lo, hi) {
    const n = Number(num);
    if (!Number.isFinite(n)) return lo;
    return Math.max(lo, Math.min(hi, n));
}

/**
 * GI区分(A..J)を返す
 *  - A: 1.4  < GI <= 1.8
 *  - B: 1.3  < GI <= 1.4
 *  - C: 1.1  < GI <= 1.3
 *  - D: 1.0  < GI <= 1.1
 *  - E: 0.85 < GI <= 1.0
 *  - F: 0.65 < GI <= 0.85
 *  - G: 0.45 < GI <= 0.65
 *  - H: 0.25 < GI <= 0.45
 *  - I: 0.10 < GI <= 0.25
 *  - J:        GI <= 0.10
 */
function categorizeGreenIndex(giRaw) {
    const gi = clamp(giRaw, 0, 1.8);
    if (gi <= 0.10) return 'J';
    if (gi <= 0.25) return 'I';
    if (gi <= 0.45) return 'H';
    if (gi <= 0.65) return 'G';
    if (gi <= 0.85) return 'F';
    if (gi <= 1.00) return 'E';
    if (gi <= 1.10) return 'D';
    if (gi <= 1.30) return 'C';
    if (gi <= 1.40) return 'B';
    return 'A';
}

function tempZone(avgTempRaw) {
    const t = Number(avgTempRaw);
    if (!Number.isFinite(t)) return 'MiddleTemp';
    if (t >= 32.5) return 'HighTemp';
    if (t >= 12.5) return 'MiddleTemp';
    return 'LowTemp';
}

// 帯01..10 (極->赤道)
const TABLES = Object.freeze({
    HighTemp: {
        A: [16, 20, 20, 14, 12, 10, 7, 12, 15, 20],
        B: [13, 18, 18, 13, 11, 8, 5, 8, 12, 16],
        C: [11, 15, 15, 10, 8, 4, 1, 4, 8, 15],
        D: [11, 15, 15, 10, 7, 4, 0, 2, 6, 14],
        E: [11, 15, 15, 9, 6, 4, 1, 2, 5, 12],
        F: [13, 15, 13, 9, 5, 3, 0, 1, 2, 6],
        G: [10, 12, 10, 7, 4, 1, 0, 0, 0, 1],
        H: [10, 11, 5, 3, 1, 0, -1, -2, -3, -3],
        I: [5, 3, 1, 1, 0, -1, -2, -3, -3, -3],
        J: [-1, -2, -3, -3, -3, -3, -3, -3, -3, -3]
    },
    MiddleTemp: {
        A: [16, 20, 20, 14, 12, 10, 7, 12, 15, 20],
        B: [13, 18, 18, 13, 11, 8, 5, 8, 12, 16],
        C: [11, 15, 15, 10, 8, 4, 1, 4, 8, 15],
        D: [10, 15, 15, 10, 7, 4, 1, 3, 6, 14],
        E: [9, 14, 14, 9, 7, 4, 1, 3, 8, 15],
        F: [7, 11, 11, 8, 6, 2, 0, 2, 6, 13],
        G: [5, 9, 5, 3, 2, 1, 0, 1, 5, 12],
        H: [3, 6, 3, 0, -1, -2, -3, -1, 3, 10],
        I: [2, 3, 2, 0, -2, -3, -3, -2, 1, 6],
        // 原文では "HighTemp, J" と誤記されていたが、文脈上 MiddleTemp の J として採用
        J: [-3, -3, -2, -3, -3, -3, -3, -3, -3, -1]
    },
    LowTemp: {
        A: [15, 19, 19, 14, 12, 11, 9, 14, 16, 20],
        B: [11, 12, 12, 12, 11, 8, 5, 12, 13, 20],
        C: [11, 12, 12, 10, 8, 4, 2, 7, 10, 15],
        D: [6, 10, 11, 11, 8, 4, 1, 4, 9, 15],
        E: [4, 7, 9, 9, 6, 4, 2, 5, 10, 15],
        F: [1, 3, 5, 7, 5, 4, 3, 4, 7, 12],
        G: [1, 2, 4, 6, 5, 4, 3, 4, 7, 10],
        H: [-3, -3, -2, -1, 0, 1, 1, 4, 7, 10],
        I: [-3, -3, -3, -3, -2, -1, 1, 2, 4, 8],
        J: [-3, -3, -3, -3, -3, -3, -3, -3, -2, -1]
    }
});

function toThresholdObject(arr) {
    return {
        landDistanceThreshold1: arr[0],
        landDistanceThreshold2: arr[1],
        landDistanceThreshold3: arr[2],
        landDistanceThreshold4: arr[3],
        landDistanceThreshold5: arr[4],
        landDistanceThreshold6: arr[5],
        landDistanceThreshold7: arr[6],
        landDistanceThreshold8: arr[7],
        landDistanceThreshold9: arr[8],
        landDistanceThreshold10: arr[9]
    };
}

/**
 * 平均気温(High/Middle/Low) と greenIndex(GI) から、
 * 低地↔乾燥地の「帯別距離閾値(帯01..10)」を返す。
 *
 * @returns {{landDistanceThreshold1:number, landDistanceThreshold2:number, ... landDistanceThreshold10:number}}
 */
export function computeLandDistanceThresholdsByGreenIndex({ averageTemperature, greenIndex }) {
    const zone = tempZone(averageTemperature);
    const cat = categorizeGreenIndex(greenIndex);

    // 既存挙動との整合: MiddleTemp かつ GI=1.00 では「現在の地球(基準)」に固定
    // ※スライダーの 1.00 を基準値として扱えるようにする
    if (zone === 'MiddleTemp' && Number(greenIndex) === 1) {
        return {
            landDistanceThreshold1: PARAM_DEFAULTS.landDistanceThreshold1,
            landDistanceThreshold2: PARAM_DEFAULTS.landDistanceThreshold2,
            landDistanceThreshold3: PARAM_DEFAULTS.landDistanceThreshold3,
            landDistanceThreshold4: PARAM_DEFAULTS.landDistanceThreshold4,
            landDistanceThreshold5: PARAM_DEFAULTS.landDistanceThreshold5,
            landDistanceThreshold6: PARAM_DEFAULTS.landDistanceThreshold6,
            landDistanceThreshold7: PARAM_DEFAULTS.landDistanceThreshold7,
            landDistanceThreshold8: PARAM_DEFAULTS.landDistanceThreshold8,
            landDistanceThreshold9: PARAM_DEFAULTS.landDistanceThreshold9,
            landDistanceThreshold10: PARAM_DEFAULTS.landDistanceThreshold10
        };
    }

    const table = TABLES[zone] || TABLES.MiddleTemp;
    const arr = table[cat] || table.E;
    return toThresholdObject(arr);
}


