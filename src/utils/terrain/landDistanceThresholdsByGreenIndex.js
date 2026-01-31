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
    if (gi <= 1.20) return 'D';
    if (gi <= 1.50) return 'C';
    if (gi <= 2.00) return 'B';
    return 'A';
}


//温度区分を返す
function tempZone(avgTempRaw) {
    const t = Number(avgTempRaw);
    if (t >= 37.5) return 'ExtremelyHighTemp';
    if (t >= 27.5) return 'VeryHighTemp';
    if (t >= 22.5) return 'HighTemp';
    if (t >= 17.5) return 'MiddleHighTemp';
    if (t >= 12.5) return 'MiddleLowTemp';
    if (t >= 7.5) return 'LowTemp';
    if (t >= 2.5) return 'VeryLowTemp';
    return 'ExtremelyLowTemp';
}


/**
 * 森林相対面積テーブル (科学的整合性版)
 * 帯01..10: 80°Nから約8°ごとの緯度帯 (極 -> 赤道)
 * 数値: 海岸線からの森林到達距離 (1 = 100km)
 * -2: 森林の完全な消失
 * GI(A..J): 温度, 乾燥, CO2分圧, O2火災リスクを統合した指標
 */
const TABLES = Object.freeze({
    // 【灼熱】極地が緑化するが、中緯度は猛烈な乾燥と火災で不毛地帯化
    ExtremelyHighTemp: {
        A: [18, 22, 26, 18, 10, 4, 1, 8, 22, 26],
        B: [15, 18, 22, 15, 8, 2, 0, 5, 19, 23],
        C: [12, 15, 18, 12, 6, 1, -1, 3, 16, 20],
        D: [10, 12, 15, 10, 4, 0, -2, 1, 13, 17],
        E: [8, 10, 12, 8, 2, -1, -2, 0, 10, 14],
        F: [6, 8, 10, 5, 1, -2, -2, -1, 7, 10],
        G: [4, 5, 7, 3, 0, -2, -2, -2, 4, 7],
        H: [2, 3, 4, 1, -1, -2, -2, -2, 1, 4],
        I: [0, 1, 1, -1, -2, -2, -2, -2, -1, 1],
        J: [-1, -1, -1, -2, -2, -2, -2, -2, -2, -2]
    },

    // 【超高温】温暖化のピーク。ハドレー循環の拡大で砂漠ベルトが北上
    VeryHighTemp: {
        A: [10, 16, 22, 24, 15, 8, 3, 12, 24, 28],
        B: [8, 13, 18, 20, 12, 6, 1, 9, 21, 25],
        C: [6, 10, 14, 16, 9, 4, 0, 6, 18, 22],
        D: [4, 8, 11, 13, 7, 2, -1, 4, 15, 19],
        E: [2, 6, 9, 10, 5, 0, -2, 2, 12, 16],
        F: [0, 4, 7, 8, 3, -1, -2, 0, 9, 13],
        G: [-1, 2, 5, 5, 1, -2, -2, -1, 6, 10],
        H: [-2, 0, 2, 3, -1, -2, -2, -2, 3, 7],
        I: [-2, -1, 0, 1, -2, -2, -2, -2, 1, 4],
        J: [-2, -2, -2, -2, -2, -2, -2, -2, -2, 1]
    },

    // 【高温】現在の温暖化進行予測。タイガ（北方の森）が北極海沿岸まで到達
    HighTemp: {
        A: [6, 14, 22, 26, 22, 14, 6, 13, 25, 29],
        B: [4, 11, 18, 22, 18, 11, 4, 10, 22, 26],
        C: [2, 9, 14, 18, 15, 8, 2, 7, 19, 23],
        D: [0, 7, 11, 15, 12, 6, 0, 5, 16, 20],
        E: [-1, 5, 9, 12, 9, 4, -1, 3, 13, 17],
        F: [-2, 3, 7, 9, 6, 2, -2, 1, 10, 14],
        G: [-2, 1, 4, 6, 4, 0, -2, -1, 7, 11],
        H: [-2, -1, 2, 4, 2, -1, -2, -2, 4, 8],
        I: [-2, -2, 0, 1, 0, -2, -2, -2, 1, 5],
        J: [-2, -2, -2, -2, -2, -2, -2, -2, -2, 1]
    },

    // 【中高：基準】現代の地球に近い。CO2肥沃化の恩恵を受けるA..C区分は内陸まで緑化
    MiddleHighTemp: {
        A: [2, 8, 18, 25, 26, 20, 10, 16, 26, 30],
        B: [1, 6, 15, 22, 22, 17, 8, 13, 23, 27],
        C: [0, 4, 12, 18, 18, 14, 6, 10, 19, 23],
        D: [-1, 2, 10, 15, 15, 11, 4, 8, 16, 20],
        E: [-2, 1, 8, 13, 12, 9, 2, 6, 13, 16], // 現地球平均
        F: [-2, 0, 6, 10, 9, 6, 0, 4, 10, 13],
        G: [-2, -1, 4, 7, 7, 4, -1, 2, 7, 10],
        H: [-2, -2, 2, 4, 4, 1, -2, 0, 4, 7],
        I: [-2, -2, 0, 2, 2, -1, -2, -2, 1, 3],
        J: [-2, -2, -2, -1, -1, -2, -2, -2, -1, -1]
    },

    // 【中低】少し涼しい地球。極地の森林が後退し、温帯林が南下し始める
    MiddleLowTemp: {
        A: [1, 5, 14, 20, 22, 22, 14, 18, 23, 25],
        B: [0, 3, 10, 17, 20, 19, 12, 15, 20, 22],
        C: [-1, 1, 8, 14, 17, 16, 10, 13, 17, 19],
        D: [-2, 0, 6, 11, 14, 13, 8, 11, 14, 16],
        E: [-2, -1, 4, 9, 11, 11, 6, 9, 11, 13],
        F: [-2, -2, 2, 7, 9, 9, 4, 7, 9, 11],
        G: [-2, -2, 0, 5, 6, 6, 2, 5, 7, 8],
        H: [-2, -2, -1, 3, 4, 4, 0, 3, 5, 6],
        I: [-2, -2, -2, 1, 2, 2, -1, 1, 2, 3],
        J: [-2, -2, -2, -1, 0, 0, -2, -1, 0, 1]
    },

    // 【寒冷】氷河期の始まり。高緯度は雪と氷、森林は海岸線の避難所へ
    LowTemp: {
        A: [2, 5, 12, 18, 22, 24, 18, 20, 22, 22],
        B: [0, 3, 9, 15, 18, 20, 15, 17, 19, 19],
        C: [-1, 1, 6, 11, 14, 17, 12, 14, 16, 16],
        D: [-2, 0, 4, 8, 11, 14, 9, 11, 13, 13],
        E: [-2, -1, 2, 6, 8, 11, 7, 9, 11, 11],
        F: [-2, -2, 0, 4, 6, 8, 5, 7, 9, 9],
        G: [-2, -2, -1, 2, 4, 6, 3, 5, 6, 6],
        H: [-2, -2, -2, 0, 2, 4, 1, 3, 3, 3],
        I: [-2, -2, -2, -1, 0, 1, -1, 0, 1, 1],
        J: [-2, -2, -2, -2, -1, -1, -2, -2, -1, -1]
    },

    // 【超寒冷】非常に厳しい。森林は中緯度の海洋近傍と赤道付近に限定
    VeryLowTemp: {
        A: [0, 2, 6, 10, 15, 18, 16, 18, 20, 20],
        B: [-1, 0, 4, 7, 12, 15, 14, 15, 17, 18],
        C: [-2, -1, 2, 5, 9, 12, 11, 12, 14, 15],
        D: [-2, -2, 0, 3, 7, 10, 9, 10, 12, 13],
        E: [-2, -2, -1, 1, 4, 8, 7, 8, 10, 11],
        F: [-2, -2, -2, 0, 2, 6, 5, 6, 8, 9],
        G: [-2, -2, -2, -1, 1, 4, 3, 4, 6, 7],
        H: [-2, -2, -2, -2, 0, 2, 1, 2, 4, 5],
        I: [-2, -2, -2, -2, -1, 0, -1, 0, 2, 3],
        J: [-2, -2, -2, -2, -2, -1, -2, -1, 0, 1]
    },

    // 【極寒】森林リフュジア（避難所）の極致。赤道直下のみ広大なジャングルが残る
    ExtremelyLowTemp: {
        A: [-1, 0, 2, 6, 10, 14, 16, 18, 20, 20],
        B: [-2, -1, 0, 4, 7, 11, 13, 15, 17, 17],
        C: [-2, -2, -1, 2, 5, 9, 11, 12, 14, 14],
        D: [-2, -2, -2, 0, 3, 7, 9, 10, 12, 12],
        E: [-2, -2, -2, -1, 1, 5, 7, 8, 10, 10],
        F: [-2, -2, -2, -2, 0, 3, 5, 6, 8, 8],
        G: [-2, -2, -2, -2, -1, 1, 3, 4, 5, 6],
        H: [-2, -2, -2, -2, -2, 0, 1, 2, 3, 4],
        I: [-2, -2, -2, -2, -2, -1, 0, 1, 1, 2],
        J: [-2, -2, -2, -2, -2, -2, -2, -2, -1, -1]
    }
});
/**
 * 配列 -> landDistanceThresholdN オブジェクトへ変換
 * arr は長さ10の配列を想定（帯01..10）
 */
