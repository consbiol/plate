import { PARAM_DEFAULTS } from '../../utils/paramsDefaults.js';

function buildDefaultGeneratorParams() {
    return {
        // 地形生成入力のデフォルト
        ...PARAM_DEFAULTS,
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
            deterministicSeed: (state) => state.generatorParams?.deterministicSeed ?? '',
            f_cloud: (state) => state.generatorParams?.f_cloud ?? PARAM_DEFAULTS.f_cloud
        },
        mutations: {
            setGeneratorParams(state, patch) {
                const base = state.generatorParams || buildDefaultGeneratorParams();
                const next = { ...base };
                const allowed = new Set([
                    ...Object.keys(PARAM_DEFAULTS),
                    'deterministicSeed',
                    'minCenterDistance'
                ]);
                if (patch && typeof patch === 'object') {
                    for (const k of Object.keys(patch)) {
                        if (!allowed.has(k)) continue;
                        next[k] = patch[k];
                    }
                }
                state.generatorParams = next;
            },
            setDeterministicSeed(state, value) {
                if (!state.generatorParams) state.generatorParams = buildDefaultGeneratorParams();
                state.generatorParams.deterministicSeed = String(value ?? '');
            },
            setCloudAmount(state, value) {
                if (!state.generatorParams) state.generatorParams = buildDefaultGeneratorParams();
                const v = Number(value);
                if (!isFinite(v)) return;
                state.generatorParams.f_cloud = Math.max(0, Math.min(1, v));
            }
        },
        actions: {
            updateGeneratorParams({ commit }, patch) {
                commit('setGeneratorParams', patch);
            },
            updateDeterministicSeed({ commit }, value) {
                commit('setDeterministicSeed', value);
            },
            updateCloudAmount({ commit }, value) {
                commit('setCloudAmount', value);
            }
        }
    };
}


