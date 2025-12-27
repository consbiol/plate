// 平均気温から氷河行数（上端・下端）を算出する
// - Grids_Calculation.vue から切り出し（機能不変）
// - internalTopGlacierRows / lastReturnedGlacierRows は vm 側の状態として保持する（平滑化のため）

import { computeGlacierBaseRowsFromTemperature, GLACIER_LAND_ANCHOR } from './glacierAnchors.js';

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

function getGlacierRowsState(vm, stateKey) {
    // Backward-compatible default: keep using the historical vm fields
    if (stateKey == null) {
        return {
            getInternal: () => vm.internalTopGlacierRows,
            setInternal: (v) => { vm.internalTopGlacierRows = v; },
            getLast: () => vm.lastReturnedGlacierRows,
            setLast: (v) => { vm.lastReturnedGlacierRows = v; }
        };
    }

    // New: separate smoothing state per key (e.g. 'land' / 'water')
    if (vm._glacierRowsState == null) vm._glacierRowsState = {};
    if (vm._glacierRowsState[stateKey] == null) vm._glacierRowsState[stateKey] = {
        internalTopGlacierRows: null,
        lastReturnedGlacierRows: null
    };
    const s = vm._glacierRowsState[stateKey];
    return {
        getInternal: () => s.internalTopGlacierRows,
        setInternal: (v) => { s.internalTopGlacierRows = v; },
        getLast: () => s.lastReturnedGlacierRows,
        setLast: (v) => { s.lastReturnedGlacierRows = v; }
    };
}

export function computeTopGlacierRowsFromAverageTemperature(vm, ratioOceanOverride, stateKey = null) {
    const t = (typeof vm.averageTemperature === 'number') ? vm.averageTemperature : 15;

    // --- Water: use the anchors (GLACIER_TEMP_ANCHORS) directly, no seaBoost/slope ---
    if (stateKey === 'water') {
        const v_calc = computeGlacierBaseRowsFromTemperature(t);
        const glacier_alpha = vm.glacier_alpha ?? 0.02;
        const st = getGlacierRowsState(vm, stateKey);
        if (st.getInternal() == null) st.setInternal(v_calc);
        st.setInternal(glacier_alpha * v_calc + (1 - glacier_alpha) * st.getInternal());
        if (st.getLast() == null) st.setLast(Math.round(st.getInternal()));
        const rounded = Math.round(st.getInternal());
        if (Math.abs(rounded - st.getLast()) >= 1) st.setLast(rounded);
        return st.getLast();
    }

    // --- Land: use single-anchor at t=15,val=2 (from GLACIER_LAND_ANCHOR) as the base, then apply slope + seaBoost ---
    // linear extrapolation with slope -1 outside anchor
    const v_calc = GLACIER_LAND_ANCHOR.val + (t - GLACIER_LAND_ANCHOR.t) * (-1);

    const ratio_ocean = (typeof ratioOceanOverride === 'number')
        ? Math.min(1, Math.max(0, ratioOceanOverride))
        : Math.min(1, Math.max(0, vm.seaLandRatio ?? 0.7));
    const ratio_ocean_ref = 0.7;

    const glacierSlope = computeGlacierSlope(ratio_ocean, ratio_ocean_ref);
    const V_REF = 2;
    const v_eff_slope = V_REF + (v_calc - V_REF) * glacierSlope;

    const v_boost = computeSeaBoost(v_calc, ratio_ocean, ratio_ocean_ref, 1.6, V_REF);
    const v_eff = v_eff_slope + v_boost;

    const glacier_alpha = vm.glacier_alpha ?? 0.02;

    const st = getGlacierRowsState(vm, stateKey);
    if (st.getInternal() == null) st.setInternal(v_eff);
    st.setInternal(glacier_alpha * v_eff + (1 - glacier_alpha) * st.getInternal());
    if (st.getLast() == null) st.setLast(Math.round(st.getInternal()));
    const rounded = Math.round(st.getInternal());
    if (Math.abs(rounded - st.getLast()) >= 1) st.setLast(rounded);
    return st.getLast();
}

/**
 * smoothed（glacier_alpha による遅延）後の内部値を返す。
 * - 注意: この関数は state を「更新」しません（乱数ではないが、平滑化 state を進める副作用があるため）。
 *   先に computeTopGlacierRowsFromAverageTemperature を1回だけ呼び出し、その直後に参照してください。
 * - 戻り値は小数の内部値（st.getInternal）または null→0 のフォールバックです。
 */
export function getSmoothedGlacierRows(vm, ratioOceanOverride, stateKey = null) {
    const st = getGlacierRowsState(vm, stateKey);
    const internal = st.getInternal();
    return (typeof internal === 'number') ? internal : 0;
}


