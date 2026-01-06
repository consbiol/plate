// パラメータ定義の集中管理
// - UI（Parameters_Display.vue）の props default
// - local 初期化
// - era 一覧
// を1箇所にまとめ、設定追加/変更時の修正漏れを減らす。

export const ERAS = Object.freeze([
    '爆撃時代',
    '生命発生前時代',
    '嫌気性細菌誕生時代',
    '光合成細菌誕生時代',
    '真核生物誕生時代',
    '多細胞生物誕生時代',
    '海洋生物多様化時代',
    '苔類進出時代',
    'シダ植物時代',
    '大森林時代',
    '文明時代',
    '海棲文明時代'
]);

export const GRID_DEFAULTS = Object.freeze({
    gridWidth: 200,
    gridHeight: 100
});

// Parameters_Display の props default 値（型定義はコンポーネント側で行う）
export const PARAM_DEFAULTS = Object.freeze({
    centersY: 7,
    seaLandRatio: 0.3,
    minCenterDistance: 20,
    baseSeaDistanceThreshold: 5,
    baseLandDistanceThreshold: 10,
    greenIndex: 1.0,
    // 低地↔乾燥地の帯別距離閾値をGIで自動更新するか（ONで自動、OFFで手動上書き）
    landDistanceThresholdAuto: true,
    landDistanceThreshold1: 10,
    landDistanceThreshold2: 15,
    landDistanceThreshold3: 15,
    landDistanceThreshold4: 10,
    landDistanceThreshold5: 8,
    landDistanceThreshold6: 4,
    landDistanceThreshold7: 1,
    landDistanceThreshold8: 4,
    landDistanceThreshold9: 8,
    landDistanceThreshold10: 15,
    landBandVerticalWobbleRows: 2,
    tundraExtraRows: 5,
    topGlacierRows: 5,
    landGlacierExtraRows: 3,
    highlandGlacierExtraRows: 7,
    alpineGlacierExtraRows: 12,
    averageLakesPerCenter: 2,
    averageHighlandsPerCenter: 5,
    f_cloud: 0.67,
    cityProbability: 0.002,
    cultivatedProbability: 0.05,
    bryophyteProbability: 0.005,
    pollutedAreasCount: 1,
    seaCityProbability: 0.002,
    seaCultivatedProbability: 0.05,
    seaPollutedAreasCount: 1,
    showCentersRed: false,
    centerBias: 0.5
});

// data().local の初期化（propsの値を優先しつつ、未props項目もここで定義）
export function createLocalParams(vm) {
    return {
        centersY: vm.centersY,
        seaLandRatio: vm.seaLandRatio,
        f_cloud: vm.f_cloud,
        minCenterDistance: vm.minCenterDistance,
        baseSeaDistanceThreshold: vm.baseSeaDistanceThreshold,
        baseLandDistanceThreshold: vm.baseLandDistanceThreshold,
        greenIndex: undefined,
        landDistanceThresholdAuto: vm.landDistanceThresholdAuto,
        tundraExtraRows: vm.tundraExtraRows,
        topGlacierRows: vm.topGlacierRows,
        landBandVerticalWobbleRows: vm.landBandVerticalWobbleRows,
        landDistanceThreshold1: vm.landDistanceThreshold1,
        landDistanceThreshold2: vm.landDistanceThreshold2,
        landDistanceThreshold3: vm.landDistanceThreshold3,
        landDistanceThreshold4: vm.landDistanceThreshold4,
        landDistanceThreshold5: vm.landDistanceThreshold5,
        landDistanceThreshold6: vm.landDistanceThreshold6,
        landDistanceThreshold7: vm.landDistanceThreshold7,
        landDistanceThreshold8: vm.landDistanceThreshold8,
        landDistanceThreshold9: vm.landDistanceThreshold9,
        landDistanceThreshold10: vm.landDistanceThreshold10,
        landGlacierExtraRows: vm.landGlacierExtraRows,
        highlandGlacierExtraRows: vm.highlandGlacierExtraRows,
        alpineGlacierExtraRows: vm.alpineGlacierExtraRows,
        averageLakesPerCenter: vm.averageLakesPerCenter,
        // 追加のUI入力（propsではない）
        deterministicSeed: '',
        cityProbability: vm.cityProbability,
        cultivatedProbability: vm.cultivatedProbability,
        bryophyteProbability: vm.bryophyteProbability,
        pollutedAreasCount: vm.pollutedAreasCount,
        seaCityProbability: vm.seaCityProbability,
        seaCultivatedProbability: vm.seaCultivatedProbability,
        seaPollutedAreasCount: vm.seaPollutedAreasCount,
        showCentersRed: vm.showCentersRed,
        centerBias: vm.centerBias,
        // mountedで storeEra に同期（初期はnullでOK）
        era: null
    };
}


