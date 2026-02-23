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
    { N, landMask, colors, lowlandColor, shallowSeaColor, seededRng }
) {
    const isAdjacentToSea = makeIsAdjacent(ctx, landMask, false);
    const isAdjacentToLand = makeIsAdjacent(ctx, landMask, true);
    const land = buildLandFeatureMasks(ctx, {
        N,
        landMask,
        colors,
        lowlandColor,
        seededRng,
        isAdjacentToSea
    });
    const sea = buildSeaFeatureMasks(ctx, {
        N,
        colors,
        shallowSeaColor,
        seededRng,
        isAdjacentToLand
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
    isAdjacentToSea
}) {
    const cityMask = createMask(N);
    const cultivatedMask = createMask(N);
    const bryophyteMask = createMask(N);
    const pollutedMask = createMask(N);
    const rCity = pickRng(ctx._getDerivedRng('city'));
    const rCult = pickRng(ctx._getDerivedRng('cultivated'));
    const rBryo = pickRng(ctx._getDerivedRng('bryophyte'));
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
                const startBryoRng = getStartRng(ctx, 'bryophyte-start', gx, gy, rBryo);
                if (!bryophyteMask[idx]) {
                    maybeStartClusterAtCell({
                        ctx,
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
                const startCultRng = getStartRng(ctx, 'cultivated-start', gx, gy, rCult);
                if (!cultivatedMask[idx]) {
                    maybeStartClusterAtCell({
                        ctx,
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
                    ctx,
                    gx,
                    gy,
                    baseProbability: baseCity,
                    isAdjacentFn: isAdjacentToSea,
                    biasScale: CITY_BIAS_SCALE,
                    biasMin: CITY_BIAS_MIN,
                    biasMax: CITY_BIAS_MAX,
                    adjacencyMultiplier: ADJACENCY_MULTIPLIER
                });
                const startCityRng = getStartRng(ctx, 'city-start', gx, gy, rCity);
                if (pcCity > 0 && !isOneCellIsland(ctx, landMask, gx, gy) && !cityMask[idx]) {
                    maybeStartClusterAtCell({
                        ctx,
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
            generatePollutedAreas(ctx, {
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
    isAdjacentToLand
}) {
    const seaCityMask = createMask(N);
    const seaCultivatedMask = createMask(N);
    const seaPollutedMask = createMask(N);
    const rSeaCity = pickRng(ctx._getDerivedRng('sea-city'));
    const rSeaCult = pickRng(ctx._getDerivedRng('sea-cultivated'));
    const isSeaCivilizationEra = (ctx.era === '海棲文明時代');
    const baseSeaCult = Math.max(0, ctx.seaCultivatedGenerationProbability || 0);
    const baseSeaCity = Math.max(0, ctx.seaCityGenerationProbability || 0);

    if (isSeaCivilizationEra) {
        for (let gy = 0; gy < ctx.gridHeight; gy++) {
            for (let gx = 0; gx < ctx.gridWidth; gx++) {
                const idx = gy * ctx.gridWidth + gx;
                if (colors[idx] !== shallowSeaColor) continue;
                const pcSeaCult = isAdjacentToLand(gx, gy) ? clamp01(baseSeaCult * 5) : baseSeaCult;
                const startSeaCultRng = getStartRng(ctx, 'sea-cultivated-start', gx, gy, rSeaCult);
                if (!seaCultivatedMask[idx]) {
                    maybeStartClusterAtCell({
                        ctx,
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
                    ctx,
                    gx,
                    gy,
                    baseProbability: baseSeaCity,
                    isAdjacentFn: isAdjacentToLand,
                    biasScale: CITY_BIAS_SCALE,
                    biasMin: CITY_BIAS_MIN,
                    biasMax: CITY_BIAS_MAX,
                    adjacencyMultiplier: ADJACENCY_MULTIPLIER
                });
                const startSeaCityRng = getStartRng(ctx, 'sea-city-start', gx, gy, rSeaCity);
                if (!seaCityMask[idx]) {
                    maybeStartClusterAtCell({
                        ctx,
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
            generatePollutedAreas(ctx, {
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
