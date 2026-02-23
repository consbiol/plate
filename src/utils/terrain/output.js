export function computePreGlacierStats({
  N,
  landMask,
  lakeMask
}) {
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
  eventType = 'generated',
  runMode = null,
  runId = null,
  centerParameters,
  gridData,
  deterministicSeed,
  preGlacierStats,
  computedTopGlacierRows,
  driftMetrics,
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
