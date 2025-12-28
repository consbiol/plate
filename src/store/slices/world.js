import { GRID_DEFAULTS } from '../../utils/paramsDefaults.js';

export function createWorldSlice({ persisted = null } = {}) {
    return {
        state: {
            // グリッドサイズ
            gridWidth: (persisted && typeof persisted.gridWidth === 'number') ? persisted.gridWidth : GRID_DEFAULTS.gridWidth,
            gridHeight: (persisted && typeof persisted.gridHeight === 'number') ? persisted.gridHeight : GRID_DEFAULTS.gridHeight,
            // NOTE: gridData は巨大になりうるため永続化しない。起動時は空。
            gridData: []
        },
        getters: {
            gridWidth: (state) => state.gridWidth,
            gridHeight: (state) => state.gridHeight,
            gridData: (state) => state.gridData
        },
        mutations: {
            setGridWidth(state, value) {
                const v = Math.round(Number(value)) || GRID_DEFAULTS.gridWidth;
                state.gridWidth = v;
            },
            setGridHeight(state, value) {
                const v = Math.round(Number(value)) || GRID_DEFAULTS.gridHeight;
                state.gridHeight = v;
            },
            setGridData(state, data) {
                state.gridData = Array.isArray(data) ? data : [];
            }
        },
        actions: {
            updateGridWidth({ commit }, value) {
                commit('setGridWidth', value);
            },
            updateGridHeight({ commit }, value) {
                commit('setGridHeight', value);
            },
            updateGridData({ commit }, data) {
                commit('setGridData', data);
            }
        }
    };
}


