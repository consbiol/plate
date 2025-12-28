const STORAGE_KEY = 'plate:store:v1';

export function safeLoadPersistedState() {
    try {
        if (typeof window === 'undefined' || !window.localStorage) return null;
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const obj = JSON.parse(raw);
        if (!obj || typeof obj !== 'object') return null;
        // 互換/安全: 永続化として「許可するキーだけ」返す（古い保存値や巨大データを無視）
        return {
            averageTemperature: obj.averageTemperature,
            planeGridCellPx: obj.planeGridCellPx,
            era: obj.era,
            generatorParams: obj.generatorParams,
            renderSettings: obj.renderSettings
        };
    } catch (e) {
        return null;
    }
}

/**
 * 永続化対象は「UI設定 + 生成パラメータ + グリッドサイズ」まで。
 * `gridData` のような巨大データは **永続化しない**（容量・性能・破損リスク）。
 */
export function safePersistState(state) {
    try {
        if (typeof window === 'undefined' || !window.localStorage) return;
        const payload = {
            averageTemperature: state.averageTemperature,
            planeGridCellPx: state.planeGridCellPx,
            era: state.era,
            generatorParams: state.generatorParams,
            renderSettings: state.renderSettings
        };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
        // ignore
    }
}


