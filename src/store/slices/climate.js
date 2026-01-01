// 気候（大気-平均気温）モデルの state を Vuex に集約するスライス
// - Turn制御（進行/停止/速度）は UI 側（Parameters_Display.vue）のタイマーで回す
// - ここは「1ターン進める」「generateで初期化する」「地形面積率を受け取る」に責務を限定

import { ERAS } from '../../utils/paramsDefaults.js';
import { createDerivedRng } from '../../utils/rng.js';
import {
    buildEraInitialClimate,
    buildEraTurnYr
} from '../../utils/climate/eraPresets.js';
import { clamp } from '../../utils/climate/math.js';
import { computeNextClimateTurn, computeRadiativeEquilibriumTempK } from '../../utils/climate/model.js';
import { buildTerrainFractionsFromTypeCounts } from '../../utils/climate/terrainFractions.js';

function buildDefaultClimateState() {
    return {
        // UI側の時代と同期（Generate時に初期化される）
        era: '大森林時代',

        // ターン状態
        Time_turn: 0,
        Time_yr: 0,
        Turn_yr: 50000,
        // 1ターンあたりの待機秒
        Turn_speed: 1.0,
        isRunning: false,

        // 時代境界の「30ターンだけ Turn_yr=1000」用
        transitionTurnsRemaining: 0,
        transitionNextTurnYr: null,

        // generateSignal で固定される定数（seed固定）
        constants: {
            solarFlareUpRate: null,
            argonCapacity: null,
            initial_H2: null,
            f_N2_fixed: null,

            land_abs_eff_planet: null,
            initial_CH4: null,

            T_sat: null,
            dT: null,
            H2O_max: null
        },

        // 突発イベント（現状は未実装のため固定値）
        events: {
            Volcano_event: 1,
            Meteo_eff: 1,
            Fire_event_CO2: 0,
            CH4_event: 0,
            sol_event: 0,
            CosmicRay: 1
        },

        // 地形由来の面積率（Parameters_Display.vue から供給）
        terrain: {
            f_land_original: 0.3,
            f_ocean_original: 0.7,
            // typeCounts由来（氷河補正後）
            f_deepSea: 0,
            f_shallowSea: 0,
            f_glacier: 0,
            f_lowland: 0,
            f_desert: 0,
            f_highland: 0,
            f_alpine: 0,
            f_tundra: 0,
            f_lake: 0,
            f_bryophyte: 0,
            f_city: 0,
            f_cultivated: 0,
            f_polluted: 0,
            f_seaCity: 0,
            f_seaCultivated: 0,
            f_seaPolluted: 0,
            // 集計値
            f_land: 0.3,
            f_ocean: 0.7,
            f_green: 0.1
        },

        // 気候変数（ターン毎に更新）
        vars: {
            solarEvolution: null,
            greenIndex: 1,

            CO2_abs_rock: 0,
            CO2_abs_plant: 0,
            CO2_abs_total: 0,
            CO2_release_volcano: 0,
            CO2_release_total: 0,
            O2_abs_total: 0,
            O2_release_total: 0,

            Pressure: 1,
            f_N2: 0.78,
            f_O2: 0,
            f_CO2: 0.0004,
            f_CH4: 0.000001,
            f_Ar: 0.002,
            f_H2: 0.01,

            f_cloud: 0.67,
            albedo: 0.3,
            H2O_eff: 1,
            Sol: null,
            averageTemperature: 15
        },
        baseAverageTemperature: 15,

        // 10ターンごとの平均気温履歴（折れ線グラフ用）
        history: {
            averageTemperatureEvery10: [] // [{ turn, yr, value }]
        }
    };
}

function sampleUniform01(rng) {
    return (typeof rng === 'function') ? rng() : Math.random();
}

function sampleRange(rng, min, max) {
    const u = sampleUniform01(rng);
    return min + (max - min) * u;
}

function buildSeededConstants({ deterministicSeed }) {
    // 乱数は seed 未指定なら従来通り完全ランダム
    const rng = createDerivedRng(deterministicSeed, 'climate', 'constants');

    return {
        // Step1
        solarFlareUpRate: sampleRange(rng, 0.25, 0.35),
        argonCapacity: sampleRange(rng, 0.008, 0.012),
        initial_H2: sampleRange(rng, 0.001, 0.1),
        f_N2_fixed: sampleRange(rng, 0.7, 0.9),
        // Step4
        land_abs_eff_planet: sampleRange(rng, 0.8, 1.2),
        initial_CH4: sampleRange(rng, 0.003, 0.03),
        // Step6
        T_sat: sampleRange(rng, 38, 42),
        dT: sampleRange(rng, 4, 6),
        H2O_max: sampleRange(rng, 2.7, 3.1)
    };
}

