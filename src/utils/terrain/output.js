// runGenerate の「出力組み立て」関連（preGlacierStats / emit payload）

export function computePreGlacierStats({
  N,
  landMask,
  lakeMask
}) {
  // ここで「氷河で上書きされる前」の陸/海比を計測（湖は海扱い）
  let landCount = 0;
  for (let i = 0; i < N; i++) {
    if (landMask[i] && !(typeof lakeMask !== 'undefined' && lakeMask[i])) landCount++;
  }
  const seaCount = Math.max(0, N - landCount);
  return {
    landCount,
    seaCount,
    total: N,
    landRatio: landCount / (N || 1)
  };
}

export function buildGeneratedPayload({
  centerParameters,
  gridData,
  deterministicSeed,
  preGlacierStats,
  computedTopGlacierRows
}) {
  // 結果をemit（平面グリッド用に displayColors も明示的に渡す）
  return {
    centerParameters,
    gridData,
    deterministicSeed,
    preGlacierStats, // 氷河上書き前の比率情報を追加
    // 氷河rowは「平均気温 + 海率(氷河上書き前)」で計算した実効値。UI表示と一致させるため返す。
    computedTopGlacierRows
  };
}


