// 高地生成（各中心ごと）
// Grids_Calculation.vue から切り出し（機能不変）。

// NOTE:
//   「必要な依存だけ」を受け取るための ctx 化を段階的に進める（挙動不変）。
// - ctx は "vm と同じ形" でも良いし、必要な値/関数だけを持つ薄いオブジェクトでも良い。
export function generateHighlands(ctx, centers, centerLandCellsPre, preLandMask, lakeMask, colors, highlandColor, seededRng, seededLog) {
    const N = ctx.gridWidth * ctx.gridHeight;
    const highlandMask = new Array(N).fill(false);
    const seedStrict = (ctx.era === '文明時代' || ctx.era === '海棲文明時代') && !!seededRng;
    for (let ci = 0; ci < centers.length; ci++) {
        // 高地（中心単位）のサブRNG
        const centerRng = ctx._getDerivedRng('highland-center', ci);
        // 高地クラスタの平均数を陸の割合に依存させる:
        // ルール: 陸の割合 x が 0.1 増えるごとにクラスタ数が +1、
        // 例: x=0.1 -> 3, x=0.3 -> 5, x=0.7 -> 9, x=0.9 ->11
        const landRatioForHighlands = (typeof ctx.seaLandRatio === 'number') ? Number(ctx.seaLandRatio) : 0.3;
        const lambda = 0.5 + 11 * landRatioForHighlands; // 上限は撤廃（非整数でも Poisson の平均として扱う）
        const numHighlands = ctx._poissonSample(lambda, 20, centerRng || seededRng); // 個数はシードで決定
        if (seededLog && seededLog[ci]) {
            seededLog[ci].highlandsCount = numHighlands;
            if (!Array.isArray(seededLog[ci].highlandClusters)) seededLog[ci].highlandClusters = [];
        }
        const centerLandGrids = centerLandCellsPre[ci] || [];
        for (let highlandIdx = 0; highlandIdx < numHighlands; highlandIdx++) {
            // 高地（クラスター単位）のサブRNG
            const clusterRng = ctx._getDerivedRng('highland-cluster', ci, highlandIdx);
            if (centerLandGrids.length === 0) break;
            let start = null;
            for (let attempt = 0; attempt < 10; attempt++) {
                // 文明時代かつシード有りのときは Math.random を使わず決定
                const r = seedStrict ? (clusterRng || seededRng) : (clusterRng || seededRng || Math.random);
                const startIdx = Math.floor(r() * centerLandGrids.length);
                const cand = centerLandGrids[startIdx];
                if (preLandMask[cand.idx] && !lakeMask[cand.idx] && !highlandMask[cand.idx]) { start = cand; break; }
            }
            if (!start) continue;
            const rForSize = seedStrict ? (clusterRng || seededRng) : (clusterRng || seededRng || Math.random); // サイズはサブRNG優先
            const targetSize = 30 + Math.floor(rForSize() * 121);
            // シードで決定された高地クラスターの開始セル・サイズを記録
            if (seededLog && seededLog[ci]) {
                seededLog[ci].highlandClusters.push({ x: start.x, y: start.y, size: targetSize });
            }
            const rDir = seedStrict ? (clusterRng || seededRng) : (clusterRng || seededRng || Math.random); // 主方向はサブRNG優先
            const mainAngle = rDir() * Math.PI * 2;
            const mainDx = Math.cos(mainAngle);
            const mainDy = Math.sin(mainAngle);
            const rSpread = seedStrict ? (clusterRng || seededRng) : (clusterRng || seededRng || Math.random); // 横方向強度もサブRNG優先
            const spreadIntensity = 0.5 + rSpread() * 1.0;
            const perpDx = -mainDy;
            const perpDy = mainDx;
            const highlandCells = [start.idx];
            const visited = new Set([start.idx]);
            const queue = [{ x: start.x, y: start.y, idx: start.idx, dist: 0 }];
            const mainProgress = new Map();
            mainProgress.set(start.idx, 0);
            // queue.shift() は O(n) なので、FIFO順序を保ったままインデックス方式にする
            let qi = 0;
            while (qi < queue.length && highlandCells.length < targetSize) {
                const current = queue[qi++];
                const currentProgress = mainProgress.get(current.idx) || 0;
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        if (dx === 0 && dy === 0) continue;
                        const wrapped = ctx.torusWrap(current.x + dx, current.y + dy);
                        if (!wrapped) continue;
                        const nIdx = wrapped.y * ctx.gridWidth + wrapped.x;
                        if (visited.has(nIdx)) continue;
                        if (!preLandMask[nIdx]) continue;
                        if (lakeMask[nIdx]) continue;
                        const relX = wrapped.x - start.x;
                        const relY = wrapped.y - start.y;
                        const progress = relX * mainDx + relY * mainDy;
                        const perpOffset = relX * perpDx + relY * perpDy;
                        // 高地生成時のノイズもサブRNGに基づく（無ければフォールバック）
                        const rNoise = seedStrict ? (clusterRng || seededRng) : (clusterRng || seededRng || Math.random);
                        const noise = (rNoise() * 2 - 1) * 2.0;
                        const allowedPerpSpread = spreadIntensity * (1 + Math.abs(noise));
                        if (progress >= currentProgress - 0.5 && Math.abs(perpOffset) <= allowedPerpSpread) {
                            visited.add(nIdx);
                            highlandCells.push(nIdx);
                            mainProgress.set(nIdx, progress);
                            queue.push({ x: wrapped.x, y: wrapped.y, idx: nIdx, dist: current.dist + 1 });
                        }
                    }
                }
            }
            for (const cellIdx of highlandCells) {
                highlandMask[cellIdx] = true;
            }
        }
    }
    for (let i = 0; i < N; i++) {
        if (highlandMask[i]) {
            colors[i] = highlandColor;
        }
    }
    return highlandMask;
}


