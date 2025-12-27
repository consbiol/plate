// 文明要素（都市/耕作地/汚染）＋海棲文明要素の生成＋苔類進出
// Grids_Calculation.vue から切り出し（機能不変）。

import { DIRS8 } from './features/constants';
import { makeIsAdjacent, isOneCellIsland } from './features/adjacency';
import { clamp01 } from './features/math';
import { getStartRng } from './features/vmRng';
import { maybeStartClusterAtCell } from './features/cluster';
import { getBiasedCityProbability } from './features/probability';
import { generatePollutedAreas } from './features/pollution';

export function generateFeatures(
    vm,
    { N, landMask, colors, lowlandColor, shallowSeaColor, seededRng }
) {
    // 追加: city/cultivated の生成（低地のみ、海隣接で確率10倍）
    const cityMask = new Array(N).fill(false);
    const cultivatedMask = new Array(N).fill(false);
    const bryophyteMask = new Array(N).fill(false);
    const pollutedMask = new Array(N).fill(false);
    const rCity = vm._getDerivedRng('city') || Math.random;
    const rCult = vm._getDerivedRng('cultivated') || Math.random;
    const rBryo = vm._getDerivedRng('bryophyte') || Math.random;
    // 地域差ノイズ（都市の発生率に地域バイアスを付与）
    // fractalNoise2D は [-1,1] を返す。これを [cityBiasMin, cityBiasMax] に線形マップして倍率とする
    const cityBiasScale = 0.01; // 小さいほど広域パッチ
    const cityBiasMin = 0.05; // 発生しにくい地域
    const cityBiasMax = 8.0; // 発生しやすい地域
    const isAdjacentToSea = makeIsAdjacent(vm, landMask, false);
    const isAdjacentToLand = makeIsAdjacent(vm, landMask, true);
    // 文明時代のみ city/cultivated を生成
    const isCivilizationEra = (vm.era === '文明時代');
    // 苔類進出時代のみ苔類進出地を生成
    const isBryophyteEra = (vm.era === '苔類進出時代');
    // 苔類進出地の生成アルゴリズム（耕作地と同等。ただし海隣接で確率100倍、かつ苔類進出時代のみ）
    if (isBryophyteEra) {
        for (let gy = 0; gy < vm.gridHeight; gy++) {
            for (let gx = 0; gx < vm.gridWidth; gx++) {
                const idx = gy * vm.gridWidth + gx;
                if (colors[idx] !== lowlandColor) continue;
                const baseBryo = Math.max(0, vm.bryophyteGenerationProbability || 0);
                const pcBryo = isAdjacentToSea(gx, gy) ? clamp01(baseBryo * 100) : baseBryo;
                const startBryoRng = getStartRng(vm, 'bryophyte-start', gx, gy, rBryo);
                if (!bryophyteMask[idx]) {
                    maybeStartClusterAtCell({
                        vm,
                        gx,
                        gy,
                        idx,
                        startProbability: pcBryo,
                        startRng: startBryoRng,
                        clusterRngKey: 'bryophyte-cluster',
                        poissonMean: 5,
                        poissonMax: 50,
                        dirs: DIRS8,
                        seededRng,
                        acceptP: 0.6,
                        canFill: (nIdx) => {
                            // 拡張条件: 低地・未city・未cultivated・未bryophyte
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
        for (let gy = 0; gy < vm.gridHeight; gy++) {
            for (let gx = 0; gx < vm.gridWidth; gx++) {
                const idx = gy * vm.gridWidth + gx;
                // 最終色が低地のみ対象（ツンドラ/砂漠/高地/高山/氷河/海などは除外）
                if (colors[idx] !== lowlandColor) continue;
                // cultivated（先に生成）陸上の耕作地（cultivated）は海隣接時に baseCult * 10 
                const baseCult = Math.max(0, vm.cultivatedGenerationProbability || 0);
                const pcCult = isAdjacentToSea(gx, gy) ? clamp01(baseCult * 5) : baseCult;
                // 開始セルの採択は座標由来のシードで決定（安定化）
                const startCultRng = getStartRng(vm, 'cultivated-start', gx, gy, rCult);
                if (!cultivatedMask[idx]) {
                    maybeStartClusterAtCell({
                        vm,
                        gx,
                        gy,
                        idx,
                        startProbability: pcCult,
                        startRng: startCultRng,
                        clusterRngKey: 'cultivated-cluster',
                        poissonMean: 5,
                        poissonMax: 50,
                        dirs: DIRS8,
                        seededRng,
                        acceptP: 0.6,
                        canFill: (nIdx) => {
                            // 拡張条件: 低地・未city・未cultivated
                            if (colors[nIdx] !== lowlandColor) return false;
                            if (cityMask[nIdx]) return false;
                            if (cultivatedMask[nIdx]) return false;
                            return true;
                        },
                        onFill: (nIdx) => { cultivatedMask[nIdx] = true; }
                    });
                }
                // city（cultivated の後で上書き）陸上の都市（city）は adjacencyMultiplier:10 を渡しており、海隣接時に10倍扱い
                if (cityMask[idx]) continue;
                const baseCity = Math.max(0, vm.cityGenerationProbability || 0);
                const pcCity = getBiasedCityProbability({
                    vm,
                    gx,
                    gy,
                    baseProbability: baseCity,
                    isAdjacentFn: isAdjacentToSea,
                    biasScale: cityBiasScale,
                    biasMin: cityBiasMin,
                    biasMax: cityBiasMax,
                    adjacencyMultiplier: 5
                });
                // 開始セルの採択は座標由来のシードで決定（安定化）
                const startCityRng = getStartRng(vm, 'city-start', gx, gy, rCity);
                if (pcCity > 0 && !isOneCellIsland(vm, landMask, gx, gy) && !cityMask[idx]) {
                    maybeStartClusterAtCell({
                        vm,
                        gx,
                        gy,
                        idx,
                        startProbability: pcCity,
                        startRng: startCityRng,
                        clusterRngKey: 'city-cluster',
                        poissonMean: 3,
                        poissonMax: 50,
                        dirs: DIRS8,
                        seededRng,
                        acceptP: 0.6,
                        canFill: (nIdx) => {
                            // 拡張条件: 低地・未city
                            if (colors[nIdx] !== lowlandColor) return false;
                            if (cityMask[nIdx]) return false;
                            return true;
                        },
                        onFill: (nIdx) => { cityMask[nIdx] = true; }
                    });
                }
            }
        }
        // 追加: 汚染地の生成（文明時代のみ、低地/都市/耕作地セル上に生成、クラスター平均サイズ ~20）
        const countPolluted = Math.max(0, Math.floor(Number(vm.pollutedAreasCount || 0)));
        if (countPolluted > 0) {
            // 海岸セルに重み10、内陸に重み1（cityと同様の海岸優遇）
            generatePollutedAreas(vm, {
                N,
                countAreas: countPolluted,
                isEligible: (i) => (colors[i] === lowlandColor || cityMask[i] || cultivatedMask[i]),
                weightFn: (idx0) => {
                    const sx = idx0 % vm.gridWidth;
                    const sy = Math.floor(idx0 / vm.gridWidth);
                    return isAdjacentToSea(sx, sy) ? 10 : 1;
                },
                pickRngKey: 'polluted-pick',
                clusterRngKey: 'polluted-cluster',
                targetMean: 20,
                targetMax: 200,
                dirs: DIRS8,
                pollutedMask,
                canExpand: (nIdx) => (colors[nIdx] === lowlandColor || cityMask[nIdx] || cultivatedMask[nIdx])
            });
        }
    }

    // 追加: 海棲city/cultivated/polluted の生成（浅瀬のみ、陸隣接で確率10倍）
    const seaCityMask = new Array(N).fill(false);
    const seaCultivatedMask = new Array(N).fill(false);
    const seaPollutedMask = new Array(N).fill(false);
    const rSeaCity = vm._getDerivedRng('sea-city') || Math.random;
    const rSeaCult = vm._getDerivedRng('sea-cultivated') || Math.random;
    // 海棲文明時代のみ seaCity/seaCultivated/seaPolluted を生成
    const isSeaCivilizationEra = (vm.era === '海棲文明時代');
    if (isSeaCivilizationEra) {
        for (let gy = 0; gy < vm.gridHeight; gy++) {
            for (let gx = 0; gx < vm.gridWidth; gx++) {
                const idx = gy * vm.gridWidth + gx;
                // 最終色が浅瀬のみ対象
                if (colors[idx] !== shallowSeaColor) continue;
                // seaCultivated（先に生成）浅瀬の海耕作（seaCultivated）は陸隣接時に baseSeaCult * 10
                const baseSeaCult = Math.max(0, vm.seaCultivatedGenerationProbability || 0);
                const pcSeaCult = isAdjacentToLand(gx, gy) ? clamp01(baseSeaCult * 5) : baseSeaCult;
                // 開始セルの採択は座標由来のシードで決定（安定化）
                const startSeaCultRng = getStartRng(vm, 'sea-cultivated-start', gx, gy, rSeaCult);
                if (!seaCultivatedMask[idx]) {
                    maybeStartClusterAtCell({
                        vm,
                        gx,
                        gy,
                        idx,
                        startProbability: pcSeaCult,
                        startRng: startSeaCultRng,
                        clusterRngKey: 'sea-cultivated-cluster',
                        poissonMean: 5,
                        poissonMax: 50,
                        dirs: DIRS8,
                        seededRng,
                        acceptP: 0.6,
                        canFill: (nIdx) => {
                            // 拡張条件: 浅瀬・未seaCity・未seaCultivated
                            if (colors[nIdx] !== shallowSeaColor) return false;
                            if (seaCityMask[nIdx]) return false;
                            if (seaCultivatedMask[nIdx]) return false;
                            return true;
                        },
                        onFill: (nIdx) => { seaCultivatedMask[nIdx] = true; }
                    });
                }
                // seaCity（seaCultivated の後で上書き）浅瀬の海都市（seaCity）も adjacencyMultiplier:10 を渡しており、陸隣接時に10倍扱い
                if (seaCityMask[idx]) continue;
                const baseSeaCity = Math.max(0, vm.seaCityGenerationProbability || 0);
                const pcSeaCity = getBiasedCityProbability({
                    vm,
                    gx,
                    gy,
                    baseProbability: baseSeaCity,
                    isAdjacentFn: isAdjacentToLand,
                    biasScale: cityBiasScale,
                    biasMin: cityBiasMin,
                    biasMax: cityBiasMax,
                    adjacencyMultiplier: 5
                });
                // 開始セルの採択は座標由来のシードで決定（安定化）
                const startSeaCityRng = getStartRng(vm, 'sea-city-start', gx, gy, rSeaCity);
                if (!seaCityMask[idx]) {
                    maybeStartClusterAtCell({
                        vm,
                        gx,
                        gy,
                        idx,
                        startProbability: pcSeaCity,
                        startRng: startSeaCityRng,
                        clusterRngKey: 'sea-city-cluster',
                        poissonMean: 3,
                        poissonMax: 50,
                        dirs: DIRS8,
                        seededRng,
                        acceptP: 0.6,
                        canFill: (nIdx) => {
                            // 拡張条件: 浅瀬・未seaCity
                            if (colors[nIdx] !== shallowSeaColor) return false;
                            if (seaCityMask[nIdx]) return false;
                            return true;
                        },
                        onFill: (nIdx) => { seaCityMask[nIdx] = true; }
                    });
                }
            }
        }
        // 追加: 海棲汚染地の生成（海棲文明時代のみ、浅瀬/海棲都市/海棲耕作地セル上に生成、クラスター平均サイズ ~20）
        const countSeaPolluted = Math.max(0, Math.floor(Number(vm.seaPollutedAreasCount || 0)));
        if (countSeaPolluted > 0) {
            // 陸隣接セルに重み10、内陸に重み1（seaCityと同様の陸隣接優遇）
            generatePollutedAreas(vm, {
                N,
                countAreas: countSeaPolluted,
                isEligible: (i) => (colors[i] === shallowSeaColor || seaCityMask[i] || seaCultivatedMask[i]),
                weightFn: (idx0) => {
                    const sx = idx0 % vm.gridWidth;
                    const sy = Math.floor(idx0 / vm.gridWidth);
                    return isAdjacentToLand(sx, sy) ? 10 : 1;
                },
                pickRngKey: 'sea-polluted-pick',
                clusterRngKey: 'sea-polluted-cluster',
                targetMean: 20,
                targetMax: 200,
                dirs: DIRS8,
                pollutedMask: seaPollutedMask,
                canExpand: (nIdx) => (colors[nIdx] === shallowSeaColor || seaCityMask[nIdx] || seaCultivatedMask[nIdx])
            });
        }
    }

    return {
        cityMask,
        cultivatedMask,
        bryophyteMask,
        pollutedMask,
        seaCityMask,
        seaCultivatedMask,
        seaPollutedMask
    };
}


