import { ERAS } from '../paramsDefaults.js';

// eraごとの初期値（指定テーブル）
const ERA_INITIALS = Object.freeze({
    '爆撃時代': {
        Time_yr: 400000000,
        f_N2: 0.78,
        f_O2: 0,
        f_CO2: 0.5,
        f_CH4: 0.01,
        f_Ar: 0.0020,
        f_H2: 0.0100,
        averageTemperature: 60,
        f_cloud: 0.45,
        greenIndex: 1,
        sol_event: 0
    },
    '生命発生前時代': {
        Time_yr: 450000000,
        f_N2: 0.78,
        f_O2: 0,
        f_CO2: 0.4,
        f_CH4: 0.01,
        f_Ar: 0.0022,
        f_H2: 0.00905,
        averageTemperature: 50,
        f_cloud: 0.50,
        greenIndex: 1,
        sol_event: 0
    },
    '嫌気性細菌誕生時代': {
        Time_yr: 600000000,
        f_N2: 0.78,
        f_O2: 0,
        f_CO2: 0.4,
        f_CH4: 0.01,
        f_Ar: 0.0029,
        f_H2: 0.00670,
        averageTemperature: 40,
        f_cloud: 0.55,
        greenIndex: 1,
        sol_event: 0
    },
    '光合成細菌誕生時代': {
        Time_yr: 1600000000,
        f_N2: 0.78,
        f_O2: 0,
        f_CO2: 0.05,
        f_CH4: 0.001,
        f_Ar: 0.0059,
        f_H2: 0.00091,
        averageTemperature: 30,
        f_cloud: 0.58,
        greenIndex: 1,
        sol_event: 0
    },
    '真核生物誕生時代': {
        Time_yr: 2600000000,
        f_N2: 0.78,
        f_O2: 0.0001,
        f_CO2: 0.01,
        f_CH4: 0.0001,
        f_Ar: 0.0077,
        f_H2: 0.00012,
        averageTemperature: 20,
        f_cloud: 0.60,
        greenIndex: 1,
        sol_event: 0
    },
    '多細胞生物誕生時代': {
        Time_yr: 3200000000,
        f_N2: 0.78,
        f_O2: 0.005,
        f_CO2: 0.005,
        f_CH4: 0.00001,
        f_Ar: 0.0084,
        f_H2: 0.000037,
        averageTemperature: 15,
        f_cloud: 0.62,
        greenIndex: 1,
        sol_event: 0
    },
    '海洋生物多様化時代': {
        Time_yr: 4000000000,
        f_N2: 0.78,
        f_O2: 0.01,
        f_CO2: 0.005,
        f_CH4: 0.000001,
        f_Ar: 0.0090,
        f_H2: 0.000007,
        averageTemperature: 23,
        f_cloud: 0.60,
        greenIndex: 1,
        sol_event: 0
    },
    '苔類進出時代': {
        Time_yr: 4100000000,
        f_N2: 0.78,
        f_O2: 0.10,
        f_CO2: 0.01,
        f_CH4: 0.000001,
        f_Ar: 0.0091,
        f_H2: 0.000006,
        averageTemperature: 17,
        f_cloud: 0.63,
        greenIndex: 1,
        sol_event: 0
    },
    'シダ植物時代': {
        Time_yr: 4200000000,
        f_N2: 0.78,
        f_O2: 0.18,
        f_CO2: 0.005,
        f_CH4: 0.000001,
        f_Ar: 0.0092,
        f_H2: 0.000005,
        averageTemperature: 10,
        f_cloud: 0.65,
        greenIndex: 1,
        sol_event: 0
    },
    '大森林時代': {
        Time_yr: 4300000000,
        f_N2: 0.78,
        f_O2: 0.30,
        f_CO2: 0.0005,
        f_CH4: 0.000001,
        f_Ar: 0.0093,
        f_H2: 0.000004,
        averageTemperature: 20,
        f_cloud: 0.60,
        greenIndex: 1,
        sol_event: 0
    },
    '文明時代': {
        Time_yr: 4550000000,
        f_N2: 0.78,
        f_O2: 0.21,
        f_CO2: 0.0004,
        f_CH4: 0.000001,
        f_Ar: 0.0094,
        f_H2: 0.000002,
        averageTemperature: 15,
        f_cloud: 0.67,
        greenIndex: 1,
        sol_event: 0
    },
    '海棲文明時代': {
        Time_yr: 4550000000,
        f_N2: 0.78,
        f_O2: 0.21,
        f_CO2: 0.0004,
        f_CH4: 0.000001,
        f_Ar: 0.0094,
        f_H2: 0.000002,
        averageTemperature: 15,
        f_cloud: 0.67,
        greenIndex: 1,
        sol_event: 0
    }
});

