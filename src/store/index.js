import { createStore } from 'vuex';

export default createStore({
    state: {
        // 平均気温 (°C)
        averageTemperature: 15,
        // 雲量（0..1）
        cloudAmount: 0.5,

        // 地表反射率（アルベド、0..1）
        albedo: 0.3,
        // 温室効果の強さ（倍率、1 = 現状維持）
        greenhouseEffect: 1.0,
        // 日射量（相対値、1 = 地球標準）
        insolation: 1.0,
        // 平均降水量 (相対降水量：地球１年あたりの降水量を1としたときの降水量)
        averagePrecipitation: 1,
        // 気圧 (hPa)
        airPressure: 1000,
        // 時代（例: 'ancient' | 'medieval' | 'modern' | 'future' など）
        era: '大森林時代'
    },
    getters: {
        averageTemperature: (state) => state.averageTemperature,
        era: (state) => state.era,
        terrainColors: (state) => state.terrainColors
    },
    mutations: {
        setAverageTemperature(state, value) {
            state.averageTemperature = value;
        },
        setEra(state, value) {
            state.era = value;
        }
    },
    actions: {
        updateAverageTemperature({ commit }, value) {
            commit('setAverageTemperature', value);
        },
        updateEra({ commit }, value) {
            commit('setEra', value);
        }
    }
});


