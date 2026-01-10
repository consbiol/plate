// 汚染地の生成（重み付き抽選＋クラスタ拡張）

import { growCluster } from './cluster';

export function generatePollutedAreas(ctx, {
    N,
    countAreas,
    isEligible,
    weightFn,
    pickRngKey,
    clusterRngKey,
    targetMean,
    targetMax,
    dirs,
    pollutedMask,
    canExpand
}) {
    const eligible = [];
    for (let i = 0; i < N; i++) {
        if (isEligible(i)) eligible.push(i);
    }

    const weights = new Array(eligible.length);
    let totalWeight = 0;
    for (let ei = 0; ei < eligible.length; ei++) {
        const idx0 = eligible[ei];
        const w = weightFn(idx0);
        weights[ei] = w;
        totalWeight += w;
    }

    const pickRng = ctx._getDerivedRng(pickRngKey) || Math.random;
    const chosen = new Set();

    for (let k = 0; k < countAreas && eligible.length > 0; k++) {
        // 重み付き抽選（選択済みは重み0にして再抽選）
        let startIdx = -1;
        let pickedEi = -1;
        for (let tries = 0; tries < Math.max(20, eligible.length); tries++) {
            if (totalWeight <= 0) break;
            let r = (pickRng() || Math.random) * totalWeight;
            let acc = 0;
            for (let ei = 0; ei < eligible.length; ei++) {
                const w = weights[ei] || 0;
                if (w <= 0) continue;
                acc += w;
                if (acc >= r) {
                    const idx0 = eligible[ei];
                    if (chosen.has(idx0)) {
                        continue;
                    }
                    startIdx = idx0;
                    pickedEi = ei;
                    break;
                }
            }
            if (startIdx >= 0) break;
        }
        if (startIdx < 0) break;

        chosen.add(startIdx);
        if (pickedEi >= 0) {
            totalWeight -= (weights[pickedEi] || 0);
            weights[pickedEi] = 0;
        }

        const sx = startIdx % ctx.gridWidth;
        const sy = Math.floor(startIdx / ctx.gridWidth);
        const clusterRng = ctx._getDerivedRng(clusterRngKey, sx, sy) || Math.random;
        const targetSize = Math.max(1, ctx._poissonSample(targetMean, targetMax, clusterRng));

        growCluster({
            ctx,
            startX: sx,
            startY: sy,
            startIdx,
            targetSize,
            dirs,
            acceptNeighbor: () => {
                const acceptP = 0.6 + ((clusterRng() || Math.random) - 0.5) * 0.2; // 0.5..0.7
                if ((clusterRng() || Math.random) > acceptP) return false;
                return true;
            },
            canFill: canExpand,
            onFill: (nIdx) => { pollutedMask[nIdx] = true; }
        });
    }
}


