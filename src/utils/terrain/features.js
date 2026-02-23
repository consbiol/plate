import { DIRS8 } from './features/constants';
import { makeIsAdjacent, isOneCellIsland } from './features/adjacency';
import { clamp01 } from './features/math';
import { pickRng } from '../rng.js';
import { toCoords } from './gridIndex.js';
import { getStartRng } from './features/vmRng';
import { maybeStartClusterAtCell } from './features/cluster';
import { getBiasedCityProbability } from './features/probability';
import { generatePollutedAreas } from './features/pollution';

const CITY_BIAS_SCALE = 0.01;
const CITY_BIAS_MIN = 0.05;
const CITY_BIAS_MAX = 8.0;
const CLUSTER_ACCEPT_P = 0.6;
const CULTIVATED_MEAN = 5;
const CULTIVATED_MAX = 50;
const CITY_MEAN = 3;
const CITY_MAX = 50;
const POLLUTED_MEAN = 20;
const POLLUTED_MAX = 200;
const ADJACENCY_MULTIPLIER = 5;

export function generateFeatures(
    ctx,
    { N, landMask, colors, lowlandColor, shallowSeaColor, seededRng, derivedRng }
) {
    const adjacencyInputs = {
        gridWidth: ctx.gridWidth,
        torusWrap: (x, y) => ctx.torusWrap(x, y)
    };
    const clusterInputs = {
        gridWidth: ctx.gridWidth,
        torusWrap: (x, y) => ctx.torusWrap(x, y),
        poissonSample: (...args) => ctx._poissonSample(...args)
    };
    const resolvedDerivedRng = derivedRng || ((...args) => ctx._getDerivedRng(...args));
    const isAdjacentToSea = makeIsAdjacent(adjacencyInputs, landMask, false);
    const isAdjacentToLand = makeIsAdjacent(adjacencyInputs, landMask, true);
    const land = buildLandFeatureMasks(ctx, {
        N,
        landMask,
        colors,
        lowlandColor,
        seededRng,
        derivedRng,
        fractalNoise2D: (x, y, o, p, s) => ctx.fractalNoise2D(x, y, o, p, s),
        isAdjacentToSea,
        adjacencyInputs,
        clusterInputs,
        resolvedDerivedRng
    });
    const sea = buildSeaFeatureMasks(ctx, {
        N,
        colors,
        shallowSeaColor,
        seededRng,
        derivedRng,
        fractalNoise2D: (x, y, o, p, s) => ctx.fractalNoise2D(x, y, o, p, s),
        isAdjacentToLand,
        clusterInputs,
        resolvedDerivedRng
    });
    return { ...land, ...sea };
}
const createMask = (N) => new Array(N).fill(false);

