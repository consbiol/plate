import { PARAM_DEFAULTS } from '../../utils/paramsDefaults.js';

function buildDefaultGeneratorParams() {
    // f_cloud は描画設定なので generatorParams から除外（renderSettings に移管）
    const GEN_DEFAULTS = { ...PARAM_DEFAULTS };
    delete GEN_DEFAULTS.f_cloud;
    return {
        // 地形生成入力のデフォルト
        ...GEN_DEFAULTS,
        // propsではない UI 入力
        deterministicSeed: '',
        // props としても存在するが、互換のため generatorParams に含めておく
        minCenterDistance: PARAM_DEFAULTS.minCenterDistance
    };
}

export function createGeneratorSlice({ persisted = null } = {}) {
    const defaultParams = buildDefaultGeneratorParams();
    const initialParams = (persisted && persisted.generatorParams && typeof persisted.generatorParams === 'object')
        ? { ...defaultParams, ...persisted.generatorParams }
        : defaultParams;

    return {
        state: {
            generatorParams: initialParams
        },
        getters: {
            generatorParams: (state) => state.generatorParams,
            deterministicSeed: (state) => state.generatorParams?.deterministicSeed ?? ''
        },
        mutations: {
            setGeneratorParams(state, patch) {
                const base = state.generatorParams || buildDefaultGeneratorParams();
                const next = { ...base };
                const allowed = new Set([
                    // f_cloud は除外（renderSettings）
                    ...Object.keys(PARAM_DEFAULTS).filter((k) => k !== 'f_cloud'),
                    'deterministicSeed',
                    'minCenterDistance'
                ]);
                let changed = false;
                if (patch && typeof patch === 'object') {
                    for (const k of Object.keys(patch)) {
                        if (!allowed.has(k)) continue;
                        const v = patch[k];
                        if (next[k] !== v) {
                            next[k] = v;
                            changed = true;
                        }
                    }
                }
                // 値が変わらないなら state を更新しない（deep watch 連鎖・無限ループ防止）
                if (!state.generatorParams) {
                    state.generatorParams = next;
                } else if (changed) {
                    state.generatorParams = next;
                }
            },
            setDeterministicSeed(state, value) {
                if (!state.generatorParams) state.generatorParams = buildDefaultGeneratorParams();
                state.generatorParams.deterministicSeed = String(value ?? '');
            }
        },
        actions: {
            updateGeneratorParams({ commit }, patch) {
                commit('setGeneratorParams', patch);
            },
            updateDeterministicSeed({ commit }, value) {
                commit('setDeterministicSeed', value);
            }
        }
    };
}


