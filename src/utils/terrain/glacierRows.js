// 平均気温から氷河行数（上端・下端）を算出する
// - Grids_Calculation.vue から切り出し（機能不変）
// - internalTopGlacierRows / lastReturnedGlacierRows は vm 側の状態として保持する（平滑化のため）

import { computeGlacierBaseRowsFromTemperature } from './glacierAnchors.js';

function computeGlacierSlope(ratio_ocean, ratio_ocean_ref = 0.7) {
    return Math.pow(Math.max(0.15, ratio_ocean / ratio_ocean_ref), 0.7);
}

// sea率に基づく追加ブーストを計算（seaBoostFactorは調整可能な倍率で大きいほど海率の氷河形成への影響を強くする）
function computeSeaBoost(v_calc, ratio_ocean, ratio_ocean_ref = 0.7, seaBoostFactor = 1.6, V_REF = 2) {
    const seaExcess = Math.max(0, ratio_ocean - ratio_ocean_ref);
    const seaExcessScaled = seaExcess > 0 ? Math.pow(seaExcess, 0.5) : 0;
    const positiveDelta = Math.max(0, v_calc - V_REF);
    return seaExcessScaled * seaBoostFactor * positiveDelta;
}

export function computeTopGlacierRowsFromAverageTemperature(vm, ratioOceanOverride) {
    const t = (typeof vm.averageTemperature === 'number') ? vm.averageTemperature : 15;
    const v_calc = computeGlacierBaseRowsFromTemperature(t);

    const ratio_ocean = (typeof ratioOceanOverride === 'number')
        ? Math.min(1, Math.max(0, ratioOceanOverride))
        : Math.min(1, Math.max(0, vm.seaLandRatio ?? 0.7));
    const ratio_ocean_ref = 0.7;

    const glacierSlope = computeGlacierSlope(ratio_ocean, ratio_ocean_ref);
    const V_REF = 2;
    const v_eff_slope = V_REF + (v_calc - V_REF) * glacierSlope;

    const v_boost = computeSeaBoost(v_calc, ratio_ocean, ratio_ocean_ref, 1.6, V_REF);
    const v_eff = v_eff_slope + v_boost;

    const glacier_alpha = vm.glacier_alpha ?? 1;
    if (vm.internalTopGlacierRows == null) vm.internalTopGlacierRows = v_eff;
    vm.internalTopGlacierRows = glacier_alpha * v_eff + (1 - glacier_alpha) * vm.internalTopGlacierRows;
    if (vm.lastReturnedGlacierRows == null) vm.lastReturnedGlacierRows = Math.round(vm.internalTopGlacierRows);
    const rounded = Math.round(vm.internalTopGlacierRows);
    if (Math.abs(rounded - vm.lastReturnedGlacierRows) >= 1) vm.lastReturnedGlacierRows = rounded;
    return vm.lastReturnedGlacierRows;
}


