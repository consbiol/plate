// 気候（大気-平均気温）モデルの state を Vuex に集約するスライス
// - Turn制御（進行/停止/速度）は UI 側（Parameters_Display.vue）のタイマーで回す
// - ここは「1ターン進める」「generateで初期化する」「地形面積率を受け取る」に責務を限定

import { ERAS } from '../../utils/paramsDefaults.js';
import { createDerivedRng } from '../../utils/rng.js';
import { bestEffort } from '../../utils/bestEffort.js';
import {
    buildEraInitialClimate,
    buildEraTurnYr
} from '../../utils/climate/eraPresets.js';
import { clamp } from '../../utils/climate/math.js';
import { computeNextClimateTurn, computeRadiativeEquilibriumTempK } from '../../utils/climate/model.js';
import { buildTerrainFractionsFromTypeCounts } from '../../utils/climate/terrainFractions.js';
import {
    VOLCANO_EVENT_MAG_DEFAULT_INDEX,
    clampVolcanoEventMagIndex
} from '../../utils/climate/volcanoEventMagnification.js';

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

        // 永続的なイベントによる Turn_yr 強制用（例：Step2 の太陽活動イベントで使用）
        // - forcedTurnsRemaining: 残り強制ターン数（0なら無効）
        // - forcedOriginalTurnYr: 強制開始前の Turn_yr を保持（復帰時に使用）
        forcedTurnsRemaining: 0,
        forcedOriginalTurnYr: null,

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
            // Volcano_event の倍率（13段階、UIはボタン操作のみ）
            // index は 0..12 を想定し、倍率は utils/climate/volcanoEventMagnification.js で解決する
            Volcano_event_mag_idx: VOLCANO_EVENT_MAG_DEFAULT_INDEX,
            // マニュアルで設定する火山係数（Step2 UI から一時的にセットされる、3ターン限定）
            Volcano_event_manual: 0,
            // Volcano_event_manual のワンショット残ターン数（mutation が 3 に設定し、model 側でデクリメントして 0 で 0 に戻す）
            Volcano_manual_remaining: 0,
            Meteo_eff: 1,
            // Meteo のワンショット残ターン（mutation で 1 に設定し、model 側でデクリメントして 0 で Meteo_eff を 1 に戻す）
            Meteo_one_shot_remaining: 0,
            // Fire のワンショット残ターン（mutation で 1 に設定し、model 側でデクリメントして 0 で Fire_event_CO2 を 0 に戻す）
            Fire_one_shot_remaining: 0,
            // Cosmic (超新星) のワンショット残ターン（mutation で 3 に設定し、model 側でデクリメントして 0 で CosmicRay を 1 に戻す）
            Cosmic_one_shot_remaining: 0,
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
            O2_abs: 0,
            O2_abs_total: 0,
            O2_prod: 0,
            O2_release_hightemp: 0,

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
        T_sat: sampleRange(rng, 24, 32),
        dT: sampleRange(rng, 12, 18),
        H2O_max: sampleRange(rng, 1.5, 1.8)
    };
}

