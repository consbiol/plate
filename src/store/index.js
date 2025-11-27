import { createStore } from 'vuex';

export default createStore({
    state: {
        // 平均気温 (°C)
        averageTemperature: 15,
        // 雲量（0..1）: 被覆に強く、濃さに弱く効く
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
        era: 'modern'
    },
    getters: {
        averageTemperature: (state) => state.averageTemperature,
        cloudAmount: (state) => state.cloudAmount,
        albedo: (state) => state.albedo,
        greenhouseEffect: (state) => state.greenhouseEffect,
        insolation: (state) => state.insolation,
        averagePrecipitation: (state) => state.averagePrecipitation,
        airPressure: (state) => state.airPressure,
        era: (state) => state.era
    },
    mutations: {
        setAverageTemperature(state, value) {
            state.averageTemperature = value;
        },
        setCloudAmount(state, value) {
            state.cloudAmount = value;
        },
        setAlbedo(state, value) {
            state.albedo = value;
        },
        setGreenhouseEffect(state, value) {
            state.greenhouseEffect = value;
        },
        setInsolation(state, value) {
            state.insolation = value;
        },
        setAveragePrecipitation(state, value) {
            state.averagePrecipitation = value;
        },
        setAirPressure(state, value) {
            state.airPressure = value;
        },
        setEra(state, value) {
            state.era = value;
        }
    },
    actions: {
        updateAverageTemperature({ commit }, value) {
            commit('setAverageTemperature', value);
        },
        updateCloudAmount({ commit }, value) {
            commit('setCloudAmount', value);
        },
        updateAlbedo({ commit }, value) {
            commit('setAlbedo', value);
        },
        updateGreenhouseEffect({ commit }, value) {
            commit('setGreenhouseEffect', value);
        },
        updateInsolation({ commit }, value) {
            commit('setInsolation', value);
        },
        updateAveragePrecipitation({ commit }, value) {
            commit('setAveragePrecipitation', value);
        },
        updateAirPressure({ commit }, value) {
            commit('setAirPressure', value);
        },
        updateEra({ commit }, value) {
            commit('setEra', value);
        }
    }
});


