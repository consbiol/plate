// 指定の「大気ー平均気温モデル」を式そのままで実装する（Step1〜9）
// - ここは純関数として設計（副作用なし）
// - state構造は store/slices/climate.js の `climate` を前提

import { clamp } from './math.js';
import { buildEraTurnYr, buildTurnAlphaParams, getNextEraByTime, buildEraInitialClimate } from './eraPresets.js';

function safeLn(x) {
    const v = Number(x);
    if (!isFinite(v) || v <= 0) return -Infinity;
    return Math.log(v);
}

function sq(x) {
    const v = Number(x);
    return v * v;
}

function ratio2Over1PlusRatio2(a, b) {
    const aa = Number(a);
    const bb = Number(b);
    if (!isFinite(aa) || !isFinite(bb) || bb === 0) return 0;
    const r = aa / bb;
    const r2 = r * r;
    return r2 / (1 + r2);
}

function computePland_t(era) {
    // Step4: Pland_t（植物固定効果係数）
    switch (era) {
        case '苔類進出時代': return 0.1;
        case 'シダ植物時代':
        case '大森林時代':
        case '文明時代':
        case '海棲文明時代':
            return 1;
        default:
            return 0;
    }
}

function computeOceanPlantO2Base(era) {
    switch (era) {
        case '光合成細菌誕生時代': return 0.1;
        case '真核生物誕生時代': return 0.2;
        case '多細胞生物誕生時代': return 0.5;
        case '海洋生物多様化時代': return 0.8;
        case '苔類進出時代':
        case 'シダ植物時代':
        case '大森林時代':
        case '文明時代':
        case '海棲文明時代':
            return 1.0;
        default:
            return 0;
    }
}

function computeLandPlantO2(era) {
    switch (era) {
        case '苔類進出時代': return 0.075;
        case 'シダ植物時代': return 1.2;
        case '大森林時代':
        case '文明時代':
        case '海棲文明時代':
            return 1.0;
        default:
            return 0;
    }
}

function computeFungalFactor(era) {
    switch (era) {
        case '苔類進出時代': return 1.50;
        case 'シダ植物時代': return 1.35;
        default: return 1.00;
    }
}

