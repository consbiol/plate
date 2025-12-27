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
import { generateLakes } from '../utils/terrain/lakes.js';
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
import { computeTopGlacierRowsFromAverageTemperature, getSmoothedGlacierRows } from '../utils/terrain/glacierRows.js';
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
    topTundraRows: { type: Number, required: true },
    topGlacierRows: { type: Number, required: true },
    landGlacierExtraRows: { type: Number, required: true },
    highlandGlacierExtraRows: { type: Number, required: true },
    alpineGlacierExtraRows: { type: Number, required: true },
    averageLakesPerCenter: { type: Number, required: true },
    averageHighlandsPerCenter: { type: Number, required: true },
    centerParameters: { type: Array, required: true },
    generateSignal: { type: Number, required: true },
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
      forceRandomDerivedRng: false
    };
  },
  watch: {
    generateSignal() {
      this.runGenerate();
    },
    reviseSignal() {
      this.runReviseHighFrequency();
    },
    driftSignal() {
      this.runDrift();
    }
  },
  methods: {
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
      return generateLakes(this, centers, centerLandCells, landMask, colors, shallowSeaColor, lowlandColor, desertColor, seededRng, seededLog);
    },
    // 高地生成（各中心ごと）
    _generateHighlands(centers, centerLandCellsPre, preLandMask, lakeMask, colors, highlandColor, seededRng, seededLog) {
      // 実装は `src/utils/terrain/highlands.js` に分離（機能不変）
      return generateHighlands(this, centers, centerLandCellsPre, preLandMask, lakeMask, colors, highlandColor, seededRng, seededLog);
    },
    // 高山生成（高地に隣接しない高地セル）
    _generateAlpines(colors, highlandColor, lowlandColor, desertColor, alpineColor, directions) {
      // 実装は `src/utils/terrain/alpines.js` に分離（機能不変）
      return generateAlpines(this, colors, highlandColor, lowlandColor, desertColor, alpineColor, directions);
    },
    runGenerate() {
      const N = this.gridWidth * this.gridHeight;
      const seededRng = this._getSeededRng();
      const seededLog = Array.from({ length: (this.centersY || 0) * 1 || 1 }, () => ({
        highlandsCount: 0,
        highlandClusters: [],
        lakeStarts: []
      }));
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
      // 大陸中心座標の決定:
      // - `deterministicSeed` が渡されている場合はシードに基づいて決定（generate 時の再現性確保）
      // - 未指定の場合は完全ランダム（従来の挙動）
      const seedStrictCenters = !!seededRng;
      const effectiveMinCenterDistance = this._computeEffectiveMinCenterDistance();
      let centers = sampleLandCenters(this, seedStrictCenters ? seededRng : null, effectiveMinCenterDistance);
      // ノイズから中心パラメータを生成（propsは直接変更しない）
      let localCenterParameters = centers.map((c) => {
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
      let scores, threshold;
      let success = false;
      for (let attempt = 0; attempt < 5 && !success; attempt++) {
        const res = computeScoresForCenters(this, centers, localCenterParameters);
        scores = res.scores;
        const sorted = scores.slice().sort((a, b) => a - b);
        // UI の seaLandRatio を内部の生成用比率へスムーズにマッピング（アンカー: 0.3->0.07, 0.9->0.7）
        const effectiveSeaLandRatio = Math.min(0.999, Math.max(0.0, mapSeaLandRatio(this.seaLandRatio)));
        const k = Math.floor((1 - effectiveSeaLandRatio) * N);
        threshold = sorted[Math.max(0, Math.min(sorted.length - 1, k))];
        let anyCenterLand = false;
        for (let i = 0; i < centers.length; i++) {
          const c = centers[i];
          const sc = scores[c.y * this.gridWidth + c.x];
          if (sc >= threshold) { anyCenterLand = true; break; }
        }
        if (anyCenterLand) {
          success = true;
        } else {
          centers = sampleLandCenters(this, seedStrictCenters ? seededRng : null, effectiveMinCenterDistance);
        }
      }
      const landMask = new Array(N).fill(false);
      for (let i = 0; i < N; i++) landMask[i] = scores[i] >= threshold;
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
      // 高地生成と適用（文明時代・海棲文明時代の決定性向上のため、海岸線ジッター前のマスクを使用）
      this._generateHighlands(centers, centerLandCellsPre, preJitterLandMask, lakeMask, colors, highlandColor, seededRng, seededLog);
      // 高山生成と適用
      this._generateAlpines(colors, highlandColor, lowlandColor, desertColor, alpineColor, directions);
      // Revise用に「ツンドラ/氷河適用前」の色を保存（湖/高地/高山の結果は保持）
      const preTundraColors = colors.slice();
      // --- 先に氷河row（基準）を計算 ---
      // ※ landMask/lakeMask にのみ依存するため、色の上書き（ツンドラ/氷河）より前に計算して問題ない
      const preGlacierStats = computePreGlacierStats({ N, landMask, lakeMask });
      const ratioOcean = preGlacierStats.seaCount / (preGlacierStats.total || 1);
      // 海率の影響は「陸の氷河形成」にのみ適用し、海/湖は標準（0.7相当）で固定する
      const computedTopGlacierRowsLand = computeTopGlacierRowsFromAverageTemperature(this, ratioOcean, 'land');
      const computedTopGlacierRowsWater = computeTopGlacierRowsFromAverageTemperature(this, 0.7, 'water');
      // glacier_alpha による平滑化後の内部値（小数）
      const computedSmoothedTopGlacierRowsLand = getSmoothedGlacierRows(this, ratioOcean, 'land');
      const computedSmoothedTopGlacierRowsWater = getSmoothedGlacierRows(this, 0.7, 'water');

      // --- ツンドラの適用（上端・下端） ---
      // 「上端・下端ツンドラグリッド追加数」は UI 上 (topTundraRows - topGlacierRows) で表現されているため、
      // 追加分を取り出し、基準（氷河row）を smoothed 値に置き換えてから適用する。
      const tundraExtraRows = Math.max(0, (this.topTundraRows || 0) - (this.topGlacierRows || 0));
      // ツンドラrowは「海グリッドに生成する氷河row」に追従させる（陸氷河は seaBoost 等で挙動が異なるため）
      const computedTopTundraRows = Math.max(0, computedSmoothedTopGlacierRowsWater + tundraExtraRows);
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
      // 上端/下端を氷河で上書き（ノイズ付き）
      // 海/湖: +0、低地・乾燥地・ツンドラ: +landGlacierExtraRows、高地: +highlandGlacierExtraRows
      // 既存UI/統計互換: computedTopGlacierRows は陸用の実効値を返す
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
      // 追加: 文明要素（都市/耕作/苔類/汚染）＋海棲文明要素（浅瀬ベース）を生成
      // 実装は `src/utils/terrain/features.js` に分離（機能不変）
      const {
        cityMask,
        cultivatedMask,
        bryophyteMask,
        pollutedMask,
        seaCityMask,
        seaCultivatedMask,
        seaPollutedMask
      } = generateFeatures(this, { N, landMask, colors, lowlandColor, shallowSeaColor, seededRng });
      // 追加: 各グリッドのプロパティ構造を作成
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
        // 低頻度の結果（湖/高地/高山は保持、ツンドラ/氷河/乾燥地はReviseで再適用）
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
      // 結果をemit（平面グリッド用に displayColors も明示的に渡す）
      this.$emit('generated', buildGeneratedPayload({
        centerParameters: localCenterParameters,
        gridData,
        deterministicSeed: this.deterministicSeed,
        preGlacierStats,
        computedTopGlacierRows
      }));
    },
    // Drift:
    // - 前回Generateの中心点（hfCache.centers）をキャッシュとして使用
    // - 暫定アルゴリズム: 全中心点を右に10グリッド移動（xをラップ）
    // - すべてのノイズをランダムに再抽選（deterministicSeed由来の派生RNGも無効化）
    runDrift() {
      const N = this.gridWidth * this.gridHeight;
      const seededRng = null; // Driftでは決定論RNGは使わない（全ノイズをランダム化）

      // Drift中は deterministicSeed 由来の派生RNG（shape-profile等）を無効化
      const prevForce = this.forceRandomDerivedRng;
      this.forceRandomDerivedRng = true;
      try {
        // centers はキャッシュ優先。無ければ通常サンプリングにフォールバック。
        const prevCenters = (this.hfCache && Array.isArray(this.hfCache.centers)) ? this.hfCache.centers : null;
        const effectiveMinCenterDistance = this._computeEffectiveMinCenterDistance();
        const baseCenters = (prevCenters && prevCenters.length > 0)
          ? prevCenters
          : sampleLandCenters(this, null, effectiveMinCenterDistance);

        const dx = 10;
        const centers = baseCenters.map((c) => ({
          x: ((Math.floor(c.x) + dx) % this.gridWidth + this.gridWidth) % this.gridWidth,
          y: Math.max(0, Math.min(this.gridHeight - 1, Math.floor(c.y)))
        }));

        const seededLog = Array.from({ length: centers.length }, () => ({
          highlandsCount: 0,
          highlandClusters: [],
          lakeStarts: []
        }));

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

        // centerParameters は「既存の影響パラメータを保持しつつ座標だけ更新」を優先
        let localCenterParameters = null;
        if (Array.isArray(this.centerParameters) && this.centerParameters.length === centers.length) {
          localCenterParameters = this.centerParameters.map((p, i) => ({
            ...p,
            x: centers[i].x,
            y: centers[i].y
          }));
        } else {
          localCenterParameters = centers.map((c) => {
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
        }

        // スコアと閾値計算（中心点は固定）。中心点が陸にならないケースでも resample はしない。
        let scores, threshold;
        const res = computeScoresForCenters(this, centers, localCenterParameters);
        scores = res.scores;
        const sorted = scores.slice().sort((a, b) => a - b);
        const effectiveSeaLandRatio = Math.min(0.999, Math.max(0.0, mapSeaLandRatio(this.seaLandRatio)));
        const k = Math.floor((1 - effectiveSeaLandRatio) * N);
        threshold = sorted[Math.max(0, Math.min(sorted.length - 1, k))];

        const landMask = new Array(N).fill(false);
        for (let i = 0; i < N; i++) landMask[i] = scores[i] >= threshold;

        const noiseGrid = buildVisualNoiseGrid(this, { N, seededRng });
        const ownerCenterIdx = computeOwnerCenterIdx(this, centers);

        dilateLandMask(this, {
          landMask,
          scores,
          threshold,
          expansionBias: 0.12,
          maxIterations: 10
        });
        removeSingleCellIslands(this, { landMask, seededRng });
        const preJitterLandMask = landMask.slice();
        jitterCoastline(this, { landMask, scores, threshold, seededRng });

        const seaNoiseAmplitude = 1.5;
        const landNoiseAmplitude = 2.5;
        const {
          deepSeaColor, shallowSeaColor, lowlandColor, desertColor,
          highlandColor, alpineColor, tundraColor, glacierColor
        } = this._getBaseColors();
        const directions = getDirections8();
        const wrap = (x, y) => this.torusWrap(x, y);
        const distFn = (x1, y1, x2, y2) => this.torusDistance(x1, y1, x2, y2);

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

        const { centerLandCells, centerLandCellsPre } = buildCenterLandCells(this, {
          centers,
          ownerCenterIdx,
          landMask,
          preLandMask: preJitterLandMask
        });

        // Driftでは「ノイズは全再抽選」だが、高地の個数/クラスター（開始セル/サイズ）は
        // deterministicSeed が指定されている場合に限りシード固定にする。
        // ※ 地形本体（landMask等）はランダムなので、結果は「高地生成の乱数源がMath.randomではない」ことを保証する。
        const lakeMask = this._generateLakes(centers, centerLandCells, landMask, colors, shallowSeaColor, lowlandColor, desertColor, seededRng, seededLog);
        const seededRngHighlands = this._getSeededRng();
        if (seededRngHighlands) {
          // 高地生成だけ派生RNGも有効化して、中心/クラスタごとに独立ストリームにする
          const prevForceHighlands = this.forceRandomDerivedRng;
          this.forceRandomDerivedRng = false;
          try {
            this._generateHighlands(centers, centerLandCellsPre, preJitterLandMask, lakeMask, colors, highlandColor, seededRngHighlands, seededLog);
          } finally {
            this.forceRandomDerivedRng = prevForceHighlands;
          }
        } else {
          this._generateHighlands(centers, centerLandCellsPre, preJitterLandMask, lakeMask, colors, highlandColor, seededRng, seededLog);
        }
        this._generateAlpines(colors, highlandColor, lowlandColor, desertColor, alpineColor, directions);

        const preTundraColors = colors.slice();

        const preGlacierStats = computePreGlacierStats({ N, landMask, lakeMask });
        const ratioOcean = preGlacierStats.seaCount / (preGlacierStats.total || 1);
        const computedTopGlacierRowsLand = computeTopGlacierRowsFromAverageTemperature(this, ratioOcean, 'land');
        const computedTopGlacierRowsWater = computeTopGlacierRowsFromAverageTemperature(this, 0.7, 'water');
        const computedSmoothedTopGlacierRowsLand = getSmoothedGlacierRows(this, ratioOcean, 'land');
        const computedSmoothedTopGlacierRowsWater = getSmoothedGlacierRows(this, 0.7, 'water');

        const tundraExtraRows = Math.max(0, (this.topTundraRows || 0) - (this.topGlacierRows || 0));
        const computedTopTundraRows = Math.max(0, computedSmoothedTopGlacierRowsWater + tundraExtraRows);
        applyTundra(this, {
          colors,
          landNoiseAmplitude,
          lowlandColor,
          tundraColor,
          computedTopTundraRows,
          tundraNoiseTableTop: tundraNoiseTopTable,
          tundraNoiseTableBottom: tundraNoiseBottomTable
        });

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

        const {
          cityMask,
          cultivatedMask,
          bryophyteMask,
          pollutedMask,
          seaCityMask,
          seaCultivatedMask,
          seaPollutedMask
        } = generateFeatures(this, { N, landMask, colors, lowlandColor, shallowSeaColor, seededRng });

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
          glacierNoiseTable,
          tundraNoiseTopTable,
          tundraNoiseBottomTable,
          shallowSeaColor,
          deepSeaColor,
          lowlandColor,
          desertColor,
          highlandColor,
          alpineColor,
          tundraColor,
          glacierColor,
          seaNoiseAmplitude,
          landNoiseAmplitude,
          preGlacierStats,
          gridDataBase: gridData
        };

        this.$emit('drifted', buildGeneratedPayload({
          centerParameters: localCenterParameters,
          gridData,
          deterministicSeed: this.deterministicSeed,
          preGlacierStats,
          computedTopGlacierRows
        }));
      } finally {
        this.forceRandomDerivedRng = prevForce;
      }
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

      const N = c.N;
      const colors = c.preTundraColors.slice();

      // --- 乾燥地（帯別閾値）を再分類（低地/乾燥地のみ対象。湖/高地/高山は保持） ---
      for (let gy = 0; gy < this.gridHeight; gy++) {
        for (let gx = 0; gx < this.gridWidth; gx++) {
          const idx = gy * this.gridWidth + gx;
          if (!c.landMask[idx]) continue;
          if (c.lakeMask && c.lakeMask[idx]) continue; // 湖は保持
          const col = colors[idx];
          if (col === c.highlandColor || col === c.alpineColor) continue; // 高地/高山は保持
          // 低地/乾燥地を再判定
          const n = c.noiseGrid[idx];
          const bandThreshold = this._getLandDistanceThresholdForRow(gy, gx);
          const landThreshold = bandThreshold + n * c.landNoiseAmplitude;
          colors[idx] = c.distanceToSea[idx] > landThreshold ? c.desertColor : c.lowlandColor;
        }
      }

      // --- 湖の周囲を低地に戻す（低頻度結果を維持） ---
      // Prefer per-lake radii collected at generation time (c.lakesList).
      // Fallback to previous global heuristic if per-lake data missing.
      if (Array.isArray(c.lakesList) && c.lakesList.length > 0) {
        for (const lake of c.lakesList) {
          // Recompute per-lake radius from CURRENT band threshold (Revise is meant to reflect parameter updates)
          let R = 0;
          if (lake && typeof lake.startY === 'number' && typeof lake.startX === 'number') {
            const bandThr = Number(this._getLandDistanceThresholdForRow(lake.startY, lake.startX)) || 0;
            R = Math.ceil(bandThr / 3);
          } else {
            R = (lake && Number(lake.radius)) || 0;
          }
          if (!Number.isFinite(R) || R <= 0) continue;
          for (const cellIdx of (lake.cells || [])) {
            const gx = cellIdx % this.gridWidth;
            const gy = Math.floor(cellIdx / this.gridWidth);
            for (let dy = -R; dy <= R; dy++) {
              for (let dx = -R; dx <= R; dx++) {
                const wrapped = this.torusWrap(gx + dx, gy + dy);
                if (!wrapped) continue;
                const d = Math.hypot(dx, dy);
                if (d > R) continue;
                const nIdx = wrapped.y * this.gridWidth + wrapped.x;
                if (colors[nIdx] === c.desertColor) colors[nIdx] = c.lowlandColor;
              }
            }
          }
        }
      } else {
        const baseLandThr = (this.baseLandDistanceThresholdFixed != null)
          ? this.baseLandDistanceThresholdFixed
          : this.baseLandDistanceThreshold;
        const lakeLowlandRadius = Math.floor(Number(baseLandThr || 0) / 5);
        if (c.lakeMask && lakeLowlandRadius > 0) {
          for (let gy = 0; gy < this.gridHeight; gy++) {
            for (let gx = 0; gx < this.gridWidth; gx++) {
              const idx = gy * this.gridWidth + gx;
              if (!c.lakeMask[idx]) continue;
              for (let dy = -lakeLowlandRadius; dy <= lakeLowlandRadius; dy++) {
                for (let dx = -lakeLowlandRadius; dx <= lakeLowlandRadius; dx++) {
                  const wrapped = this.torusWrap(gx + dx, gy + dy);
                  if (!wrapped) continue;
                  const d = Math.hypot(dx, dy);
                  if (d > lakeLowlandRadius) continue;
                  const nIdx = wrapped.y * this.gridWidth + wrapped.x;
                  if (colors[nIdx] === c.desertColor) colors[nIdx] = c.lowlandColor;
                }
              }
            }
          }
        }
      }

      // --- 氷河行数の再計算（smoothed含む） ---
      const ratioOcean = (c.preGlacierStats && c.preGlacierStats.total)
        ? (c.preGlacierStats.seaCount / (c.preGlacierStats.total || 1))
        : 0.7;
      const computedTopGlacierRowsLand = computeTopGlacierRowsFromAverageTemperature(this, ratioOcean, 'land');
      const computedTopGlacierRowsWater = computeTopGlacierRowsFromAverageTemperature(this, 0.7, 'water');
      const computedSmoothedTopGlacierRowsLand = getSmoothedGlacierRows(this, ratioOcean, 'land');
      const computedSmoothedTopGlacierRowsWater = getSmoothedGlacierRows(this, 0.7, 'water');

      // --- ツンドラ再適用（固定ノイズ） ---
      const tundraExtraRows = Math.max(0, (this.topTundraRows || 0) - (this.topGlacierRows || 0));
      const computedTopTundraRows = Math.max(0, computedSmoothedTopGlacierRowsWater + tundraExtraRows);
      applyTundra(this, {
        colors,
        landNoiseAmplitude: c.landNoiseAmplitude,
        lowlandColor: c.lowlandColor,
        tundraColor: c.tundraColor,
        computedTopTundraRows,
        tundraNoiseTableTop: c.tundraNoiseTopTable,
        tundraNoiseTableBottom: c.tundraNoiseBottomTable
      });

      // --- 氷河再適用 ---
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

      // --- gridData を再構築（Plane更新用）。文明要素は不整合なら削除 ---
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

      this.$emit('revised', {
        gridData,
        computedTopGlacierRows
      });
    }
  }
}
</script>

<style scoped>
</style>