// eraごとの標準 Turn_yr
const ERA_TURN_YR = Object.freeze({
    '爆撃時代': 50000,
    '生命発生前時代': 50000,
    '嫌気性細菌誕生時代': 50000,
    '光合成細菌誕生時代': 50000,
    '真核生物誕生時代': 50000,
    '多細胞生物誕生時代': 50000,
    '海洋生物多様化時代': 10000,
    '苔類進出時代': 5000,
    'シダ植物時代': 2000,
    '大森林時代': 1000,
    '文明時代': 10,
    '海棲文明時代': 10
});

// Step9: era の時間閾値（次の時代へ移る条件 = Time_yr が次時代の開始値を超えたら）
const ERA_START_YR = Object.freeze({
    '爆撃時代': 400000000,
    '生命発生前時代': 450000000,
    '嫌気性細菌誕生時代': 600000000,
    '光合成細菌誕生時代': 1600000000,
    '真核生物誕生時代': 2600000000,
    '多細胞生物誕生時代': 3200000000,
    '海洋生物多様化時代': 4000000000,
    '苔類進出時代': 4100000000,
    'シダ植物時代': 4200000000,
    '大森林時代': 4300000000,
    '文明時代': 4550000000,
    '海棲文明時代': 4550000000
});

// 時代遷移順
const ERA_ORDER = Object.freeze([
    '爆撃時代',
    '生命発生前時代',
    '嫌気性細菌誕生時代',
    '光合成細菌誕生時代',
    '真核生物誕生時代',
    '多細胞生物誕生時代',
    '海洋生物多様化時代',
    '苔類進出時代',
    'シダ植物時代',
    '大森林時代',
    '文明時代'
    // 海棲文明時代は現状「別ルート」想定のため自動遷移の最後に含めない
]);

export function buildEraInitialClimate(era) {
    const e = (typeof era === 'string' && ERAS.includes(era)) ? era : '大森林時代';
    return { ...ERA_INITIALS[e] };
}

export function buildEraTurnYr(era) {
    const e = (typeof era === 'string' && ERAS.includes(era)) ? era : '大森林時代';
    return Number(ERA_TURN_YR[e] || 50000);
}

// Turn_yr によって CO2_alpha/O2_alpha/Temp_alpha/GI_alpha を決定
export function buildTurnAlphaParams(Turn_yr) {
    const t = Number(Turn_yr);
    // 指定可能値（UIで選べるリスト）
    const allowed = [10, 20, 100, 1000, 2000, 5000, 10000, 50000, 100000];
    // 指定値以外は近いレンジに丸める（閾値は経験則）
    const key = allowed.includes(t)
        ? t
        : (t < 20 ? 10
            : (t < 100 ? 20
                : (t < 1000 ? 100
                    : (t < 2000 ? 1000
                        : (t < 5000 ? 2000
                            : (t < 10000 ? 5000
                                : (t < 50000 ? 10000
                                    : (t < 100000 ? 50000 : 100000))))))));

    const GI_alpha = ({
        10: 0.07,
        20: 0.09,
        100: 0.15,
        1000: 0.25,
        2000: 0.30,
        5000: 0.28,
        10000: 0.50,
        50000: 0.75,
        100000: 0.85
    })[key];

    const CO2_alpha = ({
        10: 0.05,
        20: 0.07,
        100: 0.12,
        1000: 0.20,
        2000: 0.30,
        5000: 0.45,
        10000: 0.60,
        50000: 0.70,
        100000: 0.80
    })[key];

    const O2_alpha = ({
        10: 0.10,
        20: 0.30,
        100: 0.10,
        1000: 0.30,
        2000: 0.40,
        5000: 0.55,
        10000: 0.70,
        50000: 0.80,
        100000: 0.85
    })[key];

    const Temp_alpha = ({
        10: 0.05,
        20: 0.06,
        100: 0.08,
        1000: 0.10,
        2000: 0.12,
        5000: 0.14,
        10000: 0.15,
        50000: 0.20,
        100000: 0.25
    })[key];

    const glacier_alpha = ({
        10: 0.01,
        20: 0.02,
        100: 0.06,
        1000: 0.10,
        2000: 0.18,
        5000: 0.30,
        10000: 0.45,
        50000: 0.65,
        100000: 0.75
    })[key];

    return { GI_alpha, CO2_alpha, O2_alpha, Temp_alpha, glacier_alpha, alphaKey: key };
}

export function getNextEraByTime(curEra, Time_yr) {
    const e = (typeof curEra === 'string' && ERAS.includes(curEra)) ? curEra : '大森林時代';
    const t = Number(Time_yr);
    if (!isFinite(t)) return { nextEra: e, didChange: false };
    const idx = ERA_ORDER.indexOf(e);
    if (idx < 0) return { nextEra: e, didChange: false };
    const next = ERA_ORDER[idx + 1];
    if (!next) return { nextEra: e, didChange: false };
    const threshold = ERA_START_YR[next];
    if (typeof threshold !== 'number') return { nextEra: e, didChange: false };
    if (t >= threshold) return { nextEra: next, didChange: true };
    return { nextEra: e, didChange: false };
}


