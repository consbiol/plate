// 想定: Web Worker などからも再利用できるよう、地形生成に必要な入力だけを
// 集約した純粋関数を提供する。
export const GENERATION_JOB_INPUT_KEYS = [
  'gridWidth',
  'gridHeight',
  'seaLandRatio',
  'centersY',
  'minCenterDistance',
  'centerBias',
  'noiseAmp',
  'kDecay',
  'singleCellRemovalProb',
  'baseSeaDistanceThreshold',
  'baseLandDistanceThreshold',
  'landBandVerticalWobbleRows',
  'landDistanceThreshold1',
  'landDistanceThreshold2',
  'landDistanceThreshold3',
  'landDistanceThreshold4',
  'landDistanceThreshold5',
  'landDistanceThreshold6',
  'landDistanceThreshold7',
  'landDistanceThreshold8',
  'landDistanceThreshold9',
  'landDistanceThreshold10',
  'averageTemperature',
  'topGlacierRows',
  'topTundraRows',
  'tundraExtraRows',
  'landGlacierExtraRows',
  'highlandGlacierExtraRows',
  'alpineGlacierExtraRows',
  'averageLakesPerCenter',
  'averageHighlandsPerCenter',
  'centerParameters',
  'deterministicSeed',
  'era',
  'showCentersRed',
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
