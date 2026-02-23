// クラスタ生成（BFS拡張）関連

import { getClusterRng } from './vmRng';
import { pickRng } from '../../rng.js';

export function growCluster({
    gridWidth,
    torusWrap,
    startX,
    startY,
    startIdx,
    targetSize,
    dirs,
    acceptNeighbor,
    canFill,
    onFill
}) {
    const queue = [{ x: startX, y: startY, idx: startIdx }];
    const visited = new Set([startIdx]);
    onFill(startIdx);
    let count = 1;

    // queue.shift() は O(n) なので、FIFO順序を保ったままインデックス方式にする
    let qi = 0;
    while (qi < queue.length && count < targetSize) {
        const cur = queue[qi++];
        for (const d of dirs) {
            if (acceptNeighbor && !acceptNeighbor()) continue;

            const w = torusWrap(cur.x + d.dx, cur.y + d.dy);
            if (!w) continue;
            const nIdx = w.y * gridWidth + w.x;
            if (visited.has(nIdx)) continue;
            visited.add(nIdx);

            if (canFill && !canFill(nIdx)) continue;
            onFill(nIdx);
            count++;
            if (count >= targetSize) break;
            queue.push({ x: w.x, y: w.y, idx: nIdx });
        }
    }
}

export function maybeStartClusterAtCell({
    gridWidth,
    torusWrap,
    poissonSample,
    gx,
    gy,
    idx,
    startProbability,
    startRng,
    clusterRngKey,
    poissonMean,
    poissonMax,
    dirs,
    seededRng,
    acceptP,
    derivedRng,
    canFill,
    onFill
}) {
    if (!(startProbability > 0)) return;
    if (startRng() >= startProbability) return;

    const clusterRng = getClusterRng(null, clusterRngKey, gx, gy, derivedRng);
    const targetSize = Math.max(1, poissonSample(poissonMean, poissonMax, clusterRng));

    growCluster({
        gridWidth,
        torusWrap,
        startX: gx,
        startY: gy,
        startIdx: idx,
        targetSize,
        dirs,
        acceptNeighbor: () => {
            // 隣接セルを確率的に拡張（密になり過ぎないよう acceptP で採択）
            const rand = pickRng(clusterRng, seededRng);
            return rand() <= acceptP;
        },
        canFill,
        onFill
    });
}


