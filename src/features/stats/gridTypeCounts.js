/**
 * 地形生成結果の gridData から、グリッド種別の内訳を集計する。
 *
 * Priority (flags first):
 * - seaPolluted > seaCity > seaCultivated
 * - polluted > city > bryophyte > cultivated
 * - then terrain (sea/land)
 *
 * `Parameters_Display.vue` の既存ロジックと互換（同じ優先順位・同じ分類）であることが重要。
 */
export function computeGridTypeCounts({ gridData, gridWidth, gridHeight }) {
    const N = (Array.isArray(gridData) && gridData.length)
        ? gridData.length
        : (Number(gridWidth) * Number(gridHeight));

    const counts = {
        deepSea: 0,
        shallowSea: 0,
        glacier: 0,
        lowland: 0,
        desert: 0,
        highland: 0,
        alpine: 0,
        lake: 0,
        tundra: 0,
        bryophyte: 0,
        city: 0,
        cultivated: 0,
        polluted: 0,
        seaCity: 0,
        seaCultivated: 0,
        seaPolluted: 0,
        total: N
    };

    if (!Array.isArray(gridData) || gridData.length !== N) return counts;

    for (let i = 0; i < N; i++) {
        const cell = gridData[i];
        let cat = null;
        // 海棲グリッドの優先順位: seaPolluted > seaCity > seaCultivated
        if (cell && cell.seaPolluted) {
            cat = 'seaPolluted';
        } else if (cell && cell.seaCity) {
            cat = 'seaCity';
        } else if (cell && cell.seaCultivated) {
            cat = 'seaCultivated';
        } else if (cell && cell.polluted) {
            cat = 'polluted';
        } else if (cell && cell.city) {
            cat = 'city';
        } else if (cell && cell.bryophyte) {
            cat = 'bryophyte';
        } else if (cell && cell.cultivated) {
            cat = 'cultivated';
        } else if (cell && cell.terrain && cell.terrain.type === 'sea') {
            const sea = cell.terrain.sea;
            if (sea === 'deep') cat = 'deepSea';
            else if (sea === 'glacier') cat = 'glacier';
            else cat = 'shallowSea';
        } else if (cell && cell.terrain && cell.terrain.type === 'land') {
            const l = cell.terrain.land;
            if (l === 'lowland') cat = 'lowland';
            else if (l === 'desert') cat = 'desert';
            else if (l === 'highland') cat = 'highland';
            else if (l === 'alpine') cat = 'alpine';
            else if (l === 'tundra') cat = 'tundra';
            else if (l === 'lake') cat = 'lake';
            else if (l === 'glacier') cat = 'glacier';
            else cat = 'lowland';
        } else {
            // フォールバック（互換用）
            cat = 'lowland';
        }
        counts[cat] += 1;
    }

    return counts;
}