function buildLandFeatureMasks(ctx, {
    N,
    landMask,
    colors,
    lowlandColor,
    seededRng,
    derivedRng,
    fractalNoise2D,
    isAdjacentToSea,
    adjacencyInputs,
    clusterInputs,
    resolvedDerivedRng
}) {
    const cityMask = createMask(N);
    const cultivatedMask = createMask(N);
    const bryophyteMask = createMask(N);
    const pollutedMask = createMask(N);
    const getRng = derivedRng || ((...args) => ctx._getDerivedRng(...args));
    const rCity = pickRng(getRng('city'));
    const rCult = pickRng(getRng('cultivated'));
    const rBryo = pickRng(getRng('bryophyte'));
    const isCivilizationEra = (ctx.era === '文明時代');
    const isBryophyteEra = (ctx.era === '苔類進出時代');
    const baseBryo = Math.max(0, ctx.bryophyteGenerationProbability || 0);
    const baseCult = Math.max(0, ctx.cultivatedGenerationProbability || 0);
    const baseCity = Math.max(0, ctx.cityGenerationProbability || 0);

    if (isBryophyteEra) {
        for (let gy = 0; gy < ctx.gridHeight; gy++) {
            for (let gx = 0; gx < ctx.gridWidth; gx++) {
                const idx = gy * ctx.gridWidth + gx;
                if (colors[idx] !== lowlandColor) continue;
                const pcBryo = isAdjacentToSea(gx, gy) ? clamp01(baseBryo * 100) : baseBryo;
                const startBryoRng = getStartRng(null, 'bryophyte-start', gx, gy, rBryo, derivedRng);
                if (!bryophyteMask[idx]) {
                    maybeStartClusterAtCell({
                        ...clusterInputs,
                        gx,
                        gy,
                        idx,
                        startProbability: pcBryo,
                        startRng: startBryoRng,
                        clusterRngKey: 'bryophyte-cluster',
                        poissonMean: CULTIVATED_MEAN,
                        poissonMax: CULTIVATED_MAX,
                        dirs: DIRS8,
                        seededRng,
                        derivedRng: resolvedDerivedRng,
                        acceptP: CLUSTER_ACCEPT_P,
                        canFill: (nIdx) => {
                            if (colors[nIdx] !== lowlandColor) return false;
                            if (cityMask[nIdx]) return false;
                            if (cultivatedMask[nIdx]) return false;
                            if (bryophyteMask[nIdx]) return false;
                            return true;
                        },
                        onFill: (nIdx) => { bryophyteMask[nIdx] = true; }
                    });
                }
            }
        }
    }
    if (isCivilizationEra) {
        for (let gy = 0; gy < ctx.gridHeight; gy++) {
            for (let gx = 0; gx < ctx.gridWidth; gx++) {
                const idx = gy * ctx.gridWidth + gx;
                if (colors[idx] !== lowlandColor) continue;
                const pcCult = isAdjacentToSea(gx, gy) ? clamp01(baseCult * 5) : baseCult;
                const startCultRng = getStartRng(null, 'cultivated-start', gx, gy, rCult, derivedRng);
                if (!cultivatedMask[idx]) {
                    maybeStartClusterAtCell({
                        ...clusterInputs,
                        gx,
                        gy,
                        idx,
                        startProbability: pcCult,
                        startRng: startCultRng,
                        clusterRngKey: 'cultivated-cluster',
                        poissonMean: CULTIVATED_MEAN,
                        poissonMax: CULTIVATED_MAX,
                        dirs: DIRS8,
                        seededRng,
                        derivedRng: resolvedDerivedRng,
                        acceptP: CLUSTER_ACCEPT_P,
                        canFill: (nIdx) => {
                            if (colors[nIdx] !== lowlandColor) return false;
                            if (cityMask[nIdx]) return false;
                            if (cultivatedMask[nIdx]) return false;
                            return true;
                        },
                        onFill: (nIdx) => { cultivatedMask[nIdx] = true; }
                    });
                }
                if (cityMask[idx]) continue;
                const pcCity = getBiasedCityProbability({
                    fractalNoise2D,
                    gx,
                    gy,
                    baseProbability: baseCity,
                    isAdjacentFn: isAdjacentToSea,
                    biasScale: CITY_BIAS_SCALE,
                    biasMin: CITY_BIAS_MIN,
                    biasMax: CITY_BIAS_MAX,
                    adjacencyMultiplier: ADJACENCY_MULTIPLIER
                });
                const startCityRng = getStartRng(null, 'city-start', gx, gy, rCity, derivedRng);
                if (pcCity > 0 && !isOneCellIsland(adjacencyInputs, landMask, gx, gy) && !cityMask[idx]) {
                    maybeStartClusterAtCell({
                        ...clusterInputs,
                        gx,
                        gy,
                        idx,
                        startProbability: pcCity,
                        startRng: startCityRng,
                        clusterRngKey: 'city-cluster',
                        poissonMean: CITY_MEAN,
                        poissonMax: CITY_MAX,
                        dirs: DIRS8,
                        seededRng,
                        derivedRng: resolvedDerivedRng,
                        acceptP: CLUSTER_ACCEPT_P,
                        canFill: (nIdx) => {
                            if (colors[nIdx] !== lowlandColor) return false;
                            if (cityMask[nIdx]) return false;
                            return true;
                        },
                        onFill: (nIdx) => { cityMask[nIdx] = true; }
                    });
                }
            }
        }
        const countPolluted = Math.max(0, Math.floor(Number(ctx.pollutedAreasCount || 0)));
        if (countPolluted > 0) {
            generatePollutedAreas({
                ...clusterInputs,
                derivedRng: resolvedDerivedRng
            }, {
                N,
                countAreas: countPolluted,
                isEligible: (i) => (colors[i] === lowlandColor || cityMask[i] || cultivatedMask[i]),
                weightFn: (idx0) => {
                    const { x: sx, y: sy } = toCoords(idx0, ctx.gridWidth);
                    return isAdjacentToSea(sx, sy) ? 10 : 1;
                },
                pickRngKey: 'polluted-pick',
                clusterRngKey: 'polluted-cluster',
                targetMean: POLLUTED_MEAN,
                targetMax: POLLUTED_MAX,
                dirs: DIRS8,
                pollutedMask,
                canExpand: (nIdx) => (colors[nIdx] === lowlandColor || cityMask[nIdx] || cultivatedMask[nIdx])
            });
        }
    }
    return { cityMask, cultivatedMask, bryophyteMask, pollutedMask };
}

