import { createDerivedRng } from '../rng.js';
import { sampleLandCenters } from './centers.js';
import { buildTerrainEventPayload } from './output.js';

const RAND_DIRS_8 = Object.freeze([
  { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
  { dx: 1, dy: 1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 }
]);

const clampRange = (value, min, max) => Math.max(min, Math.min(max, value));
const wrapMod = (value, mod) => ((value % mod) + mod) % mod;
const isFiniteNumber = (value) => Number.isFinite(Number(value));
const toFiniteNumber = (value, fallback) => (isFiniteNumber(value) ? Number(value) : fallback);
const deriveEffectiveMinCenterDistance = ({ minCenterDistance, computeEffectiveMinCenterDistance, fallback }) => (
  isFiniteNumber(minCenterDistance)
    ? Number(minCenterDistance)
    : (typeof computeEffectiveMinCenterDistance === 'function' ? computeEffectiveMinCenterDistance() : fallback)
);

const torusMean1D = (vals, mod) => {
  const n = vals.length || 1;
  let s = 0;
  let c = 0;
  for (let i = 0; i < vals.length; i++) {
    const ang = (vals[i] / mod) * (Math.PI * 2);
    s += Math.sin(ang);
    c += Math.cos(ang);
  }
  let meanAng = Math.atan2(s / n, c / n);
  if (meanAng < 0) meanAng += Math.PI * 2;
  return (meanAng / (Math.PI * 2)) * mod;
};

/**
 * @typedef {import('../../types/index.js').TerrainEventPayload} TerrainEventPayload
 */

const resolveFn = (runtime, publicName, privateName, deps) => (
  (deps && typeof deps[publicName] === 'function')
    ? deps[publicName]
    : ((runtime && typeof runtime[publicName] === 'function') ? runtime[publicName] : runtime[privateName])
);
const readProp = (runtime, deps, key, fallback = undefined) => {
  if (deps && deps.props && Object.prototype.hasOwnProperty.call(deps.props, key)) return deps.props[key];
  if (runtime && Object.prototype.hasOwnProperty.call(runtime, key)) return runtime[key];
  return fallback;
};
const readState = (runtime, deps, key, fallback = undefined) => {
  if (deps && deps.state && Object.prototype.hasOwnProperty.call(deps.state, key)) return deps.state[key];
  if (runtime && Object.prototype.hasOwnProperty.call(runtime, key)) return runtime[key];
  return fallback;
};
const buildRuntimeFromDeps = (deps) => {
  if (!deps) return {};
  return {
    deps,
    ...(deps.props || {}),
    ...(deps.state || {}),
    hfCache: deps.hfCache
  };
};

/**
 * Run full generation via a runtime-compatible object.
 * @param {object} runtime - must provide the same methods/fields as Grids_Calculation.vue
 * @param {{preserveCenterCoordinates?: boolean, runContext?: any}} [options]
 * @returns {{payload: TerrainEventPayload, state: object}}
 */
export function runGenerate(runtime, { preserveCenterCoordinates = false, runContext = null, deps = null } = {}) {
  const resolvedDeps = deps || runtime.deps || null;
  const buildGenerationJobSpec = resolveFn(runtime, 'buildGenerationJobSpec', '_buildGenerationJobSpec', resolvedDeps);
  const getSeededRng = resolveFn(runtime, 'getSeededRng', '_getSeededRng', resolvedDeps);
  const resetDriftStateForGenerate = resolveFn(runtime, 'resetDriftStateForGenerate', '_resetDriftStateForGenerate', resolvedDeps);
  const buildSeededLog = resolveFn(runtime, 'buildSeededLog', '_buildSeededLog', resolvedDeps);
  const precomputeGenerateFixedTables = resolveFn(runtime, 'precomputeGenerateFixedTables', '_precomputeGenerateFixedTables', resolvedDeps);
  const computeCentersAndParamsForGenerate = resolveFn(runtime, 'computeCentersAndParamsForGenerate', '_computeCentersAndParamsForGenerate', resolvedDeps);
  const computeScoresThresholdAndLandMaskForGenerate = resolveFn(runtime, 'computeScoresThresholdAndLandMaskForGenerate', '_computeScoresThresholdAndLandMaskForGenerate', resolvedDeps);
  const ensureRunContext = resolveFn(runtime, 'ensureRunContext', '_ensureRunContext', resolvedDeps);
  const buildWorld = resolveFn(runtime, 'buildWorld', '_buildWorld', resolvedDeps)
    || resolveFn(runtime, 'buildWorldAndEmit', '_buildWorldAndEmit', resolvedDeps);

  const { generationInputs, N } = buildGenerationJobSpec.call(runtime);
  const seededRng = getSeededRng.call(runtime);
  resetDriftStateForGenerate.call(runtime, { preserveCenterCoordinates });
  const centersY = (generationInputs && Number.isFinite(Number(generationInputs.centersY)))
    ? Number(generationInputs.centersY)
    : readProp(runtime, resolvedDeps, 'centersY', runtime.centersY);
  const seededLog = buildSeededLog.call(runtime, centersY);
  const { glacierNoiseTable, tundraNoiseTopTable, tundraNoiseBottomTable } =
    precomputeGenerateFixedTables.call(runtime, { N, seededRng });
  const {
    centers: centers0,
    localCenterParameters,
    seedStrictCenters,
    effectiveMinCenterDistance
  } = computeCentersAndParamsForGenerate.call(runtime, { preserveCenterCoordinates, seededRng });
  const { centers, scores, threshold, landMask } = computeScoresThresholdAndLandMaskForGenerate.call(runtime, {
    N,
    centers: centers0,
    localCenterParameters,
    preserveCenterCoordinates,
    seedStrictCenters,
    seededRng,
    effectiveMinCenterDistance
  });
  const ensured = ensureRunContext.call(runtime, {
    runContext,
    defaultRunMode: preserveCenterCoordinates ? 'update' : 'generate'
  });
  const built = buildWorld.call(runtime, {
    emitEvent: 'generated',
    runContext: ensured,
    N,
    centers,
    localCenterParameters,
    landMask,
    scores,
    threshold,
    seededRng,
    seededLog,
    glacierNoiseTable,
    tundraNoiseTopTable,
    tundraNoiseBottomTable
  });
  const payload = (built && built.payload) ? built.payload : built;
  const state = { lastGenerationInputs: generationInputs };
  if (built && built.hfCache) state.hfCache = built.hfCache;
  return { payload, state };
}

export function runGenerateWithDeps(deps, { preserveCenterCoordinates = false, runContext = null } = {}) {
  const runtime = buildRuntimeFromDeps(deps);
  return runGenerate(runtime, { preserveCenterCoordinates, runContext, deps });
}

export function runDrift(runtime, { runContext = null, deps = null } = {}) {
  const resolvedDeps = deps || runtime.deps || null;
  const gridWidth = readProp(runtime, resolvedDeps, 'gridWidth', runtime.gridWidth);
  const gridHeight = readProp(runtime, resolvedDeps, 'gridHeight', runtime.gridHeight);
  const N = gridWidth * gridHeight;
  const seededRng = null;
  const deterministicSeedForMoves = readProp(runtime, resolvedDeps, 'deterministicSeed', runtime.deterministicSeed);

  const setForceRandomDerivedRng = (value) => {
    if (resolvedDeps && typeof resolvedDeps.setForceRandomDerivedRng === 'function') {
      resolvedDeps.setForceRandomDerivedRng(value);
    } else if (typeof runtime.setForceRandomDerivedRng === 'function') {
      runtime.setForceRandomDerivedRng(value);
    } else {
      runtime.forceRandomDerivedRng = value;
    }
  };
  const prevForce = readProp(runtime, resolvedDeps, 'forceRandomDerivedRng', runtime.forceRandomDerivedRng);
  setForceRandomDerivedRng(true);
  let state = {
    driftTurn: Number.isFinite(readState(runtime, resolvedDeps, 'driftTurn', 0)) ? (readState(runtime, resolvedDeps, 'driftTurn', 0) | 0) : 0,
    driftIsApproach: (typeof readState(runtime, resolvedDeps, 'driftIsApproach', true) === 'boolean')
      ? readState(runtime, resolvedDeps, 'driftIsApproach', true)
      : true,
    superPloom_calc: Number.isFinite(readState(runtime, resolvedDeps, 'superPloom_calc', 0))
      ? readState(runtime, resolvedDeps, 'superPloom_calc', 0)
      : 0,
    superPloom_history: Array.isArray(readState(runtime, resolvedDeps, 'superPloom_history', null))
      ? readState(runtime, resolvedDeps, 'superPloom_history', []).slice()
      : [],
    driftMetrics: readState(runtime, resolvedDeps, 'driftMetrics', null) || null
  };
  try {
    const hfCache = (resolvedDeps && resolvedDeps.hfCache) ? resolvedDeps.hfCache : runtime.hfCache;
    const prevCenters = (hfCache && Array.isArray(hfCache.centers)) ? hfCache.centers : null;
    const effectiveMinCenterDistance = deriveEffectiveMinCenterDistance({
      minCenterDistance: readProp(runtime, resolvedDeps, 'minCenterDistance', runtime.minCenterDistance),
      computeEffectiveMinCenterDistance: (resolvedDeps && typeof resolvedDeps.computeEffectiveMinCenterDistance === 'function')
        ? resolvedDeps.computeEffectiveMinCenterDistance
        : null,
      fallback: (typeof runtime._computeEffectiveMinCenterDistance === 'function')
        ? runtime._computeEffectiveMinCenterDistance()
        : 20
    });
    const baseCenters = (prevCenters && prevCenters.length > 0)
      ? prevCenters
      : sampleLandCenters({
        gridWidth,
        gridHeight,
        centersY: readProp(runtime, resolvedDeps, 'centersY', runtime.centersY),
        minCenterDistance: readProp(runtime, resolvedDeps, 'minCenterDistance', runtime.minCenterDistance),
        torusDistance: (x1, y1, x2, y2) => (resolvedDeps && resolvedDeps.torusDistance)
          ? resolvedDeps.torusDistance(x1, y1, x2, y2)
          : runtime.torusDistance(x1, y1, x2, y2)
      }, null, effectiveMinCenterDistance);

    if (!prevCenters || prevCenters.length <= 0) {
      state = {
        ...state,
        driftTurn: 0,
        superPloom_calc: 0,
        superPloom_history: [],
        driftMetrics: null
      };
    }

    const WIDTH = gridWidth;
    const HEIGHT = gridHeight;
    const MIN_DIST = toFiniteNumber(effectiveMinCenterDistance, 1) || 1;

    const points = baseCenters.map((c) => ({
      x: wrapMod(Math.floor(c.x), WIDTH),
      y: clampRange(Math.floor(c.y), 0, HEIGHT - 1)
    }));

    const turn0 = state.driftTurn | 0;
    const isApproach = !!state.driftIsApproach;
    const phaseName = isApproach ? 'Approach' : 'Repel';
    const useYtorus = !isApproach;

    const getDist = (a, b, yTorus) => {
      let dx = (b.x - a.x);
      if (dx > WIDTH / 2) dx -= WIDTH;
      if (dx < -WIDTH / 2) dx += WIDTH;
      let dy = (b.y - a.y);
      if (yTorus) {
        if (dy > HEIGHT / 2) dy -= HEIGHT;
        if (dy < -HEIGHT / 2) dy += HEIGHT;
      }
      const d = Math.hypot(dx, dy);
      return { dx, dy, d };
    };

    const stepFromVector = (dx, dy) => {
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) return { dx: 0, dy: 0 };
      if (dx === 0 && dy === 0) return { dx: 0, dy: 0 };
      const sx = dx === 0 ? 0 : (dx > 0 ? 1 : -1);
      const sy = dy === 0 ? 0 : (dy > 0 ? 1 : -1);
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      // 斜めを優先しつつ、極端に片方が大きい場合は直進
      if (ax > ay * 1.5) return { dx: sx, dy: 0 };
      if (ay > ax * 1.5) return { dx: 0, dy: sy };
      return { dx: sx, dy: sy };
    };

    const move = (p, dx, dy) => {
      const nx = wrapMod(p.x + dx, WIDTH);
      const ny = clampRange(p.y + dy, 0, HEIGHT - 1);
      if (nx === p.x && ny === p.y) return false;
      const collision = points.some((other) => {
        if (other === p) return false;
        return getDist({ x: nx, y: ny }, other, /*yTorus*/ false).d < MIN_DIST;
      });
      if (!collision) {
        p.x = nx;
        p.y = ny;
        return true;
      }
      return false;
    };

    const computeCenter = () => {
      const xs = points.map(p => p.x);
      const ys = points.map(p => p.y);
      const cx = torusMean1D(xs, WIDTH);
      const cy = useYtorus
        ? torusMean1D(ys, HEIGHT)
        : (ys.reduce((acc, v) => acc + v, 0) / (ys.length || 1));
      return { x: cx, y: cy };
    };

    const movePrimary = (p, dx, dy, rng) => {
      if (move(p, dx, dy)) return true;
      if (dy !== 0 && clampRange(p.y + dy, 0, HEIGHT - 1) === p.y) {
        const dxAlt = (rng() < 0.5) ? -1 : 1;
        if (move(p, dxAlt, 0)) return true;
      }
      return false;
    };

    const center = computeCenter();
    points.forEach((p, pi) => {
      const rngForMoves = (typeof deterministicSeedForMoves !== 'undefined' && deterministicSeedForMoves !== null)
        ? (createDerivedRng(deterministicSeedForMoves, 'drift-move', turn0, pi) || Math.random)
        : Math.random;

      if (isApproach) {
        const dG = getDist(p, center, useYtorus);
        const stG = stepFromVector(dG.dx, dG.dy);
        movePrimary(p, stG.dx * 2, stG.dy * 2, rngForMoves);

        let nearest = null;
        let minD = Infinity;
        for (let i = 0; i < points.length; i++) {
          const other = points[i];
          if (other === p) continue;
          const d = getDist(p, other, useYtorus).d;
          if (d < minD) {
            minD = d;
            nearest = other;
          }
        }
        if (nearest) {
          const dN = getDist(p, nearest, useYtorus);
          const stN = stepFromVector(dN.dx, dN.dy);
          movePrimary(p, stN.dx * 1, stN.dy * 1, rngForMoves);
        }

        for (let k = 0; k < 2; k++) {
          const r = RAND_DIRS_8[(rngForMoves() * RAND_DIRS_8.length) | 0];
          move(p, r.dx, r.dy);
        }
      } else {
        const cycle = turn0 % 3;
        const dG = getDist(p, center, useYtorus);
        const stG = stepFromVector(dG.dx, dG.dy);
        movePrimary(p, stG.dx * -1, stG.dy * -1, rngForMoves);

        let nearest = null, second = null;
        let minD = Infinity, secondD = Infinity;
        for (let i = 0; i < points.length; i++) {
          const other = points[i];
          if (other === p) continue;
          const d = getDist(p, other, useYtorus).d;
          if (d < minD) { secondD = minD; second = nearest; minD = d; nearest = other; }
          else if (d < secondD) { secondD = d; second = other; }
        }
        if (nearest) {
          const dN = getDist(p, nearest, useYtorus);
          const stN = stepFromVector(dN.dx, dN.dy);
          movePrimary(p, stN.dx * -1, stN.dy * -1, rngForMoves);
        }

        if (cycle === 2) {
          const r = RAND_DIRS_8[(rngForMoves() * RAND_DIRS_8.length) | 0];
          move(p, r.dx, r.dy);
          if (second) {
            const d2 = getDist(p, second, useYtorus);
            const st2 = stepFromVector(d2.dx, d2.dy);
            movePrimary(p, st2.dx * 1, st2.dy * 1, rngForMoves);
          }
        } else {
          for (let k = 0; k < 2; k++) {
            const r = RAND_DIRS_8[(rngForMoves() * RAND_DIRS_8.length) | 0];
            move(p, r.dx, r.dy);
          }
        }

        if (p.y <= 5 || p.y >= (HEIGHT - 5)) {
          const eq = (HEIGHT - 1) / 2;
          const dyToEq = (p.y < eq) ? 1 : -1;
          if (!move(p, 0, dyToEq)) {
            if (!move(p, 1, dyToEq)) {
              if (!move(p, -1, dyToEq)) {
                const dxAlt = (rngForMoves() < 0.5) ? -1 : 1;
                move(p, dxAlt, 0);
              }
            }
          }
        }
      }
    });

    const centers = points.map((p) => ({ x: p.x, y: p.y }));

    let sum = 0;
    let cnt = 0;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        sum += getDist(points[i], points[j], useYtorus).d;
        cnt += 1;
      }
    }
    const avgDist = cnt > 0 ? (sum / cnt) : 0;
    let spc = Number.isFinite(state.superPloom_calc) ? state.superPloom_calc : 0;
    const minCD = toFiniteNumber(runtime.minCenterDistance, 20);
    let baseDefault = 50 + (((minCD - 20) / 5) * 2);
    baseDefault = Math.min(baseDefault, 58);
    if (avgDist < baseDefault) {
      spc += 1;
    } else if (avgDist >= 58 && avgDist <= 62) {
      spc -= 4;
    } else if (avgDist > 62 && avgDist <= 65) {
      spc -= 2;
    } else if (avgDist > 65) {
      spc -= 1;
    }
    spc = Math.max(spc, 0);
    const superPloomHistory = Array.isArray(state.superPloom_history) ? state.superPloom_history.slice() : [];
    superPloomHistory.push(spc);
    const superPloom = (superPloomHistory.length > 1)
      ? superPloomHistory[superPloomHistory.length - 2]
      : 0;

    const nextDriftIsApproach = (isApproach && superPloom > 20)
      ? false
      : (!isApproach && superPloom === 0)
        ? true
        : isApproach;

    const driftMetrics = {
      superPloom_calc: spc,
      superPloom,
      phase: phaseName,
      avgDist
    };
    const buildSeededLog = resolveFn(runtime, 'buildSeededLog', '_buildSeededLog', resolvedDeps);
    const precomputeDriftFixedTables = resolveFn(runtime, 'precomputeDriftFixedTables', '_precomputeDriftFixedTables', resolvedDeps);
    const computeCenterParametersForDrift = resolveFn(runtime, 'computeCenterParametersForDrift', '_computeCenterParametersForDrift', resolvedDeps);
    const computeScoresThresholdAndLandMaskForDrift = resolveFn(runtime, 'computeScoresThresholdAndLandMaskForDrift', '_computeScoresThresholdAndLandMaskForDrift', resolvedDeps);
    const getSeededRng = resolveFn(runtime, 'getSeededRng', '_getSeededRng', resolvedDeps);
    const ensureRunContext = resolveFn(runtime, 'ensureRunContext', '_ensureRunContext', resolvedDeps);
    const buildWorld = resolveFn(runtime, 'buildWorld', '_buildWorld', resolvedDeps)
      || resolveFn(runtime, 'buildWorldAndEmit', '_buildWorldAndEmit', resolvedDeps);

    const seededLog = buildSeededLog.call(runtime, centers.length);
    const { glacierNoiseTable, tundraNoiseTopTable, tundraNoiseBottomTable } =
      precomputeDriftFixedTables.call(runtime, { N });
    const localCenterParameters = computeCenterParametersForDrift.call(runtime, { centers });
    const { scores, threshold, landMask } = computeScoresThresholdAndLandMaskForDrift.call(runtime, { N, centers, localCenterParameters });

    const seededRngHighlands = getSeededRng.call(runtime);
    const built = buildWorld.call(runtime, {
      emitEvent: 'drifted',
      runContext: ensureRunContext.call(runtime, { runContext, defaultRunMode: 'drift' }),
      N,
      centers,
      localCenterParameters,
      landMask,
      scores,
      threshold,
      seededRng,
      seededLog,
      glacierNoiseTable,
      tundraNoiseTopTable,
      tundraNoiseBottomTable,
      driftMetrics,
      highlandsSeededRng: seededRngHighlands || null,
      enableDerivedRngDuringHighlands: !!seededRngHighlands
    });
    const payload = (built && built.payload) ? built.payload : built;
    return {
      payload,
      state: {
        ...state,
        driftTurn: turn0 + 1,
        driftIsApproach: nextDriftIsApproach,
        superPloom_calc: spc,
        superPloom_history: superPloomHistory,
        driftMetrics,
        ...(built && built.hfCache ? { hfCache: built.hfCache } : null)
      }
    };
  } finally {
    setForceRandomDerivedRng(prevForce);
  }
}

