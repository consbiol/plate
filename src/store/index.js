import { createStore } from 'vuex';

// 時代ごとのT_mannenのデフォルト速度（count/秒）: 将来的に各時代で異なる値を設定可能
const DEFAULT_TMANEN_SPEED_BY_ERA = {
    '爆撃時代': 1.0,
    '生命発生前時代': 1.0,
    '嫌気性細菌誕生時代': 10.0,
    '光合成細菌誕生時代': 1.0,
    '真核生物誕生時代': 1.0,
    '多細胞生物誕生時代': 1.0,
    '海洋生物多様化時代': 1.0,
    '苔類進出時代': 1.0,
    'シダ植物時代': 1.0,
    '大森林時代': 1.0,
    '文明時代': 1.0,
    '海棲文明時代': 1.0
};

export default createStore({
    state: {
        // 平均気温 (°C)
        averageTemperature: 15,
        // 雲量（0..1）
        cloudAmount: 0.5,
        // 平面地図の1グリッドのピクセル数（1..10）
        planeGridCellPx: 3,
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
        era: '大森林時代',
        // 新規カウンタ: T_mannen
        T_mannen: 0,
        // カウントの進行状態
        tmannenRunning: false,
        // 1秒あたりのカウント増加量
        tmannenSpeed: 1.0,
        // カウントの経過をためて整数 increment に変換する accumulator
        tmannenAccumulator: 0
    },
    getters: {
        averageTemperature: (state) => state.averageTemperature,
        era: (state) => state.era,
        planeGridCellPx: (state) => state.planeGridCellPx
        , T_mannen: (state) => state.T_mannen
        , tmannenRunning: (state) => state.tmannenRunning
        , tmannenSpeed: (state) => state.tmannenSpeed
    },
    mutations: {
        setAverageTemperature(state, value) {
            state.averageTemperature = value;
        },
        setEra(state, value) {
            state.era = value;
            // era 変更時にその時代のデフォルト速度を自動適用
            try {
                const def = DEFAULT_TMANEN_SPEED_BY_ERA && DEFAULT_TMANEN_SPEED_BY_ERA[value];
                if (typeof def === 'number' && isFinite(def)) {
                    state.tmannenSpeed = def;
                    // reset accumulator to avoid immediate fractional carryover
                    state.tmannenAccumulator = 0;
                }
            } catch (e) {
                // ignore
            }
        },
        setPlaneGridCellPx(state, value) {
            state.planeGridCellPx = value;
        },
        setTmannen(state, value) {
            state.T_mannen = value;
        },
        incrementTmannen(state, delta) {
            const d = Number(delta) || 0;
            // accumulator に加算
            state.tmannenAccumulator = (state.tmannenAccumulator || 0) + d;
            // 整数 increment を適用
            const inc = Math.floor(state.tmannenAccumulator);
            if (inc !== 0) {
                state.T_mannen = (state.T_mannen || 0) + inc;
                state.tmannenAccumulator -= inc;
            }
        },
        setTmannenSpeed(state, value) {
            const v = Number(value);
            state.tmannenSpeed = isFinite(v) ? v : state.tmannenSpeed;
        },
        setTmannenRunning(state, flag) {
            state.tmannenRunning = !!flag;
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
        },
        updateTmannen({ commit }, delta) {
            commit('incrementTmannen', delta);
        },
        updateTmannenSpeed({ commit }, value) {
            commit('setTmannenSpeed', value);
        },
        updateTmannenRunning({ commit }, value) {
            commit('setTmannenRunning', value);
        }
        ,
        resetTmannenSpeedToDefault({ commit, state }) {
            try {
                const def = DEFAULT_TMANEN_SPEED_BY_ERA && DEFAULT_TMANEN_SPEED_BY_ERA[state.era];
                commit('setTmannenSpeed', (typeof def === 'number' && isFinite(def)) ? def : 1.0);
            } catch (e) {
                commit('setTmannenSpeed', 1.0);
            }
        }
    }
});