export function createClimateSlice() {
    const defaults = buildDefaultClimateState();

    return {
        state: {
            climate: defaults
        },
        getters: {
            climate: (state) => state.climate,
            climateTurn: (state) => ({
                era: state.climate?.era,
                Time_turn: state.climate?.Time_turn,
                Time_yr: state.climate?.Time_yr,
                Turn_yr: state.climate?.Turn_yr,
                Turn_speed: state.climate?.Turn_speed,
                isRunning: state.climate?.isRunning
            }),
            climateVars: (state) => state.climate?.vars,
            climateHistory: (state) => state.climate?.history
        },
        mutations: {
            setClimate(state, next) {
                state.climate = next;
            },
            patchClimate(state, patch) {
                const cur = state.climate || buildDefaultClimateState();
                state.climate = { ...cur, ...(patch || {}) };
            },
            setTurnSpeed(state, value) {
                const cur = state.climate || buildDefaultClimateState();
                const v = Number(value);
                if (!isFinite(v)) return;
                const clamped = clamp(v, 0.1, 10);
                // 0.1刻み
                const snapped = Math.round(clamped * 10) / 10;
                state.climate = { ...cur, Turn_speed: snapped };
            },
            setClimateRunning(state, value) {
                const cur = state.climate || buildDefaultClimateState();
                state.climate = { ...cur, isRunning: !!value };
            }
        },
        actions: {
            // generateSignal 実行時にのみ初期化（revise/update/drift では初期化しない）
            initClimateFromGenerate({ commit, state }, { era, deterministicSeed, Turn_yrOverride, resetTurnYrToEraDefault } = {}) {
                const nextEra = (typeof era === 'string' && ERAS.includes(era)) ? era : defaults.era;
                const constants = buildSeededConstants({ deterministicSeed });

                const initial = buildEraInitialClimate(nextEra);
                const cur = (state && state.climate) ? state.climate : null;
                const prevTurnYr = cur ? Number(cur.Turn_yr) : NaN;
                const overrideCandidate = Number(Turn_yrOverride);
                const shouldReset = (typeof resetTurnYrToEraDefault === 'boolean') ? resetTurnYrToEraDefault : false;
                const Turn_yr = (typeof Turn_yrOverride !== 'undefined' && isFinite(overrideCandidate) && overrideCandidate > 0)
                    ? overrideCandidate
                    : (shouldReset
                        ? buildEraTurnYr(nextEra)
                        : (isFinite(prevTurnYr) && prevTurnYr > 0 ? prevTurnYr : buildEraTurnYr(nextEra)));

                const terrain = { ...defaults.terrain };
                const vars = {
                    ...defaults.vars,
                    ...initial,
                    // N2 は「常に一定（固定）」なので、seed固定値を優先
                    f_N2: constants.f_N2_fixed,
                    // 初期の Pressure は式に従い合計で初期化（下限も適用）
                    Pressure: Math.max(
                        constants.f_N2_fixed
                        + (initial.f_O2 || 0)
                        + (initial.f_CO2 || 0)
                        + (initial.f_CH4 || 0)
                        + (initial.f_Ar || 0)
                        + (initial.f_H2 || 0),
                        0.3
                    )
                };

                const next = {
                    ...buildDefaultClimateState(),
                    era: nextEra,
                    Time_turn: 0,
                    Time_yr: initial.Time_yr,
                    Turn_yr,
                    Turn_speed: defaults.Turn_speed,
                    isRunning: false,
                    transitionTurnsRemaining: 0,
                    transitionNextTurnYr: null,
                    constants,
                    terrain,
                    vars,
                    history: {
                        averageTemperatureEvery10: [{ turn: 0, yr: initial.Time_yr, value: vars.averageTemperature }]
                    }
                };
                next.baseAverageTemperature = initial.averageTemperature;
                // 放射平衡温度（初期化時点）は「時代デフォルトの平均気温」を優先して設定する。
                // これにより、generate直後の averageTemperature_calc が時代初期値（例: 大森林時代20℃）から始まる。
                try {
                    const out = computeRadiativeEquilibriumTempK(next, { conservative: true });
                    const initCalcK = (typeof initial.averageTemperature === 'number')
                        ? (initial.averageTemperature + 273.15)
                        : (out && typeof out.averageTemperature_calc === 'number' ? out.averageTemperature_calc : null);
                    next.vars = {
                        ...next.vars,
                        averageTemperature_calc: initCalcK,
                        Sol: out && typeof out.Sol === 'number' ? out.Sol : next.vars.Sol,
                        f_cloud: out && typeof out.f_cloud === 'number' ? out.f_cloud : next.vars.f_cloud,
                        H2O_eff: out && typeof out.H2O_eff === 'number' ? out.H2O_eff : next.vars.H2O_eff,
                        Radiation_cooling: out && typeof out.Radiation_cooling === 'number' ? out.Radiation_cooling : next.vars.Radiation_cooling
                    };
                } catch (e) { /* ignore */ }

                commit('setClimate', next);
            },

            // Parameters_Display 側から「地形面積率」を注入
            updateClimateTerrainFractions({ commit, state }, { gridTypeCounts, preGlacierStats, gridWidth, gridHeight, era } = {}) {
                const cur = state.climate || buildDefaultClimateState();
                const terrain = buildTerrainFractionsFromTypeCounts({
                    typeCounts: gridTypeCounts,
                    preGlacierStats,
                    gridWidth,
                    gridHeight,
                    era
                });
                commit('setClimate', { ...cur, terrain: { ...cur.terrain, ...terrain } });
            },

            // 1ターン進める（Step1〜9）
            advanceClimateOneTurn({ commit, state }) {
                const cur = state.climate || buildDefaultClimateState();
                const next = computeNextClimateTurn(cur);
                commit('setClimate', next);
            },

            // UI操作
            updateTurnSpeed({ commit }, value) {
                commit('setTurnSpeed', value);
            },
            setTurnRunning({ commit }, value) {
                commit('setClimateRunning', value);
            }
        }
    };
}


