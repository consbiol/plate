export function createUiSlice({ persisted = null } = {}) {
    return {
        state: {
            // 平均気温 (°C)
            averageTemperature: (persisted && typeof persisted.averageTemperature === 'number') ? persisted.averageTemperature : 15,
            // 平面地図の1グリッドのピクセル数（1..10）
            planeGridCellPx: (persisted && typeof persisted.planeGridCellPx === 'number') ? persisted.planeGridCellPx : 3,
            // 時代（色プリセット等）
            era: (persisted && typeof persisted.era === 'string') ? persisted.era : '大森林時代'
        },
        getters: {
            averageTemperature: (state) => state.averageTemperature,
            era: (state) => state.era,
            planeGridCellPx: (state) => state.planeGridCellPx
        },
        mutations: {
            setAverageTemperature(state, value) {
                state.averageTemperature = value;
            },
            setEra(state, value) {
                state.era = value;
            },
            setPlaneGridCellPx(state, value) {
                state.planeGridCellPx = value;
            }
        },
        actions: {
            updateAverageTemperature({ commit }, value) {
                commit('setAverageTemperature', value);
            },
            updateEra({ commit }, value) {
                commit('setEra', value);
            },
            updatePlaneGridCellPx({ commit }, value) {
                // 安全側に丸め＋クランプ
                let v = Math.round(Number(value));
                if (!isFinite(v)) v = 3;
                if (v < 1) v = 1;
                if (v > 10) v = 10;
                commit('setPlaneGridCellPx', v);
            }
        }
    };
}


