import { createStore } from 'vuex';

export default createStore({
    state: {
        // 平均気温 (°C)
        averageTemperature: 15,
        // 雲量（0..1）
        cloudAmount: 0.5,
        // グリッド地形ごとのカラー定義（Hex）
        terrainColors: {
            deepSea: '#1e508c',     // rgb(30,80,140)
            shallowSea: '#3C78B4',  // rgb(60,120,180)
            lowland: '#228B22',     // rgb(34,139,34)
            desert: '#96826E',      // rgb(150,130,110)
            highland: '#91644B',    // rgb(145,100,75)
            alpine: '#5F5046',      // rgb(95,80,70)
            tundra: '#698736',      // 赤
            glacier: '#FFFFFF',     // rgb(255,255,255)
            border: '#000000'       // rgb(0,0,0)
        },
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
        era: (state) => state.era,
        terrainColors: (state) => state.terrainColors
    },
    mutations: {
        setAverageTemperature(state, value) {
            state.averageTemperature = value;
        },
        setCloudAmount(state, value) {
            state.cloudAmount = value;
        },
        setTerrainColors(state, payload) {
            // 部分更新にも対応（未指定キーは保持）
            state.terrainColors = { ...state.terrainColors, ...(payload || {}) };
        },
        setTerrainColor(state, { key, value }) {
            if (!key) return;
            state.terrainColors = { ...state.terrainColors, [key]: value };
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
        updateTerrainColors({ commit }, payload) {
            commit('setTerrainColors', payload);
        },
        updateTerrainColor({ commit }, payload) {
            commit('setTerrainColor', payload);
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


