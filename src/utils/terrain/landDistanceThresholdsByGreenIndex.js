import { PARAM_DEFAULTS } from '../paramsDefaults.js';

function clamp(num, lo, hi) {
    const n = Number(num);
    if (!Number.isFinite(n)) return lo;
    return Math.max(lo, Math.min(hi, n));
}

/**
 * GI区分(A..J)を返す
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

/**
 * 温度区分を返す
 */
function tempZone(avgTempRaw) {
    const t = Number(avgTempRaw);
    if (t >= 37.5) return 'ExtremelyHighTemp';
    if (t >= 32.5) return 'VeryHighTemp';
    if (t >= 27.5) return 'HighTemp';
    if (t >= 17.5) return 'MiddleTemp';
    if (t >= 7.5) return 'LowTemp';
    return 'VeryLowTemp';
}

// 帯01..10 (極->赤道)
const TABLES = Object.freeze({
    ExtremelyHighTemp: {
        A: [20, 20, 20, 15, 12, 10, 7, 12, 15, 15],
        B: [16, 18, 18, 13, 11, 8, 5, 8, 12, 13],
        C: [13, 15, 15, 10, 8, 4, 1, 4, 8, 13],
        D: [13, 15, 15, 10, 7, 4, 0, 2, 6, 12],
        E: [11, 15, 15, 9, 6, 4, 1, 2, 5, 6],
        F: [12, 13, 8, 7, 3, 2, 0, 0, 1, 3],
        G: [11, 10, 9, 5, 2, 0, 0, -1, -1, 0],
        H: [10, 7, 3, 1, 0, -1, -2, -3, -3, -3],
        I: [4, 2, 1, 0, -1, -2, -3, -3, -3, -3],
        J: [-1, -2, -3, -3, -3, -3, -3, -3, -3, -3]
    },
    VeryHighTemp: {
        A: [20, 20, 20, 15, 12, 10, 7, 12, 15, 15],
        B: [16, 18, 18, 13, 11, 8, 5, 8, 12, 13],
        C: [13, 15, 15, 10, 8, 4, 1, 4, 8, 13],
        D: [13, 15, 15, 10, 7, 4, 0, 2, 6, 12],
        E: [13, 15, 15, 9, 6, 4, 1, 2, 5, 10],
        F: [11, 15, 13, 9, 5, 3, 0, 1, 2, 6],
        G: [10, 12, 10, 7, 4, 1, 0, 0, 0, 1],
        H: [10, 11, 5, 3, 1, 0, -1, -2, -3, -3],
        I: [5, 3, 1, 1, 0, -1, -2, -3, -3, -3],
        J: [-1, -2, -3, -3, -3, -3, -3, -3, -3, -3]
    },
    HighTemp: {
        A: [16, 20, 20, 14, 12, 10, 7, 12, 15, 20],
        B: [13, 18, 18, 13, 11, 8, 5, 8, 12, 16],
        C: [11, 15, 15, 10, 8, 4, 1, 4, 8, 15],
        D: [11, 15, 15, 10, 7, 4, 0, 2, 6, 14],
        E: [11, 15, 15, 9, 6, 4, 0, 2, 5, 13],
        F: [11, 14, 13, 9, 5, 3, 0, 1, 3, 8],
        G: [9, 11, 9, 6, 4, 1, -1, 0, 1, 4],
        H: [8, 9, 5, 2, 1, 0, -2, -2, -2, 0],
        I: [4, 3, 1, 1, 0, -2, -3, -3, -2, -1],
        J: [-2, -3, -2, -3, -3, -3, -3, -3, -3, -2]
    },
    MiddleTemp: {
        A: [16, 20, 20, 14, 12, 10, 7, 12, 15, 20],
        B: [13, 18, 18, 13, 11, 8, 5, 8, 12, 16],
        C: [11, 15, 15, 10, 8, 4, 1, 4, 8, 15],
        D: [11, 15, 15, 10, 7, 3, 0, 2, 6, 14],
        E: [10, 14, 14, 9, 6, 3, -1, 1, 5, 13],
        F: [9, 12, 12, 8, 5, 2, -1, 0, 3, 10],
        G: [7, 10, 8, 5, 3, 0, -2, -1, 1, 6],
        H: [5, 7, 4, 1, 0, -1, -3, -2, 0, 3],
        I: [3, 3, 1, 0, -1, -2, -3, -3, -1, 1],
        J: [-3, -3, -2, -3, -3, -3, -3, -3, -3, -1]
    },
    LowTemp: {
        A: [10, 20, 20, 14, 12, 10, 7, 13, 20, 20],
        B: [10, 18, 18, 13, 11, 8, 5, 8, 13, 18],
        C: [9, 15, 15, 10, 8, 4, 1, 4, 8, 17],
        D: [9, 14, 15, 10, 7, 4, 1, 3, 6, 16],
        E: [8, 14, 14, 9, 7, 4, 1, 3, 8, 16],
        F: [6, 11, 11, 8, 6, 2, 0, 2, 6, 14],
        G: [4, 9, 5, 3, 2, 1, 0, 1, 5, 13],
        H: [2, 4, 3, 0, -1, -2, -3, -1, 4, 12],
        I: [0, 1, 2, 0, -2, -3, -3, -2, 3, 8],
        J: [-3, -3, -3, -3, -3, -3, -3, -3, -3, -1]
    },
    VeryLowTemp: {
        A: [9, 15, 17, 14, 12, 12, 9, 20, 21, 21],
        B: [8, 12, 12, 12, 11, 8, 5, 12, 16, 20],
        C: [7, 12, 12, 10, 8, 4, 2, 7, 10, 19],
        D: [5, 10, 11, 11, 8, 4, 1, 4, 9, 16],
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
 * 平均気温と greenIndex(GI) から帯別距離閾値を返す。
 */
export function computeLandDistanceThresholdsByGreenIndex({ averageTemperature, greenIndex }) {
    const zone = tempZone(averageTemperature);
    const cat = categorizeGreenIndex(greenIndex);

    // 既存挙動との整合: MiddleTemp かつ GI=1.00 では基準値に固定
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