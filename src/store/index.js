import { createStore } from 'vuex';

export default createStore({
    state: {
        // UI/描画で「実際に参照されている」状態（Parameters_Display / Terrain_Display で使用）
        // 平均気温 (°C)
        averageTemperature: 15,
        // 平面地図の1グリッドのピクセル数（1..10）
        planeGridCellPx: 3,
        // 時代（色プリセット等）
        era: '大森林時代',

        // -------------------------------------------------------------------
        // 予約（現状未使用）:
        // 以前 state に入っていた将来用パラメータは、混乱を避けるため state から外し、コメントとして残す。
        // （必要になったタイミングで state/getters/mutations/actions を追加して復活させる）
        //
        // 惑星誕生後の年齢(年)
        // Time_yr: 4400000000,
        // １ターンあたりの年齢の増加量(年)
        // Turn_yr: 1000,
        // 地表反射率（アルベド、0..1）
        // Albedo: 0.3,
        // 有効放射率（温室効果が強いほどRadiation_coolingは小さくなる）
        // Radiation_cooling: 1.0,
        // 太陽入射量 W/m2
        // Sol: 1361,
        // 平均降水量 (相対降水量：地球１年あたりの降水量を1としたときの降水量)
        // averagePrecipitation: 1,
        // 気圧 (bar)
        // Pressure: 1,
        // 雲量（0..1）
        // f_cloud: 0.5,
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


