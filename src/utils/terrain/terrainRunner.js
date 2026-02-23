// Terrain generation runner helpers.
// These are extracted from Grids_Calculation.vue so the heavy logic can be reused
// in a Web Worker by providing a compatible runtime object.
import { createDerivedRng } from '../rng.js';
import { sampleLandCenters } from './centers.js';
import { buildTerrainEventPayload } from './output.js';

const RAND_DIRS_8 = Object.freeze([
  { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
  { dx: 1, dy: 1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 }
]);

const clampRange = (value, min, max) => Math.max(min, Math.min(max, value));
const wrapMod = (value, mod) => ((value % mod) + mod) % mod;

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
 * @returns {TerrainEventPayload}
 */
export function runGenerate(runtime, { preserveCenterCoordinates = false, runContext = null } = {}) {
  const { generationInputs, N } = runtime._buildGenerationJobSpec();
  runtime.lastGenerationInputs = generationInputs;
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
  return runtime._buildWorldAndEmit({
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
}

/**
 * Run one drift turn via a runtime-compatible object.
 * @param {object} runtime
 * @param {{runContext?: any}} [options]
 * @returns {TerrainEventPayload}
 */
export function runDrift(runtime, { runContext = null } = {}) {
  const N = runtime.gridWidth * runtime.gridHeight;
  // Driftでは決定論RNGは原則無効（ノイズはランダム化）だが、いくつかの処理は seededRng 引数を取るため null を用いる
  const seededRng = null;
  // ドリフト内の「ランダム移動」はシード固定化する（ただし毎ターン同じ方向に固定されないように turn/点index を混ぜる）
  // NOTE: runtime._getSeededRng() を毎回作ると乱数列が毎ターン先頭から同じになり「永遠に同じ2方向を引き続ける」ため、
  //       衝突判定で弾かれたケースで停止しやすい。createDerivedRng を直接使って turn を混ぜる。
  const deterministicSeedForMoves = runtime.deterministicSeed;

  // Drift中は deterministicSeed 由来の派生RNG（shape-profile等）を無効化
  const prevForce = runtime.forceRandomDerivedRng;
  runtime.forceRandomDerivedRng = true;
  try {
    // centers はキャッシュ優先。無ければ通常サンプリングにフォールバック。
    const prevCenters = (runtime.hfCache && Array.isArray(runtime.hfCache.centers)) ? runtime.hfCache.centers : null;
    // 「中心間の排他距離 (グリッド)」は既存設定（prop）を優先して使用
    const effectiveMinCenterDistance = Number.isFinite(Number(runtime.minCenterDistance))
      ? Number(runtime.minCenterDistance)
      : runtime._computeEffectiveMinCenterDistance();
    const baseCenters = (prevCenters && prevCenters.length > 0)
      ? prevCenters
      : sampleLandCenters(runtime, null, effectiveMinCenterDistance);

    // 初回（Generateを経ずにDriftした等）はドリフト状態をリセット
    if (!prevCenters || prevCenters.length <= 0) {
      runtime.driftTurn = 0;
      runtime.superPloom_calc = 0;
      runtime.superPloom_history = [];
      runtime.driftMetrics = null;
    }

    const WIDTH = runtime.gridWidth;
    const HEIGHT = runtime.gridHeight;
    const MIN_DIST = Number(effectiveMinCenterDistance) || 1;

    // 点配列（整数格子上で動かす）
    const points = baseCenters.map((c) => ({
      x: wrapMod(Math.floor(c.x), WIDTH),
      y: clampRange(Math.floor(c.y), 0, HEIGHT - 1)
    }));

    // フェーズ判定: 動的に切り替える（runtime.driftIsApproach により管理）
    const turn0 = Number.isFinite(runtime.driftTurn) ? (runtime.driftTurn | 0) : 0;
    const isApproach = (typeof runtime.driftIsApproach === 'boolean') ? runtime.driftIsApproach : true;
    const phaseName = isApproach ? 'Approach' : 'Repel';
    // 距離計算: xは常にトーラス、yは Repel のみトーラス
    const useYtorus = !isApproach;

    // getDist: 最短距離（dx,dy）を返す。xは常にトーラス。yは useYtorus=true の場合のみトーラス。
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

    // 移動処理の核: 1グリッド移動を試行し、衝突（最小距離違反）ならキャンセル
    // NOTE:
    // - 反発フェーズでは「距離計算」は上下トーラスを使うが、
    //   実際の座標は上下を越えられない（クランプ）ため、
    //   最小距離維持（衝突判定）まで上下トーラスにすると「端同士」が近接扱いになり
    //   端から離脱できず張り付く原因になる。
    // - そのため衝突判定は「xのみトーラス」「yは通常差分（非トーラス）」で行う。
    const move = (p, dx, dy) => {
      const nx = wrapMod(p.x + dx, WIDTH);
      const ny = clampRange(p.y + dy, 0, HEIGHT - 1);
      // クランプ等で座標が変わらないなら「移動できなかった」とみなす（張り付き/空振り対策）
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

    // 重心法/最近点法の「意図した1歩」が端クランプ等で無効になった時のフォールバック
    const movePrimary = (p, dx, dy, rng) => {
      if (move(p, dx, dy)) return true;
      // y方向が端でクランプされる（＝動けない）なら、横へ逃がす
      if (dy !== 0 && clampRange(p.y + dy, 0, HEIGHT - 1) === p.y) {
        const dxAlt = (rng() < 0.5) ? -1 : 1;
        if (move(p, dxAlt, 0)) return true;
      }
      return false;
    };

    // --- 1ターン分の移動 ---
    const center = computeCenter();
    points.forEach((p, pi) => {
      // 点ごとの乱数源（turn0 と点index を混ぜる）
      const rngForMoves = (typeof deterministicSeedForMoves !== 'undefined' && deterministicSeedForMoves !== null)
        ? (createDerivedRng(deterministicSeedForMoves, 'drift-move', turn0, pi) || Math.random)
        : Math.random;

      if (isApproach) {
        // Approach: centroid -> nearest -> random x2
        const dG = getDist(p, center, useYtorus);
        const stG = stepFromVector(dG.dx, dG.dy);
        // 接近フェーズ1: 重心法で2グリッド接近に変更
        movePrimary(p, stG.dx * 2, stG.dy * 2, rngForMoves);

        // nearest approach
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
        // Repel: 3-turn cycle
        const cycle = turn0 % 3;
        // 1) centroid repel
        const dG = getDist(p, center, useYtorus);
        const stG = stepFromVector(dG.dx, dG.dy);
        movePrimary(p, stG.dx * -1, stG.dy * -1, rngForMoves);

        // 2) nearest repel (and also find second nearest)
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
          // third turn: random once + approach to second-nearest
          const r = RAND_DIRS_8[(rngForMoves() * RAND_DIRS_8.length) | 0];
          move(p, r.dx, r.dy);
          if (second) {
            const d2 = getDist(p, second, useYtorus);
            const st2 = stepFromVector(d2.dx, d2.dy);
            movePrimary(p, st2.dx * 1, st2.dy * 1, rngForMoves);
          }
        } else {
          // first two turns: random x2
          for (let k = 0; k < 2; k++) {
            const r = RAND_DIRS_8[(rngForMoves() * RAND_DIRS_8.length) | 0];
            move(p, r.dx, r.dy);
          }
        }

        // repel特有: 上下端5グリッド以内なら赤道へ 1
        if (p.y <= 5 || p.y >= (HEIGHT - 5)) {
          const eq = (HEIGHT - 1) / 2;
          const dyToEq = (p.y < eq) ? 1 : -1;
          // まず直進、ダメなら斜め/横を試して「張り付き」を避ける
          if (!move(p, 0, dyToEq)) {
            if (!move(p, 1, dyToEq)) {
              if (!move(p, -1, dyToEq)) {
                // 最後の保険: 横に1（トーラス）だけでも動けるなら動かす
                const dxAlt = (rngForMoves() < 0.5) ? -1 : 1;
                move(p, dxAlt, 0);
              }
            }
          }
        }
      }
    });

    const centers = points.map((p) => ({ x: p.x, y: p.y }));

    // --- superPloom 更新（7点間平均距離） ---
    let sum = 0;
    let cnt = 0;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        sum += getDist(points[i], points[j], useYtorus).d;
        cnt += 1;
      }
    }
    const avgDist = cnt > 0 ? (sum / cnt) : 0;
    let spc = Number.isFinite(runtime.superPloom_calc) ? runtime.superPloom_calc : 0;
    // 既定値は minCenterDistance に依存
    const minCD = Number.isFinite(Number(runtime.minCenterDistance)) ? Number(runtime.minCenterDistance) : 20;
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
    runtime.superPloom_calc = spc;
    if (!Array.isArray(runtime.superPloom_history)) runtime.superPloom_history = [];
    runtime.superPloom_history.push(spc);
    // 厳密な遅延を1ターンにする: 直前ターンの値を参照する
    const superPloom = (runtime.superPloom_history.length > 1)
      ? runtime.superPloom_history[runtime.superPloom_history.length - 2]
      : 0;

    // フェーズ切替: 接近側で superPloom > 30 -> 反発へ。反発で superPloom == 0 -> 接近へ。
    if (isApproach && superPloom > 20) {
      runtime.driftIsApproach = false;
    } else if (!isApproach && superPloom === 0) {
      runtime.driftIsApproach = true;
    }

    // ターンを進める（ドリフト実行1回 = 1ターン）
    runtime.driftTurn = turn0 + 1;

    // 出力用メトリクス（Parameters Output で表示）
    runtime.driftMetrics = {
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

    // Driftでは「ノイズは全再抽選」だが、高地の個数/クラスター（開始セル/サイズ）は
    // deterministicSeed が指定されている場合に限りシード固定にする。
    const seededRngHighlands = runtime._getSeededRng();
    return runtime._buildWorldAndEmit({
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
      driftMetrics: runtime.driftMetrics,
      highlandsSeededRng: seededRngHighlands || null,
      enableDerivedRngDuringHighlands: !!seededRngHighlands
    });
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
