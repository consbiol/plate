// 湖の生成（各中心ごと）＋周囲低地化（縁取り）
// Grids_Calculation.vue から切り出し（機能不変）。

export function generateLakes(vm, centers, centerLandCells, landMask, colors, shallowSeaColor, lowlandColor, desertColor, seededRng, seededLog) {
    const N = vm.gridWidth * vm.gridHeight;
    const lakeMask = new Array(N).fill(false);
    const seedStrict = (vm.era === '文明時代' || vm.era === '海棲文明時代') && !!seededRng;
    for (let ci = 0; ci < centers.length; ci++) {
        const lambda = vm.averageLakesPerCenter;
        // 文明時代・海棲文明時代のみ湖の個数もシードで決定（他時代は従来通り）
        const countRng = seedStrict ? (vm._getDerivedRng('lake-count', ci) || seededRng) : null;
        const numLakes = vm._poissonSample(lambda, 20, countRng || seededRng || Math.random);
        const centerLandGrids = centerLandCells[ci] || [];
        for (let lakeIdx = 0; lakeIdx < numLakes; lakeIdx++) {
            if (centerLandGrids.length === 0) break;
            let start = null;
            for (let attempt = 0; attempt < 10; attempt++) {
                const r = seededRng || Math.random; // 開始セルはシード優先（従来仕様維持）
                const startIdx = Math.floor(r() * centerLandGrids.length);
                const cand = centerLandGrids[startIdx];
                if (landMask[cand.idx] && !lakeMask[cand.idx]) { start = cand; break; }
            }
            if (!start) continue;
            // シードで決定された湖の開始セルを記録
            if (seededLog && seededLog[ci]) {
                if (!Array.isArray(seededLog[ci].lakeStarts)) seededLog[ci].lakeStarts = [];
                seededLog[ci].lakeStarts.push({ x: start.x, y: start.y });
            }
            const sizeRng = seedStrict ? (vm._getDerivedRng('lake-size', ci, lakeIdx) || seededRng) : null;
            const targetSize = 3 + Math.floor((sizeRng || Math.random)() * 13);
            const lakeQueue = [{ x: start.x, y: start.y, idx: start.idx }];
            const visited = new Set([start.idx]);
            const lakeCells = [start.idx];
            let q = 0;
            const dirs = [
                { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
                { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
                { dx: -1, dy: -1 }, { dx: 1, dy: -1 },
                { dx: -1, dy: 1 }, { dx: 1, dy: 1 }
            ];
            const stepRng = seedStrict ? (vm._getDerivedRng('lake-expand', ci, lakeIdx) || seededRng) : null;
            while (q < lakeQueue.length && lakeCells.length < targetSize) {
                const cur = lakeQueue[q++];
                for (const d of dirs) {
                    const rr = (stepRng || Math.random)();
                    if (rr > 0.4) continue;
                    const wrapped = vm.torusWrap(cur.x + d.dx, cur.y + d.dy);
                    if (!wrapped) continue;
                    const nIdx = wrapped.y * vm.gridWidth + wrapped.x;
                    if (visited.has(nIdx)) continue;
                    if (!landMask[nIdx]) continue;
                    // 同じ中心に属することを確認
                    // 所属確認は中心IDに依存するが、中心ごとに前計算された centerLandCells を使っているため十分
                    // 厳密なチェックは既存ロジックと同等性を保つため省略
                    visited.add(nIdx);
                    lakeCells.push(nIdx);
                    lakeQueue.push({ x: wrapped.x, y: wrapped.y, idx: nIdx });
                    if (lakeCells.length >= targetSize) break;
                }
            }
            for (const cellIdx of lakeCells) {
                lakeMask[cellIdx] = true;
            }
        }
    }
    for (let i = 0; i < lakeMask.length; i++) {
        if (lakeMask[i]) colors[i] = shallowSeaColor;
    }
    const lakeLowlandRadius = Math.max(1, Math.floor(vm.baseLandDistanceThreshold / 5));
    if (lakeLowlandRadius > 0) {
        for (let gy = 0; gy < vm.gridHeight; gy++) {
            for (let gx = 0; gx < vm.gridWidth; gx++) {
                const idx = gy * vm.gridWidth + gx;
                if (!lakeMask[idx]) continue;
                for (let dy = -lakeLowlandRadius; dy <= lakeLowlandRadius; dy++) {
                    for (let dx = -lakeLowlandRadius; dx <= lakeLowlandRadius; dx++) {
                        const wrapped = vm.torusWrap(gx + dx, gy + dy);
                        if (!wrapped) continue;
                        const d = Math.hypot(dx, dy);
                        if (d > lakeLowlandRadius) continue;
                        const nIdx = wrapped.y * vm.gridWidth + wrapped.x;
                        if (colors[nIdx] === desertColor) {
                            colors[nIdx] = lowlandColor;
                        }
                    }
                }
            }
        }
    }
    return lakeMask;
}


