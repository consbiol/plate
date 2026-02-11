// - state構造は store/slices/climate.js の `climate` を前提

import { buildEraTurnYr, buildTurnAlphaParams, getNextEraByTime, buildEraInitialClimate } from './eraPresets.js';
import { computeSolarAndGases, computeH2Oeff, computeLnGases, computeRadiationCooling, computeRadiativeEquilibriumCalc, computeClouds, computeAlbedo } from './radiative.js';
import { volcanoEventMagFromIndex } from './volcanoEventMagnification.js';


function sq(x) {
    const v = Number(x);
    return v * v;
}

// -----------------------------------------------------------------------------
// Era-dependent coefficients
// - Keep era strings centralized here for readability and easy auditing.
// - `?? 0` / `?? 1` defaults match the previous switch fallbacks.
// -----------------------------------------------------------------------------

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
    'シダ植物時代': 1.2,
    '大森林時代': 1.0,
    '文明時代': 1.0,
    '海棲文明時代': 1.0,
});

const ERA_FUNGAL_FACTOR = /** @type {Record<string, number>} */ ({
    '苔類進出時代': 2.0,
    'シダ植物時代': 1.8,
});


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

export function computeNextClimateTurn(cur) {
    const state = cur && typeof cur === 'object' ? cur : {};
    const era = state.era || '大森林時代';

    const Time_turn = Number(state.Time_turn) || 0;
    const Time_yr = Number(state.Time_yr) || 0;
    let baseAverageTemperature = (typeof state.baseAverageTemperature === 'number') ? state.baseAverageTemperature : 15;

    // Turn_yr（UIで指定された値を優先。未設定なら era 既定値）
    // ただし forcedTurnsRemaining が有効な間は、このターンの計算に限り Turn_yr=1000 を強制する。
    const baseTurnYr = Number(state.Turn_yr) || buildEraTurnYr(era);
    let Turn_yr = baseTurnYr;
    // --- 強制 Turn_yr オーバーライド（Step2 の永続的太陽イベント用） ---
    // - forcedTurnsRemaining: 残り強制ターン数（0: 無効）
    // - forcedOriginalTurnYr: 強制開始前に保持しておく Turn_yr（復帰時に使用）
    // 将来 Step2 に追加されるイベントでもこの機構を流用してください（下方に注釈あり）。
    let forcedTurnsRemaining = Number(state.forcedTurnsRemaining) || 0;
    let forcedOriginalTurnYr = (typeof state.forcedOriginalTurnYr === 'number') ? state.forcedOriginalTurnYr : null;

    // 強制中は「このターンの計算」に使う Turn_yr を 1000 にする（alpha や nextTimeYr も含む）
    // 強制中は「このターンの計算」に使う Turn_yr を 1000 にする（alpha や nextTimeYr も含む）
    // NOTE: 文明時代・海棲文明時代は 10 に固定する
    if (forcedTurnsRemaining > 0) {
        const isCivilEra = (era === '文明時代' || era === '海棲文明時代');
        if (isCivilEra) {
            Turn_yr = 10;
        } else {
            Turn_yr = 1000;
        }
    }

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
    const f_N2_fixed = Number(constants.f_N2_fixed);
    if (isFinite(f_N2_fixed)) f_N2 = f_N2_fixed * (1 - Math.exp(-(Time_yr * 1e-9) / 0.3));

    // Consolidated solar / gas computation
    const _gases = computeSolarAndGases(Time_yr, constants);
    const solarEvolution = _gases.solarEvolution;
    // override Ar/H2 based on computed values
    f_Ar = _gases.f_Ar;
    f_H2 = _gases.f_H2;
    if (f_H2 < 0.0001) f_H2 = 0;

    // Volcano_event は terrain.driftMetrics.superPloom / phase によって上書きされる場合がある。
    let Volcano_event = Number(events.Volcano_event) || 1;
    // Drift metrics 経由で superPloom を参照し、火山係数を段階的に増減する
    try {
        const driftMetrics = (terrain && terrain.driftMetrics) ? terrain.driftMetrics : null;
        const superPloom = driftMetrics && typeof driftMetrics.superPloom !== 'undefined' ? Number(driftMetrics.superPloom) : null;
        const phaseName = driftMetrics && typeof driftMetrics.phase === 'string' ? driftMetrics.phase : null;
        if (phaseName === 'Approach') {
            if (superPloom > 30) {
                Volcano_event = 4.0; // Lv3
            } else if (superPloom > 20 && superPloom < 30) {
                Volcano_event = 2.5; // Lv2
            }
        } else if (phaseName === 'Repel') {
            if (superPloom > 30) {
                Volcano_event = 5.0; // Lv4
            } else if (superPloom > 20 && superPloom < 30) {
                Volcano_event = 4.0; // Lv3
            } else if (superPloom > 10 && superPloom < 20) {
                Volcano_event = 2.5; // Lv2
            } else if (superPloom > 0 && superPloom < 10) {
                Volcano_event = 1.5; // Lv1
            } else if (superPloom === 0) {
                Volcano_event = 1.0; // Lv0
            }
        }
    } catch (e) {
        // ignore and keep Volcano_event as-is
    }

    // マントル活動（Volcano_event倍率）: 13段階の倍率を乗算
    // NOTE: 漂移由来の段階値(1.5, 2.5, 4.0...)を「ベース」とし、ここで倍率を掛ける
    const Volcano_event_mag_idx = events ? events.Volcano_event_mag_idx : null;
    const Volcano_event_mag = volcanoEventMagFromIndex(Volcano_event_mag_idx);
    Volcano_event = Volcano_event * Volcano_event_mag;

    // --- Step2: イベント ---
    const Meteo_eff = Number(events.Meteo_eff);
    const Fire_event_CO2 = Number(events.Fire_event_CO2);
    const Meteo_CO2_add = Number(events.Meteo_CO2_add) || 0;
    const CH4_event = Number(events.CH4_event);
    const sol_event = Number(events.sol_event);
    const CosmicRay = (typeof events.CosmicRay === 'number') ? events.CosmicRay : 1;
    const Volcano_event_manual = Number(events.Volcano_event_manual) || 0;
    // 次 state が時代遷移で開始されるかを事前判定（時代変化直後の「初回ターン」扱いを検出するため）
    const eraWillChange = getNextEraByTime(era, Time_yr + Turn_yr).didChange;
    // Temp_alpha の上書き制御用（隕石イベントなどで Meteo_eff != 1 の場合は即時 Temp_alpha=1）
    let temp_Alpha_event = Temp_alpha;
    if (Meteo_eff !== 1) {
        temp_Alpha_event = 1;
    }
    // NOTE:
    // 「永続」イベント（例: sol_event）が継続する間は値が非ゼロのままなので、
    // `sol_event !== 0` をトリガーにすると毎ターン延長されて永遠に戻らない。
    // 発火点（=ユーザー操作でイベント値が加算/減算された瞬間）で forcedTurnsRemaining をセットするのが正しい。
    // そのため、発火処理は store の mutation 側で行い、ここでは forcedTurnsRemaining のみを参照する。

    // --- Step3: 植生 ---
    const co2Factor = (1.5 * f_CO2) / (0.0002 + f_CO2);
    const co2FactorClamped = Math.max(0, Math.min(co2Factor, 1.5));
    const f_O2_norm = f_O2 / 0.21;
    const O2_suppression = 1 / (1 + Math.pow(f_O2_norm / 1.8, 4));
    const tempSigmaColdSide = 18;
    const tempSigmaHotSide = 12;
    const tempSigma =
        averageTemperature < 22.5
            ? tempSigmaColdSide
            : tempSigmaHotSide

    const greenIndex_calc = 1.81 * Math.exp(-(sq(averageTemperature - 22.5)) / (2 * sq(tempSigma))) * f_cloud * co2FactorClamped * O2_suppression;
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
    const f_land_original = Number(terrain.f_land_original) || 0.3;

    // CO2
    const CO2_carbonate_eq =
        0.00028 * Math.exp((averageTemperature - 15) / 60);
    const CO2_flux_ocean =
        -1 * Turn_yr ** 0.5
        * 0.0000012
        * f_ocean
        * f_CO2
        * Math.tanh((20 - averageTemperature) / 12)
        * Math.exp(-(averageTemperature - 15) / 80);

    const CO2_flux_carbonate =
        -1 * Turn_yr ** 0.5
        * 0.00000015
        * (f_CO2 - CO2_carbonate_eq)
        * Math.exp((averageTemperature - 15) / 20)
        * Math.exp(-sq((averageTemperature - 50) / 20));

    const Pland_t = computePland_t(era);

    const land_weathering_eff =
        1 + 0.3 * Math.tanh(3 * Pland_t);
    const CO2_abs_rock =
        Turn_yr ** 0.5
        * 0.00000008
        * (f_land / 0.3)
        * land_weathering_eff
        * Math.exp((averageTemperature - 15) / 18)
        * Math.pow((f_CO2 / 0.002), 0.8)
        * Math.exp(-sq((averageTemperature - 30) / 22));

    const CO2_abs_plant =
        Turn_yr ** 0.5
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
        Turn_yr ** 0.5
        * 0.00000025
        * (Volcano_event + Volcano_event_manual)
        * Math.pow(4.55e9 / (Time_yr + 0.1e9), 1.25)
        * (1 + 0.4 * Math.tanh((f_land_original - 0.3) / 0.2))
        * (0.5 + (Math.random() + Math.random()) / 2);

    const CO2_release_ocean = Math.max(CO2_flux_ocean, 0);
    const CO2_release_carbonate = Math.max(CO2_flux_carbonate, 0);

    const CO2_release_civil = 0; // 未実装

    const CO2_release_total = CO2_release_volcano + CO2_release_ocean + CO2_release_carbonate + CO2_release_civil + Fire_event_CO2;

    const f_CO2_calc = f_CO2 - CO2_abs_total + CO2_release_total;
    // 最初のターン（または時代変化による次state開始ターン）では平滑化を行わず、収支計算結果をそのまま採用する
    if (Time_turn === 0 || eraWillChange) {
        f_CO2 = f_CO2_calc;
    } else {
        f_CO2 = CO2_alpha * f_CO2_calc + (1 - CO2_alpha) * f_CO2 + Meteo_CO2_add;
    }
    f_CO2 = Math.max(f_CO2, 0.000006);

    // O2
    const f_O2_forAbs = Math.max(f_O2 - 0.0001, 0);

    const land_abs_eff_planet = Number(constants.land_abs_eff_planet) || 1.0;

    const ReducingFactor = 1 / (1 + Math.pow((f_O2_forAbs / 0.05), 2));
    const land_abs_eff = (20 * ReducingFactor) + 0.6 * land_abs_eff_planet;
    const volcGate = f_O2_forAbs / (f_O2_forAbs + 0.1); // 火山項のゲート
    const O2_abs =
        Turn_yr ** 0.5
        * 0.00008
        * land_abs_eff
        * (f_land / 0.3)
        * (Math.pow((f_O2_forAbs / 0.21), 0.6) + 0.1)
        * Math.min(Math.exp(-sq((averageTemperature - 25) / 25)), 3)
        * f_O2_forAbs
        + Turn_yr ** 0.5
        * 0.0003
        * (Volcano_event + Volcano_event_manual / 20)
        * volcGate;

    const ocean_plantO2_base = computeOceanPlantO2Base(era);
    const land_plantO2 = computeLandPlantO2(era);
    const fungal_factor = computeFungalFactor(era);
    const O2_prod =
        Turn_yr ** 0.5
        * 0.0007
        * (
            0.6
            * f_ocean
            * Math.exp(-sq((averageTemperature - 20) / 18))
            * ocean_plantO2_base
            * (1 + 0.25 * f_green * land_plantO2)
            * ((f_CO2 / (f_CO2 + 0.0004)) + 0.5)
            + 0.4
            * f_green
            * Math.exp(-sq((averageTemperature - 22.5) / 15))
            * land_plantO2
            * fungal_factor
            * ((3 * f_CO2) / (f_CO2 + 0.0008))
        )
        * Math.pow((1 + f_O2 / 0.21), -0.25);


    // NOTE: Step6 でも使用するため、ここで一度だけ計算して使い回す
    // （高温O2放出式が H2O_eff を参照するため、先に定義して TDZ を避ける）
    const H2O_eff = computeH2Oeff(averageTemperature, f_ocean, constants, { conservative: false });

    // --- 高温時O2放出（簡易） ---
    // NOTE:
    // - 暴走温暖化（高温・高水蒸気）での「水の光解離→H逸散→O2残留」などを粗く表現する用途
    // - 値が小さすぎ/大きすぎになりやすいので、係数・温度閾値・上限は constants で調整可能にする
    const o2HighTempCoef = Number(constants.o2_high_temp_coef) || 0.00002;
    const o2HighTempAgeTau = Number(constants.o2_high_temp_age_tau) || 1e7; // yr (default reduced so effect can appear on simulation timescales)
    const o2HighTempTth = Number(constants.o2_high_temp_Tth) || 40; // ℃
    const o2HighTempTscale = Number(constants.o2_high_temp_Tscale) || 15;
    const o2HighTempProdThresh = Number(constants.o2_high_temp_prod_thresh) || 1e-6;
    const o2HighTempMax = Number(constants.o2_high_temp_max) || 1e-4; // 上限値

    const ageFactor = 1 - Math.exp(-Time_yr / o2HighTempAgeTau);
    const tempSigmoid = 1 / (1 + Math.exp(-(averageTemperature - o2HighTempTth) / o2HighTempTscale));

    let O2_release_hightemp = Turn_yr ** 0.5 * o2HighTempCoef * f_ocean * H2O_eff * tempSigmoid * ageFactor;
    O2_release_hightemp = Math.max(0, Math.min(O2_release_hightemp, o2HighTempMax));

    // 早期の時代（爆撃時代・生命発生前時代・嫌気性細菌誕生時代）では高温放出は無効化する
    const _noHighTempEras = ['爆撃時代', '生命発生前時代', '嫌気性細菌誕生時代'];
    if (_noHighTempEras.includes(era)) {
        O2_release_hightemp = 0;
    }

    // トリガー：生産が閾値以下なら有効、そうでなければ無効化（設計次第で常時有効も可）
    if (O2_prod > o2HighTempProdThresh) {
        O2_release_hightemp = 0;
    }

    const f_O2_calc = f_O2 - O2_abs + O2_prod + O2_release_hightemp;
    f_O2 = O2_alpha * f_O2_calc + (1 - O2_alpha) * f_O2;

    // CH4
    const initial_CH4 = Number(constants.initial_CH4) || 0.01;
    f_CH4 = initial_CH4 / (1 + sq(f_O2 / 0.003)) * 1 / (1 + Math.pow((f_O2 / 0.05), 4)) + CH4_event;
    f_CH4 = Math.max(f_CH4, 0.0000001);

    // H2O
    const f_H2O = H2O_eff * 0.01;

    f_O2 = Math.max(f_O2, 0);
    f_CO2 = Math.max(f_CO2, 0.000006);
    Pressure = f_Ar + f_H2 + f_N2 + f_O2 + f_CO2 + f_CH4 + f_H2O;
    Pressure = Math.max(Pressure, 0.001);

    // --- Step5: 雲量・アルベド ---
    const cloudRes = computeClouds({ Pressure, f_ocean, averageTemperature, CosmicRay, f_CH4, f_CO2 });
    const hazeFrac = cloudRes.hazeFrac;
    f_cloud = cloudRes.f_cloud;
    // compute albedo from shared helper
    const albedo = computeAlbedo({ f_cloud, hazeFrac, terrain, Time_yr });

    // --- Step6: 有効放射率 ---

    // H2O_eff は Step4(O2) で計算済み（高温O2放出式で参照するため）

    const { lnCO2, lnCH4 } = computeLnGases(f_CO2, f_CH4);
    let Radiation_cooling = computeRadiationCooling(Pressure, lnCO2, lnCH4, H2O_eff, f_H2, f_N2, f_CO2, averageTemperature, solarEvolution, Time_yr);

    // --- Step7: 平均気温 ---
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
        averageTemperature = temp_Alpha_event * (averageTemperature_calc - 273.15) + (1 - temp_Alpha_event) * averageTemperature;
    }

    // --- Step8: ターン終了処理 ---
    const nextTimeYr = Time_yr + Turn_yr;
    let nextTimeTurn = Time_turn + 1;

    // --- Step9: 時代変更トリガー（時間経過） ---
    let nextEra = era;
    const { nextEra: eraByTime, didChange } = getNextEraByTime(era, nextTimeYr);
    if (didChange) {
        nextEra = eraByTime;
        baseAverageTemperature = buildEraInitialClimate(nextEra).averageTemperature;
        // 時代が変わったらターンカウントをリセットする
        // （次 state は次時代開始時点の状態なので Time_turn を 0 にする）
        nextTimeTurn = 0;
    }

    // --- 強制 Turn_yr の継続/終了処理 ---
    let nextForcedTurnsRemaining = Math.max(0, Number(forcedTurnsRemaining) - 1);
    let nextTurnYrForState = Turn_yr;
    if (forcedTurnsRemaining > 0) {
        // 終了する次 state では元の Turn_yr に戻す（保存済み original がある場合）
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
        // 強制なし：ユーザー指定（baseTurnYr）を維持
        nextTurnYrForState = baseTurnYr;
    }



    // --- Meteo (隕石落下) と Fire (森林火災) のワンショット残ターン処理 ---
    const nextEvents = { ...events };

    // Meteo
    const meteoRemaining = Number(events.Meteo_one_shot_remaining || 0);
    const nextMeteoRemaining = Math.max(0, meteoRemaining - 1);
    if (meteoRemaining > 0) {
        nextEvents.Meteo_one_shot_remaining = nextMeteoRemaining;
        if (nextMeteoRemaining === 0) {
            // ワンショットが終了したら Meteo_eff を Lv0 (=1) に戻し、CO2加算もリセット
            nextEvents.Meteo_eff = 1;
            nextEvents.Meteo_CO2_add = 0;
        }
    }

    // Fire
    const fireRemaining = Number(events.Fire_one_shot_remaining || 0);
    const nextFireRemaining = Math.max(0, fireRemaining - 1);
    if (fireRemaining > 0) {
        nextEvents.Fire_one_shot_remaining = nextFireRemaining;
        if (nextFireRemaining === 0) {
            // ワンショットが終了したら Fire_event_CO2 を Lv0 (=0) に戻す
            nextEvents.Fire_event_CO2 = 0;
        }
    }

    // Volcano manual (ワンショット: Volcano_event_manual)
    const volcanoRemaining = Number(events.Volcano_manual_remaining || 0);
    const nextVolcanoRemaining = Math.max(0, volcanoRemaining - 1);
    if (volcanoRemaining > 0) {
        nextEvents.Volcano_manual_remaining = nextVolcanoRemaining;
        if (nextVolcanoRemaining === 0) {
            // ワンショットが終了したら Volcano_event_manual を Lv0 (=0) に戻す
            nextEvents.Volcano_event_manual = 0;
        }
    }

    // Cosmic (超新星 / ガンマ線バースト: CosmicRay ワンショット)
    const cosmicRemaining = Number(events.Cosmic_one_shot_remaining || 0);
    const nextCosmicRemaining = Math.max(0, cosmicRemaining - 1);
    if (cosmicRemaining > 0) {
        nextEvents.Cosmic_one_shot_remaining = nextCosmicRemaining;
        if (nextCosmicRemaining === 0) {
            // ワンショットが終了したら CosmicRay を 1 (デフォルト) に戻す
            nextEvents.CosmicRay = 1;
        }
    }

    return {
        ...state,
        events: nextEvents,
        era: nextEra,
        Time_turn: nextTimeTurn,
        Time_yr: nextTimeYr,
        Turn_yr: nextTurnYrForState,
        // 保存して次ターンに受け渡す（強制が継続している/終了したことを store 側で把握できる）
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

            // expose explicit naming for UI/debug
            O2_abs: O2_abs,
            O2_abs_total: O2_abs,
            O2_prod,
            O2_release_hightemp,
            Pressure,
            f_N2,
            f_O2,
            f_CO2,
            f_CH4,
            f_Ar,
            f_H2,
            f_H2O,
            f_cloud,
            albedo,
            H2O_eff,
            // expose raw radiative equilibrium calc (K) so callers can use non-smoothed temperature
            averageTemperature_calc,
            Radiation_cooling,
            Sol,
            averageTemperature
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