export function computeNextClimateTurn(cur) {
    const state = cur && typeof cur === 'object' ? cur : {};
    const era = state.era || '大森林時代';

    const Time_turn = Number(state.Time_turn) || 0;
    const Time_yr = Number(state.Time_yr) || 0;
    let baseAverageTemperature = (typeof state.baseAverageTemperature === 'number') ? state.baseAverageTemperature : 15;

    // Turn_yr（UIで指定された値を優先。未設定なら era 既定値）
    let Turn_yr = Number(state.Turn_yr) || buildEraTurnYr(era);
    // NOTE: 以前あった「時代遷移の30ターン補正 (Turn_yr=1000)」は要件により削除。
    // 互換のため state に古い transition* が残っていても無視し、常に 0/null にクリアして返す。
    let transitionTurnsRemaining = 0;
    let transitionNextTurnYr = null;

    const { GI_alpha, CO2_alpha, O2_alpha, Temp_alpha } = buildTurnAlphaParams(Turn_yr);

    const constants = state.constants || {};
    const events = state.events || {};
    const terrain = state.terrain || {};
    const v0 = state.vars || {};

    // 前ターン値
    let f_N2 = Number(v0.f_N2);
    let f_O2 = Number(v0.f_O2);
    let f_CO2 = Number(v0.f_CO2);
    let f_CH4 = Number(v0.f_CH4);
    let f_Ar = Number(v0.f_Ar);
    let f_H2 = Number(v0.f_H2);
    let Pressure = Number(v0.Pressure);
    let f_cloud = Number(v0.f_cloud);
    let averageTemperature = Number(v0.averageTemperature);
    let greenIndex = Number(v0.greenIndex);

    // --- Step1: 地質・天文学的パラメータ ---
    const solarFlareUpRate = Number(constants.solarFlareUpRate) || 0.3;
    const argonCapacity = Number(constants.argonCapacity) || 0.0101;
    const initial_H2 = Number(constants.initial_H2) || 0.01;
    // N2は固定
    const f_N2_fixed = Number(constants.f_N2_fixed);
    if (isFinite(f_N2_fixed)) f_N2 = f_N2_fixed;

    const solarEvolution = 1 + solarFlareUpRate * ((Time_yr * 0.000000001) / 4.55);

    // Ar
    f_Ar = 0.000001 + (argonCapacity - 0.000001) * (1 - Math.exp(-0.555 * Time_yr * 0.000000001));

    // H2
    f_H2 = initial_H2 * Math.exp(-Time_yr / 500000000);
    if (f_H2 < 0.0001) f_H2 = 0;

    // --- Step2: イベント ---
    const Volcano_event = Number(events.Volcano_event);
    const Meteo_eff = Number(events.Meteo_eff);
    const Fire_event_CO2 = Number(events.Fire_event_CO2);
    const CH4_event = Number(events.CH4_event);
    const sol_event = Number(events.sol_event);
    const CosmicRay = (typeof events.CosmicRay === 'number') ? events.CosmicRay : 1;
    // 次 state が時代遷移で開始されるかを事前判定（時代変化直後の「初回ターン」扱いを検出するため）
    const eraWillChange = getNextEraByTime(era, Time_yr + Turn_yr).didChange;

    // --- Step3: 植生 ---
    const greenIndex_calc = 1.81 * Math.exp(-(sq(averageTemperature - 22.5)) / (2 * sq(12))) * f_cloud;
    // 最初のターン（または時代変化による次state開始ターン）では平滑化を行わず、生値を採用する
    if (Time_turn === 0 || eraWillChange) {
        greenIndex = greenIndex_calc;
    } else {
        greenIndex = GI_alpha * greenIndex_calc + (1 - GI_alpha) * greenIndex;
    }

    // --- Step4: 大気成分（収支） ---
    const f_land = Number(terrain.f_land) || 0;
    const f_ocean = Number(terrain.f_ocean) || 0;
    const f_green = Number(terrain.f_green) || 0;
    const f_glacier = Number(terrain.f_glacier) || 0;
    const f_land_original = Number(terrain.f_land_original) || 0.3;

    // CO2吸収の調整項
    const f_weather = Math.max(
        0.01,
        1 / (1 + Math.exp((averageTemperature - 90) / 5))
    );

    const CO2_abs_rock =
        Turn_yr
        * 0.00000001
        * (f_land / 0.3)
        * Math.exp((averageTemperature - 15) / 17)
        * Math.pow((f_CO2 / 0.0004), 0.5)
        * f_weather;

    const Pland_t = computePland_t(era);
    const CO2_abs_plant =
        (f_CO2 < 0.0001) ? 0 : (
            Turn_yr
            * 0.00000005
            * Pland_t
            * (f_green / 0.3)
            * Math.exp(-sq((averageTemperature - 22.5) / 15))
            * ((3 * f_CO2) / (f_CO2 + 0.0008))
        );

    const CO2_abs_total = CO2_abs_rock + CO2_abs_plant;

    const CO2_release_volcano =
        Turn_yr
        * 0.00000015
        * Volcano_event
        * ((1 + 4.55 / 2.5) / (1 + Time_yr / 2500000000))
        * (1 + 0.5 * ((f_land_original - 0.3) / 0.3));

    const CO2_release_civil = 0; // 未実装

    const CO2_release_total = CO2_release_volcano + CO2_release_civil + Fire_event_CO2;

    const f_CO2_calc = f_CO2 - CO2_abs_total + CO2_release_total;
    // 最初のターン（または時代変化による次state開始ターン）では平滑化を行わず、収支計算結果をそのまま採用する
    if (Time_turn === 0 || eraWillChange) {
        f_CO2 = f_CO2_calc;
    } else {
        f_CO2 = CO2_alpha * f_CO2_calc + (1 - CO2_alpha) * f_CO2;
    }
    f_CO2 = Math.max(f_CO2, 0.000006);

    // O2
    const f_O2_forAbs = Math.max(f_O2 - 0.00001, 0);

    const land_abs_eff_planet = Number(constants.land_abs_eff_planet) || 1.0;
    let HighO2_abs_boost = 1 + Math.pow((f_O2_forAbs / 0.21), 1.5);
    HighO2_abs_boost = Math.min(HighO2_abs_boost, 5);

    const land_abs_eff = (100 * Math.exp(-Time_yr / 500000000)) * HighO2_abs_boost + 0.6 * land_abs_eff_planet;

    const O2_abs =
        Turn_yr
        * 0.00001
        * land_abs_eff
        * (f_land / 0.3)
        * Math.pow((f_O2_forAbs / 0.21), 0.5)
        * Math.min(Math.exp((averageTemperature - 15) / 20), 3)
        * f_O2_forAbs;

    const ocean_plantO2_base = computeOceanPlantO2Base(era);
    const land_plantO2 = computeLandPlantO2(era);
    const fungal_factor = computeFungalFactor(era);

    const O2_prod =
        Turn_yr
        * 0.001
        * (
            0.6
            * f_ocean
            * Math.exp(-sq((averageTemperature - 20) / 10))
            * ocean_plantO2_base
            * (1 + 0.25 * f_green * land_plantO2)
            + 0.4
            * f_green
            * Math.exp(-sq((averageTemperature - 22.5) / 15))
            * land_plantO2
            * fungal_factor
        )
        * ((3 * f_CO2) / (f_CO2 + 0.0008))
        * Math.pow((1 + f_O2 / 0.21), -0.25)
        * Math.exp(-Math.pow((f_O2 / 0.35), 3));

    const f_O2_calc = f_O2 - O2_abs + O2_prod;
    f_O2 = O2_alpha * f_O2_calc + (1 - O2_alpha) * f_O2;

    // CH4
    const initial_CH4 = Number(constants.initial_CH4) || 0.01;
    f_CH4 = initial_CH4 / (1 + sq(f_O2 / 0.003)) * 1 / (1 + Math.pow((f_O2 / 0.05), 4)) + CH4_event;
    f_CH4 = Math.max(f_CH4, 0.0000001);

    // Pressure
    f_O2 = Math.max(f_O2, 0);
    f_CO2 = Math.max(f_CO2, 0.000006);
    Pressure = f_Ar + f_H2 + f_N2 + f_O2 + f_CO2 + f_CH4;
    Pressure = Math.max(Pressure, 0.001);
    Pressure = Math.max(Pressure, 0.3);

    // --- Step5: 雲量・アルベド ---
    const f_cloud_0 =
        Math.max(
            0,
            (
                0.1
                + 0.7 * f_ocean
                + 0.15 * safeLn(Math.min(Pressure, 10))
                + 0.02 * Math.min(50, (averageTemperature - 15))
            )
            * (1 / (1 + Math.exp((averageTemperature - 65) / 6)))
        );

    const hazeFrac = ratio2Over1PlusRatio2(f_CH4, f_CO2);
    f_cloud = f_cloud_0 * (1 - 0.3 * hazeFrac) * CosmicRay;
    f_cloud = clamp(f_cloud, 0.001, 1);

    // albedo
    const f_tundra = Number(terrain.f_tundra) || 0;
    const f_city = Number(terrain.f_city) || 0;
    const f_desert = Number(terrain.f_desert) || 0;
    const f_cultivated = Number(terrain.f_cultivated) || 0;
    const f_polluted = Number(terrain.f_polluted) || 0;
    const f_highland = Number(terrain.f_highland) || 0;
    const f_alpine = Number(terrain.f_alpine) || 0;

    const albedo_0 =
        // 氷河
        (1 - f_cloud) * 0.65 * f_glacier + (f_cloud) * (0.65 + 0.05) * f_glacier
        // 緑地+ツンドラ
        + (1 - f_cloud) * 0.13 * (f_green + f_tundra) + (f_cloud) * (0.13 + 0.15) * (f_green + f_tundra)
        // 都市
        + (1 - f_cloud) * 0.14 * f_city + (f_cloud) * (0.14 + 0.06) * f_city
        // 砂漠
        + (1 - f_cloud) * 0.38 * f_desert + (f_cloud) * (0.38 + 0.07) * f_desert
        // 農地+汚染地
        + (1 - f_cloud) * 0.18 * (f_cultivated + f_polluted) + (f_cloud) * (0.18 + 0.12) * (f_cultivated + f_polluted)
        // 高地+高山
        + (1 - f_cloud) * 0.22 * (f_highland + f_alpine) + (f_cloud) * (0.22 + 0.03) * (f_highland + f_alpine)
        // 海洋
        + (1 - f_cloud) * 0.06 * f_ocean + (f_cloud) * (0.06 + 0.69) * f_ocean;

    let albedo = albedo_0 + (1 - albedo_0) * 0.12 * hazeFrac;
    albedo = clamp(albedo, 0, 0.9);

    // --- Step6: 有効放射率 ---
    const T_sat = Number(constants.T_sat) || 40;
    const dT = Number(constants.dT) || 5;
    const H2O_max = Number(constants.H2O_max) || 2.9;

    const H2O_eff =
        H2O_max
        * (Math.exp((averageTemperature - 15) / 20) / (1 + Math.exp((averageTemperature - T_sat) / dT)))
        * (f_ocean + 0.1 * (1 - f_ocean));

    const a_H2 = 0.4 * f_N2 + 0.2 * f_H2 + 0.1 * f_CO2;

    let lnCO2 = safeLn(f_CO2 / 0.00028);
    if (!isFinite(lnCO2) || lnCO2 < -1.5) lnCO2 = -1.5;
    let lnCH4 = safeLn(f_CH4 / 0.0000018);
    if (!isFinite(lnCH4) || lnCH4 < -1.5) lnCH4 = -1.5;

    let Radiation_cooling =
        1 / (1 + Pressure * (0.25 * lnCO2 + 0.6 * lnCH4 + H2O_eff + f_H2 * a_H2));
    Radiation_cooling = Math.max(Radiation_cooling, 0.05);

    // --- Step7: 平均気温 ---
    const milankovitch = 1 + 0.00005 * Math.sin(2 * Math.PI * Time_yr / 100000);
    const Sol = 950 * solarEvolution * milankovitch + sol_event;

    const sigma = 5.67e-8;
    const averageTemperature_calc =
        Math.pow((Sol * Meteo_eff * (1 - albedo)) / (4 * sigma * Radiation_cooling), 0.25);

    if (Time_turn === 0) {
        averageTemperature = averageTemperature_calc - 273.15;
    } else {
        averageTemperature = Temp_alpha * (averageTemperature_calc - 273.15) + (1 - Temp_alpha) * averageTemperature;
    }

    // --- Step8: ターン終了処理 ---
    const nextTimeYr = Time_yr + Turn_yr;
    let nextTimeTurn = Time_turn + 1;

    // --- Step9: 時代変更トリガー（時間経過） ---
    let nextEra = era;
    const { nextEra: eraByTime, didChange } = getNextEraByTime(era, nextTimeYr);
    if (didChange) {
        nextEra = eraByTime;
        // 30ターン補正は削除（常に無効）
        transitionTurnsRemaining = 0;
        transitionNextTurnYr = null;
        baseAverageTemperature = buildEraInitialClimate(nextEra).averageTemperature;
        // 時代が変わったらターンカウントをリセットする
        // （次 state は次時代開始時点の状態なので Time_turn を 0 にする）
        nextTimeTurn = 0;
    }

    // 次stateの Turn_yr は常に「現在の Turn_yr（=ユーザー指定）」を維持する
    const nextTurnYrForState = Turn_yr;

    // 10ターンごとの平均気温履歴
    const history = state.history || { averageTemperatureEvery10: [] };
    const prevHist = Array.isArray(history.averageTemperatureEvery10) ? history.averageTemperatureEvery10 : [];
    const nextHist = prevHist.slice(-500); // 念のため上限（約5000ターン分の10ターン間隔）
    if (nextTimeTurn % 10 === 0) {
        nextHist.push({ turn: nextTimeTurn, yr: nextTimeYr, value: averageTemperature });
    }

    return {
        ...state,
        era: nextEra,
        Time_turn: nextTimeTurn,
        Time_yr: nextTimeYr,
        Turn_yr: nextTurnYrForState,
        transitionTurnsRemaining,
        transitionNextTurnYr,
        vars: {
            ...state.vars,
            solarEvolution,
            greenIndex,
            CO2_abs_total,
            CO2_abs_rock,
            CO2_abs_plant,
            CO2_release_total,
            CO2_release_volcano,
            // expose intermediate / helper values for diagnostics/UI
            f_weather,
            land_abs_eff,
            ocean_plantO2_base,
            land_plantO2,
            fungal_factor,
            // expose constants used for H2O_eff calculation so UI can display them
            T_sat,
            dT,
            H2O_max,
            O2_abs_total: O2_abs,
            O2_release_total: O2_prod,
            Pressure,
            f_N2,
            f_O2,
            f_CO2,
            f_CH4,
            f_Ar,
            f_H2,
            f_cloud,
            albedo,
            H2O_eff,
            // expose raw radiative equilibrium calc (K) so callers can use non-smoothed temperature
            averageTemperature_calc,
            Radiation_cooling,
            Sol,
            averageTemperature
        },
        baseAverageTemperature,
        history: {
            ...history,
            averageTemperatureEvery10: nextHist
        }
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

    const solarFlareUpRate = Number(constants.solarFlareUpRate) || 0.3;
    const argonCapacity = Number(constants.argonCapacity) || 0.0101;
    const initial_H2 = Number(constants.initial_H2) || 0.01;

    const solarEvolution = 1 + solarFlareUpRate * ((Time_yr * 0.000000001) / 4.55);
    const f_Ar = 0.000001 + (argonCapacity - 0.000001) * (1 - Math.exp(-0.555 * Time_yr * 0.000000001));
    const f_H2 = Math.max(0, initial_H2 * Math.exp(-Time_yr / 500000000));

    const f_N2 = Number(v0.f_N2) || 0.78;
    const f_O2 = Math.max(0, Number(v0.f_O2) || 0);
    const f_CO2 = Math.max(Number(v0.f_CO2) || 0.000006, 0.000006);
    const f_CH4 = Math.max(Number(v0.f_CH4) || 0.0000001, 0.0000001);
    const Pressure = f_Ar + f_H2 + f_N2 + f_O2 + f_CO2 + f_CH4;
    // previous cloud snapshot (unused here) removed
    const Meteo_eff = Number(events.Meteo_eff) || 1;
    const sol_event = Number(events.sol_event) || 0;
    const CosmicRay = (typeof events.CosmicRay === 'number') ? events.CosmicRay : 1;

    const f_ocean = Number(terrain.f_ocean) || 0.7;
    const f_cloud_0 =
        Math.max(
            0,
            (
                0.1
                + 0.7 * f_ocean
                + 0.15 * Math.log(Math.min(Pressure, 10))
                + 0.02 * Math.min(50, ((Number(v0.averageTemperature) || 15) - 15))
            )
            * (1 / (1 + Math.exp(((Number(v0.averageTemperature) || 15) - 65) / 6)))
        );

    const hazeFrac = (function (a, b) {
        const aa = Number(a); const bb = Number(b);
        if (!isFinite(aa) || !isFinite(bb) || bb === 0) return 0;
        const r = aa / bb; const r2 = r * r;
        return r2 / (1 + r2);
    })(f_CH4, f_CO2);
    const f_cloud = Math.max(0.001, Math.min(1, f_cloud_0 * (1 - 0.3 * hazeFrac) * CosmicRay));

    // H2O_eff approximation (use v0.averageTemperature as driver)
    // NOTE: baseAverageTemperature は「時代初期値」なので、ここでは現在値（v0.averageTemperature）を優先する。
    const averageTemperature = (typeof v0.averageTemperature === 'number')
        ? Number(v0.averageTemperature)
        : (Number(s.baseAverageTemperature) || 15);
    const T_sat = Number(constants.T_sat) || 40;
    const dT = Number(constants.dT) || 5;
    const H2O_max = Number(constants.H2O_max) || 2.9;
    let H2O_eff =
        H2O_max
        * (Math.exp((averageTemperature - 15) / 20) / (1 + Math.exp((averageTemperature - T_sat) / dT)))
        * (f_ocean + 0.1 * (1 - f_ocean));
    // conservative mode: avoid large H2O_eff runaway at init (use limited water vapor feedback)
    if (conservative) {
        H2O_eff = Math.min(H2O_eff, 1.0);
    }

    const a_H2 = 0.4 * f_N2 + 0.2 * f_H2 + 0.1 * f_CO2;

    let lnCO2 = Math.log(Math.max(f_CO2 / 0.00028, Math.exp(-1.5)));
    let lnCH4 = Math.log(Math.max(f_CH4 / 0.0000018, Math.exp(-1.5)));

    let Radiation_cooling =
        1 / (1 + Pressure * (0.25 * lnCO2 + 0.6 * lnCH4 + H2O_eff + f_H2 * a_H2));
    Radiation_cooling = Math.max(Radiation_cooling, 0.05);

    const milankovitch = 1 + 0.00005 * Math.sin(2 * Math.PI * Time_yr / 100000);
    const Sol = 950 * solarEvolution * milankovitch + sol_event;
    const sigma = 5.67e-8;
    const averageTemperature_calc = Math.pow((Sol * Meteo_eff * (1 - Math.max(0, Math.min(0.9, 0.3)))) / (4 * sigma * Radiation_cooling), 0.25);
    // Note: We used a placeholder albedo estimate here; in init we only need an approximate raw radiative temperature.
    return { averageTemperature_calc, Sol, f_cloud, Radiation_cooling, H2O_eff };
}


