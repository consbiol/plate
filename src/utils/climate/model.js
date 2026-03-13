import {
    buildEraInitialClimate,
    buildEraTurnYr,
    buildTurnAlphaParams,
    computeEraBryophyteProbability,
    getEraStartTime,
    getNextEraByTime
} from './eraPresets.js';
import { computeSolarAndGases, computeH2Oeff, computeLnGases, computeRadiationCooling, computeRadiativeEquilibriumCalc, computeClouds, computeAlbedo } from './radiative.js';
import { volcanoEventMagFromIndex } from './volcanoEventMagnification.js';


function sq(x) {
    const v = Number(x);
    return v * v;
}

// Era-dependent coefficients
const ERA_PLAND_T = /** @type {Record<string, number>} */ ({
    '苔類進出時代': 0.1,
    'シダ植物時代': 1,
    '大森林時代': 1,
    '文明時代': 1,
    '海棲文明時代': 1,
});

const ERA_OCEAN_PLANT_O2_BASE = /** @type {Record<string, number>} */ ({
    '光合成細菌誕生時代': 0.1,
    '真核生物誕生時代': 0.3,
    '多細胞生物誕生時代': 0.5,
    '海洋生物多様化時代': 0.7,
    '苔類進出時代': 1.0,
    'シダ植物時代': 1.0,
    '大森林時代': 1.0,
    '文明時代': 1.0,
    '海棲文明時代': 1.0,
});

const ERA_LAND_PLANT_O2 = /** @type {Record<string, number>} */ ({
    '苔類進出時代': 0.07,
    'シダ植物時代': 1.0,
    '大森林時代': 0.85,
    '文明時代': 0.85,
    '海棲文明時代': 0.85,
});

const ERA_FUNGAL_FACTOR = /** @type {Record<string, number>} */ ({
    '苔類進出時代': 2.0,
    'シダ植物時代': 1.8,
});


const ERA_OCEAN_PH_PARAMS = Object.freeze({
    '爆撃時代': { f_CO2_0: 0.3, pH0: 6, alphaPh: 0.5 },
    '生命発生前時代': { f_CO2_0: 0.3, pH0: 6, alphaPh: 0.5 },
    '嫌気性細菌誕生時代': { f_CO2_0: 0.2, pH0: 6.3, alphaPh: 0.6 },
    '光合成細菌誕生時代': { f_CO2_0: 0.1, pH0: 6.8, alphaPh: 0.7 },
    '真核生物誕生時代': { f_CO2_0: 0.02, pH0: 7.3, alphaPh: 0.8 },
    '多細胞生物誕生時代': { f_CO2_0: 0.01, pH0: 7.5, alphaPh: 0.85 },
    '海洋生物多様化時代': { f_CO2_0: 0.01, pH0: 8.0, alphaPh: 0.9 },
    '苔類進出時代': { f_CO2_0: 0.003, pH0: 8.2, alphaPh: 0.85 },
    'シダ植物時代': { f_CO2_0: 0.0002, pH0: 8.3, alphaPh: 0.8 },
    '大森林時代': { f_CO2_0: 0.0004, pH0: 8.3, alphaPh: 0.8 },
    '文明時代': { f_CO2_0: 0.0003, pH0: 8.2, alphaPh: 0.9 },
    '海棲文明時代': { f_CO2_0: 0.0004, pH0: 8.25, alphaPh: 0.8 },
});
const ERA_OCEAN_PH_DEFAULT = ERA_OCEAN_PH_PARAMS['多細胞生物誕生時代'];
const NO_HIGH_TEMP_ERAS = new Set(['爆撃時代', '生命発生前時代', '嫌気性細菌誕生時代']);


function computePland_t(era) {
    return ERA_PLAND_T[era] ?? 0;
}

function computeOceanPlantO2Base(era) {
    return ERA_OCEAN_PLANT_O2_BASE[era] ?? 0;
}

