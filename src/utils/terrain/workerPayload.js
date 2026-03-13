export function buildDriftStateSnapshot({
  driftTurn,
  driftIsApproach,
  superPloom_calc,
  superPloom_history,
  driftMetrics
}) {
  return {
    driftTurn,
    driftIsApproach,
    superPloom_calc,
    superPloom_history: Array.isArray(superPloom_history) ? superPloom_history.slice() : [],
    driftMetrics: driftMetrics || null
  };
}

export function buildWorkerInputs({
  runMode,
  runContext,
  generationInputs,
  hfCache,
  driftState
}) {
  return {
    runMode,
    runContext: deepClonePlain(runContext || null),
    generationInputs: deepClonePlain(generationInputs || {}),
    hfCache: buildHfCacheSnapshot(hfCache),
    driftState: deepClonePlain(driftState || null)
  };
}

export function buildWorkerOutputs({
  payload,
  hfCache,
  driftState
}) {
  return {
    payload: payload || null,
    hfCache: buildHfCacheSnapshot(hfCache),
    driftState: driftState || null
  };
}

export function buildDepsSnapshot({ props, state, hfCache }) {
  return {
    props: deepClonePlain(props || {}),
    state: deepClonePlain(state || {}),
    hfCache: buildHfCacheSnapshot(hfCache)
  };
}

const HF_CACHE_DEEP_KEYS = [
  'centers',
  'lakesList',
  'preGlacierStats',
  'gridDataBase'
];

const HF_CACHE_KEYS = [
  'N',
  'centers',
  'landMask',
  'lakeMask',
  'lakesList',
  'noiseGrid',
  'distanceToSea',
  'distanceToLand',
  'preTundraColors',
  'glacierNoiseTable',
  'tundraNoiseTopTable',
  'tundraNoiseBottomTable',
  'shallowSeaColor',
  'deepSeaColor',
  'lowlandColor',
  'desertColor',
  'highlandColor',
  'alpineColor',
  'tundraColor',
  'glacierColor',
  'seaNoiseAmplitude',
  'landNoiseAmplitude',
  'preGlacierStats',
  'gridDataBase',
  // generate/update 時に固定された wobble / landDistanceThreshold を revise で使うために保持
  'wobbleShiftByX',
  'wobbleRowsFixed',
  'baseLandDistanceThresholdFixed'
];

const deepClonePlain = (value) => {
  if (value == null) return value;
  try {
    if (typeof structuredClone === 'function') {
      return structuredClone(value);
    }
  } catch (e) {
    // fall through
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (e) {
    return null;
  }
};

export function buildHfCacheSnapshot(hfCache) {
  if (!hfCache || typeof hfCache !== 'object') return null;
  const snapshot = {};
  for (const key of HF_CACHE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(hfCache, key)) continue;
    const value = hfCache[key];
    if (HF_CACHE_DEEP_KEYS.includes(key)) {
      snapshot[key] = deepClonePlain(value);
      continue;
    }
    snapshot[key] = Array.isArray(value) ? value.slice() : value;
  }
  return snapshot;
}
