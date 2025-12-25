import { createStore } from 'vuex';

export default createStore({
    state: {
        // 平均気温 (°C)
        averageTemperature: 15,
        // 雲量（0..1）
        f_cloud: 0.5,
        // 平面地図の1グリッドのピクセル数（1..10）
        planeGridCellPx: 3,
        //惑星誕生後の年齢(年)
        Time_yr: 4400000000,
        //１ターンあたりの年齢の増加量(年)
        Turn_yr: 1000,
        // 地表反射率（アルベド、0..1）
        Albedo: 0.3,
        // 有効放射率（温室効果が強いほどRadiation_coolingは小さくなる）
        Radiation_cooling: 1.0,
        // 太陽入射量 W/m2
        Sol: 1361,
        // 平均降水量 (相対降水量：地球１年あたりの降水量を1としたときの降水量)
        averagePrecipitation: 1,
        // 気圧 (bar)
        Pressure: 1,
        // 時代（例: 'ancient' | 'medieval' | 'modern' | 'future' など）
        era: '大森林時代'
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
});


