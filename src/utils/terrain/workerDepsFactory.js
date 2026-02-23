import { createSeededRng, createDerivedRng } from '../rng.js';
import { buildGenerationJobInputs } from './jobInputs.js';
import { sampleLandCenters, computeScoresForCenters, computeOwnerCenterIdx, computeEffectiveMinCenterDistance } from './centers.js';
import { buildVisualNoiseGrid, getDirections8 } from './noiseGrid.js';
import { computeDistanceMap } from '../pathfinding/distanceMap.js';
import { classifyBaseColors } from './classifyColors.js';
import { buildCenterLandCells } from './centerCells.js';
import { generateLakes, applyLakeColors, applyLowlandAroundLakes } from './lakes.js';
import { generateHighlands } from './highlands.js';
import { generateAlpines } from './alpines.js';
import { applyTundra } from './tundra.js';
import { applyGlaciers } from './glaciers.js';
import { generateFeatures } from './features.js';
import { buildGridData, markCentersOnGridData } from './gridData.js';
import { applySeededLogToCenterParameters } from './centerParams.js';
import { computePreGlacierStats, buildGeneratedPayload } from './output.js';
import { computeTopGlacierRowsPure, computeTopGlacierRowsFromAverageTemperature, getSmoothedGlacierRows } from './glacierRows.js';
import { mapSeaLandRatio } from './ratio.js';
import { dilateLandMask, removeSingleCellIslands, jitterCoastline } from './landmask.js';
import { torusWrap, torusDistance, torusDirection } from '../torus.js';
import { noise2D, fractalNoise2D } from '../noise.js';
import { poissonSample } from '../stats/poisson.js';
import { getEraTerrainColors, getDefaultTerrainColors } from '../colors.js';
import { getBiasedCityProbability } from './features/probability.js';
export function createWorkerDeps({ depsSnapshot = null, overrides = null } = {}) {
  const base = depsSnapshot && typeof depsSnapshot === 'object' ? depsSnapshot : {};
  const deps = {
    props: base.props || {},
    state: base.state || {},
    hfCache: base.hfCache || null
  };
  if (overrides && typeof overrides === 'object') {
    return { ...deps, ...overrides };
  }
  return deps;
}

export function createWorkerDepsWithFunctions({ depsSnapshot = null, functions = null, overrides = null } = {}) {
  const base = createWorkerDeps({ depsSnapshot, overrides });
  if (functions && typeof functions === 'object') {
    return { ...base, ...functions };
  }
  return base;
}

