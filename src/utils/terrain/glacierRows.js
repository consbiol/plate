// 平均気温から氷河行数（上端・下端）を算出する
// - Grids_Calculation.vue から切り出し（機能不変）
// - internalTopGlacierRows / lastReturnedGlacierRows は vm 側の状態として保持する（平滑化のため）

function interpAnchors(t, anchors) {
  if (t <= anchors[0].t) {
    return anchors[0].val + (t - anchors[0].t) * (-1);
  }
  const last = anchors[anchors.length - 1];
  if (t >= last.t) {
    return last.val + (t - last.t) * (-1);
  }
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i];
    const b = anchors[i + 1];
    if (t >= a.t && t <= b.t) {
      const ratio = (t - a.t) / (b.t - a.t);
      return a.val + ratio * (b.val - a.val);
    }
  }
  return 0;
}

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

  const anchors = [
    { t: -25, val: 42 },
    { t: -15, val: 32 },
    { t: -5,  val: 22 },
    { t: 5,   val: 12 },
    { t: 10,  val: 7  },
    { t: 15,  val: 2  },
    { t: 25,  val: -8 }
  ];

  const v_calc = interpAnchors(t, anchors);

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