function computeLandPlantO2(era) {
    return ERA_LAND_PLANT_O2[era] ?? 0;
}

function computeFungalFactor(era) {
    return ERA_FUNGAL_FACTOR[era] ?? 1.0;
}

function computeOceanPhParams(era) {
    return ERA_OCEAN_PH_PARAMS[era] ?? ERA_OCEAN_PH_DEFAULT;
}

function resolveRandom(random) {
    return (typeof random === 'function') ? random : Math.random;
}

function applyVolcanoDrift(baseVolcanoEvent, driftMetrics) {
    if (!driftMetrics) return baseVolcanoEvent;
    const superPloom = Number(driftMetrics.superPloom);
    if (!Number.isFinite(superPloom)) return baseVolcanoEvent;
    const phaseName = (typeof driftMetrics.phase === 'string') ? driftMetrics.phase : null;

    if (phaseName === 'Approach') {
        if (superPloom > 30) return 3.0;
        if (superPloom > 20 && superPloom < 30) return 2.0;
        return baseVolcanoEvent;
    }

    if (phaseName === 'Repel') {
        if (superPloom > 30) return 3.0;
        if (superPloom > 20 && superPloom < 30) return 2.0;
        if (superPloom > 10 && superPloom < 20) return 1.5;
        if (superPloom > 0 && superPloom < 10) return 1.0;
        if (superPloom === 0) return 1.0;
    }

    return baseVolcanoEvent;
}

function applyOneShotReset(events, remainingKey, onEnd) {
    const remaining = Number(events[remainingKey] || 0);
    const nextRemaining = Math.max(0, remaining - 1);
    if (remaining <= 0) return;
    events[remainingKey] = nextRemaining;
    if (nextRemaining === 0) {
        onEnd(events);
    }
}

export function computeNextClimateTurn(cur, options = {}) {
    return computeNextClimateTurnCore(cur, { random: resolveRandom(options.random) });
}

