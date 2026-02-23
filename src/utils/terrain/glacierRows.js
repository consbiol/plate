import { computeGlacierBaseRowsFromTemperature, GLACIER_LAND_ANCHOR } from './glacierAnchors.js';

const DEFAULT_AVG_TEMP = 15;
const DEFAULT_RATIO_OCEAN = 0.7;
const DEFAULT_GLACIER_ALPHA = 0.02;
const SEA_BOOST_FACTOR = 1.6;
const V_REF = 2;

const clamp01 = (value) => Math.min(1, Math.max(0, value));

const computeGlacierSlope = (ratio_ocean, ratio_ocean_ref = DEFAULT_RATIO_OCEAN) => (
  Math.pow(Math.max(0.15, ratio_ocean / ratio_ocean_ref), 0.7)
);

const computeSeaBoost = (
  v_calc,
  ratio_ocean,
  ratio_ocean_ref = DEFAULT_RATIO_OCEAN,
  seaBoostFactor = SEA_BOOST_FACTOR,
  vRef = V_REF
) => {
  const seaExcess = Math.max(0, ratio_ocean - ratio_ocean_ref);
  const seaExcessScaled = seaExcess > 0 ? Math.pow(seaExcess, 0.5) : 0;
  const positiveDelta = Math.max(0, v_calc - vRef);
  return seaExcessScaled * seaBoostFactor * positiveDelta;
};

function resolveGlacierRowsState(state, stateKey) {
  if (state && typeof state.getInternal === 'function') return state;
  if (!state) {
    return {
      getInternal: () => null,
      setInternal: () => {},
      getLast: () => null,
      setLast: () => {}
    };
  }
  if (stateKey == null) {
    return {
      getInternal: () => state.internalTopGlacierRows,
      setInternal: (v) => { state.internalTopGlacierRows = v; },
      getLast: () => state.lastReturnedGlacierRows,
      setLast: (v) => { state.lastReturnedGlacierRows = v; }
    };
  }
  if (!state.byKey) state.byKey = {};
  if (!state.byKey[stateKey]) {
    state.byKey[stateKey] = {
      internalTopGlacierRows: null,
      lastReturnedGlacierRows: null
    };
  }
  const s = state.byKey[stateKey];
  return {
    getInternal: () => s.internalTopGlacierRows,
    setInternal: (v) => { s.internalTopGlacierRows = v; },
    getLast: () => s.lastReturnedGlacierRows,
    setLast: (v) => { s.lastReturnedGlacierRows = v; }
  };
}

const smoothAndQuantize = (st, target, alpha) => {
  if (st.getInternal() == null) st.setInternal(target);
  st.setInternal(alpha * target + (1 - alpha) * st.getInternal());
  if (st.getLast() == null) st.setLast(Math.round(st.getInternal()));
  const rounded = Math.round(st.getInternal());
  if (Math.abs(rounded - st.getLast()) >= 1) st.setLast(rounded);
  return st.getLast();
};

export function computeTopGlacierRowsFromAverageTemperature({
  averageTemperature,
  glacierAlpha,
  seaLandRatio,
  state
}, ratioOceanOverride, stateKey = null) {
  const t = (typeof averageTemperature === 'number') ? averageTemperature : DEFAULT_AVG_TEMP;
  const glacier_alpha = (typeof glacierAlpha === 'number') ? glacierAlpha : DEFAULT_GLACIER_ALPHA;
  const st = resolveGlacierRowsState(state, stateKey);

  if (stateKey === 'water') {
    const v_calc = computeGlacierBaseRowsFromTemperature(t);
    return smoothAndQuantize(st, v_calc, glacier_alpha);
  }

  const v_calc = GLACIER_LAND_ANCHOR.val + (t - GLACIER_LAND_ANCHOR.t) * (-1);
  const ratio_ocean = (typeof ratioOceanOverride === 'number')
    ? clamp01(ratioOceanOverride)
    : clamp01((typeof seaLandRatio === 'number') ? seaLandRatio : DEFAULT_RATIO_OCEAN);

  const glacierSlope = computeGlacierSlope(ratio_ocean, DEFAULT_RATIO_OCEAN);
  const v_eff_slope = V_REF + (v_calc - V_REF) * glacierSlope;
  const v_boost = computeSeaBoost(v_calc, ratio_ocean, DEFAULT_RATIO_OCEAN, SEA_BOOST_FACTOR, V_REF);
  const v_eff = v_eff_slope + v_boost;
  return smoothAndQuantize(st, v_eff, glacier_alpha);
}

export function computeTopGlacierRowsPure(temperature, ratioOceanOverride, stateKey = null) {
  const t = (typeof temperature === 'number') ? temperature : DEFAULT_AVG_TEMP;
  if (stateKey === 'water') {
    const v_calc = computeGlacierBaseRowsFromTemperature(t);
    return Math.round(v_calc);
  }

  const v_calc = GLACIER_LAND_ANCHOR.val + (t - GLACIER_LAND_ANCHOR.t) * (-1);
  const ratio_ocean = (typeof ratioOceanOverride === 'number')
    ? clamp01(ratioOceanOverride)
    : DEFAULT_RATIO_OCEAN;

  const glacierSlope = computeGlacierSlope(ratio_ocean, DEFAULT_RATIO_OCEAN);
  const v_eff_slope = V_REF + (v_calc - V_REF) * glacierSlope;
  const v_boost = computeSeaBoost(v_calc, ratio_ocean, DEFAULT_RATIO_OCEAN, SEA_BOOST_FACTOR, V_REF);
  const v_eff = v_eff_slope + v_boost;
  return Math.round(v_eff);
}

export function getSmoothedGlacierRows({ state }, ratioOceanOverride, stateKey = null) {
  void ratioOceanOverride;
  const st = resolveGlacierRowsState(state, stateKey);
  const internal = st.getInternal();
  return (typeof internal === 'number') ? internal : 0;
}