function toThresholdObject(arr) {
    const a = Array.isArray(arr) ? arr : [];
    return {
        landDistanceThreshold1: a[0] ?? PARAM_DEFAULTS.landDistanceThreshold1,
        landDistanceThreshold2: a[1] ?? PARAM_DEFAULTS.landDistanceThreshold2,
        landDistanceThreshold3: a[2] ?? PARAM_DEFAULTS.landDistanceThreshold3,
        landDistanceThreshold4: a[3] ?? PARAM_DEFAULTS.landDistanceThreshold4,
        landDistanceThreshold5: a[4] ?? PARAM_DEFAULTS.landDistanceThreshold5,
        landDistanceThreshold6: a[5] ?? PARAM_DEFAULTS.landDistanceThreshold6,
        landDistanceThreshold7: a[6] ?? PARAM_DEFAULTS.landDistanceThreshold7,
        landDistanceThreshold8: a[7] ?? PARAM_DEFAULTS.landDistanceThreshold8,
        landDistanceThreshold9: a[8] ?? PARAM_DEFAULTS.landDistanceThreshold9,
        landDistanceThreshold10: a[9] ?? PARAM_DEFAULTS.landDistanceThreshold10
    };
}
/**
 * 平均気温と greenIndex(GI) から帯別距離閾値を返す。
 */
export function computeLandDistanceThresholdsByGreenIndex({ averageTemperature, greenIndex }) {
    const zone = tempZone(averageTemperature);
    const cat = categorizeGreenIndex(greenIndex);

    // 既存挙動との整合: 現代相当（MiddleHighTemp）かつ GI=1.00 では基準値に固定
    if (zone === 'MiddleHighTemp' && Number(greenIndex) === 1) {
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

    const table = TABLES[zone] || TABLES.MiddleHighTemp;
    const arr = table[cat] || table.E;
    return toThresholdObject(arr);
}