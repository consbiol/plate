// 想定: Web Worker などからも再利用できるよう、地形生成に必要な入力だけを
// 集約した純粋関数を提供する。
export const GENERATION_JOB_INPUT_KEYS = [
  'gridWidth',
  'gridHeight',
  'seaLandRatio',
  'centersY',
  'minCenterDistance',
  'noiseAmp',
  'kDecay',
  'baseSeaDistanceThreshold',
  'baseLandDistanceThreshold',
  'landBandVerticalWobbleRows',
  'averageTemperature',
  'deterministicSeed',
  'era',
  'centerBias',
  'topGlacierRows',
  'topTundraRows',
  'tundraExtraRows',
  'cityGenerationProbability',
  'cultivatedGenerationProbability',
  'bryophyteGenerationProbability',
  'pollutedAreasCount',
  'seaCityGenerationProbability',
  'seaCultivatedGenerationProbability',
  'seaPollutedAreasCount'
];

export function buildGenerationJobInputs(config) {
  if (!config || typeof config !== 'object') return {};
  return GENERATION_JOB_INPUT_KEYS.reduce((acc, key) => {
    acc[key] = config[key];
    return acc;
  }, {});
}