export function createDefaultWorkerDepsFunctions({ depsSnapshot = null } = {}) {
  const props = (depsSnapshot && depsSnapshot.props) ? depsSnapshot.props : {};
  const state = (depsSnapshot && depsSnapshot.state) ? depsSnapshot.state : {};
  const internal = {
    forceRandomDerivedRng: false,
    _glacierRowsState: {},
    wobbleRowsFixed: null,
    wobbleShiftByX: null,
    baseLandDistanceThresholdFixed: null,
    emitSeq: 0,
    generationInputs: null,
    hfCache: depsSnapshot && depsSnapshot.hfCache ? depsSnapshot.hfCache : null
  };

  const getProp = (key, fallback = null) => (
    Object.prototype.hasOwnProperty.call(props, key) ? props[key] : fallback
  );
  const getInput = (key, fallback = null) => (
    internal.generationInputs && Object.prototype.hasOwnProperty.call(internal.generationInputs, key)
      ? internal.generationInputs[key]
      : getProp(key, fallback)
  );

  const getDerivedRng = (...labels) => (
    internal.forceRandomDerivedRng ? null : createDerivedRng(getProp('deterministicSeed', null), ...labels)
  );
  const torusWrapFn = (x, y) => torusWrap(getProp('gridWidth', 0), getProp('gridHeight', 0), x, y);
  const torusDistanceFn = (x1, y1, x2, y2) => torusDistance(getProp('gridWidth', 0), getProp('gridHeight', 0), x1, y1, x2, y2);
  const torusDirectionFn = (x1, y1, x2, y2) => torusDirection(getProp('gridWidth', 0), getProp('gridHeight', 0), x1, y1, x2, y2);
  const poissonSampleFn = (lambda, maxK = 20, rng = null) => poissonSample(lambda, maxK, rng);

  const getGlacierRowsStateAccessors = (stateKey) => {
    if (!internal._glacierRowsState[stateKey]) {
      internal._glacierRowsState[stateKey] = {
        internalTopGlacierRows: null,
        lastReturnedGlacierRows: null
      };
    }
    const s = internal._glacierRowsState[stateKey];
    return {
      getInternal: () => s.internalTopGlacierRows,
      setInternal: (v) => { s.internalTopGlacierRows = v; },
      getLast: () => s.lastReturnedGlacierRows,
      setLast: (v) => { s.lastReturnedGlacierRows = v; }
    };
  };

  const getLatBandIndex = (y, x) => {
    const wobbleRows = (internal.wobbleRowsFixed != null)
      ? Math.max(0, Math.floor(internal.wobbleRowsFixed || 0))
      : Math.max(0, Math.floor(getInput('landBandVerticalWobbleRows', 0) || 0));
    let yShifted = y;
    if (wobbleRows > 0) {
      const pre = internal.wobbleShiftByX && Number.isFinite(internal.wobbleShiftByX[x]) ? internal.wobbleShiftByX[x] : 0;
      yShifted = Math.max(0, Math.min(getProp('gridHeight', 0) - 1, y + pre));
    }
    const dPole = Math.min(yShifted, getProp('gridHeight', 0) - 1 - yShifted);
    const band = Math.floor(dPole / 5) + 1;
    return Math.min(10, Math.max(1, band));
  };
  const getLandDistanceThresholdForRow = (y, x) => {
    const idx = getLatBandIndex(y, x);
    const key = `landDistanceThreshold${idx}`;
    const v = Number(getInput(key, null));
    return Number.isFinite(v) ? v : 0;
  };

  const ensureRunContext = ({ runContext = null, defaultRunMode = null } = {}) => {
    const rc = runContext || null;
    const runMode = (rc && rc.runMode) ? rc.runMode : (defaultRunMode || null);
    const hasRunId = rc && (typeof rc.runId !== 'undefined') && rc.runId !== null;
    const runId = hasRunId ? rc.runId : `${Date.now()}-${++internal.emitSeq}`;
    return { runMode, runId };
  };

  const computeGlacierRowsForRatio = ({ ratioOcean, climateRawC }) => {
    if (Number.isFinite(climateRawC)) {
      const computedTopGlacierRowsLand = computeTopGlacierRowsPure(climateRawC, ratioOcean, 'land');
      const computedTopGlacierRowsWater = computeTopGlacierRowsPure(climateRawC, 0.7, 'water');
      return {
        computedTopGlacierRowsLand,
        computedTopGlacierRowsWater,
        computedSmoothedTopGlacierRowsLand: computedTopGlacierRowsLand,
        computedSmoothedTopGlacierRowsWater: computedTopGlacierRowsWater
      };
    }
    const averageTemperature = getInput('averageTemperature', 15);
    const glacierAlpha = getInput('glacier_alpha', null);
    const seaLandRatio = getInput('seaLandRatio', 0.7);
    return {
      computedTopGlacierRowsLand: computeTopGlacierRowsFromAverageTemperature({
        averageTemperature,
        glacierAlpha,
        seaLandRatio,
        state: getGlacierRowsStateAccessors('land')
      }, ratioOcean, 'land'),
      computedTopGlacierRowsWater: computeTopGlacierRowsFromAverageTemperature({
        averageTemperature,
        glacierAlpha,
        seaLandRatio,
        state: getGlacierRowsStateAccessors('water')
      }, 0.7, 'water'),
      computedSmoothedTopGlacierRowsLand: getSmoothedGlacierRows({ state: getGlacierRowsStateAccessors('land') }, ratioOcean, 'land'),
      computedSmoothedTopGlacierRowsWater: getSmoothedGlacierRows({ state: getGlacierRowsStateAccessors('water') }, 0.7, 'water')
    };
  };

  const buildWorld = ({
    emitEvent,
    runContext = null,
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
    driftMetrics = null,
    highlandsSeededRng = null,
    enableDerivedRngDuringHighlands = false
  }) => {
    const gridWidth = getProp('gridWidth', 0);
    const gridHeight = getProp('gridHeight', 0);
    const era = getInput('era', null);
    const seaLandRatio = getInput('seaLandRatio', 0.3);
    const kDecay = getInput('kDecay', 2.0);
    const noiseAmp = getInput('noiseAmp', 0.08);
    const centerBias = getInput('centerBias', 0);

    const ctx = {
      gridWidth,
      gridHeight,
      era,
      seaLandRatio,
      kDecay,
      noiseAmp,
      centerBias,
      baseSeaDistanceThreshold: getInput('baseSeaDistanceThreshold', 0),
      baseLandDistanceThreshold: getInput('baseLandDistanceThreshold', 0),
      landBandVerticalWobbleRows: getInput('landBandVerticalWobbleRows', 0),
      averageLakesPerCenter: getInput('averageLakesPerCenter', 1),
      averageHighlandsPerCenter: getInput('averageHighlandsPerCenter', 1),
      cityGenerationProbability: getInput('cityGenerationProbability', 0),
      cultivatedGenerationProbability: getInput('cultivatedGenerationProbability', 0),
      bryophyteGenerationProbability: getInput('bryophyteGenerationProbability', 0),
      pollutedAreasCount: getInput('pollutedAreasCount', 0),
      seaCityGenerationProbability: getInput('seaCityGenerationProbability', 0),
      seaCultivatedGenerationProbability: getInput('seaCultivatedGenerationProbability', 0),
      seaPollutedAreasCount: getInput('seaPollutedAreasCount', 0),
      landGlacierExtraRows: getInput('landGlacierExtraRows', 0),
      highlandGlacierExtraRows: getInput('highlandGlacierExtraRows', 0),
      alpineGlacierExtraRows: getInput('alpineGlacierExtraRows', 0),
      topTundraRows: getInput('topTundraRows', 0),
      topGlacierRows: getInput('topGlacierRows', 0),
      showCentersRed: !!getInput('showCentersRed', false),
      torusWrap: torusWrapFn,
      torusDistance: torusDistanceFn,
      torusDirection: torusDirectionFn,
      noise2D,
      fractalNoise2D,
      _getDerivedRng: (...labels) => getDerivedRng(...labels),
      _poissonSample: (...args) => poissonSampleFn(...args),
      _getLandDistanceThresholdForRow: (y, x) => getLandDistanceThresholdForRow(y, x)
    };

    const noiseGrid = buildVisualNoiseGrid({
      gridWidth,
      gridHeight,
      era,
      derivedRng: (...labels) => getDerivedRng(...labels)
    }, { N, seededRng });
    const ownerCenterIdx = computeOwnerCenterIdx({ gridWidth, gridHeight, torusDistance: torusDistanceFn }, centers);

    const dilated = dilateLandMask(ctx, {
      landMask,
      scores,
      threshold,
      expansionBias: 0.12,
      maxIterations: 10
    });
    const noIslands = removeSingleCellIslands(ctx, {
      landMask: dilated,
      seededRng,
      singleCellRemovalProb: getInput('singleCellRemovalProb', 0.5)
    });
    const preJitterLandMask = noIslands.slice();
    const refinedLandMask = jitterCoastline(ctx, {
      landMask: noIslands,
      scores,
      threshold,
      seededRng
    });

    const seaNoiseAmplitude = 1.5;
    const landNoiseAmplitude = 2.5;
    const tc = era ? getEraTerrainColors(era) : getDefaultTerrainColors();
    const deepSeaColor = tc.deepSea;
    const shallowSeaColor = tc.shallowSea;
    const lowlandColor = tc.lowland;
    const desertColor = tc.desert;
    const highlandColor = tc.highland;
    const alpineColor = tc.alpine;
    const tundraColor = tc.tundra;
    const glacierColor = tc.glacier;
    const directions = getDirections8();

    const landSources = [];
    for (let gy = 0; gy < gridHeight; gy++) {
      for (let gx = 0; gx < gridWidth; gx++) {
        const idx = gy * gridWidth + gx;
        if (refinedLandMask[idx]) landSources.push({ x: gx, y: gy });
      }
    }
    const distanceToLand = computeDistanceMap({
      sources: landSources,
      N,
      directions,
      gridWidth,
      torusWrap: (x, y) => torusWrapFn(x, y),
      torusDistance: (x1, y1, x2, y2) => torusDistanceFn(x1, y1, x2, y2)
    });
    const seaSources = [];
    for (let gy = 0; gy < gridHeight; gy++) {
      for (let gx = 0; gx < gridWidth; gx++) {
        const idx = gy * gridWidth + gx;
        if (!refinedLandMask[idx]) seaSources.push({ x: gx, y: gy });
      }
    }
    const distanceToSea = computeDistanceMap({
      sources: seaSources,
      N,
      directions,
      gridWidth,
      torusWrap: (x, y) => torusWrapFn(x, y),
      torusDistance: (x1, y1, x2, y2) => torusDistanceFn(x1, y1, x2, y2)
    });

    const colors = classifyBaseColors({
      gridWidth,
      gridHeight,
      baseSeaDistanceThreshold: getInput('baseSeaDistanceThreshold', 0),
      getLandDistanceThresholdForRow: (gy, gx) => getLandDistanceThresholdForRow(gy, gx)
    }, {
      N,
      landMask: refinedLandMask,
      noiseGrid,
      distanceToSea,
      distanceToLand,
      seaNoiseAmplitude,
      landNoiseAmplitude,
      deepSeaColor,
      shallowSeaColor,
      lowlandColor,
      desertColor
    });

    const { centerLandCells, centerLandCellsPre } = buildCenterLandCells({ gridWidth, gridHeight }, {
      centers,
      ownerCenterIdx,
      landMask: refinedLandMask,
      preLandMask: preJitterLandMask
    });
    const { lakeMask, lakesList } = generateLakes(ctx, centers, centerLandCells, refinedLandMask, seededRng, seededLog);
    applyLakeColors(colors, lakeMask, shallowSeaColor);
    applyLowlandAroundLakes({
      gridWidth,
      gridHeight,
      torusWrap: torusWrapFn,
      _getLandDistanceThresholdForRow: (y, x) => getLandDistanceThresholdForRow(y, x)
    }, {
      colors,
      lakesList,
      lakeMask,
      baseLandThr: getInput('baseLandDistanceThreshold', 0),
      desertColor,
      lowlandColor
    });

    const highlandMask = generateHighlands(ctx, centers, centerLandCellsPre, preJitterLandMask, lakeMask, (highlandsSeededRng || seededRng), seededLog);
    for (let i = 0; i < highlandMask.length; i++) {
      if (highlandMask[i]) colors[i] = highlandColor;
    }
    if (highlandsSeededRng && enableDerivedRngDuringHighlands) {
      const prevForce = internal.forceRandomDerivedRng;
      internal.forceRandomDerivedRng = false;
      internal.forceRandomDerivedRng = prevForce;
    }

    generateAlpines({ gridWidth, gridHeight, torusWrap: torusWrapFn }, colors, highlandColor, lowlandColor, desertColor, alpineColor, getDirections8());

    const preTundraColors = colors.slice();
    const preGlacierStats = computePreGlacierStats({ N, landMask: refinedLandMask, lakeMask });
    const ratioOcean = preGlacierStats.seaCount / (preGlacierStats.total || 1);
    const glacierRows = computeGlacierRowsForRatio({ ratioOcean, climateRawC: null });
    const {
      computedTopGlacierRowsLand,
      computedTopGlacierRowsWater,
      computedSmoothedTopGlacierRowsLand,
      computedSmoothedTopGlacierRowsWater
    } = glacierRows;
    const tundraExtraRows = Number.isFinite(Number(getInput('tundraExtraRows', null)))
      ? Math.max(0, Number(getInput('tundraExtraRows', 0)))
      : Math.max(0, (getInput('topTundraRows', 0) || 0) - (getInput('topGlacierRows', 0) || 0));
    const computedTopTundraRows = Math.max(0, computedTopGlacierRowsWater + tundraExtraRows);
    applyTundra({
      gridWidth,
      gridHeight,
      era,
      derivedRng: (...labels) => getDerivedRng(...labels),
      topTundraRows: getInput('topTundraRows', 0)
    }, {
      colors,
      landNoiseAmplitude,
      lowlandColor,
      tundraColor,
      computedTopTundraRows,
      tundraNoiseTableTop: tundraNoiseTopTable,
      tundraNoiseTableBottom: tundraNoiseBottomTable
    });

    const computedTopGlacierRows = computedTopGlacierRowsLand;
    applyGlaciers({
      gridWidth,
      gridHeight,
      landGlacierExtraRows: getInput('landGlacierExtraRows', 0),
      highlandGlacierExtraRows: getInput('highlandGlacierExtraRows', 0),
      alpineGlacierExtraRows: getInput('alpineGlacierExtraRows', 0)
    }, {
      colors,
      glacierNoiseTable,
      landNoiseAmplitude,
      computedTopGlacierRows,
      computedTopGlacierRowsLand,
      computedTopGlacierRowsWater,
      computedSmoothedTopGlacierRowsLand,
      computedSmoothedTopGlacierRowsWater,
      shallowSeaColor,
      deepSeaColor,
      lowlandColor,
      tundraColor,
      desertColor,
      highlandColor,
      alpineColor,
      glacierColor,
      landMask: refinedLandMask,
      lakeMask
    });

    const features = generateFeatures(ctx, {
      N,
      landMask: refinedLandMask,
      colors,
      lowlandColor,
      shallowSeaColor,
      seededRng,
      derivedRng: (...labels) => getDerivedRng(...labels)
    });

    const gridData = buildGridData({
      gridWidth,
      gridHeight
    }, {
      N,
      colors,
      landMask: refinedLandMask,
      lakeMask,
      shallowSeaColor,
      lowlandColor,
      highlandColor,
      alpineColor,
      tundraColor,
      glacierColor,
      desertColor,
      cityMask: features.cityMask,
      cultivatedMask: features.cultivatedMask,
      bryophyteMask: features.bryophyteMask,
      pollutedMask: features.pollutedMask,
      seaCityMask: features.seaCityMask,
      seaCultivatedMask: features.seaCultivatedMask,
      seaPollutedMask: features.seaPollutedMask
    });
    applySeededLogToCenterParameters({
      centers,
      centerParameters: localCenterParameters,
      seededLog
    });
    markCentersOnGridData({
      gridWidth,
      gridHeight,
      showCentersRed: !!getInput('showCentersRed', false)
    }, { gridData, centers });

    internal.hfCache = {
      N,
      centers,
      landMask: refinedLandMask,
      lakeMask,
      lakesList: lakesList || [],
      noiseGrid,
      distanceToSea,
      distanceToLand,
      preTundraColors,
      glacierNoiseTable,
      tundraNoiseTopTable,
      tundraNoiseBottomTable,
      shallowSeaColor,
      deepSeaColor,
      lowlandColor,
      desertColor,
      highlandColor,
      alpineColor,
      tundraColor,
      glacierColor,
      seaNoiseAmplitude,
      landNoiseAmplitude,
      preGlacierStats,
      gridDataBase: gridData
    };

    const ensured = ensureRunContext({
      runContext,
      defaultRunMode: (emitEvent === 'drifted') ? 'drift' : null
    });
    const payload = buildGeneratedPayload({
      eventType: emitEvent,
      runMode: ensured.runMode,
      runId: ensured.runId,
      centerParameters: localCenterParameters,
      gridData,
      deterministicSeed: getProp('deterministicSeed', null),
      preGlacierStats,
      computedTopGlacierRows,
      ...(driftMetrics ? { driftMetrics } : null)
    });
    return { payload, hfCache: internal.hfCache };
  };

  const reviseReclassifyDesert = ({ c, colors }) => {
    for (let gy = 0; gy < getProp('gridHeight', 0); gy++) {
      for (let gx = 0; gx < getProp('gridWidth', 0); gx++) {
        const idx = gy * getProp('gridWidth', 0) + gx;
        if (!c.landMask[idx]) continue;
        if (c.lakeMask && c.lakeMask[idx]) continue;
        const col = colors[idx];
        if (col === c.highlandColor || col === c.alpineColor) continue;
        const n = c.noiseGrid[idx];
        const bandThreshold = getLandDistanceThresholdForRow(gy, gx);
        const landThreshold = bandThreshold + n * c.landNoiseAmplitude;
        colors[idx] = c.distanceToSea[idx] > landThreshold ? c.desertColor : c.lowlandColor;
      }
    }
  };
  const reviseRestoreLowlandAroundLakes = ({ c, colors }) => {
    const baseLandThr = (internal.baseLandDistanceThresholdFixed != null)
      ? internal.baseLandDistanceThresholdFixed
      : getInput('baseLandDistanceThreshold', 0);
    applyLowlandAroundLakes({
      gridWidth: getProp('gridWidth', 0),
      gridHeight: getProp('gridHeight', 0),
      torusWrap: torusWrapFn,
      _getLandDistanceThresholdForRow: (y, x) => getLandDistanceThresholdForRow(y, x)
    }, {
      colors,
      lakesList: c.lakesList || [],
      lakeMask: c.lakeMask,
      baseLandThr,
      desertColor: c.desertColor,
      lowlandColor: c.lowlandColor
    });
  };
  const reviseComputeGlacierRows = ({ c }) => {
    const ratioOcean = (c.preGlacierStats && c.preGlacierStats.total)
      ? (c.preGlacierStats.seaCount / (c.preGlacierStats.total || 1))
      : 0.7;
    return computeGlacierRowsForRatio({ ratioOcean, climateRawC: null });
  };
  const reviseApplyTundra = ({ c, colors, computedTopGlacierRowsWater }) => {
    const tundraExtraRows = Number.isFinite(Number(getInput('tundraExtraRows', null)))
      ? Math.max(0, Number(getInput('tundraExtraRows', 0)))
      : Math.max(0, (getInput('topTundraRows', 0) || 0) - (getInput('topGlacierRows', 0) || 0));
    const computedTopTundraRows = Math.max(0, computedTopGlacierRowsWater + tundraExtraRows);
    applyTundra({
      gridWidth: getProp('gridWidth', 0),
      gridHeight: getProp('gridHeight', 0),
      era: getInput('era', null),
      derivedRng: (...labels) => getDerivedRng(...labels),
      topTundraRows: getInput('topTundraRows', 0)
    }, {
      colors,
      landNoiseAmplitude: c.landNoiseAmplitude,
      lowlandColor: c.lowlandColor,
      tundraColor: c.tundraColor,
      computedTopTundraRows,
      tundraNoiseTableTop: c.tundraNoiseTopTable,
      tundraNoiseTableBottom: c.tundraNoiseBottomTable
    });
    return { computedTopTundraRows };
  };
  const reviseApplyGlaciers = ({
    c,
    colors,
    computedTopGlacierRowsLand,
    computedTopGlacierRowsWater,
    computedSmoothedTopGlacierRowsLand,
    computedSmoothedTopGlacierRowsWater
  }) => {
    const computedTopGlacierRows = computedTopGlacierRowsLand;
    applyGlaciers({
      gridWidth: getProp('gridWidth', 0),
      gridHeight: getProp('gridHeight', 0),
      landGlacierExtraRows: getInput('landGlacierExtraRows', 0),
      highlandGlacierExtraRows: getInput('highlandGlacierExtraRows', 0),
      alpineGlacierExtraRows: getInput('alpineGlacierExtraRows', 0)
    }, {
      colors,
      glacierNoiseTable: c.glacierNoiseTable,
      landNoiseAmplitude: c.landNoiseAmplitude,
      computedTopGlacierRows,
      computedTopGlacierRowsLand,
      computedTopGlacierRowsWater,
      computedSmoothedTopGlacierRowsLand,
      computedSmoothedTopGlacierRowsWater,
      shallowSeaColor: c.shallowSeaColor,
      deepSeaColor: c.deepSeaColor,
      lowlandColor: c.lowlandColor,
      tundraColor: c.tundraColor,
      desertColor: c.desertColor,
      highlandColor: c.highlandColor,
      alpineColor: c.alpineColor,
      glacierColor: c.glacierColor,
      landMask: c.landMask,
      lakeMask: c.lakeMask
    });
    return { computedTopGlacierRows };
  };
  const reviseRebuildGridDataAndSanitizeFeatures = ({ c, colors }) => {
    const N = c.N;
    const base = Array.isArray(c.gridDataBase) ? c.gridDataBase : [];
    const cityMask = new Array(N).fill(false);
    const cultivatedMask = new Array(N).fill(false);
    const bryophyteMask = new Array(N).fill(false);
    const pollutedMask = new Array(N).fill(false);
    const seaCityMask = new Array(N).fill(false);
    const seaCultivatedMask = new Array(N).fill(false);
    const seaPollutedMask = new Array(N).fill(false);
    for (let i = 0; i < N; i++) {
      const cell = base[i];
      if (!cell) continue;
      cityMask[i] = !!cell.city;
      cultivatedMask[i] = !!cell.cultivated;
      bryophyteMask[i] = !!cell.bryophyte;
      pollutedMask[i] = !!cell.polluted;
      seaCityMask[i] = !!cell.seaCity;
      seaCultivatedMask[i] = !!cell.seaCultivated;
      seaPollutedMask[i] = !!cell.seaPolluted;
    }
    const gridData = buildGridData({ gridWidth: getProp('gridWidth', 0), gridHeight: getProp('gridHeight', 0) }, {
      N,
      colors,
      landMask: c.landMask,
      lakeMask: c.lakeMask,
      shallowSeaColor: c.shallowSeaColor,
      lowlandColor: c.lowlandColor,
      highlandColor: c.highlandColor,
      alpineColor: c.alpineColor,
      tundraColor: c.tundraColor,
      glacierColor: c.glacierColor,
      desertColor: c.desertColor,
      cityMask,
      cultivatedMask,
      bryophyteMask,
      pollutedMask,
      seaCityMask,
      seaCultivatedMask,
      seaPollutedMask
    });
    markCentersOnGridData({
      gridWidth: getProp('gridWidth', 0),
      gridHeight: getProp('gridHeight', 0),
      showCentersRed: !!getInput('showCentersRed', false)
    }, { gridData, centers: c.centers });

    const isBryophyteEra = (getInput('era', null) === '苔類進出時代');
    const isCivilizationEra = (getInput('era', null) === '文明時代');
    const isSeaCivilizationEra = (getInput('era', null) === '海棲文明時代');
    const baseBryo = Math.max(0, Number(getInput('bryophyteGenerationProbability', 0) || 0));
    const baseCult = Math.max(0, Number(getInput('cultivatedGenerationProbability', 0) || 0));
    const baseCity = Math.max(0, Number(getInput('cityGenerationProbability', 0) || 0));
    const countPollutedAreas = Math.max(0, Math.floor(Number(getInput('pollutedAreasCount', 0) || 0)));
    const baseSeaCult = Math.max(0, Number(getInput('seaCultivatedGenerationProbability', 0) || 0));
    const baseSeaCity = Math.max(0, Number(getInput('seaCityGenerationProbability', 0) || 0));
    const countSeaPollutedAreas = Math.max(0, Math.floor(Number(getInput('seaPollutedAreasCount', 0) || 0)));

    const isAdjacentToSea = (gx, gy) => {
      for (let di = 0; di < DIRS_8.length; di++) {
        const d = DIRS_8[di];
        const w = torusWrapFn(gx + d[0], gy + d[1]);
        if (!w) continue;
        const nIdx = w.y * getProp('gridWidth', 0) + w.x;
        if (!c.landMask[nIdx]) return true;
      }
      return false;
    };
    const isAdjacentToLand = (gx, gy) => {
      for (let di = 0; di < DIRS_8.length; di++) {
        const d = DIRS_8[di];
        const w = torusWrapFn(gx + d[0], gy + d[1]);
        if (!w) continue;
        const nIdx = w.y * getProp('gridWidth', 0) + w.x;
        if (c.landMask[nIdx]) return true;
      }
      return false;
    };

    let lowlandCount = 0;
    let shallowCount = 0;
    for (let i = 0; i < N; i++) {
      const cell = gridData[i];
      if (!cell || !cell.terrain) continue;
      if (cell.terrain.type === 'land') {
        if (cell.terrain.land === 'lowland') lowlandCount++;
      } else {
        if (cell.terrain.sea === 'shallow') shallowCount++;
      }
    }
    const pPollutedApprox = Math.min(1, (countPollutedAreas > 0) ? ((countPollutedAreas * 20) / Math.max(1, lowlandCount)) : 0);
    const pSeaPollutedApprox = Math.min(1, (countSeaPollutedAreas > 0) ? ((countSeaPollutedAreas * 20) / Math.max(1, shallowCount)) : 0);
    const cityBiasScale = 0.01;
    const cityBiasMin = 0.05;
    const cityBiasMax = 8.0;

    for (let i = 0; i < N; i++) {
      const cell = gridData[i];
      if (!cell || !cell.terrain) continue;
      if (cell.terrain.type === 'land') {
        const land = cell.terrain.land;
        const isLowland = (land === 'lowland');
        if (!isLowland) {
          const landType = land;
          const fullyIneligible = (landType === 'glacier' || landType === 'desert' || landType === 'highland' || landType === 'alpine');
          if (fullyIneligible) {
            cell.city = false;
            cell.cultivated = false;
            cell.polluted = false;
            cell.bryophyte = false;
          }
        } else if (isBryophyteEra) {
          const prev = base[i];
          const prevIsLowland = !!(prev && prev.terrain && prev.terrain.type === 'land' && prev.terrain.land === 'lowland');
          if (!prevIsLowland && !cell.bryophyte && !cell.city && !cell.cultivated && !cell.polluted) {
            const gx = i % getProp('gridWidth', 0);
            const gy = Math.floor(i / getProp('gridWidth', 0));
            const adjSea = isAdjacentToSea(gx, gy);
            const p = Math.min(1, adjSea ? (baseBryo * 100) : baseBryo);
            if (p > 0) {
              const rng = createDerivedRng(getProp('deterministicSeed', null), 'bryophyte-revise', `i${i}`) || Math.random;
              if (rng() < p) cell.bryophyte = true;
            }
          }
        } else if (isCivilizationEra) {
          const prev = base[i];
          const prevIsLowland = !!(prev && prev.terrain && prev.terrain.type === 'land' && prev.terrain.land === 'lowland');
          if (!prevIsLowland) {
            const gx = i % getProp('gridWidth', 0);
            const gy = Math.floor(i / getProp('gridWidth', 0));
            const adjSea = isAdjacentToSea(gx, gy);
            if (!cell.cultivated) {
              const pCult = Math.min(1, adjSea ? (baseCult * 5) : baseCult);
              if (pCult > 0) {
                const rng = createDerivedRng(getProp('deterministicSeed', null), 'cultivated-revise', `i${i}`) || Math.random;
                if (rng() < pCult) cell.cultivated = true;
              }
            }
            if (!cell.city) {
              const pcCity = getBiasedCityProbability({
                fractalNoise2D: (x, y, o, p, s) => fractalNoise2D(x, y, o, p, s),
                gx,
                gy,
                baseProbability: baseCity,
                isAdjacentFn: isAdjacentToSea,
                biasScale: cityBiasScale,
                biasMin: cityBiasMin,
                biasMax: cityBiasMax,
                adjacencyMultiplier: 5
              });
              if (pcCity > 0) {
                const rng = createDerivedRng(getProp('deterministicSeed', null), 'city-revise', `i${i}`) || Math.random;
                if (rng() < pcCity) cell.city = true;
              }
            }
            if (countPollutedAreas > 0 && !cell.polluted) {
              const w = adjSea ? 10 : 1;
              const p = Math.min(1, pPollutedApprox * w);
              if (p > 0) {
                const rng = createDerivedRng(getProp('deterministicSeed', null), 'polluted-revise', `i${i}`) || Math.random;
                if (rng() < p) cell.polluted = true;
              }
            }
          }
        }
        cell.seaCity = false;
        cell.seaCultivated = false;
        cell.seaPolluted = false;
      } else {
        const sea = cell.terrain.sea;
        const isShallow = (sea === 'shallow');
        if (!isShallow) {
          cell.seaCity = false;
          cell.seaCultivated = false;
          cell.seaPolluted = false;
        } else if (isSeaCivilizationEra) {
          const prev = base[i];
          const prevIsShallow = !!(prev && prev.terrain && prev.terrain.type === 'sea' && prev.terrain.sea === 'shallow');
          if (!prevIsShallow) {
            const gx = i % getProp('gridWidth', 0);
            const gy = Math.floor(i / getProp('gridWidth', 0));
            const adjLand = isAdjacentToLand(gx, gy);
            if (!cell.seaCultivated) {
              const pSeaCult = Math.min(1, adjLand ? (baseSeaCult * 5) : baseSeaCult);
              if (pSeaCult > 0) {
                const rng = createDerivedRng(getProp('deterministicSeed', null), 'sea-cultivated-revise', `i${i}`) || Math.random;
                if (rng() < pSeaCult) cell.seaCultivated = true;
              }
            }
            if (!cell.seaCity) {
              const pcSeaCity = getBiasedCityProbability({
                fractalNoise2D: (x, y, o, p, s) => fractalNoise2D(x, y, o, p, s),
                gx,
                gy,
                baseProbability: baseSeaCity,
                isAdjacentFn: isAdjacentToLand,
                biasScale: cityBiasScale,
                biasMin: cityBiasMin,
                biasMax: cityBiasMax,
                adjacencyMultiplier: 5
              });
              if (pcSeaCity > 0) {
                const rng = createDerivedRng(getProp('deterministicSeed', null), 'sea-city-revise', `i${i}`) || Math.random;
                if (rng() < pcSeaCity) cell.seaCity = true;
              }
            }
            if (countSeaPollutedAreas > 0 && !cell.seaPolluted) {
              const w = adjLand ? 10 : 1;
              const p = Math.min(1, pSeaPollutedApprox * w);
              if (p > 0) {
                const rng = createDerivedRng(getProp('deterministicSeed', null), 'sea-polluted-revise', `i${i}`) || Math.random;
                if (rng() < p) cell.seaPolluted = true;
              }
            }
          }
        }
        cell.city = false;
        cell.cultivated = false;
        cell.bryophyte = false;
        cell.polluted = false;
      }
    }

    internal.hfCache.gridDataBase = gridData;
    return { gridData };
  };

  return {
    buildGenerationJobSpec: () => {
      const generationInputs = buildGenerationJobInputs(props);
      internal.generationInputs = generationInputs;
      const gridWidth = Number.isFinite(generationInputs.gridWidth) ? generationInputs.gridWidth : getProp('gridWidth', 0);
      const gridHeight = Number.isFinite(generationInputs.gridHeight) ? generationInputs.gridHeight : getProp('gridHeight', 0);
      return { generationInputs, gridWidth, gridHeight, N: gridWidth * gridHeight };
    },
    getSeededRng: () => createSeededRng(getProp('deterministicSeed', null)),
    resetDriftStateForGenerate: ({ preserveCenterCoordinates }) => {
      if (!preserveCenterCoordinates) {
        internal.forceRandomDerivedRng = false;
        state.superPloom_calc = 0;
        state.superPloom_history = [];
        state.driftTurn = 0;
        state.driftIsApproach = true;
        state.driftMetrics = null;
        internal.hfCache = null;
        internal._glacierRowsState = {};
      }
    },
    buildSeededLog: (count) => Array.from({ length: (count || 0) * 1 || 1 }, () => ({
      highlandsCount: 0,
      highlandClusters: [],
      lakeStarts: []
    })),
    precomputeGenerateFixedTables: ({ N, seededRng }) => {
      const wobbleRows = Math.max(0, Math.floor(getInput('landBandVerticalWobbleRows', 0) || 0));
      internal.wobbleRowsFixed = wobbleRows;
      if (wobbleRows > 0) {
        internal.wobbleShiftByX = new Array(getProp('gridWidth', 0));
        const seedStrictGeom = (getInput('era', null) === '文明時代' || getInput('era', null) === '海棲文明時代') && !!seededRng;
        for (let x = 0; x < getProp('gridWidth', 0); x++) {
          const r = seedStrictGeom ? (getDerivedRng('wobble-x', x) || seededRng) : Math.random;
          internal.wobbleShiftByX[x] = Math.round((r() * 2 - 1) * wobbleRows);
        }
      } else {
        internal.wobbleShiftByX = null;
      }
      internal.baseLandDistanceThresholdFixed = getInput('baseLandDistanceThreshold', 0);
      const glacierNoiseTable = new Array(N);
      {
        const seedStrictGl = (getInput('era', null) === '文明時代' || getInput('era', null) === '海棲文明時代') && !!seededRng;
        const gRng = seedStrictGl ? (getDerivedRng('glacier-noise') || seededRng) : Math.random;
        for (let i = 0; i < N; i++) glacierNoiseTable[i] = (gRng() * 2 - 1);
      }
      const tundraNoiseTopTable = new Array(N);
      const tundraNoiseBottomTable = new Array(N);
      {
        const seedStrict = (getInput('era', null) === '文明時代' || getInput('era', null) === '海棲文明時代') && !!seededRng;
        const rTop = seedStrict ? (getDerivedRng('tundra-noise-top') || seededRng) : Math.random;
        const rBot = seedStrict ? (getDerivedRng('tundra-noise-bottom') || seededRng) : Math.random;
        for (let i = 0; i < N; i++) {
          tundraNoiseTopTable[i] = (rTop() * 2 - 1);
          tundraNoiseBottomTable[i] = (rBot() * 2 - 1);
        }
      }
      return { glacierNoiseTable, tundraNoiseTopTable, tundraNoiseBottomTable };
    },
    computeCentersAndParamsForGenerate: ({ preserveCenterCoordinates, seededRng }) => {
      const seedStrictCenters = !!seededRng;
      const effectiveMinCenterDistance = computeEffectiveMinCenterDistance(getInput('seaLandRatio', 0.3), getInput('seaLandRatio', 0.3));
      let centers;
      let localCenterParameters;
      const centerParameters = Array.isArray(getInput('centerParameters', [])) ? getInput('centerParameters', []) : [];
      if (preserveCenterCoordinates && centerParameters.length > 0) {
        const clampX = (v) => Math.max(0, Math.min(getProp('gridWidth', 0) - 1, Math.round(Number(v))));
        const clampY = (v) => Math.max(0, Math.min(getProp('gridHeight', 0) - 1, Math.round(Number(v))));
        centers = centerParameters.map((p) => ({ x: clampX(p && p.x), y: clampY(p && p.y) }));
        localCenterParameters = centerParameters.map((p, i) => ({ ...(p || {}), x: centers[i].x, y: centers[i].y }));
      } else {
        centers = sampleLandCenters({
          gridWidth: getProp('gridWidth', 0),
          gridHeight: getProp('gridHeight', 0),
          centersY: getInput('centersY', 1),
          minCenterDistance: getInput('minCenterDistance', 20),
          torusDistance: torusDistanceFn
        }, seedStrictCenters ? seededRng : null, effectiveMinCenterDistance);
        localCenterParameters = centers.map((c) => {
          if (seededRng) {
            const u1 = seededRng() * 2 - 1;
            return {
              x: c.x,
              y: c.y,
              influenceMultiplier: 0.9 + u1 * 0.05,
              kDecayVariation: getInput('kDecay', 2.0) * (1.3 + u1 * 0.1)
            };
          }
          const n1 = noise2D(c.x * 0.1, c.y * 0.1);
          return {
            x: c.x,
            y: c.y,
            influenceMultiplier: 0.9 + n1 * 0.05,
            kDecayVariation: getInput('kDecay', 2.0) * (1.3 + n1 * 0.1)
          };
        });
      }
      return { centers, localCenterParameters, seedStrictCenters, effectiveMinCenterDistance };
    },
    computeScoresThresholdAndLandMaskForGenerate: ({ N, centers, localCenterParameters, preserveCenterCoordinates, seedStrictCenters, seededRng, effectiveMinCenterDistance }) => {
      let scores, threshold;
      let success = false;
      let nextCenters = centers;
      for (let attempt = 0; attempt < 5 && !success; attempt++) {
        const res = computeScoresForCenters({
          gridWidth: getProp('gridWidth', 0),
          gridHeight: getProp('gridHeight', 0),
          kDecay: getInput('kDecay', 2.0),
          centerBias: getInput('centerBias', 0),
          fractalNoise2D: (x, y, o, p) => fractalNoise2D(x, y, o, p),
          noise2D: (x, y) => noise2D(x, y),
          noiseAmp: getInput('noiseAmp', 0.08),
          torusDistance: torusDistanceFn,
          torusDirection: torusDirectionFn,
          derivedRng: (...labels) => getDerivedRng(...labels)
        }, nextCenters, localCenterParameters);
        scores = res.scores;
        const sorted = scores.slice().sort((a, b) => a - b);
        const effectiveSeaLandRatio = Math.min(0.999, Math.max(0.0, mapSeaLandRatio(getInput('seaLandRatio', 0.3))));
        const k = Math.floor((1 - effectiveSeaLandRatio) * N);
        threshold = sorted[Math.max(0, Math.min(sorted.length - 1, k))];
        let anyCenterLand = false;
        for (let i = 0; i < nextCenters.length; i++) {
          const c = nextCenters[i];
          const sc = scores[c.y * getProp('gridWidth', 0) + c.x];
          if (sc >= threshold) { anyCenterLand = true; break; }
        }
        if (anyCenterLand) {
          success = true;
        } else {
          if (preserveCenterCoordinates) {
            success = true;
          } else {
            nextCenters = sampleLandCenters({
              gridWidth: getProp('gridWidth', 0),
              gridHeight: getProp('gridHeight', 0),
              centersY: getInput('centersY', 1),
              minCenterDistance: getInput('minCenterDistance', 20),
              torusDistance: torusDistanceFn
            }, seedStrictCenters ? seededRng : null, effectiveMinCenterDistance);
          }
        }
      }
      const landMask = new Array(N).fill(false);
      for (let i = 0; i < N; i++) landMask[i] = scores[i] >= threshold;
      return { centers: nextCenters, scores, threshold, landMask };
    },
    ensureRunContext,
    buildWorld,
    precomputeDriftFixedTables: ({ N }) => {
      const wobbleRows = Math.max(0, Math.floor(getInput('landBandVerticalWobbleRows', 0) || 0));
      internal.wobbleRowsFixed = wobbleRows;
      if (wobbleRows > 0) {
        internal.wobbleShiftByX = new Array(getProp('gridWidth', 0));
        for (let x = 0; x < getProp('gridWidth', 0); x++) {
          internal.wobbleShiftByX[x] = Math.round((Math.random() * 2 - 1) * wobbleRows);
        }
      } else {
        internal.wobbleShiftByX = null;
      }
      internal.baseLandDistanceThresholdFixed = getInput('baseLandDistanceThreshold', 0);
      const glacierNoiseTable = new Array(N);
      for (let i = 0; i < N; i++) glacierNoiseTable[i] = (Math.random() * 2 - 1);
      const tundraNoiseTopTable = new Array(N);
      const tundraNoiseBottomTable = new Array(N);
      for (let i = 0; i < N; i++) {
        tundraNoiseTopTable[i] = (Math.random() * 2 - 1);
        tundraNoiseBottomTable[i] = (Math.random() * 2 - 1);
      }
      return { glacierNoiseTable, tundraNoiseTopTable, tundraNoiseBottomTable };
    },
    computeCenterParametersForDrift: ({ centers }) => {
      const current = Array.isArray(getInput('centerParameters', [])) ? getInput('centerParameters', []) : [];
      if (current.length === centers.length) {
        return current.map((p, i) => ({ ...p, x: centers[i].x, y: centers[i].y }));
      }
      return centers.map((c) => {
        const u1 = Math.random() * 2 - 1;
        return {
          x: c.x,
          y: c.y,
          influenceMultiplier: 0.9 + u1 * 0.05,
          kDecayVariation: getInput('kDecay', 2.0) * (1.3 + u1 * 0.1)
        };
      });
    },
    computeScoresThresholdAndLandMaskForDrift: ({ N, centers, localCenterParameters }) => {
      const res = computeScoresForCenters({
        gridWidth: getProp('gridWidth', 0),
        gridHeight: getProp('gridHeight', 0),
        kDecay: getInput('kDecay', 2.0),
        centerBias: getInput('centerBias', 0),
        fractalNoise2D: (x, y, o, p) => fractalNoise2D(x, y, o, p),
        noise2D: (x, y) => noise2D(x, y),
        noiseAmp: getInput('noiseAmp', 0.08),
        torusDistance: torusDistanceFn,
        torusDirection: torusDirectionFn,
        derivedRng: (...labels) => getDerivedRng(...labels)
      }, centers, localCenterParameters);
      const scores = res.scores;
      const sorted = scores.slice().sort((a, b) => a - b);
      const effectiveSeaLandRatio = Math.min(0.999, Math.max(0.0, mapSeaLandRatio(getInput('seaLandRatio', 0.3))));
      const k = Math.floor((1 - effectiveSeaLandRatio) * N);
      const threshold = sorted[Math.max(0, Math.min(sorted.length - 1, k))];
      const landMask = new Array(N).fill(false);
      for (let i = 0; i < N; i++) landMask[i] = scores[i] >= threshold;
      return { scores, threshold, landMask };
    },
    reviseReclassifyDesert,
    reviseRestoreLowlandAroundLakes,
    reviseComputeGlacierRows,
    reviseApplyTundra,
    reviseApplyGlaciers,
    reviseRebuildGridDataAndSanitizeFeatures,
    computeEffectiveMinCenterDistance: () => computeEffectiveMinCenterDistance(getInput('seaLandRatio', 0.3), getInput('seaLandRatio', 0.3)),
    torusDistance: torusDistanceFn,
    setForceRandomDerivedRng: (value) => { internal.forceRandomDerivedRng = value; }
  };
}

const REQUIRED_DEPS_FUNCTIONS = [
  'buildGenerationJobSpec',
  'getSeededRng',
  'resetDriftStateForGenerate',
  'buildSeededLog',
  'precomputeGenerateFixedTables',
  'computeCentersAndParamsForGenerate',
  'computeScoresThresholdAndLandMaskForGenerate',
  'ensureRunContext',
  'buildWorld',
  'precomputeDriftFixedTables',
  'computeCenterParametersForDrift',
  'computeScoresThresholdAndLandMaskForDrift',
  'reviseReclassifyDesert',
  'reviseRestoreLowlandAroundLakes',
  'reviseComputeGlacierRows',
  'reviseApplyTundra',
  'reviseApplyGlaciers',
  'reviseRebuildGridDataAndSanitizeFeatures',
  'computeEffectiveMinCenterDistance',
  'torusDistance',
  'setForceRandomDerivedRng'
];

const DIRS_8 = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], /*0,0*/ [1, 0],
  [-1, 1], [0, 1], [1, 1]
];

export function getMissingWorkerDepsFunctions(deps) {
  const d = deps && typeof deps === 'object' ? deps : {};
  return REQUIRED_DEPS_FUNCTIONS.filter((key) => typeof d[key] !== 'function');
}
