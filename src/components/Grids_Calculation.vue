<template>
  <div style="display:none"></div>
</template>

<script>
import { getEraTerrainColors, getDefaultTerrainColors } from '../utils/colors.js';
import { createSeededRng, createDerivedRng } from '../utils/rng.js';
import {
  torusDistance as torusDistanceUtil,
  torusDirection as torusDirectionUtil,
  torusWrap as torusWrapUtil
} from '../utils/torus.js';
import { generateLakes, applyLowlandAroundLakes } from '../utils/terrain/lakes.js';
import { generateHighlands } from '../utils/terrain/highlands.js';
import { generateAlpines } from '../utils/terrain/alpines.js';
import { generateFeatures } from '../utils/terrain/features.js';
import { computeDistanceMap } from '../utils/pathfinding/distanceMap.js';
import { applyGlaciers } from '../utils/terrain/glaciers.js';
import { applyTundra } from '../utils/terrain/tundra.js';
import { dilateLandMask, removeSingleCellIslands, jitterCoastline } from '../utils/terrain/landmask.js';
import { sampleLandCenters, computeScoresForCenters, computeOwnerCenterIdx } from '../utils/terrain/centers.js';
import { mapSeaLandRatio } from '../utils/terrain/ratio.js';
import { buildVisualNoiseGrid, getDirections8 } from '../utils/terrain/noiseGrid.js';
import { classifyBaseColors } from '../utils/terrain/classifyColors.js';
import { buildCenterLandCells } from '../utils/terrain/centerCells.js';
import { buildGridData, markCentersOnGridData } from '../utils/terrain/gridData.js';
import { applySeededLogToCenterParameters } from '../utils/terrain/centerParams.js';
import { computePreGlacierStats, buildGeneratedPayload } from '../utils/terrain/output.js';
import { computeTopGlacierRowsFromAverageTemperature, getSmoothedGlacierRows, computeTopGlacierRowsPure } from '../utils/terrain/glacierRows.js';
import { noise2D as noise2DUtil, fractalNoise2D as fractalNoise2DUtil } from '../utils/noise.js';
import { poissonSample } from '../utils/stats/poisson.js';
import { PARAM_DEFAULTS } from '../utils/paramsDefaults.js';
// このコンポーネントは「計算専用」です（UIや描画は行いません）。
// 概要:
// 1) 陸中心のサンプリングと各中心の影響（スコア）計算
// 2) スコアに基づく海/陸の初期マスク生成（海陸比を保つ閾値）
// 3) 膨張（ディレーション）により連結性を強化（トーラスを考慮）
// 4) BFSで海まで/陸までの距離を算出（後段の分類に使用）
// 5) 陸は「低地/乾燥地」に分類、湖を生成し浅瀬で上書き、湖の周囲を低地で縁取り
// 6) 高地を生成し灰色がかった茶色で上書き（各中心点ごと、サイズは湖の10倍、形状はメイン方向に沿った帯状で横方向にノイズ性の広がりを持つ）
// 7) 低地の一部をツンドラへ上書き
// 8) 最後に氷河で上書き（海・湖を含めて最終段）
// トーラス接続の定義:
// - 左右端は通常のラップ（0↔gridSize-1）
// - 上端は「左半分↔右半分」を同じ上端行(y=0)で接続
// - 下端は「左半分↔右半分」を同じ下端行(y=gridSize-1)で接続
export default {
  name: 'Grids_Calculation',
  props: {
    gridWidth: { type: Number, required: true },
    gridHeight: { type: Number, required: true },
    seaLandRatio: { type: Number, required: true },
    centersY: { type: Number, required: true },
    minCenterDistance: { type: Number, required: true },
    noiseAmp: { type: Number, required: true, default: 0.08 },
    kDecay: { type: Number, required: true, default: 2.0 },
    baseSeaDistanceThreshold: { type: Number, required: true },
    baseLandDistanceThreshold: { type: Number, required: true },
    // 平均気温(°C): 氷河行数の大本パラメータ
    averageTemperature: { type: Number, required: false, default: 15 },
    // per-latitude-band vertical wobble (rows): integer number of rows to shift (+/-)
    landBandVerticalWobbleRows: { type: Number, required: false, default: 2 },
    // per-latitude-band land distance thresholds (bands 1..10, pole->equator)
    landDistanceThreshold1: { type: Number, required: false, default: 10 },
    landDistanceThreshold2: { type: Number, required: false, default: 15 },
    landDistanceThreshold3: { type: Number, required: false, default: 15 },
    landDistanceThreshold4: { type: Number, required: false, default: 10 },
    landDistanceThreshold5: { type: Number, required: false, default: 8 },
    landDistanceThreshold6: { type: Number, required: false, default: 4 },
    landDistanceThreshold7: { type: Number, required: false, default: 1 },
    landDistanceThreshold8: { type: Number, required: false, default: 4 },
    landDistanceThreshold9: { type: Number, required: false, default: 8 },
    landDistanceThreshold10: { type: Number, required: false, default: 15 },
    // 上端・下端ツンドラ追加グリッド数（UI設定値そのもの）
    // ※ topTundraRows は負値をクランプする都合で差分復元すると膨張するため、こちらを優先して使う
    tundraExtraRows: { type: Number, required: false, default: 0 },
    topTundraRows: { type: Number, required: true },
    topGlacierRows: { type: Number, required: true },
    landGlacierExtraRows: { type: Number, required: true },
    highlandGlacierExtraRows: { type: Number, required: true },
    alpineGlacierExtraRows: { type: Number, required: true },
    averageLakesPerCenter: { type: Number, required: true },
    averageHighlandsPerCenter: { type: Number, required: true },
    centerParameters: { type: Array, required: true },
    generateSignal: { type: Number, required: true },
    // Update（Generateと同等だが中心点座標を維持）用シグナル
    updateSignal: { type: Number, required: false, default: 0 },
    // 高頻度生成タスク（氷河・乾燥地の再計算）用シグナル
    reviseSignal: { type: Number, required: false, default: 0 },
    // Drift（大陸中心点の移動 + 全ノイズ再抽選）用シグナル
    driftSignal: { type: Number, required: false, default: 0 },
    // 都市グリッド生成の確率（低地のみ、海隣接で10倍）
    cityGenerationProbability: { type: Number, required: false, default: 0.002 },
    // 耕作地グリッド生成の確率（低地のみ、海隣接で10倍）
    cultivatedGenerationProbability: { type: Number, required: false, default: 0.05 },
    // 苔類進出地グリッド生成の確率（低地のみ、海隣接で100倍、苔類進出時代のみ生成）
    bryophyteGenerationProbability: { type: Number, required: false, default: 0.005 },
    // 汚染地クラスター数（マップ全体、開始セルはシードで決定）
    pollutedAreasCount: { type: Number, required: false, default: 1 },
    // 海棲都市グリッド生成の確率（浅瀬のみ、陸隣接で10倍）
    seaCityGenerationProbability: { type: Number, required: false, default: 0.002 },
    // 海棲耕作地グリッド生成の確率（浅瀬のみ、陸隣接で10倍）
    seaCultivatedGenerationProbability: { type: Number, required: false, default: 0.05 },
    // 海棲汚染地クラスター数（マップ全体、開始セルはシードで決定）
    seaPollutedAreasCount: { type: Number, required: false, default: 1 },
    // 大陸中心点を赤で表示（平面地図オーバーレイ）
    showCentersRed: { type: Boolean, required: false, default: true },
    // 中心点近傍の陸生成バイアス（0で無効、値を上げると中心付近が陸になりやすい）
    centerBias: { type: Number, required: false, default: 0.8 },
    // 指定要素のみ決定化するためのシード（未指定時は従来通り）
    deterministicSeed: { type: [Number, String], required: false, default: null },
    // 時代（パレット切替用、未指定ならデフォルト色）
    era: { type: String, required: false, default: null }
  },
  data() {
    return {
      // prop を直接変更しないための内部ステート
      internalTopGlacierRows: this.topGlacierRows,
      lastReturnedGlacierRows: null,
      // Generate時に「高頻度更新に必要なものだけ」キャッシュする
      hfCache: null,
      // 帯の縦揺らぎは Generate 時に固定（Revise では固定値を使う）
      wobbleRowsFixed: null,
      // 低頻度タスク側の baseLandDistanceThreshold を固定（Revise では固定値を使う）
      baseLandDistanceThresholdFixed: null,
      // Drift中は deterministicSeed 由来の派生RNG（shape-profile等）を無効化して「全ノイズをランダム」にする
      forceRandomDerivedRng: false,

      // --- Drift の「ターン」状態（driftSignal 1回 = 1ターン） ---
      driftTurn: 0,
      // 現在のフェーズ（true=接近, false=反発）
      driftIsApproach: true,
      superPloom_calc: 0,
      superPloom_history: [],
      // Parameters Output に出す用（直近ターンの値）
      driftMetrics: null
    };
  },
  watch: {
    generateSignal() {
      this.runGenerate();
    },
    updateSignal() {
      // Update は中心座標を維持するが、ドリフト状態（superPloom_calc/superPloom/phase）は
      // 初期化せずにそのまま保持する（generate と挙動を分ける）。
      this.runGenerate({ preserveCenterCoordinates: true });
    },
    reviseSignal() {
      this.runReviseHighFrequency();
    },
    driftSignal() {
      this.runDrift();
    }
  },
  methods: {
    // --- ctx builders: ctx 化のために依存を明示する（挙動は変えない） ---
    _buildLakesCtx() {
      return {
        gridWidth: this.gridWidth,
        gridHeight: this.gridHeight,
        era: this.era,
        averageLakesPerCenter: this.averageLakesPerCenter,
        baseLandDistanceThreshold: this.baseLandDistanceThreshold,
        torusWrap: (...args) => this.torusWrap(...args),
        _poissonSample: (...args) => this._poissonSample(...args),
        _getDerivedRng: (...args) => this._getDerivedRng(...args),
        _getLandDistanceThresholdForRow: (...args) => this._getLandDistanceThresholdForRow(...args),
        // 結果の持ち帰り（従来互換）
        _lastLakesList: null
      };
    },
    _buildHighlandsCtx() {
      return {
        gridWidth: this.gridWidth,
        gridHeight: this.gridHeight,
        era: this.era,
        seaLandRatio: this.seaLandRatio,
        torusWrap: (...args) => this.torusWrap(...args),
        _poissonSample: (...args) => this._poissonSample(...args),
        _getDerivedRng: (...args) => this._getDerivedRng(...args)
      };
    },
    _buildFeaturesCtx() {
      return {
        gridWidth: this.gridWidth,
        gridHeight: this.gridHeight,
        era: this.era,
        torusWrap: (...args) => this.torusWrap(...args),
        _getDerivedRng: (...args) => this._getDerivedRng(...args),
        _poissonSample: (...args) => this._poissonSample(...args),
        fractalNoise2D: (...args) => this.fractalNoise2D(...args),
        // probabilities / counts
        cityGenerationProbability: this.cityGenerationProbability,
        cultivatedGenerationProbability: this.cultivatedGenerationProbability,
        bryophyteGenerationProbability: this.bryophyteGenerationProbability,
        pollutedAreasCount: this.pollutedAreasCount,
        seaCityGenerationProbability: this.seaCityGenerationProbability,
        seaCultivatedGenerationProbability: this.seaCultivatedGenerationProbability,
        seaPollutedAreasCount: this.seaPollutedAreasCount
      };
    },
    _buildLakeLowlandCtx() {
      return {
        gridWidth: this.gridWidth,
        gridHeight: this.gridHeight,
        torusWrap: (...args) => this.torusWrap(...args),
        _getLandDistanceThresholdForRow: (...args) => this._getLandDistanceThresholdForRow(...args)
      };
    },
    // サブRNG（サブストリーム）生成: ベースの deterministicSeed にラベルを連結して独立RNGを作る
    _getDerivedRng(...labels) {
      if (this.forceRandomDerivedRng) return null;
      return createDerivedRng(this.deterministicSeed, ...labels);
    },
    // --- シード対応RNG（mulberry32 + xmur3） ---
    // 実装は `src/utils/rng.js` に集約（機能は同一、乱数列の再現性も同じ）。
    _getSeededRng() {
      return createSeededRng(this.deterministicSeed);
    },
    // トーラス上の距離（xは通常ラップ、yは端で半分ずらして接続）
    torusDistance(x1, y1, x2, y2) {
      return torusDistanceUtil(this.gridWidth, this.gridHeight, x1, y1, x2, y2);
    },
    // トーラス上での最短経路の方向ベクトルを計算（角度計算用）
    // 戻り値: { dx, dy } トーラス上での最短経路の方向
    torusDirection(x1, y1, x2, y2) {
      return torusDirectionUtil(this.gridWidth, this.gridHeight, x1, y1, x2, y2);
    },
    // トーラス上の座標ラップ（近傍探索やBFSで使用）
    // 戻り値: ラップ後の座標（無効ならnull）
    torusWrap(x, y) {
      return torusWrapUtil(this.gridWidth, this.gridHeight, x, y);
    },
    // 緯度帯インデックスを取得（1..10）。両極から5行ごとに帯を区切る。
    _getLatBandIndex(y, x) {
      const wobbleRows = (this.wobbleRowsFixed != null)
        ? Math.max(0, Math.floor(this.wobbleRowsFixed || 0))
        : Math.max(0, Math.floor(this.landBandVerticalWobbleRows || 0));
      let yShifted = y;
      if (wobbleRows > 0) {
        // 実行ごと完全ランダム（シード非依存）。runGenerateで列ごと事前計算があればそれを使用。
        const pre = this._wobbleShiftByX && Number.isFinite(this._wobbleShiftByX[x]) ? this._wobbleShiftByX[x] : null;
        const shift = (pre != null)
          ? pre
          : Math.round((Math.random() * 2 - 1) * wobbleRows);
        yShifted = Math.max(0, Math.min(this.gridHeight - 1, y + shift));
      }
      const dPole = Math.min(yShifted, this.gridHeight - 1 - yShifted);
      const band = Math.floor(dPole / 5) + 1;
      if (band < 1) return 1;
      if (band > 10) return 10;
      return band;
    },
    // 指定行/列の land distance threshold を返す
    _getLandDistanceThresholdForRow(y, x) {
      const b = this._getLatBandIndex(y, x);
      // `baseLandDistanceThreshold` を「全帯に効く基準オフセット」として扱う。
      // これにより、UIの「基準値」を変更して Revise しても乾燥地が反映される。
      const baseDefault = Number(PARAM_DEFAULTS && PARAM_DEFAULTS.baseLandDistanceThreshold);
      const baseNowRaw = Number(this.baseLandDistanceThreshold);
      const baseNow = Number.isFinite(baseNowRaw) ? baseNowRaw : baseDefault;
      const baseDelta = (Number.isFinite(baseDefault) ? (baseNow - baseDefault) : 0);
      switch (b) {
        case 1: return Number(this.landDistanceThreshold1) + baseDelta;
        case 2: return Number(this.landDistanceThreshold2) + baseDelta;
        case 3: return Number(this.landDistanceThreshold3) + baseDelta;
        case 4: return Number(this.landDistanceThreshold4) + baseDelta;
        case 5: return Number(this.landDistanceThreshold5) + baseDelta;
        case 6: return Number(this.landDistanceThreshold6) + baseDelta;
        case 7: return Number(this.landDistanceThreshold7) + baseDelta;
        case 8: return Number(this.landDistanceThreshold8) + baseDelta;
        case 9: return Number(this.landDistanceThreshold9) + baseDelta;
        case 10: return Number(this.landDistanceThreshold10) + baseDelta;
        default: return Number(this.landDistanceThreshold10) + baseDelta;
      }
    },
    // seaLandRatio に応じて中心間の最低距離を計算する
    // マッピング: 0.2 -> 20, 0.6 -> 30, 1.0 -> 40（線形補間）。範囲外はクランプ。
    _computeEffectiveMinCenterDistance() {
      const raw = Number.isFinite(this.seaLandRatio) ? Number(this.seaLandRatio) : Number(PARAM_DEFAULTS && PARAM_DEFAULTS.seaLandRatio);
      const x = Math.max(0.2, Math.min(1.0, raw));
      const minDistance = 20 + (x - 0.2) * 25; // 20..40
      return Math.round(minDistance);
    },
    // ノイズ実装は `src/utils/noise.js` に集約（機能不変）。
    // 既存コード（features/centers等）が vm.noise2D / vm.fractalNoise2D を参照するため、ここは薄い委譲として残す。
    noise2D(x, y) {
      return noise2DUtil(x, y);
    },
    fractalNoise2D(x, y, octaves = 3, persistence = 0.4, scale = 0.1) {
      return fractalNoise2DUtil(x, y, octaves, persistence, scale);
    },
    // 基本色の集約定義（機能不変）
    _getBaseColors() {
      // 時代指定があれば時代パレットを優先、なければ共通ユーティリティのデフォルト
      const tc = this.era ? getEraTerrainColors(this.era) : getDefaultTerrainColors();
      return {
        deepSeaColor: tc.deepSea,
        shallowSeaColor: tc.shallowSea,
        lowlandColor: tc.lowland,
        desertColor: tc.desert,     // 乾燥地
        highlandColor: tc.highland, // 高地
        alpineColor: tc.alpine,     // 高山
        tundraColor: tc.tundra,     // ツンドラ
        glacierColor: tc.glacier
      };
    },
    // Poissonサンプリング（湖/高地の個数決定用）- 既存ロジックの関数化（乱数消費順不変）
    _poissonSample(lambda, maxK = 20, rng) {
      return poissonSample(lambda, maxK, rng);
    },
    // 湖の生成（各中心ごと）＋周囲低地化（縁取り）
    _generateLakes(centers, centerLandCells, landMask, colors, shallowSeaColor, lowlandColor, desertColor, seededRng, seededLog) {
      // 実装は `src/utils/terrain/lakes.js` に分離（機能不変）
      // ctx を作って依存を明示（挙動不変）
      const ctx = this._buildLakesCtx();
      const lakeMask = generateLakes(ctx, centers, centerLandCells, landMask, colors, shallowSeaColor, lowlandColor, desertColor, seededRng, seededLog);
      // 高頻度Revise用に従来の場所へ反映（挙動不変）
      this._lastLakesList = ctx._lastLakesList;
      return lakeMask;
    },
    // 高地生成（各中心ごと）
    _generateHighlands(centers, centerLandCellsPre, preLandMask, lakeMask, colors, highlandColor, seededRng, seededLog) {
      // 実装は `src/utils/terrain/highlands.js` に分離（機能不変）
      // ctx を作って依存を明示（挙動不変）
      const ctx = this._buildHighlandsCtx();
      return generateHighlands(ctx, centers, centerLandCellsPre, preLandMask, lakeMask, colors, highlandColor, seededRng, seededLog);
    },
    // 高山生成（高地に隣接しない高地セル）
    _generateAlpines(colors, highlandColor, lowlandColor, desertColor, alpineColor, directions) {
      // 実装は `src/utils/terrain/alpines.js` に分離（機能不変）
      return generateAlpines(this, colors, highlandColor, lowlandColor, desertColor, alpineColor, directions);
    },
    // --- Generate helpers（パイプラインを段階に分けて読みやすくする。挙動/乱数消費順は維持） ---
    _buildSeededLog(count) {
      return Array.from({ length: (count || 0) * 1 || 1 }, () => ({
        highlandsCount: 0,
        highlandClusters: [],
        lakeStarts: []
      }));
    },
    _resetDriftStateForGenerate({ preserveCenterCoordinates }) {
      // Initialize superPloom / drift phase only for full generate.
      // If preserveCenterCoordinates is true (Update), DO NOT modify superPloom_* nor drift phase/turn.
      try {
        if (!preserveCenterCoordinates) {
          this.superPloom_calc = 0;
          this.superPloom_history = [];
          this.driftTurn = 0;
          this.driftIsApproach = true; // start with Approach phase
          // clear high-frequency caches so Generate starts from fresh state
          try { this.hfCache = null; } catch (e) { /* ignore */ }
          try { this._lastLakesList = null; } catch (e) { /* ignore */ }
          // reset glacier smoothing/internal state to avoid carrying previous generate's cache
          try { this._glacierRowsState = null; } catch (e) { /* ignore */ }
          try { this.internalTopGlacierRows = null; } catch (e) { /* ignore */ }
          try { this.lastReturnedGlacierRows = null; } catch (e) { /* ignore */ }
        }
      } catch (e) { /* ignore */ }
    },
    _precomputeGenerateFixedTables({ N, seededRng }) {
      // 帯の縦揺らぎ（列ごと）の事前生成（Generate時に固定。Reviseでは固定値を使う）
      const wobbleRows = Math.max(0, Math.floor(this.landBandVerticalWobbleRows || 0));
      this.wobbleRowsFixed = wobbleRows;
      if (wobbleRows > 0) {
        this._wobbleShiftByX = new Array(this.gridWidth);
        const seedStrictGeom = (this.era === '文明時代' || this.era === '海棲文明時代') && !!seededRng;
        for (let x = 0; x < this.gridWidth; x++) {
          const r = seedStrictGeom ? (this._getDerivedRng('wobble-x', x) || seededRng) : Math.random;
          this._wobbleShiftByX[x] = Math.round((r() * 2 - 1) * wobbleRows);
        }
      } else {
        this._wobbleShiftByX = null;
      }
      // 低頻度パラメータを固定（Reviseではこの固定値を使う）
      this.baseLandDistanceThresholdFixed = this.baseLandDistanceThreshold;

      // 固定ノイズ（Generate時に固定）
      const glacierNoiseTable = new Array(N);
      {
        const seedStrictGl = (this.era === '文明時代' || this.era === '海棲文明時代') && !!seededRng;
        const gRng = seedStrictGl ? (this._getDerivedRng('glacier-noise') || seededRng) : Math.random;
        for (let i = 0; i < N; i++) {
          glacierNoiseTable[i] = (gRng() * 2 - 1);
        }
      }
      // ツンドラ揺らぎノイズも「Generate時に固定」して、Reviseでのチラつきを避ける
      const tundraNoiseTopTable = new Array(N);
      const tundraNoiseBottomTable = new Array(N);
      {
        const seedStrict = (this.era === '文明時代' || this.era === '海棲文明時代') && !!seededRng;
        const rTop = seedStrict ? (this._getDerivedRng('tundra-noise-top') || seededRng) : Math.random;
        const rBot = seedStrict ? (this._getDerivedRng('tundra-noise-bottom') || seededRng) : Math.random;
        for (let i = 0; i < N; i++) {
          tundraNoiseTopTable[i] = (rTop() * 2 - 1);
          tundraNoiseBottomTable[i] = (rBot() * 2 - 1);
        }
      }
      return { glacierNoiseTable, tundraNoiseTopTable, tundraNoiseBottomTable };
    },
    _computeCentersAndParamsForGenerate({ preserveCenterCoordinates, seededRng }) {
      // 大陸中心座標の決定:
      // - `deterministicSeed` が渡されている場合はシードに基づいて決定（generate 時の再現性確保）
      // - 未指定の場合は完全ランダム（従来の挙動）
      const seedStrictCenters = !!seededRng;
      const effectiveMinCenterDistance = this._computeEffectiveMinCenterDistance();

      // Update: 中心点座標を維持（現在の centerParameters の x/y をそのまま使う）
      let centers;
      let localCenterParameters;
      if (preserveCenterCoordinates && Array.isArray(this.centerParameters) && this.centerParameters.length > 0) {
        const clampX = (v) => Math.max(0, Math.min(this.gridWidth - 1, Math.round(Number(v))));
        const clampY = (v) => Math.max(0, Math.min(this.gridHeight - 1, Math.round(Number(v))));
        centers = this.centerParameters.map((p) => ({
          x: clampX(p && p.x),
          y: clampY(p && p.y)
        }));
        // 既存の中心パラメータ（influence/kDecay/directionなど）を維持し、座標だけクランプした値で統一
        localCenterParameters = this.centerParameters.map((p, i) => ({
          ...(p || {}),
          x: centers[i].x,
          y: centers[i].y
        }));
      } else {
        centers = sampleLandCenters(this, seedStrictCenters ? seededRng : null, effectiveMinCenterDistance);
        // ノイズから中心パラメータを生成（propsは直接変更しない）
        localCenterParameters = centers.map((c) => {
          if (seededRng) {
            const u1 = seededRng() * 2 - 1; // [-1,1)
            const u2 = seededRng();         // [0,1)
            return {
              x: c.x,
              y: c.y,
              // さらにばらつきを縮小（影響は狭いレンジ、減衰は強め）
              influenceMultiplier: 0.9 + u1 * 0.05, // [0.85, 0.95]
              kDecayVariation: this.kDecay * (1.3 + u1 * 0.1), // [1.2, 1.4] × kDecay
              directionAngle: (u2 * 2 * Math.PI * 1.5)
            };
          } else {
            const n1 = this.noise2D(c.x * 0.1, c.y * 0.1);
            const n2 = this.noise2D(c.x * 0.15, c.y * 0.15);
            return {
              x: c.x,
              y: c.y,
              // さらにばらつきを縮小（影響は狭いレンジ、減衰は強め）
              influenceMultiplier: 0.9 + n1 * 0.05,
              kDecayVariation: this.kDecay * (1.3 + n1 * 0.1),
              directionAngle: n2 * Math.PI * 2 * 1.5
            };
          }
        });
      }
      return { centers, localCenterParameters, seedStrictCenters, effectiveMinCenterDistance };
    },
    _computeScoresThresholdAndLandMaskForGenerate({
      N,
      centers,
      localCenterParameters,
      preserveCenterCoordinates,
      seedStrictCenters,
      seededRng,
      effectiveMinCenterDistance
    }) {
      let scores, threshold;
      let success = false;
      let nextCenters = centers;
      for (let attempt = 0; attempt < 5 && !success; attempt++) {
        const res = computeScoresForCenters(this, nextCenters, localCenterParameters);
        scores = res.scores;
        const sorted = scores.slice().sort((a, b) => a - b);
        // UI の seaLandRatio を内部の生成用比率へスムーズにマッピング（アンカー: 0.3->0.07, 0.9->0.7）
        const effectiveSeaLandRatio = Math.min(0.999, Math.max(0.0, mapSeaLandRatio(this.seaLandRatio)));
        const k = Math.floor((1 - effectiveSeaLandRatio) * N);
        threshold = sorted[Math.max(0, Math.min(sorted.length - 1, k))];
        let anyCenterLand = false;
        for (let i = 0; i < nextCenters.length; i++) {
          const c = nextCenters[i];
          const sc = scores[c.y * this.gridWidth + c.x];
          if (sc >= threshold) { anyCenterLand = true; break; }
        }
        if (anyCenterLand) {
          success = true;
        } else {
          // Update（座標固定）の場合は再サンプリングしない
          if (preserveCenterCoordinates) {
            success = true;
          } else {
            nextCenters = sampleLandCenters(this, seedStrictCenters ? seededRng : null, effectiveMinCenterDistance);
          }
        }
      }
      const landMask = new Array(N).fill(false);
      for (let i = 0; i < N; i++) landMask[i] = scores[i] >= threshold;
      return { centers: nextCenters, scores, threshold, landMask };
    },
    _buildWorldAndEmit({
      emitEvent,
      N,
      centers,
      localCenterParameters,
      landMask,
      scores,
      threshold,
      seededRng,
      seededLog,
      glacierNoiseTable,
      tundraNoiseTopTable,
      tundraNoiseBottomTable,
      // Drift only:
      driftMetrics = null,
      // Drift only: 高地生成だけ deterministicSeed を有効化する場合に使用
      highlandsSeededRng = null,
      enableDerivedRngDuringHighlands = false
    }) {
      // 前計算: 各セルのノイズ（後段の複数ループで再利用）
      const noiseGrid = buildVisualNoiseGrid(this, { N, seededRng });
      // 前計算: 各セルの最寄り中心インデックス（湖/高地生成の所属チェック高速化）
      const ownerCenterIdx = computeOwnerCenterIdx(this, centers);
      // 膨張のバイアス（閾値近傍の許容範囲）: 値を下げて過度な拡張を抑制（平均サイズ縮小）
      dilateLandMask(this, {
        landMask,
        scores,
        threshold,
        expansionBias: 0.12,
        maxIterations: 10
      });
      removeSingleCellIslands(this, { landMask, seededRng });
      // 高地用に「海岸線ジッター前」の landMask をスナップショット
      const preJitterLandMask = landMask.slice();
      jitterCoastline(this, { landMask, scores, threshold, seededRng });
      const seaNoiseAmplitude = 1.5;
      const landNoiseAmplitude = 2.5;
      const {
        deepSeaColor, shallowSeaColor, lowlandColor, desertColor,
        highlandColor, alpineColor, tundraColor, glacierColor
      } = this._getBaseColors();
      // 近傍方向（トーラス考慮はtorusWrap側で処理）
      const directions = getDirections8();
      // Dijkstraは共通ユーティリティで計算
      const wrap = (x, y) => this.torusWrap(x, y);
      const distFn = (x1, y1, x2, y2) => this.torusDistance(x1, y1, x2, y2);
      // 距離マップ計算: 陸まで（ソース=陸セル）
      const landSources = [];
      for (let gy = 0; gy < this.gridHeight; gy++) {
        for (let gx = 0; gx < this.gridWidth; gx++) {
          const idx = gy * this.gridWidth + gx;
          if (landMask[idx]) landSources.push({ x: gx, y: gy });
        }
      }
      const distanceToLand = computeDistanceMap({
        sources: landSources,
        N,
        directions,
        gridWidth: this.gridWidth,
        wrap,
        distance: distFn
      });
      // 距離マップ計算: 海まで（ソース=海セル）
      const seaSources = [];
      for (let gy = 0; gy < this.gridHeight; gy++) {
        for (let gx = 0; gx < this.gridWidth; gx++) {
          const idx = gy * this.gridWidth + gx;
          if (!landMask[idx]) seaSources.push({ x: gx, y: gy });
        }
      }
      const distanceToSea = computeDistanceMap({
        sources: seaSources,
        N,
        directions,
        gridWidth: this.gridWidth,
        wrap,
        distance: distFn
      });

      const colors = classifyBaseColors(this, {
        N,
        landMask,
        noiseGrid,
        distanceToSea,
        distanceToLand,
        seaNoiseAmplitude,
        landNoiseAmplitude,
        deepSeaColor,
        shallowSeaColor,
        lowlandColor,
        desertColor
      });

      // 各中心の陸セル一覧を前計算（湖/高地で再利用）
      const { centerLandCells, centerLandCellsPre } = buildCenterLandCells(this, {
        centers,
        ownerCenterIdx,
        landMask,
        preLandMask: preJitterLandMask
      });
      // 湖生成と適用（ジッター後のマスクに基づく）
      const lakeMask = this._generateLakes(centers, centerLandCells, landMask, colors, shallowSeaColor, lowlandColor, desertColor, seededRng, seededLog);

      // 高地生成と適用
      // - Generate: seededRng をそのまま渡す
      // - Drift: 高地だけ deterministicSeed を有効化する場合は highlandsSeededRng を渡す
      if (highlandsSeededRng && enableDerivedRngDuringHighlands) {
        const prevForceHighlands = this.forceRandomDerivedRng;
        this.forceRandomDerivedRng = false;
        try {
          this._generateHighlands(centers, centerLandCellsPre, preJitterLandMask, lakeMask, colors, highlandColor, highlandsSeededRng, seededLog);
        } finally {
          this.forceRandomDerivedRng = prevForceHighlands;
        }
      } else {
        this._generateHighlands(centers, centerLandCellsPre, preJitterLandMask, lakeMask, colors, highlandColor, (highlandsSeededRng || seededRng), seededLog);
      }

      // 高山生成と適用
      this._generateAlpines(colors, highlandColor, lowlandColor, desertColor, alpineColor, directions);

      // Revise用に「ツンドラ/氷河適用前」の色を保存（湖/高地/高山の結果は保持）
      const preTundraColors = colors.slice();

      // --- 先に氷河row（基準）を計算 ---
      const preGlacierStats = computePreGlacierStats({ N, landMask, lakeMask });
      const ratioOcean = preGlacierStats.seaCount / (preGlacierStats.total || 1);
      // 海率の影響は「陸の氷河形成」にのみ適用し、海/湖は標準（0.7相当）で固定する
      // 要件: generate 時は「平滑化なし（放射平衡温度由来）」の topGlacierRows を使いたい。
      // ここでは store の気候モデルが出す averageTemperature_calc (K) があればそれを優先して使い、
      // 一時的に this.averageTemperature と this.glacier_alpha を上書きして computeTopGlacierRowsFromAverageTemperature を呼び、
      // 平滑化を実質無効（glacier_alpha=1）にして即値を取得します。
      let computedTopGlacierRowsLand;
      let computedTopGlacierRowsWater;
      let computedSmoothedTopGlacierRowsLand;
      let computedSmoothedTopGlacierRowsWater;
      try {
        const climateVars = (this.$store && this.$store.getters && this.$store.getters.climateVars) ? this.$store.getters.climateVars : null;
        if (climateVars && typeof climateVars.averageTemperature_calc === 'number') {
          const rawC = climateVars.averageTemperature_calc - 273.15;
          // use pure computation (no smoothing, no vm mutation)
          computedTopGlacierRowsLand = computeTopGlacierRowsPure(rawC, ratioOcean, 'land');
          computedTopGlacierRowsWater = computeTopGlacierRowsPure(rawC, 0.7, 'water');
          computedSmoothedTopGlacierRowsLand = computedTopGlacierRowsLand;
          computedSmoothedTopGlacierRowsWater = computedTopGlacierRowsWater;
        } else {
          computedTopGlacierRowsLand = computeTopGlacierRowsFromAverageTemperature(this, ratioOcean, 'land');
          computedTopGlacierRowsWater = computeTopGlacierRowsFromAverageTemperature(this, 0.7, 'water');
          computedSmoothedTopGlacierRowsLand = getSmoothedGlacierRows(this, ratioOcean, 'land');
          computedSmoothedTopGlacierRowsWater = getSmoothedGlacierRows(this, 0.7, 'water');
        }
      } catch (e) {
        // fallback to default behaviour on error
        computedTopGlacierRowsLand = computeTopGlacierRowsFromAverageTemperature(this, ratioOcean, 'land');
        computedTopGlacierRowsWater = computeTopGlacierRowsFromAverageTemperature(this, 0.7, 'water');
        computedSmoothedTopGlacierRowsLand = getSmoothedGlacierRows(this, ratioOcean, 'land');
        computedSmoothedTopGlacierRowsWater = getSmoothedGlacierRows(this, 0.7, 'water');
      }

      // --- ツンドラの適用（上端・下端） ---
      const tundraExtraRows = Number.isFinite(Number(this.tundraExtraRows))
        ? Math.max(0, Number(this.tundraExtraRows))
        : Math.max(0, (this.topTundraRows || 0) - (this.topGlacierRows || 0));
      const computedTopTundraRows = Math.max(0, computedTopGlacierRowsWater + tundraExtraRows);
      applyTundra(this, {
        colors,
        landNoiseAmplitude,
        lowlandColor,
        tundraColor,
        computedTopTundraRows,
        tundraNoiseTableTop: tundraNoiseTopTable,
        tundraNoiseTableBottom: tundraNoiseBottomTable
      });

      // --- 氷河の適用（上端/下端） ---
      const computedTopGlacierRows = computedTopGlacierRowsLand;
      applyGlaciers(this, {
        colors,
        glacierNoiseTable,
        landNoiseAmplitude,
        computedTopGlacierRows,
        computedTopGlacierRowsLand,
        computedTopGlacierRowsWater,
        computedSmoothedTopGlacierRowsLand,
        computedSmoothedTopGlacierRowsWater,
        shallowSeaColor,
        deepSeaColor,
        lowlandColor,
        tundraColor,
        desertColor,
        highlandColor,
        alpineColor,
        glacierColor,
        landMask,
        lakeMask
      });

      // 文明要素（都市/耕作/苔類/汚染）＋海棲文明要素（浅瀬ベース）
      const {
        cityMask,
        cultivatedMask,
        bryophyteMask,
        pollutedMask,
        seaCityMask,
        seaCultivatedMask,
        seaPollutedMask
      } = generateFeatures(this._buildFeaturesCtx(), { N, landMask, colors, lowlandColor, shallowSeaColor, seededRng });

      // 各グリッドのプロパティ構造を作成
      const gridData = buildGridData(this, {
        N,
        colors,
        landMask,
        lakeMask,
        shallowSeaColor,
        lowlandColor,
        highlandColor,
        alpineColor,
        tundraColor,
        glacierColor,
        desertColor,
        cityMask,
        cultivatedMask,
        bryophyteMask,
        pollutedMask,
        seaCityMask,
        seaCultivatedMask,
        seaPollutedMask
      });
      applySeededLogToCenterParameters({
        centers,
        centerParameters: localCenterParameters,
        seededLog
      });
      markCentersOnGridData(this, { gridData, centers });

      // 高頻度更新に必要なデータをキャッシュ
      this.hfCache = {
        N,
        centers,
        landMask,
        lakeMask,
        lakesList: this._lastLakesList || [],
        noiseGrid,
        distanceToSea,
        distanceToLand,
        preTundraColors,
        // 固定ノイズ
        glacierNoiseTable,
        tundraNoiseTopTable,
        tundraNoiseBottomTable,
        // 色定義
        shallowSeaColor,
        deepSeaColor,
        lowlandColor,
        desertColor,
        highlandColor,
        alpineColor,
        tundraColor,
        glacierColor,
        // 定数（Reviseで同一にする）
        seaNoiseAmplitude,
        landNoiseAmplitude,
        // 氷河行数計算に使う海率（氷河上書き前）
        preGlacierStats,
        // featuresを「不整合なら消す」ためのベース
        gridDataBase: gridData
      };

      const payload = buildGeneratedPayload({
        centerParameters: localCenterParameters,
        gridData,
        deterministicSeed: this.deterministicSeed,
        preGlacierStats,
        computedTopGlacierRows,
        ...(driftMetrics ? { driftMetrics } : null)
      });
      this.$emit(emitEvent, payload);
    },
    // --- Drift helpers（中心点移動と、Drift用の前計算/再生成を分離） ---
    _precomputeDriftFixedTables({ N }) {
      // 帯の縦揺らぎ（列ごと）の事前生成（Drift時も固定。Reviseでは固定値を使う）
      const wobbleRows = Math.max(0, Math.floor(this.landBandVerticalWobbleRows || 0));
      this.wobbleRowsFixed = wobbleRows;
      if (wobbleRows > 0) {
        this._wobbleShiftByX = new Array(this.gridWidth);
        for (let x = 0; x < this.gridWidth; x++) {
          this._wobbleShiftByX[x] = Math.round((Math.random() * 2 - 1) * wobbleRows);
        }
      } else {
        this._wobbleShiftByX = null;
      }
      // 低頻度パラメータを固定（Reviseではこの固定値を使う）
      this.baseLandDistanceThresholdFixed = this.baseLandDistanceThreshold;

      // 固定ノイズ（Driftでは毎回ランダムに作り直す）
      const glacierNoiseTable = new Array(N);
      for (let i = 0; i < N; i++) glacierNoiseTable[i] = (Math.random() * 2 - 1);
      const tundraNoiseTopTable = new Array(N);
      const tundraNoiseBottomTable = new Array(N);
      for (let i = 0; i < N; i++) {
        tundraNoiseTopTable[i] = (Math.random() * 2 - 1);
        tundraNoiseBottomTable[i] = (Math.random() * 2 - 1);
      }
      return { glacierNoiseTable, tundraNoiseTopTable, tundraNoiseBottomTable };
    },
    _computeCenterParametersForDrift({ centers }) {
      // centerParameters は「既存の影響パラメータを保持しつつ座標だけ更新」を優先
      if (Array.isArray(this.centerParameters) && this.centerParameters.length === centers.length) {
        return this.centerParameters.map((p, i) => ({
          ...p,
          x: centers[i].x,
          y: centers[i].y
        }));
      }
      return centers.map((c) => {
        const u1 = Math.random() * 2 - 1;
        const u2 = Math.random();
        return {
          x: c.x,
          y: c.y,
          influenceMultiplier: 0.9 + u1 * 0.05,
          kDecayVariation: this.kDecay * (1.3 + u1 * 0.1),
          directionAngle: (u2 * 2 * Math.PI * 1.5)
        };
      });
    },
    _computeScoresThresholdAndLandMaskForDrift({ N, centers, localCenterParameters }) {
      // スコアと閾値計算（中心点は固定）。中心点が陸にならないケースでも resample はしない。
      const res = computeScoresForCenters(this, centers, localCenterParameters);
      const scores = res.scores;
      const sorted = scores.slice().sort((a, b) => a - b);
      const effectiveSeaLandRatio = Math.min(0.999, Math.max(0.0, mapSeaLandRatio(this.seaLandRatio)));
      const k = Math.floor((1 - effectiveSeaLandRatio) * N);
      const threshold = sorted[Math.max(0, Math.min(sorted.length - 1, k))];
      const landMask = new Array(N).fill(false);
      for (let i = 0; i < N; i++) landMask[i] = scores[i] >= threshold;
      return { scores, threshold, landMask };
    },
    runGenerate({ preserveCenterCoordinates = false } = {}) {
      const N = this.gridWidth * this.gridHeight;
      const seededRng = this._getSeededRng();
      this._resetDriftStateForGenerate({ preserveCenterCoordinates });
      const seededLog = this._buildSeededLog(this.centersY);
      const { glacierNoiseTable, tundraNoiseTopTable, tundraNoiseBottomTable } =
        this._precomputeGenerateFixedTables({ N, seededRng });
      const {
        centers: centers0,
        localCenterParameters,
        seedStrictCenters,
        effectiveMinCenterDistance
      } = this._computeCentersAndParamsForGenerate({ preserveCenterCoordinates, seededRng });
      const { centers, scores, threshold, landMask } = this._computeScoresThresholdAndLandMaskForGenerate({
        N,
        centers: centers0,
        localCenterParameters,
        preserveCenterCoordinates,
        seedStrictCenters,
        seededRng,
        effectiveMinCenterDistance
      });
      this._buildWorldAndEmit({
        emitEvent: 'generated',
        N,
        centers,
        localCenterParameters,
        landMask,
        scores,
        threshold,
        seededRng,
        seededLog,
        glacierNoiseTable,
        tundraNoiseTopTable,
        tundraNoiseBottomTable
      });
    },
    // Drift:
    // - 前回Generateの中心点（hfCache.centers）をキャッシュとして使用
    // - 新アルゴリズム:
    //   - 50ターンごとに Approach / Repel を交互
    //   - 各ターンで「重心法 1」「最短点法 1」「ランダム 1 x2」を順に試行
    //   - Repel では上下端5グリッド以内なら赤道方向へ 1 追加
    //   - 常に minCenterDistance（中心間の排他距離）を衝突判定で維持
    // - すべてのノイズをランダムに再抽選（deterministicSeed由来の派生RNGも無効化）
    runDrift() {
      const N = this.gridWidth * this.gridHeight;
      // Driftでは決定論RNGは原則無効（ノイズはランダム化）だが、いくつかの処理は seededRng 引数を取るため null を用いる
      const seededRng = null;
      // ドリフト内の「ランダム移動」はシード固定化する（ただし毎ターン同じ方向に固定されないように turn/点index を混ぜる）
      // NOTE: this._getSeededRng() を毎回作ると乱数列が毎ターン先頭から同じになり「永遠に同じ2方向を引き続ける」ため、
      //       衝突判定で弾かれたケースで停止しやすい。createDerivedRng を直接使って turn を混ぜる。
      const deterministicSeedForMoves = this.deterministicSeed;

      // Drift中は deterministicSeed 由来の派生RNG（shape-profile等）を無効化
      const prevForce = this.forceRandomDerivedRng;
      this.forceRandomDerivedRng = true;
      try {
        // centers はキャッシュ優先。無ければ通常サンプリングにフォールバック。
        const prevCenters = (this.hfCache && Array.isArray(this.hfCache.centers)) ? this.hfCache.centers : null;
        // 「中心間の排他距離 (グリッド)」は既存設定（prop）を優先して使用
        const effectiveMinCenterDistance = Number.isFinite(Number(this.minCenterDistance))
          ? Number(this.minCenterDistance)
          : this._computeEffectiveMinCenterDistance();
        const baseCenters = (prevCenters && prevCenters.length > 0)
          ? prevCenters
          : sampleLandCenters(this, null, effectiveMinCenterDistance);

        // 初回（Generateを経ずにDriftした等）はドリフト状態をリセット
        if (!prevCenters || prevCenters.length <= 0) {
          this.driftTurn = 0;
          this.superPloom_calc = 0;
          this.superPloom_history = [];
          this.driftMetrics = null;
        }

        const WIDTH = this.gridWidth;
        const HEIGHT = this.gridHeight;
        const MIN_DIST = Number(effectiveMinCenterDistance) || 1;

        // 点配列（整数格子上で動かす）
        const points = baseCenters.map((c) => ({
          x: ((Math.floor(c.x) % WIDTH) + WIDTH) % WIDTH,
          y: Math.max(0, Math.min(HEIGHT - 1, Math.floor(c.y)))
        }));

        // フェーズ判定: 動的に切り替える（this.driftIsApproach により管理）
        const turn0 = Number.isFinite(this.driftTurn) ? (this.driftTurn | 0) : 0;
        const isApproach = (typeof this.driftIsApproach === 'boolean') ? this.driftIsApproach : true;
        const phaseName = isApproach ? 'Approach' : 'Repel';
        // 距離計算: xは常にトーラス、yは Repel のみトーラス
        const useYtorus = !isApproach;

        const clampY = (y) => {
          if (y < 0) return 0;
          if (y > HEIGHT - 1) return HEIGHT - 1;
          return y;
        };
        // xはトーラス
        const wrapX = (x) => ((x % WIDTH) + WIDTH) % WIDTH;

        // getDist: 最短距離（dx,dy）を返す。xは常にトーラス。yは useYtorus=true の場合のみトーラス。
        const getDist = (a, b, yTorus) => {
          let dx = (b.x - a.x);
          if (dx > WIDTH / 2) dx -= WIDTH;
          if (dx < -WIDTH / 2) dx += WIDTH;
          let dy = (b.y - a.y);
          if (yTorus) {
            if (dy > HEIGHT / 2) dy -= HEIGHT;
            if (dy < -HEIGHT / 2) dy += HEIGHT;
          }
          const d = Math.hypot(dx, dy);
          return { dx, dy, d };
        };

        const stepFromVector = (dx, dy) => {
          if (!Number.isFinite(dx) || !Number.isFinite(dy)) return { dx: 0, dy: 0 };
          if (dx === 0 && dy === 0) return { dx: 0, dy: 0 };
          const sx = dx === 0 ? 0 : (dx > 0 ? 1 : -1);
          const sy = dy === 0 ? 0 : (dy > 0 ? 1 : -1);
          const ax = Math.abs(dx);
          const ay = Math.abs(dy);
          // 斜めを優先しつつ、極端に片方が大きい場合は直進
          if (ax > ay * 1.5) return { dx: sx, dy: 0 };
          if (ay > ax * 1.5) return { dx: 0, dy: sy };
          return { dx: sx, dy: sy };
        };

        // 移動処理の核: 1グリッド移動を試行し、衝突（最小距離違反）ならキャンセル
        // NOTE:
        // - 反発フェーズでは「距離計算」は上下トーラスを使うが、
        //   実際の座標は上下を越えられない（クランプ）ため、
        //   最小距離維持（衝突判定）まで上下トーラスにすると「端同士」が近接扱いになり
        //   端から離脱できず張り付く原因になる。
        // - そのため衝突判定は「xのみトーラス」「yは通常差分（非トーラス）」で行う。
        const move = (p, dx, dy) => {
          const nx = wrapX(p.x + dx);
          const ny = clampY(p.y + dy);
          // クランプ等で座標が変わらないなら「移動できなかった」とみなす（張り付き/空振り対策）
          if (nx === p.x && ny === p.y) return false;
          const collision = points.some((other) => {
            if (other === p) return false;
            return getDist({ x: nx, y: ny }, other, /*yTorus*/ false).d < MIN_DIST;
          });
          if (!collision) {
            p.x = nx;
            p.y = ny;
            return true;
          }
          return false;
        };

        // トーラス対応重心（xは常に円平均、yは Repel のみ円平均）
        const torusMean1D = (vals, mod) => {
          const n = vals.length || 1;
          let s = 0, c = 0;
          for (let i = 0; i < vals.length; i++) {
            const ang = (vals[i] / mod) * (Math.PI * 2);
            s += Math.sin(ang);
            c += Math.cos(ang);
          }
          let meanAng = Math.atan2(s / n, c / n);
          if (meanAng < 0) meanAng += Math.PI * 2;
          return (meanAng / (Math.PI * 2)) * mod;
        };
        const computeCenter = () => {
          const xs = points.map(p => p.x);
          const ys = points.map(p => p.y);
          const cx = torusMean1D(xs, WIDTH);
          const cy = useYtorus
            ? torusMean1D(ys, HEIGHT)
            : (ys.reduce((acc, v) => acc + v, 0) / (ys.length || 1));
          return { x: cx, y: cy };
        };

        const randDirs8 = [
          { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
          { dx: 1, dy: 1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 }
        ];

        // 重心法/最近点法の「意図した1歩」が端クランプ等で無効になった時のフォールバック
        const movePrimary = (p, dx, dy, rng) => {
          if (move(p, dx, dy)) return true;
          // y方向が端でクランプされる（＝動けない）なら、横へ逃がす
          if (dy !== 0 && clampY(p.y + dy) === p.y) {
            const dxAlt = (rng() < 0.5) ? -1 : 1;
            if (move(p, dxAlt, 0)) return true;
          }
          return false;
        };

        // --- 1ターン分の移動 ---
        const center = computeCenter();
        points.forEach((p, pi) => {
          // 点ごとの乱数源（turn0 と点index を混ぜる）
          const rngForMoves = (typeof deterministicSeedForMoves !== 'undefined' && deterministicSeedForMoves !== null)
            ? (createDerivedRng(deterministicSeedForMoves, 'drift-move', turn0, pi) || Math.random)
            : Math.random;

          if (isApproach) {
            // Approach: centroid -> nearest -> random x2
            const dG = getDist(p, center, useYtorus);
            const stG = stepFromVector(dG.dx, dG.dy);
            movePrimary(p, stG.dx * 1, stG.dy * 1, rngForMoves);

            // nearest approach
            let nearest = null;
            let minD = Infinity;
            for (let i = 0; i < points.length; i++) {
              const other = points[i];
              if (other === p) continue;
              const d = getDist(p, other, useYtorus).d;
              if (d < minD) {
                minD = d;
                nearest = other;
              }
            }
            if (nearest) {
              const dN = getDist(p, nearest, useYtorus);
              const stN = stepFromVector(dN.dx, dN.dy);
              movePrimary(p, stN.dx * 1, stN.dy * 1, rngForMoves);
            }

            for (let k = 0; k < 2; k++) {
              const r = randDirs8[(rngForMoves() * randDirs8.length) | 0];
              move(p, r.dx, r.dy);
            }
          } else {
            // Repel: 3-turn cycle
            const cycle = turn0 % 3;
            // 1) centroid repel
            const dG = getDist(p, center, useYtorus);
            const stG = stepFromVector(dG.dx, dG.dy);
            movePrimary(p, stG.dx * -1, stG.dy * -1, rngForMoves);

            // 2) nearest repel (and also find second nearest)
            let nearest = null, second = null;
            let minD = Infinity, secondD = Infinity;
            for (let i = 0; i < points.length; i++) {
              const other = points[i];
              if (other === p) continue;
              const d = getDist(p, other, useYtorus).d;
              if (d < minD) { secondD = minD; second = nearest; minD = d; nearest = other; }
              else if (d < secondD) { secondD = d; second = other; }
            }
            if (nearest) {
              const dN = getDist(p, nearest, useYtorus);
              const stN = stepFromVector(dN.dx, dN.dy);
              movePrimary(p, stN.dx * -1, stN.dy * -1, rngForMoves);
            }

            if (cycle === 2) {
              // third turn: random once + approach to second-nearest
              const r = randDirs8[(rngForMoves() * randDirs8.length) | 0];
              move(p, r.dx, r.dy);
              if (second) {
                const d2 = getDist(p, second, useYtorus);
                const st2 = stepFromVector(d2.dx, d2.dy);
                movePrimary(p, st2.dx * 1, st2.dy * 1, rngForMoves);
              }
            } else {
              // first two turns: random x2
              for (let k = 0; k < 2; k++) {
                const r = randDirs8[(rngForMoves() * randDirs8.length) | 0];
                move(p, r.dx, r.dy);
              }
            }

            // repel特有: 上下端5グリッド以内なら赤道へ 1
            if (p.y <= 5 || p.y >= (HEIGHT - 5)) {
              const eq = (HEIGHT - 1) / 2;
              const dyToEq = (p.y < eq) ? 1 : -1;
              // まず直進、ダメなら斜め/横を試して「張り付き」を避ける
              if (!move(p, 0, dyToEq)) {
                if (!move(p, 1, dyToEq)) {
                  if (!move(p, -1, dyToEq)) {
                    // 最後の保険: 横に1（トーラス）だけでも動けるなら動かす
                    const dxAlt = (rngForMoves() < 0.5) ? -1 : 1;
                    move(p, dxAlt, 0);
                  }
                }
              }
            }
          }
        });

        const centers = points.map((p) => ({ x: p.x, y: p.y }));

        // --- superPloom 更新（7点間平均距離） ---
        let sum = 0;
        let cnt = 0;
        for (let i = 0; i < points.length; i++) {
          for (let j = i + 1; j < points.length; j++) {
            sum += getDist(points[i], points[j], useYtorus).d;
            cnt += 1;
          }
        }
        const avgDist = cnt > 0 ? (sum / cnt) : 0;
        // --- superPloom 更新（7点間平均距離） ---
        let spc = Number.isFinite(this.superPloom_calc) ? this.superPloom_calc : 0;
        // 既定値は minCenterDistance に依存
        const minCD = Number.isFinite(Number(this.minCenterDistance)) ? Number(this.minCenterDistance) : 20;
        let baseDefault = 50 + (((minCD - 20) / 5) * 2);
        baseDefault = Math.min(baseDefault, 58);
        if (avgDist < baseDefault) {
          spc += 1;
        } else if (avgDist >= 58 && avgDist <= 62) {
          spc -= 4;
        } else if (avgDist > 62 && avgDist <= 65) {
          spc -= 2;
        } else if (avgDist > 65) {
          spc -= 1;
        }
        spc = Math.max(spc, 0);
        this.superPloom_calc = spc;
        if (!Array.isArray(this.superPloom_history)) this.superPloom_history = [];
        this.superPloom_history.push(spc);
        const superPloom = (this.superPloom_history.length > 5)
          ? this.superPloom_history[this.superPloom_history.length - 6]
          : 0;

        // フェーズ切替: 接近側で superPloom > 30 -> 反発へ。反発で superPloom == 0 -> 接近へ。
        if (isApproach && superPloom > 20) {
          this.driftIsApproach = false;
        } else if (!isApproach && superPloom === 0) {
          this.driftIsApproach = true;
        }

        // ターンを進める（driftSignal 1回 = 1ターン）
        this.driftTurn = turn0 + 1;

        // 出力用メトリクス（Parameters Output で表示）
        this.driftMetrics = {
          superPloom_calc: spc,
          superPloom,
          phase: phaseName,
          avgDist
        };
        const seededLog = this._buildSeededLog(centers.length);
        const { glacierNoiseTable, tundraNoiseTopTable, tundraNoiseBottomTable } =
          this._precomputeDriftFixedTables({ N });
        const localCenterParameters = this._computeCenterParametersForDrift({ centers });
        const { scores, threshold, landMask } = this._computeScoresThresholdAndLandMaskForDrift({ N, centers, localCenterParameters });

        // Driftでは「ノイズは全再抽選」だが、高地の個数/クラスター（開始セル/サイズ）は
        // deterministicSeed が指定されている場合に限りシード固定にする。
        const seededRngHighlands = this._getSeededRng();
        this._buildWorldAndEmit({
          emitEvent: 'drifted',
          N,
          centers,
          localCenterParameters,
          landMask,
          scores,
          threshold,
          seededRng,
          seededLog,
          glacierNoiseTable,
          tundraNoiseTopTable,
          tundraNoiseBottomTable,
          driftMetrics: this.driftMetrics,
          highlandsSeededRng: seededRngHighlands || null,
          enableDerivedRngDuringHighlands: !!seededRngHighlands
        });
      } finally {
        this.forceRandomDerivedRng = prevForce;
      }
    },
    // --- Revise helpers（高頻度更新。できるだけデータを引数で受け渡しして見通しを良くする） ---
    _reviseReclassifyDesert({ c, colors }) {
      // 乾燥地（帯別閾値）を再分類（低地/乾燥地のみ対象。湖/高地/高山は保持）
      for (let gy = 0; gy < this.gridHeight; gy++) {
        for (let gx = 0; gx < this.gridWidth; gx++) {
          const idx = gy * this.gridWidth + gx;
          if (!c.landMask[idx]) continue;
          if (c.lakeMask && c.lakeMask[idx]) continue; // 湖は保持
          const col = colors[idx];
          if (col === c.highlandColor || col === c.alpineColor) continue; // 高地/高山は保持
          const n = c.noiseGrid[idx];
          const bandThreshold = this._getLandDistanceThresholdForRow(gy, gx);
          const landThreshold = bandThreshold + n * c.landNoiseAmplitude;
          colors[idx] = c.distanceToSea[idx] > landThreshold ? c.desertColor : c.lowlandColor;
        }
      }
    },
    _reviseRestoreLowlandAroundLakes({ c, colors }) {
      // 湖の周囲を低地に戻す（低頻度結果を維持）
      try {
        const baseLandThr = (this.baseLandDistanceThresholdFixed != null)
          ? this.baseLandDistanceThresholdFixed
          : this.baseLandDistanceThreshold;
        applyLowlandAroundLakes(this._buildLakeLowlandCtx(), {
          colors,
          lakesList: c.lakesList || [],
          lakeMask: c.lakeMask,
          baseLandThr,
          desertColor: c.desertColor,
          lowlandColor: c.lowlandColor
        });
      } catch (e) { /* ignore */ }
    },
    _reviseComputeGlacierRows({ c }) {
      const ratioOcean = (c.preGlacierStats && c.preGlacierStats.total)
        ? (c.preGlacierStats.seaCount / (c.preGlacierStats.total || 1))
        : 0.7;
      // Prefer climate raw radiative temperature (averageTemperature_calc) when available to avoid using smoothed store averageTemperature.
      const climateVars = (this.$store && this.$store.getters && this.$store.getters.climateVars) ? this.$store.getters.climateVars : null;
      let computedTopGlacierRowsLand;
      let computedTopGlacierRowsWater;
      let computedSmoothedTopGlacierRowsLand;
      let computedSmoothedTopGlacierRowsWater;
      if (climateVars && typeof climateVars.averageTemperature_calc === 'number') {
        const rawC = climateVars.averageTemperature_calc - 273.15;
        computedTopGlacierRowsLand = computeTopGlacierRowsPure(rawC, ratioOcean, 'land');
        computedTopGlacierRowsWater = computeTopGlacierRowsPure(rawC, 0.7, 'water');
        // For revise application we treat smoothed values as equal to pure when using climate raw temp
        computedSmoothedTopGlacierRowsLand = computedTopGlacierRowsLand;
        computedSmoothedTopGlacierRowsWater = computedTopGlacierRowsWater;
      } else {
        computedTopGlacierRowsLand = computeTopGlacierRowsFromAverageTemperature(this, ratioOcean, 'land');
        computedTopGlacierRowsWater = computeTopGlacierRowsFromAverageTemperature(this, 0.7, 'water');
        computedSmoothedTopGlacierRowsLand = getSmoothedGlacierRows(this, ratioOcean, 'land');
        computedSmoothedTopGlacierRowsWater = getSmoothedGlacierRows(this, 0.7, 'water');
      }
      return {
        computedTopGlacierRowsLand,
        computedTopGlacierRowsWater,
        computedSmoothedTopGlacierRowsLand,
        computedSmoothedTopGlacierRowsWater
      };
    },
    _reviseApplyTundra({ c, colors, computedTopGlacierRowsWater }) {
      const tundraExtraRows = Number.isFinite(Number(this.tundraExtraRows))
        ? Math.max(0, Number(this.tundraExtraRows))
        : Math.max(0, (this.topTundraRows || 0) - (this.topGlacierRows || 0));
      const computedTopTundraRows = Math.max(0, computedTopGlacierRowsWater + tundraExtraRows);
      applyTundra(this, {
        colors,
        landNoiseAmplitude: c.landNoiseAmplitude,
        lowlandColor: c.lowlandColor,
        tundraColor: c.tundraColor,
        computedTopTundraRows,
        tundraNoiseTableTop: c.tundraNoiseTopTable,
        tundraNoiseTableBottom: c.tundraNoiseBottomTable
      });
      return { computedTopTundraRows };
    },
    _reviseApplyGlaciers({
      c,
      colors,
      computedTopGlacierRowsLand,
      computedTopGlacierRowsWater,
      computedSmoothedTopGlacierRowsLand,
      computedSmoothedTopGlacierRowsWater
    }) {
      const computedTopGlacierRows = computedTopGlacierRowsLand;
      applyGlaciers(this, {
        colors,
        glacierNoiseTable: c.glacierNoiseTable,
        landNoiseAmplitude: c.landNoiseAmplitude,
        computedTopGlacierRows,
        computedTopGlacierRowsLand,
        computedTopGlacierRowsWater,
        computedSmoothedTopGlacierRowsLand,
        computedSmoothedTopGlacierRowsWater,
        shallowSeaColor: c.shallowSeaColor,
        deepSeaColor: c.deepSeaColor,
        lowlandColor: c.lowlandColor,
        tundraColor: c.tundraColor,
        desertColor: c.desertColor,
        highlandColor: c.highlandColor,
        alpineColor: c.alpineColor,
        glacierColor: c.glacierColor,
        landMask: c.landMask,
        lakeMask: c.lakeMask
      });
      return { computedTopGlacierRows };
    },
    _reviseRebuildGridDataAndSanitizeFeatures({ c, colors }) {
      // gridData を再構築（Plane更新用）。文明要素は不整合なら削除
      const N = c.N;
      const base = Array.isArray(c.gridDataBase) ? c.gridDataBase : [];
      const cityMask = new Array(N).fill(false);
      const cultivatedMask = new Array(N).fill(false);
      const bryophyteMask = new Array(N).fill(false);
      const pollutedMask = new Array(N).fill(false);
      const seaCityMask = new Array(N).fill(false);
      const seaCultivatedMask = new Array(N).fill(false);
      const seaPollutedMask = new Array(N).fill(false);
      for (let i = 0; i < N; i++) {
        const cell = base[i];
        if (!cell) continue;
        cityMask[i] = !!cell.city;
        cultivatedMask[i] = !!cell.cultivated;
        bryophyteMask[i] = !!cell.bryophyte;
        pollutedMask[i] = !!cell.polluted;
        seaCityMask[i] = !!cell.seaCity;
        seaCultivatedMask[i] = !!cell.seaCultivated;
        seaPollutedMask[i] = !!cell.seaPolluted;
      }
      const gridData = buildGridData(this, {
        N,
        colors,
        landMask: c.landMask,
        lakeMask: c.lakeMask,
        shallowSeaColor: c.shallowSeaColor,
        lowlandColor: c.lowlandColor,
        highlandColor: c.highlandColor,
        alpineColor: c.alpineColor,
        tundraColor: c.tundraColor,
        glacierColor: c.glacierColor,
        desertColor: c.desertColor,
        cityMask,
        cultivatedMask,
        bryophyteMask,
        pollutedMask,
        seaCityMask,
        seaCultivatedMask,
        seaPollutedMask
      });
      // 中心点マーキングは維持
      markCentersOnGridData(this, { gridData, centers: c.centers });

      // 不整合なら削除（地形に合わないフラグを落とす）
      for (let i = 0; i < N; i++) {
        const cell = gridData[i];
        if (!cell || !cell.terrain) continue;
        if (cell.terrain.type === 'land') {
          const land = cell.terrain.land;
          const isLowland = (land === 'lowland');
          if (!isLowland) {
            cell.city = false;
            cell.cultivated = false;
            cell.bryophyte = false;
            cell.polluted = false;
          }
          // 海棲系は陸なら全消し
          cell.seaCity = false;
          cell.seaCultivated = false;
          cell.seaPolluted = false;
        } else {
          // sea
          const sea = cell.terrain.sea;
          const isShallow = (sea === 'shallow');
          if (!isShallow) {
            cell.seaCity = false;
            cell.seaCultivated = false;
            cell.seaPolluted = false;
          }
          // 陸系は海なら全消し
          cell.city = false;
          cell.cultivated = false;
          cell.bryophyte = false;
          cell.polluted = false;
        }
      }

      // キャッシュのベース（文明要素）も更新して、連続Reviseで破綻しないようにする
      this.hfCache.gridDataBase = gridData;
      return { gridData };
    },
    // 高頻度生成タスク:
    // - 乾燥地（帯別距離閾値）を再計算して反映
    // - ツンドラを再計算して反映
    // - 氷河行数を再計算して反映
    // - 文明要素は不整合なら削除
    // - 低頻度側の地形（海陸/湖/高地/高山/中心点）は保持
    runReviseHighFrequency() {
      const c = this.hfCache;
      if (!c || !c.N || !Array.isArray(c.preTundraColors)) return;

      const colors = c.preTundraColors.slice();
      this._reviseReclassifyDesert({ c, colors });
      this._reviseRestoreLowlandAroundLakes({ c, colors });
      const {
        computedTopGlacierRowsLand,
        computedTopGlacierRowsWater,
        computedSmoothedTopGlacierRowsLand,
        computedSmoothedTopGlacierRowsWater
      } = this._reviseComputeGlacierRows({ c });
      this._reviseApplyTundra({ c, colors, computedTopGlacierRowsWater });
      const { computedTopGlacierRows } = this._reviseApplyGlaciers({
        c,
        colors,
        computedTopGlacierRowsLand,
        computedTopGlacierRowsWater,
        computedSmoothedTopGlacierRowsLand,
        computedSmoothedTopGlacierRowsWater
      });
      const { gridData } = this._reviseRebuildGridDataAndSanitizeFeatures({ c, colors });
      this.$emit('revised', { gridData, computedTopGlacierRows });
    }
  }
}
</script>

<style scoped>
</style>