// Worker化を見据えた純粋計算コア（random を注入可能）
export function computeNextClimateTurnCore(cur, deps = {}) {
    const random = resolveRandom(deps.random);
    const state = cur && typeof cur === 'object' ? cur : {};
    const era = state.era || '大森林時代';

    const Time_turn = Number(state.Time_turn) || 0;
    const Time_yr = Number(state.Time_yr) || 0;
    const eraStartCandidate = Number(state.eraStartYr);
    const eraStartYr = isFinite(eraStartCandidate)
        ? Math.max(0, eraStartCandidate)
        : getEraStartTime(era);
    const Time_yr_era = Math.max(0, Time_yr - eraStartYr);

    const baseTurnYr = Number(state.Turn_yr) || buildEraTurnYr(era);
    let Turn_yr = baseTurnYr;
    let forcedTurnsRemaining = Number(state.forcedTurnsRemaining) || 0;
    let forcedOriginalTurnYr = (typeof state.forcedOriginalTurnYr === 'number') ? state.forcedOriginalTurnYr : null;
    if (forcedTurnsRemaining > 0) {
        const isCivilEra = (era === '文明時代' || era === '海棲文明時代');
        Turn_yr = isCivilEra ? 10 : 1000;
    }

    const constants = state.constants || {};
    const events = state.events || {};
    const terrain = state.terrain || {};
    const v0 = state.vars || {};
    let greenIndex = Number(v0.greenIndex);
    const prevBryophyteProbability = Math.max(0, Number(v0.bryophyteProbability) || 0);
    const bryophyteProbability = (era === '苔類進出時代')
        ? computeEraBryophyteProbability(Time_yr_era, Turn_yr, prevBryophyteProbability, greenIndex)
        : 0;
    let baseAverageTemperature = (typeof state.baseAverageTemperature === 'number') ? state.baseAverageTemperature : 15;

    const { GI_alpha, CO2_alpha, O2_alpha, Temp_alpha, CH4_alpha } = buildTurnAlphaParams(Turn_yr);

    let f_N2 = Number(v0.f_N2);
    let f_O2 = Number(v0.f_O2);
    let f_CO2 = Number(v0.f_CO2);
    let f_CH4 = Number(v0.f_CH4);
    let f_Ar = Number(v0.f_Ar);
    let f_H2 = Number(v0.f_H2);
    let Pressure = Number(v0.Pressure);
    let f_cloud = Number(v0.f_cloud);
    let averageTemperature = Number(v0.averageTemperature);

    // 地質・天文学的パラメータ
    const f_N2_fixed = Number(constants.f_N2_fixed);
    if (isFinite(f_N2_fixed)) f_N2 = f_N2_fixed * (1 - Math.exp(-(Time_yr * 1e-9) / 0.3));

    const gases = computeSolarAndGases(Time_yr, constants);
    const solarEvolution = gases.solarEvolution;
    f_Ar = gases.f_Ar;
    f_H2 = gases.f_H2;
    if (f_H2 < 0.0001) f_H2 = 0;

    let Volcano_event = Number(events.Volcano_event) || 1;
    Volcano_event = applyVolcanoDrift(Volcano_event, terrain && terrain.driftMetrics);

    // マントル活動（Volcano_event倍率）: 13段階の倍率を乗算
    const Volcano_event_mag_idx = events ? events.Volcano_event_mag_idx : null;
    const Volcano_event_mag = volcanoEventMagFromIndex(Volcano_event_mag_idx);
    Volcano_event = Volcano_event * Volcano_event_mag;

    // イベント
    const Meteo_eff = Number(events.Meteo_eff);
    const Fire_event_CO2 = Number(events.Fire_event_CO2);
    const Meteo_CO2_add = Number(events.Meteo_CO2_add) || 0;
    const CH4_event = Number(events.CH4_event);
    const sol_event = Number(events.sol_event);
    const CosmicRay = (typeof events.CosmicRay === 'number') ? events.CosmicRay : 1;
    const Volcano_event_manual = Number(events.Volcano_event_manual) || 0;
    const sqrtTurnYr = Math.sqrt(Turn_yr);
    const nextTimeYrEra = Time_yr_era + Turn_yr;
    const eraWillChange = getNextEraByTime(era, nextTimeYrEra).didChange;
    let tempAlphaEvent = Temp_alpha;
    if (Meteo_eff !== 1) {
        tempAlphaEvent = 1;
    }

    // 植生
    const co2Factor = (1.5 * f_CO2) / (0.0002 + f_CO2);
    const co2FactorClamped = Math.max(0, Math.min(co2Factor, 1.5));
    const f_O2_norm = f_O2 / 0.21;
    const O2_suppression = 1 / (1 + Math.pow(f_O2_norm / 1.8, 4));
    const tempSigmaColdSide = 18;
    const tempSigmaHotSide = 12;
    const tempSigma =
        averageTemperature < 22.5
            ? tempSigmaColdSide
            : tempSigmaHotSide;

    const greeningTech = 0;
    const greenIndex_calc = 1.81 * Math.exp(-(sq(averageTemperature - 22.5)) / (2 * sq(tempSigma))) * f_cloud * co2FactorClamped * O2_suppression + greeningTech;
    if (Time_turn === 0 || eraWillChange) {
        greenIndex = greenIndex_calc;
    } else {
        greenIndex = GI_alpha * greenIndex_calc + (1 - GI_alpha) * greenIndex;
    }

    // 大気成分（収支）
    const f_land = Number(terrain.f_land) || 0;
    const f_ocean = Number(terrain.f_ocean) || 0;
    const f_green = Number(terrain.f_green) || 0;
    const f_land_original = Number(terrain.f_land_original) || 0.3;
    const f_deepSea = Number(terrain.f_deepSea) || 0;
    const f_shallowSea = Number(terrain.f_shallowSea) || 0;

    const CO2_carbonate_eq =
        0.00028 * Math.exp((averageTemperature - 15) / 60);
    const CO2_flux_ocean =
        -1 * sqrtTurnYr
        * 0.0000012
        * f_ocean
        * f_CO2
        * Math.tanh((20 - averageTemperature) / 12)
        * Math.exp(-(averageTemperature - 15) / 80);

    const CO2_flux_carbonate =
        -1 * sqrtTurnYr
        * 0.00000015
        * (f_CO2 - CO2_carbonate_eq)
        * Math.exp((averageTemperature - 15) / 20)
        * Math.exp(-sq((averageTemperature - 50) / 20));

    const Pland_t = computePland_t(era);

    const land_weathering_eff =
        1 + 0.3 * Math.tanh(3 * Pland_t);
    const CO2_abs_rock =
        sqrtTurnYr
        * 0.00000008
        * (f_land / 0.3)
        * land_weathering_eff
        * Math.exp((averageTemperature - 15) / 18)
        * Math.pow((f_CO2 / 0.002), 0.8)
        * Math.exp(-sq((averageTemperature - 30) / 22));

    const CO2_abs_plant =
        sqrtTurnYr
        * 0.0000006
        * Pland_t
        * (f_green / 0.3)
        * Math.exp(-sq((averageTemperature - 22.5) / 15))
        * ((3 * f_CO2) / (f_CO2 + 0.0008))
        * (f_CO2 / (f_CO2 + 0.00003));

    const CO2_abs_ocean = Math.max(-CO2_flux_ocean, 0);
    const CO2_abs_carbonate = Math.max(-CO2_flux_carbonate, 0);

    const CO2_abs_total = CO2_abs_rock + CO2_abs_plant + CO2_abs_ocean + CO2_abs_carbonate;

    const CO2_release_volcano =
        sqrtTurnYr
        * 0.00000025
        * (Volcano_event + Volcano_event_manual)
        * Math.pow(4.55e9 / (Time_yr + 0.1e9), 1.25)
        * (1 + 0.4 * Math.tanh((f_land_original - 0.3) / 0.2))
        * (0.5 + (random() + random()) / 2);

    const CO2_release_ocean = Math.max(CO2_flux_ocean, 0);
    const CO2_release_carbonate = Math.max(CO2_flux_carbonate, 0);

    const CO2_release_civil = 0;

    const CO2_release_total = CO2_release_volcano + CO2_release_ocean + CO2_release_carbonate + CO2_release_civil + Fire_event_CO2;

    const f_CO2_calc = f_CO2 - CO2_abs_total + CO2_release_total;
    if (Time_turn === 0 || eraWillChange) {
        f_CO2 = f_CO2_calc;
    } else {
        f_CO2 = CO2_alpha * f_CO2_calc + (1 - CO2_alpha) * f_CO2 + Meteo_CO2_add;
    }
    f_CO2 = Math.max(f_CO2, 0.000006);

    //海洋pH
    const { f_CO2_0, pH0, alphaPh } = computeOceanPhParams(era);
    const oceanPhRatio = Math.max(f_CO2 / f_CO2_0, 1e-12);
    const oceanPh = pH0 - alphaPh * Math.log10(oceanPhRatio);

    // O2
    const f_O2_forAbs = Math.max(f_O2 - 0.0001, 0);

    const land_abs_eff_planet = Number(constants.land_abs_eff_planet) || 1.0;

    const ReducingFactor = 1 / (1 + Math.pow((f_O2_forAbs / 0.05), 2));
    const land_abs_eff = (20 * ReducingFactor) + 0.6 * land_abs_eff_planet;
    const volcGate = f_O2_forAbs / (f_O2_forAbs + 0.1);
    const O2_abs =
        sqrtTurnYr
        * 0.00008
        * land_abs_eff
        * (f_land / 0.3)
        * (Math.pow((f_O2_forAbs / 0.21), 0.6) + 0.1)
        * Math.min(Math.exp(-sq((averageTemperature - 25) / 25)), 3)
        * f_O2_forAbs
        + sqrtTurnYr
        * 0.0003
        * (Volcano_event + Volcano_event_manual / 20)
        * volcGate;

    const ocean_plantO2_base = computeOceanPlantO2Base(era);
    const land_plantO2 = computeLandPlantO2(era);
    const fungal_factor = computeFungalFactor(era);
    const O2_prod =
        sqrtTurnYr
        * 0.0007
        * (
            0.6
            * (0.31 * f_deepSea + 2.6 * f_shallowSea)
            * Math.exp(-sq((averageTemperature - 20) / 18))
            * ocean_plantO2_base
            * (1 + 0.15 * f_green * land_plantO2 - 0.35 * Math.pow(f_green, 3) * land_plantO2)
            * ((f_CO2 / (f_CO2 + 0.0004)) + 0.5)
            + 0.4
            * f_green
            * Math.exp(-sq((averageTemperature - 22.5) / 15))
            * land_plantO2
            * fungal_factor
            * ((3 * f_CO2) / (f_CO2 + 0.0008))
        )
        * Math.pow((1 + f_O2 / 0.21), -0.25);


    const H2O_eff = computeH2Oeff(averageTemperature, f_ocean, constants, { conservative: false });

    // 高温時O2放出（簡易）
    const o2HighTempCoef = Number(constants.o2_high_temp_coef) || 0.00002;
    const o2HighTempAgeTau = Number(constants.o2_high_temp_age_tau) || 1e7;
    const o2HighTempTth = Number(constants.o2_high_temp_Tth) || 40;
    const o2HighTempTscale = Number(constants.o2_high_temp_Tscale) || 15;
    const o2HighTempProdThresh = Number(constants.o2_high_temp_prod_thresh) || 1e-6;
    const o2HighTempMax = Number(constants.o2_high_temp_max) || 1e-4;

    const ageFactor = 1 - Math.exp(-Time_yr / o2HighTempAgeTau);
    const tempSigmoid = 1 / (1 + Math.exp(-(averageTemperature - o2HighTempTth) / o2HighTempTscale));

    let O2_release_hightemp = sqrtTurnYr * o2HighTempCoef * f_ocean * H2O_eff * tempSigmoid * ageFactor;
    O2_release_hightemp = Math.max(0, Math.min(O2_release_hightemp, o2HighTempMax));

    if (NO_HIGH_TEMP_ERAS.has(era)) {
        O2_release_hightemp = 0;
    }

    if (O2_prod > o2HighTempProdThresh) {
        O2_release_hightemp = 0;
    }

    const f_O2_calc = f_O2 - O2_abs + O2_prod + O2_release_hightemp;
    f_O2 = O2_alpha * f_O2_calc + (1 - O2_alpha) * f_O2;

    const initial_CH4 = Number(constants.initial_CH4) || 0.01;
    const f_CH4_calc = initial_CH4 / (1 + sq(f_O2 / 0.003)) * 1 / (1 + Math.pow((f_O2 / 0.05), 4)) + CH4_event;
    f_CH4 = CH4_alpha * f_CH4_calc + (1 - CH4_alpha) * f_CH4;
    f_CH4 = Math.max(f_CH4, 0.0000001);

    const f_H2O = H2O_eff * 0.01;

    f_O2 = Math.max(f_O2, 0);
    f_CO2 = Math.max(f_CO2, 0.000006);
    Pressure = f_Ar + f_H2 + f_N2 + f_O2 + f_CO2 + f_CH4 + f_H2O;
    Pressure = Math.max(Pressure, 0.001);

    // 雲量・アルベド
    const cloudRes = computeClouds({ Pressure, f_ocean, averageTemperature, CosmicRay, f_CH4, f_CO2 });
    const hazeFrac = cloudRes.hazeFrac;
    f_cloud = cloudRes.f_cloud;
    const albedo = computeAlbedo({ f_cloud, hazeFrac, terrain, Time_yr });

    // 有効放射率
    const { lnCO2, lnCH4 } = computeLnGases(f_CO2, f_CH4);
    let Radiation_cooling = computeRadiationCooling(Pressure, lnCO2, lnCH4, H2O_eff, f_H2, f_N2, f_CO2, averageTemperature, solarEvolution, Time_yr);

    // 平均気温
    const initialSolVal = Number(constants.initialSol) || 950;
    const { averageTemperature_calc, Sol } = computeRadiativeEquilibriumCalc({
        solarEvolution,
        Time_yr,
        Meteo_eff,
        sol_event,
        albedo,
        Radiation_cooling,
        initialSol: initialSolVal
    });

    if (Time_turn === 0) {
        averageTemperature = averageTemperature_calc - 273.15;
    } else {
        averageTemperature = tempAlphaEvent * (averageTemperature_calc - 273.15) + (1 - tempAlphaEvent) * averageTemperature;
    }

    const nextTimeYr = Time_yr + Turn_yr;
    let nextTimeTurn = Time_turn + 1;

    // --- Step9: 時代変更トリガー（時間経過） ---
    let nextEra = era;
    let nextEraStartYr = eraStartYr;
    const { nextEra: eraByTime, didChange } = getNextEraByTime(era, nextTimeYrEra);
    if (didChange) {
        nextEra = eraByTime;
        baseAverageTemperature = buildEraInitialClimate(nextEra).averageTemperature;
        nextTimeTurn = 0;
        nextEraStartYr = nextTimeYr;
    }

    // 強制 Turn_yr の継続/終了処理
    let nextForcedTurnsRemaining = Math.max(0, Number(forcedTurnsRemaining) - 1);
    let nextTurnYrForState = Turn_yr;
    if (forcedTurnsRemaining > 0) {
        if (nextForcedTurnsRemaining === 0 && (typeof forcedOriginalTurnYr === 'number' && forcedOriginalTurnYr > 0)) {
            nextTurnYrForState = forcedOriginalTurnYr;
            forcedOriginalTurnYr = null;
        } else {
            const nextIsCivil = (nextEra === '文明時代' || nextEra === '海棲文明時代');
            if (nextIsCivil) {
                nextTurnYrForState = 10;
            } else {
                nextTurnYrForState = 1000;
            }
        }
    } else {
        nextTurnYrForState = baseTurnYr;
    }

    // ワンショットイベントの残ターン処理
    const nextEvents = { ...events };

    applyOneShotReset(nextEvents, 'Meteo_one_shot_remaining', (e) => {
        e.Meteo_eff = 1;
        e.Meteo_CO2_add = 0;
    });
    applyOneShotReset(nextEvents, 'Fire_one_shot_remaining', (e) => {
        e.Fire_event_CO2 = 0;
    });
    applyOneShotReset(nextEvents, 'CH4_one_shot_remaining', (e) => {
        e.CH4_event = 0;
    });
    applyOneShotReset(nextEvents, 'Volcano_manual_remaining', (e) => {
        e.Volcano_event_manual = 0;
    });
    applyOneShotReset(nextEvents, 'Cosmic_one_shot_remaining', (e) => {
        e.CosmicRay = 1;
    });

    return {
        ...state,
        events: nextEvents,
        era: nextEra,
        eraStartYr: nextEraStartYr,
        Time_turn: nextTimeTurn,
        Time_yr: nextTimeYr,
        Turn_yr: nextTurnYrForState,
        forcedTurnsRemaining: nextForcedTurnsRemaining,
        forcedOriginalTurnYr: forcedOriginalTurnYr,
        vars: {
            ...state.vars,
            solarEvolution,
            greenIndex,
            CO2_abs_total,
            CO2_abs_rock,
            CO2_abs_plant,
            CO2_abs_ocean,
            CO2_abs_carbonate,
            CO2_release_total,
            CO2_release_ocean,
            CO2_release_carbonate,
            CO2_release_volcano,
            land_abs_eff,
            ocean_plantO2_base,
            land_plantO2,
            fungal_factor,

            O2_abs: O2_abs,
            O2_abs_total: O2_abs,
            O2_prod,
            O2_release_hightemp,
            Pressure,
            f_N2,
            f_O2,
            f_CO2,
            oceanPh,
            f_CH4,
            f_Ar,
            f_H2,
            f_H2O,
            f_cloud,
            albedo,
            H2O_eff,
            averageTemperature_calc,
            Radiation_cooling,
            Sol,
            averageTemperature,
            bryophyteProbability
        },
        baseAverageTemperature
    };
}