function buildSeaFeatureMasks(ctx, {
    N,
    colors,
    shallowSeaColor,
    seededRng,
    derivedRng,
    fractalNoise2D,
    isAdjacentToLand,
    clusterInputs,
    resolvedDerivedRng
}) {
    const seaCityMask = createMask(N);
    const seaCultivatedMask = createMask(N);
    const seaPollutedMask = createMask(N);
    const getRng = derivedRng || ((...args) => ctx._getDerivedRng(...args));
    const rSeaCity = pickRng(getRng('sea-city'));
    const rSeaCult = pickRng(getRng('sea-cultivated'));
    const isSeaCivilizationEra = (ctx.era === '海棲文明時代');
    const baseSeaCult = Math.max(0, ctx.seaCultivatedGenerationProbability || 0);
    const baseSeaCity = Math.max(0, ctx.seaCityGenerationProbability || 0);

    if (isSeaCivilizationEra) {
        for (let gy = 0; gy < ctx.gridHeight; gy++) {
            for (let gx = 0; gx < ctx.gridWidth; gx++) {
                const idx = gy * ctx.gridWidth + gx;
                if (colors[idx] !== shallowSeaColor) continue;
                const pcSeaCult = isAdjacentToLand(gx, gy) ? clamp01(baseSeaCult * 5) : baseSeaCult;
                const startSeaCultRng = getStartRng(null, 'sea-cultivated-start', gx, gy, rSeaCult, derivedRng);
                if (!seaCultivatedMask[idx]) {
                    maybeStartClusterAtCell({
                        ...clusterInputs,
                        gx,
                        gy,
                        idx,
                        startProbability: pcSeaCult,
                        startRng: startSeaCultRng,
                        clusterRngKey: 'sea-cultivated-cluster',
                        poissonMean: CULTIVATED_MEAN,
                        poissonMax: CULTIVATED_MAX,
                        dirs: DIRS8,
                        seededRng,
                        derivedRng: resolvedDerivedRng,
                        acceptP: CLUSTER_ACCEPT_P,
                        canFill: (nIdx) => {
                            if (colors[nIdx] !== shallowSeaColor) return false;
                            if (seaCityMask[nIdx]) return false;
                            if (seaCultivatedMask[nIdx]) return false;
                            return true;
                        },
                        onFill: (nIdx) => { seaCultivatedMask[nIdx] = true; }
                    });
                }
                if (seaCityMask[idx]) continue;
                const pcSeaCity = getBiasedCityProbability({
                    fractalNoise2D,
                    gx,
                    gy,
                    baseProbability: baseSeaCity,
                    isAdjacentFn: isAdjacentToLand,
                    biasScale: CITY_BIAS_SCALE,
                    biasMin: CITY_BIAS_MIN,
                    biasMax: CITY_BIAS_MAX,
                    adjacencyMultiplier: ADJACENCY_MULTIPLIER
                });
                const startSeaCityRng = getStartRng(null, 'sea-city-start', gx, gy, rSeaCity, derivedRng);
                if (!seaCityMask[idx]) {
                    maybeStartClusterAtCell({
                        ...clusterInputs,
                        gx,
                        gy,
                        idx,
                        startProbability: pcSeaCity,
                        startRng: startSeaCityRng,
                        clusterRngKey: 'sea-city-cluster',
                        poissonMean: CITY_MEAN,
                        poissonMax: CITY_MAX,
                        dirs: DIRS8,
                        seededRng,
                        derivedRng: resolvedDerivedRng,
                        acceptP: CLUSTER_ACCEPT_P,
                        canFill: (nIdx) => {
                            if (colors[nIdx] !== shallowSeaColor) return false;
                            if (seaCityMask[nIdx]) return false;
                            return true;
                        },
                        onFill: (nIdx) => { seaCityMask[nIdx] = true; }
                    });
                }
            }
        }
        const countSeaPolluted = Math.max(0, Math.floor(Number(ctx.seaPollutedAreasCount || 0)));
        if (countSeaPolluted > 0) {
            generatePollutedAreas({
                ...clusterInputs,
                derivedRng: resolvedDerivedRng
            }, {
                N,
                countAreas: countSeaPolluted,
                isEligible: (i) => (colors[i] === shallowSeaColor || seaCityMask[i] || seaCultivatedMask[i]),
                weightFn: (idx0) => {
                    const { x: sx, y: sy } = toCoords(idx0, ctx.gridWidth);
                    return isAdjacentToLand(sx, sy) ? 10 : 1;
                },
                pickRngKey: 'sea-polluted-pick',
                clusterRngKey: 'sea-polluted-cluster',
                targetMean: POLLUTED_MEAN,
                targetMax: POLLUTED_MAX,
                dirs: DIRS8,
                pollutedMask: seaPollutedMask,
                canExpand: (nIdx) => (colors[nIdx] === shallowSeaColor || seaCityMask[nIdx] || seaCultivatedMask[nIdx])
            });
        }
    }
    return { seaCityMask, seaCultivatedMask, seaPollutedMask };
}
