import { createStore } from 'vuex';

export default createStore({
    state: {
        // 平均気温 (°C)
        averageTemperature: 15,
        // 平均降水量 (相対降水量：地球１年あたりの降水量を1としたときの降水量)
        averagePrecipitation: 1,
        // 気圧 (hPa)
        airPressure: 1000,
        // 時代（例: 'ancient' | 'medieval' | 'modern' | 'future' など）
        era: 'modern'
    },
    getters: {
        averageTemperature: (state) => state.averageTemperature,
        averagePrecipitation: (state) => state.averagePrecipitation,
        airPressure: (state) => state.airPressure,
        era: (state) => state.era
    },
    mutations: {
        setAverageTemperature(state, value) {
            state.averageTemperature = value;
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


