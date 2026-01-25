import { PARAM_DEFAULTS } from '../../utils/paramsDefaults.js';

function buildDefaultRenderSettings() {
    return {
        // 雲量（0..1）
        f_cloud: PARAM_DEFAULTS.f_cloud,
        // Sphere の雲ノイズ周期（uv空間上の反復数）
        cloudPeriod: 16,
        // 極周辺での雲生成ブースト強度（0..1）
        polarCloudBoost: 1.0,

        // Sphere 描画の極処理（旧propsの既定値に合わせる）
        polarBufferRows: 150,
        polarAvgRows: 3,
        polarBlendRows: 12,
        polarNoiseStrength: 0.3,
        polarNoiseScale: 0.01,

        // 陸（氷河除く）に事後的に適用する色変更トーン
        landTintColor: null,
        landTintStrength: 0.35
    };
}

export function createRenderSlice({ persisted = null } = {}) {
    const defaults = buildDefaultRenderSettings();
    const initial = (persisted && persisted.renderSettings && typeof persisted.renderSettings === 'object')
        ? { ...defaults, ...persisted.renderSettings }
        : defaults;

    return {
        state: {
            renderSettings: initial
        },
        getters: {
            renderSettings: (state) => state.renderSettings,
            f_cloud: (state) => state.renderSettings?.f_cloud ?? defaults.f_cloud
        },
        mutations: {
            setRenderSettings(state, patch) {
                const base = state.renderSettings || buildDefaultRenderSettings();
                const next = { ...base };
                const allowed = new Set(Object.keys(defaults));
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
                if (!state.renderSettings) {
                    state.renderSettings = next;
                } else if (changed) {
                    state.renderSettings = next;
                }
            },
            setCloudAmount(state, value) {
                if (!state.renderSettings) state.renderSettings = buildDefaultRenderSettings();
                const v = Number(value);
                if (!isFinite(v)) return;
                state.renderSettings.f_cloud = Math.max(0, Math.min(1, v));
            }
        },
        actions: {
            updateRenderSettings({ commit }, patch) {
                commit('setRenderSettings', patch);
            },
            // 互換API（旧 generator 側の雲量更新）
            updateCloudAmount({ commit }, value) {
                commit('setCloudAmount', value);
            }
        }
    };
}