export function runDriftWithDeps(deps, { runContext = null } = {}) {
  const runtime = buildRuntimeFromDeps(deps);
  return runDrift(runtime, { runContext, deps });
}

/**
 * Run high-frequency revise via a runtime-compatible object.
 * @param {object} runtime
 * @param {{emit?: boolean, runContext?: any}} [options]
 * @returns {TerrainEventPayload|undefined}
 */
export function runReviseHighFrequency(runtime, { emit = true, runContext = null, deps = null } = {}) {
  void emit;
  const resolvedDeps = deps || runtime.deps || null;
  const c = runtime.hfCache;
  if (!c || !c.N || !Array.isArray(c.preTundraColors)) return;

  const colors = c.preTundraColors.slice();
  const reviseReclassifyDesert = resolveFn(runtime, 'reviseReclassifyDesert', '_reviseReclassifyDesert', resolvedDeps);
  const reviseRestoreLowlandAroundLakes = resolveFn(runtime, 'reviseRestoreLowlandAroundLakes', '_reviseRestoreLowlandAroundLakes', resolvedDeps);
  const reviseComputeGlacierRows = resolveFn(runtime, 'reviseComputeGlacierRows', '_reviseComputeGlacierRows', resolvedDeps);
  const reviseApplyTundra = resolveFn(runtime, 'reviseApplyTundra', '_reviseApplyTundra', resolvedDeps);
  const reviseApplyGlaciers = resolveFn(runtime, 'reviseApplyGlaciers', '_reviseApplyGlaciers', resolvedDeps);
  const reviseRebuildGridDataAndSanitizeFeatures = resolveFn(runtime, 'reviseRebuildGridDataAndSanitizeFeatures', '_reviseRebuildGridDataAndSanitizeFeatures', resolvedDeps);
  const ensureRunContext = resolveFn(runtime, 'ensureRunContext', '_ensureRunContext', resolvedDeps);

  reviseReclassifyDesert.call(runtime, { c, colors });
  reviseRestoreLowlandAroundLakes.call(runtime, { c, colors });
  const {
    computedTopGlacierRowsLand,
    computedTopGlacierRowsWater,
    computedSmoothedTopGlacierRowsLand,
    computedSmoothedTopGlacierRowsWater
  } = reviseComputeGlacierRows.call(runtime, { c });
  reviseApplyTundra.call(runtime, { c, colors, computedTopGlacierRowsWater });
  const { computedTopGlacierRows } = reviseApplyGlaciers.call(runtime, {
    c,
    colors,
    computedTopGlacierRowsLand,
    computedTopGlacierRowsWater,
    computedSmoothedTopGlacierRowsLand,
    computedSmoothedTopGlacierRowsWater
  });
  const { gridData } = reviseRebuildGridDataAndSanitizeFeatures.call(runtime, { c, colors });
  const ensured = ensureRunContext.call(runtime, { runContext, defaultRunMode: 'revise' });
  const payload = buildTerrainEventPayload({
    eventType: 'revised',
    runMode: ensured.runMode,
    runId: ensured.runId,
    gridData,
    // reviseでは中心点/シード/比率は「既知の最新」を埋めておく（受け側の分岐削減）
    centerParameters: Array.isArray(runtime.centerParameters) ? runtime.centerParameters : [],
    deterministicSeed: (typeof runtime.deterministicSeed !== 'undefined') ? runtime.deterministicSeed : null,
    preGlacierStats: c.preGlacierStats || null,
    computedTopGlacierRows,
    driftMetrics: null,
    lowlandDistanceToSeaStats: null
  });
  return payload;
}

export function runReviseHighFrequencyWithDeps(deps, { emit = true, runContext = null } = {}) {
  const runtime = buildRuntimeFromDeps(deps);
  return runReviseHighFrequency(runtime, { emit, runContext, deps });
}
