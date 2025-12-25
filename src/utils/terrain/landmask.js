// 陸マスクの後処理（膨張・小島削除・海岸線ジッター）
// - Grids_Calculation.vue から切り出し（機能不変）

function isSeedStrictEra(vm) {
  return (vm.era === '文明時代' || vm.era === '海棲文明時代');
}

export function dilateLandMask(vm, {
  landMask,
  scores,
  threshold,
  expansionBias = 0.12,
  maxIterations = 10
}) {
  for (let iter = 0; iter < maxIterations; iter++) {
    const newLandMask = landMask.slice();
    let changed = false;
    for (let gy = 0; gy < vm.gridHeight; gy++) {
      for (let gx = 0; gx < vm.gridWidth; gx++) {
        const idx = gy * vm.gridWidth + gx;
        if (landMask[idx]) continue;
        let landNeighborCount = 0;
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue;
            const wrapped = vm.torusWrap(gx + dx, gy + dy);
            if (wrapped && landMask[wrapped.y * vm.gridWidth + wrapped.x]) {
              landNeighborCount++;
            }
          }
        }
        const scoreClose = scores[idx] >= threshold - expansionBias;
        // 大陸の統合を防ぐため、条件を厳しくする:
        // - スコアが閾値近傍なら「近傍3」で昇格、
        // - 無条件昇格の近傍数も3に上げる（大陸の独立性を保つ）
        if ((landNeighborCount >= 3 && scoreClose) || landNeighborCount >= 4) {
          newLandMask[idx] = true;
          changed = true;
        }
      }
    }
    for (let i = 0; i < landMask.length; i++) landMask[i] = newLandMask[i];
    if (!changed) break;
  }
}

export function removeSingleCellIslands(vm, {
  landMask,
  seededRng
}) {
  // 小島（単独1グリッド）の90%を削除（ランダムに残す約10%）
  for (let gy = 0; gy < vm.gridHeight; gy++) {
    for (let gx = 0; gx < vm.gridWidth; gx++) {
      const idx = gy * vm.gridWidth + gx;
      if (!landMask[idx]) continue;
      // 8近傍に陸があれば単独島ではない
      let hasLandNeighbor = false;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const wrapped = vm.torusWrap(gx + dx, gy + dy);
          if (!wrapped) continue;
          const nIdx = wrapped.y * vm.gridWidth + wrapped.x;
          if (landMask[nIdx]) { hasLandNeighbor = true; break; }
        }
        if (hasLandNeighbor) break;
      }
      if (!hasLandNeighbor) {
        // 一律で70%の確率で海に戻す（シードがあれば再現可能にする）
        // _getDerivedRng は常に存在する前提（念のためのガードは不要）
        const pickRng = vm._getDerivedRng('coast-island', gx, gy) || seededRng || Math.random;
        if (pickRng() < 0.7) landMask[idx] = false;
      }
    }
  }
}

export function jitterCoastline(vm, {
  landMask,
  scores,
  threshold,
  seededRng
}) {
  // --- 海岸線のランダム微摂動（同じシードでも海岸線だけ見た目に変化を出す） ---
  // 近傍に異なる陸海があるセル（=海岸線セル）のうち、スコアが閾値近傍のものだけ微小確率で反転
  // 他の要素（座標/影響/減衰/方向）はシード固定のまま
  let minScore = Infinity, maxScore = -Infinity;
  for (let i = 0; i < scores.length; i++) {
    const s = scores[i];
    if (s < minScore) minScore = s;
    if (s > maxScore) maxScore = s;
  }
  const scoreBand = Math.max(1e-6, (maxScore - minScore) * 0.05); // 閾値±2%帯
  const flipProb = 0.30; // 反転確率（控えめ）

  const hasOppNeighbor = (x, y) => {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const w = vm.torusWrap(x + dx, y + dy);
        if (!w) continue;
        const a = y * vm.gridWidth + x;
        const b = w.y * vm.gridWidth + w.x;
        if (landMask[a] !== landMask[b]) return true;
      }
    }
    return false;
  };

  for (let gy = 0; gy < vm.gridHeight; gy++) {
    for (let gx = 0; gx < vm.gridWidth; gx++) {
      const idx = gy * vm.gridWidth + gx;
      const s = scores[idx];
      if (Math.abs(s - threshold) <= scoreBand && hasOppNeighbor(gx, gy)) {
        const strict = isSeedStrictEra(vm) && !!seededRng;
        const r = strict ? (vm._getDerivedRng('coast-flip', gx, gy) || seededRng) : Math.random;
        if (r() < flipProb) {
          landMask[idx] = !landMask[idx];
        }
      }
    }
  }
}