// 計算済みの state から「放射平衡での温度（K）」を返す（副作用なし）
export function computeRadiativeEquilibriumTempK(state, options = {}) {
    const conservative = !!options.conservative;
    const s = state || {};
    const Time_yr = Number(s.Time_yr) || 0;
    const constants = s.constants || {};
    const events = s.events || {};
    const terrain = s.terrain || {};
    const v0 = s.vars || {};

    const gases = computeSolarAndGases(Time_yr, constants);
    const solarEvolution = gases.solarEvolution;
    const f_Ar = gases.f_Ar;
    const f_H2 = gases.f_H2;

    const f_N2 = Number(v0.f_N2) || 0.78;
    const f_O2 = Math.max(0, Number(v0.f_O2) || 0);
    const f_CO2 = Math.max(Number(v0.f_CO2) || 0.0000001, 0.0000001);
    const f_CH4 = Math.max(Number(v0.f_CH4) || 0.0000001, 0.0000001);
    const Meteo_eff = Number(events.Meteo_eff) || 1;
    const sol_event = Number(events.sol_event) || 0;
    const CosmicRay = (typeof events.CosmicRay === 'number') ? events.CosmicRay : 1;

    const f_ocean = Number(terrain.f_ocean) || 0.7;

    // H2O_eff approximation (use v0.averageTemperature as driver)
    // NOTE: baseAverageTemperature は「時代初期値」なので、ここでは現在値（v0.averageTemperature）を優先する。
    const averageTemperature = (typeof v0.averageTemperature === 'number')
        ? Number(v0.averageTemperature)
        : (Number(s.baseAverageTemperature) || 15);
    let H2O_eff = computeH2Oeff(averageTemperature, f_ocean, constants, { conservative });
    // f_H2O を H2O_eff から算出して Pressure に含める
    const f_H2O = H2O_eff * 0.01;
    const Pressure = f_Ar + f_H2 + f_N2 + f_O2 + f_CO2 + f_CH4 + f_H2O;
    // compute clouds using shared helper (init-mode for radiative estimate)
    const cloudInit = computeClouds({ Pressure, f_ocean, averageTemperature, CosmicRay, f_CH4, f_CO2 });
    const hazeFrac = cloudInit.hazeFrac;
    const f_cloud = cloudInit.f_cloud;

    const { lnCO2, lnCH4 } = computeLnGases(f_CO2, f_CH4);
    let Radiation_cooling = computeRadiationCooling(Pressure, lnCO2, lnCH4, H2O_eff, f_H2, f_N2, f_CO2, averageTemperature, solarEvolution, Time_yr);

    // compute albedo via shared helper
    const albedo = computeAlbedo({ f_cloud, hazeFrac, terrain, Time_yr });

    const initialSolVal = Number(constants.initialSol) || 950;
    const { averageTemperature_calc, Sol } = computeRadiativeEquilibriumCalc({
        solarEvolution,
        Time_yr,
        Meteo_eff,
        sol_event,
        albedo,
        Radiation_cooling,
        initialSol: initialSolVal
    });
    return { averageTemperature_calc, Sol, f_cloud, Radiation_cooling, H2O_eff, f_H2O };
}




