// runGenerate の「出力組み立て」関連（preGlacierStats / emit payload）

/**
 * @typedef {import('../../types/index.js').TerrainEventPayload} TerrainEventPayload
 * @typedef {import('../../types/index.js').TerrainEventType} TerrainEventType
 */

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
    // emitイベント名と一致させる（例: 'generated' / 'drifted'）
    eventType = 'generated',
    // 任意: 実行モード（UI側で固定して渡す）
    runMode = null,
    // 任意: 実行ID（UI側で固定して渡す）
    runId = null,
    centerParameters,
    gridData,
    deterministicSeed,
    preGlacierStats,
    computedTopGlacierRows,
    // 任意: Drift用の付加情報（Parameters Outputに表示）
    driftMetrics,
    // 任意: 低地→海まで距離の統計（現在は未使用/未生成の可能性あり）
    lowlandDistanceToSeaStats
}) {
    /** @type {TerrainEventPayload} */
    return buildTerrainEventPayload({
        eventType,
        runMode,
        runId,
        centerParameters,
        gridData,
        deterministicSeed,
        preGlacierStats,
        computedTopGlacierRows,
        driftMetrics,
        lowlandDistanceToSeaStats
    });
}

// payload shape unification:
// - emitted by 'generated' / 'revised' / 'drifted'
// - always returns the same top-level keys so consumers can be simpler.
export function buildTerrainEventPayload({
    eventType,
    runMode = null,
    runId = null,
    gridData = null,
    centerParameters = [],
    deterministicSeed = null,
    preGlacierStats = null,
    computedTopGlacierRows = null,
    driftMetrics = null,
    lowlandDistanceToSeaStats = null
}) {
    /** @type {TerrainEventType} */
    const safeEventType = (eventType === 'generated' || eventType === 'revised' || eventType === 'drifted')
        ? eventType
        : 'generated';
    /** @type {TerrainEventPayload} */
    return {
        eventType: safeEventType,
        runMode,
        runId,
        gridData,
        centerParameters,
        deterministicSeed,
        preGlacierStats,
        computedTopGlacierRows,
        driftMetrics,
        lowlandDistanceToSeaStats
    };
}


