// 発生確率（地域バイアス）関連

import { clamp, clamp01 } from './math';

export function getBiasedCityProbability({
    vm,
    gx,
    gy,
    baseProbability,
    isAdjacentFn,
    biasScale,
    biasMin,
    biasMax,
    adjacencyMultiplier
}) {
    // 地域差ノイズによる倍率
    // 座標はそのまま渡し、スケールは引数で指定（ダブルスケーリングを避ける）
    const n = vm.fractalNoise2D(gx, gy, 4, 0.5, biasScale);
    const u = (n + 1) * 0.5; // [0,1]
    const bias = clamp(biasMin, biasMin + u * (biasMax - biasMin), biasMax);
    const biasedBase = baseProbability * bias;
    const p = isAdjacentFn(gx, gy) ? clamp01(biasedBase * adjacencyMultiplier) : clamp01(biasedBase);
    return p;
}


