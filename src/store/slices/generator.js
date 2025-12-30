import { PARAM_DEFAULTS } from '../../utils/paramsDefaults.js';
import { getGeneratorAllowedKeys } from '../../utils/paramKeys.js';

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
    // 互換/安全:
    // 旧バージョンで generatorParams に混入していた f_cloud は描画設定なので無視する。
    // （これが残っていると、generatorParams更新のたびにUI側のlocal.f_cloudが上書きされ、0.67へ戻る原因になる）
    const persistedGen = (persisted && persisted.generatorParams && typeof persisted.generatorParams === 'object')
        ? { ...persisted.generatorParams }
        : null;
    if (persistedGen && Object.prototype.hasOwnProperty.call(persistedGen, 'f_cloud')) {
        delete persistedGen.f_cloud;
    }
    const initialParams = persistedGen
        ? { ...defaultParams, ...persistedGen }
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
                const allowed = new Set(getGeneratorAllowedKeys(PARAM_DEFAULTS));
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
                // 互換: 旧保存値等で混入した f_cloud を確実に排除する
                if (Object.prototype.hasOwnProperty.call(next, 'f_cloud')) {
                    delete next.f_cloud;
                    changed = true;
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


