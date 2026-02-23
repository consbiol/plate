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
const deriveEffectiveMinCenterDistance = (runtime) => (
  isFiniteNumber(runtime.minCenterDistance)
    ? Number(runtime.minCenterDistance)
    : runtime._computeEffectiveMinCenterDistance()
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

/**
 * Run full generation via a runtime-compatible object.
 * @param {object} runtime - must provide the same methods/fields as Grids_Calculation.vue
 * @param {{preserveCenterCoordinates?: boolean, runContext?: any}} [options]
 * @returns {{payload: TerrainEventPayload, state: object}}
 */
export function runGenerate(runtime, { preserveCenterCoordinates = false, runContext = null } = {}) {
  const { generationInputs, N } = runtime._buildGenerationJobSpec();
  const seededRng = runtime._getSeededRng();
  runtime._resetDriftStateForGenerate({ preserveCenterCoordinates });
  const seededLog = runtime._buildSeededLog(runtime.centersY);
  const { glacierNoiseTable, tundraNoiseTopTable, tundraNoiseBottomTable } =
    runtime._precomputeGenerateFixedTables({ N, seededRng });
  const {
    centers: centers0,
    localCenterParameters,
    seedStrictCenters,
    effectiveMinCenterDistance
  } = runtime._computeCentersAndParamsForGenerate({ preserveCenterCoordinates, seededRng });
  const { centers, scores, threshold, landMask } = runtime._computeScoresThresholdAndLandMaskForGenerate({
    N,
    centers: centers0,
    localCenterParameters,
    preserveCenterCoordinates,
    seedStrictCenters,
    seededRng,
    effectiveMinCenterDistance
  });
  const ensured = runtime._ensureRunContext({
    runContext,
    defaultRunMode: preserveCenterCoordinates ? 'update' : 'generate'
  });
  const payload = runtime._buildWorldAndEmit({
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
  return { payload, state: { lastGenerationInputs: generationInputs } };
}

export function runDrift(runtime, { runContext = null } = {}) {
  const N = runtime.gridWidth * runtime.gridHeight;
  const seededRng = null;
  const deterministicSeedForMoves = runtime.deterministicSeed;

  const prevForce = runtime.forceRandomDerivedRng;
  runtime.forceRandomDerivedRng = true;
  let state = {
    driftTurn: Number.isFinite(runtime.driftTurn) ? (runtime.driftTurn | 0) : 0,
    driftIsApproach: (typeof runtime.driftIsApproach === 'boolean') ? runtime.driftIsApproach : true,
    superPloom_calc: Number.isFinite(runtime.superPloom_calc) ? runtime.superPloom_calc : 0,
    superPloom_history: Array.isArray(runtime.superPloom_history) ? runtime.superPloom_history.slice() : [],
    driftMetrics: runtime.driftMetrics || null
  };
  try {
    const prevCenters = (runtime.hfCache && Array.isArray(runtime.hfCache.centers)) ? runtime.hfCache.centers : null;
    const effectiveMinCenterDistance = deriveEffectiveMinCenterDistance(runtime);
    const baseCenters = (prevCenters && prevCenters.length > 0)
      ? prevCenters
      : sampleLandCenters(runtime, null, effectiveMinCenterDistance);

    if (!prevCenters || prevCenters.length <= 0) {
      state = {
        ...state,
        driftTurn: 0,
        superPloom_calc: 0,
        superPloom_history: [],
        driftMetrics: null
      };
    }

    const WIDTH = runtime.gridWidth;
    const HEIGHT = runtime.gridHeight;
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
    const seededLog = runtime._buildSeededLog(centers.length);
    const { glacierNoiseTable, tundraNoiseTopTable, tundraNoiseBottomTable } =
      runtime._precomputeDriftFixedTables({ N });
    const localCenterParameters = runtime._computeCenterParametersForDrift({ centers });
    const { scores, threshold, landMask } = runtime._computeScoresThresholdAndLandMaskForDrift({ N, centers, localCenterParameters });

    const seededRngHighlands = runtime._getSeededRng();
    const payload = runtime._buildWorldAndEmit({
      emitEvent: 'drifted',
      runContext: runtime._ensureRunContext({ runContext, defaultRunMode: 'drift' }),
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
    return {
      payload,
      state: {
        ...state,
        driftTurn: turn0 + 1,
        driftIsApproach: nextDriftIsApproach,
        superPloom_calc: spc,
        superPloom_history: superPloomHistory,
        driftMetrics
      }
    };
  } finally {
    runtime.forceRandomDerivedRng = prevForce;
  }
}

/**
 * Run high-frequency revise via a runtime-compatible object.
 * @param {object} runtime
 * @param {{emit?: boolean, runContext?: any}} [options]
 * @returns {TerrainEventPayload|undefined}
 */
export function runReviseHighFrequency(runtime, { emit = true, runContext = null } = {}) {
  const c = runtime.hfCache;
  if (!c || !c.N || !Array.isArray(c.preTundraColors)) return;

  const colors = c.preTundraColors.slice();
  runtime._reviseReclassifyDesert({ c, colors });
  runtime._reviseRestoreLowlandAroundLakes({ c, colors });
  const {
    computedTopGlacierRowsLand,
    computedTopGlacierRowsWater,
    computedSmoothedTopGlacierRowsLand,
    computedSmoothedTopGlacierRowsWater
  } = runtime._reviseComputeGlacierRows({ c });
  runtime._reviseApplyTundra({ c, colors, computedTopGlacierRowsWater });
  const { computedTopGlacierRows } = runtime._reviseApplyGlaciers({
    c,
    colors,
    computedTopGlacierRowsLand,
    computedTopGlacierRowsWater,
    computedSmoothedTopGlacierRowsLand,
    computedSmoothedTopGlacierRowsWater
  });
  const { gridData } = runtime._reviseRebuildGridDataAndSanitizeFeatures({ c, colors });
  const ensured = runtime._ensureRunContext({ runContext, defaultRunMode: 'revise' });
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
  if (emit && typeof runtime.$emit === 'function') runtime.$emit('revised', payload);
  return payload;
}