export function createClimateSlice() {
    const defaults = buildDefaultClimateState();
    const FORCED_TURN_WINDOW_DEFAULT = { turns: 20, forcedTurnYr: 1000 };

    // Step2 のイベント発火時に「20ターンだけ Turn_yr=1000 を強制」するための共通処理。
    // 注意: 「永続」イベントは値（例: sol_event）が継続するため、判定を computeNextClimateTurn 側で
    // `sol_event !== 0` のように書くと毎ターン延長されて永遠に戻らない。必ず「発火した瞬間」にここを呼ぶこと。
    function startForcedTurnYrWindow(curClimate, { turns = 20, forcedTurnYr = 1000 } = {}) {
        const cur = curClimate || buildDefaultClimateState();
        const era = cur.era;
        const isCivilEra = (era === '文明時代' || era === '海棲文明時代');
        if (isCivilEra) return cur;

        const nTurns = Math.max(0, Math.floor(Number(turns) || 0));
        if (nTurns <= 0) return cur;

        const original = (typeof cur.forcedOriginalTurnYr === 'number' && cur.forcedOriginalTurnYr > 0)
            ? cur.forcedOriginalTurnYr
            : (typeof cur.Turn_yr === 'number' && cur.Turn_yr > 0 ? cur.Turn_yr : null);

        return {
            ...cur,
            // 強制開始前の Turn_yr を保持（UI変更値を含む）
            forcedOriginalTurnYr: original,
            // この瞬間から nTurns ターン強制（重複発火時はここで再スタートする）
            forcedTurnsRemaining: nTurns,
            // 即時反映（次ターン計算から強制されるが、UI表示を直ちに揃えたい場合に備えてここでも反映）
            Turn_yr: Number(forcedTurnYr) || 1000
        };
    }

    function patchClimateEvents(state, updater, { forceTurnWindow = false, forceTurnWindowParams } = {}) {
        const cur = state.climate || buildDefaultClimateState();
        const ev = { ...(cur.events || {}) };
        const ok = updater ? updater(ev, cur) : true;
        if (ok === false) return;

        const withEvent = { ...cur, events: ev };
        state.climate = forceTurnWindow
            ? startForcedTurnYrWindow(withEvent, forceTurnWindowParams || FORCED_TURN_WINDOW_DEFAULT)
            : withEvent;
    }

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
            ,
            // sol_event を UI から直接セットする（slider 用）
            // NOTE: Turn_yr 強制は「+/- ボタンで発火した瞬間」のみ行う（slider 変更では行わない）
            setSolEvent(state, value) {
                patchClimateEvents(state, (ev) => {
                    const v = Number(value);
                    if (!isFinite(v)) return false;
                    // UI仕様: -500..+500
                    ev.sol_event = clamp(Math.round(v), -500, 500);
                });
            }
            ,
            // sol_event を永続的に加算/減算する（+/- ボタン用）。この「発火点」でのみ Turn_yr=1000 を20ターン強制する。
            bumpSolEvent(state, delta) {
                patchClimateEvents(state, (ev) => {
                    const prev = Number(ev.sol_event || 0);
                    const d = Number(delta || 0);
                    if (!isFinite(d)) return false;
                    ev.sol_event = clamp(prev + d, -500, 500);
                }, { forceTurnWindow: true });
            }
            ,
            // 隕石落下イベント（ワンショット）
            // payload: { level: 1..5 } - Lv1..Lv5 の強度を指定。Lv0(リセット)の場合は level=0。
            triggerMeteoLevel(state, payload) {
                const lvl = (payload && typeof payload.level === 'number') ? Math.floor(payload.level) : 0;
                patchClimateEvents(state, (ev) => {
                    // レベル -> Meteo_eff のマッピング
                    const mapping = {
                        0: 1.00,
                        1: 0.97,
                        2: 0.93,
                        3: 0.88,
                        4: 0.80,
                        5: 0.70
                    };
                    const val = Object.prototype.hasOwnProperty.call(mapping, lvl) ? mapping[lvl] : 1.00;
                    ev.Meteo_eff = Number(val);
                    // 1ターンだけ有効にするフラグ（model側でデクリメントして次ターンにリセットする）
                    ev.Meteo_one_shot_remaining = (lvl === 0) ? 0 : 1;
                }, { forceTurnWindow: true });
            }
            ,
            // 森林火災イベント（ワンショット）
            // payload: { level: 1..5 } - Lv1..Lv5 の強度を指定。Lv0(リセット)の場合は level=0。
            triggerFireLevel(state, payload) {
                const lvl = (payload && typeof payload.level === 'number') ? Math.floor(payload.level) : 0;
                patchClimateEvents(state, (ev) => {
                    // レベル -> Fire_event_CO2 のマッピング (分圧 / bar)
                    const mapping = {
                        0: 0,
                        1: 0.000005,
                        2: 0.00005,
                        3: 0.00025,
                        4: 0.0010,
                        5: 0.0025
                    };
                    const val = Object.prototype.hasOwnProperty.call(mapping, lvl) ? mapping[lvl] : 0;
                    ev.Fire_event_CO2 = Number(val);
                    // 1ターンだけ有効にするフラグ（model側でデクリメントして次ターンにリセットする）
                    ev.Fire_one_shot_remaining = (lvl === 0) ? 0 : 1;
                }, { forceTurnWindow: true });
            }
            ,
            // 火山イベント（マニュアル：Step2 UI からトリガー。Lv1..Lv5 を 3 ターンセット）
            // payload: { level: 0..5 } - Lv0 はリセット
            triggerVolcanoManualLevel(state, payload) {
                const lvl = (payload && typeof payload.level === 'number') ? Math.floor(payload.level) : 0;
                patchClimateEvents(state, (ev) => {
                    const mapping = {
                        0: 0,
                        1: 0.5,
                        2: 1.5,
                        3: 3.0,
                        4: 4.0,
                        5: 6.0
                    };
                    const val = Object.prototype.hasOwnProperty.call(mapping, lvl) ? mapping[lvl] : 0;
                    ev.Volcano_event_manual = Number(val);
                    // 3ターンだけ有効（model 側でデクリメントして 0 に戻す）
                    ev.Volcano_manual_remaining = (lvl === 0) ? 0 : 3;
                }, { forceTurnWindow: true });
            }
            ,
            // マントル活動（Volcano_event倍率）: 13段階を +/- ボタンで上下させる
            // payload: { delta: -1 | +1 }
            bumpVolcanoEventMagIndex(state, payload) {
                patchClimateEvents(state, (ev) => {
                    const prevIdx = clampVolcanoEventMagIndex(ev.Volcano_event_mag_idx);
                    const d = payload ? Number(payload.delta) : 0;
                    if (!isFinite(d)) return false;
                    const nextIdx = clampVolcanoEventMagIndex(prevIdx + Math.sign(d));
                    if (nextIdx === prevIdx) return false;
                    ev.Volcano_event_mag_idx = nextIdx;
                }, { forceTurnWindow: true });
            }
            ,
            // 超新星イベント（ワンショット：CosmicRay を一時的に上げる）
            // payload: { level: optional } - 現状 level は使わず固定値 1.3 を 3ターンセットする
            triggerCosmicEvent(state) {
                patchClimateEvents(state, (ev) => {
                    // 発火：CosmicRay を 1.3 に、残ターンを 3 にセット
                    ev.CosmicRay = 1.3;
                    ev.Cosmic_one_shot_remaining = 3;
                }, { forceTurnWindow: true });
            }
            ,
            // ガンマ線バースト（ワンショット：CosmicRay を一時的に上げる）
            // payload: none - 1ターンだけ CosmicRay = 1.5 にする
            triggerGammaEvent(state) {
                patchClimateEvents(state, (ev) => {
                    // 発火：CosmicRay を 1.5 に、残ターンを 1 にセット
                    ev.CosmicRay = 1.5;
                    ev.Cosmic_one_shot_remaining = 1;
                }, { forceTurnWindow: true });
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
                    // 初期化時は強制補正は無効
                    forcedTurnsRemaining: 0,
                    forcedOriginalTurnYr: null,
                    constants,
                    terrain,
                    vars,
                    
                };
                next.baseAverageTemperature = initial.averageTemperature;
                // 放射平衡温度（初期化時点）は「時代デフォルトの平均気温」を優先して設定する。
                // これにより、generate直後の averageTemperature_calc が時代初期値（例: 大森林時代20℃）から始まる。
                bestEffort(() => {
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
                        f_H2O: out && typeof out.f_H2O === 'number' ? out.f_H2O : next.vars.f_H2O,
                        Radiation_cooling: out && typeof out.Radiation_cooling === 'number' ? out.Radiation_cooling : next.vars.Radiation_cooling
                    };
                });

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


