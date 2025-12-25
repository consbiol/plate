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
import { computeTopGlacierRowsFromAverageTemperature } from '../utils/terrain/glacierRows.js';
import { noise2D as noise2DUtil, fractalNoise2D as fractalNoise2DUtil } from '../utils/noise.js';
import { poissonSample } from '../utils/stats/poisson.js';
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
      lastReturnedGlacierRows: null
    };
  },
  watch: {
    generateSignal() {
      this.runGenerate();
    }
  },
  methods: {
    // サブRNG（サブストリーム）生成: ベースの deterministicSeed にラベルを連結して独立RNGを作る
    _getDerivedRng(...labels) {
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
      const wobbleRows = Math.max(0, Math.floor(this.landBandVerticalWobbleRows || 0));
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
      switch (b) {
        case 1: return this.landDistanceThreshold1;
        case 2: return this.landDistanceThreshold2;
        case 3: return this.landDistanceThreshold3;
        case 4: return this.landDistanceThreshold4;
        case 5: return this.landDistanceThreshold5;
        case 6: return this.landDistanceThreshold6;
        case 7: return this.landDistanceThreshold7;
        case 8: return this.landDistanceThreshold8;
        case 9: return this.landDistanceThreshold9;
        case 10: return this.landDistanceThreshold10;
        default: return this.landDistanceThreshold10;
      }
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
      // 帯の縦揺らぎ（列ごと）の事前生成（完全ランダム、シード非依存）
      const wobbleRows = Math.max(0, Math.floor(this.landBandVerticalWobbleRows || 0));
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
      const glacierNoiseTable = new Array(N);
      {
        const seedStrictGl = (this.era === '文明時代' || this.era === '海棲文明時代') && !!seededRng;
        const gRng = seedStrictGl ? (this._getDerivedRng('glacier-noise') || seededRng) : Math.random;
        for (let i = 0; i < N; i++) {
          glacierNoiseTable[i] = (gRng() * 2 - 1);
        }
      }
      // 大陸中心座標の決定:
      // - 文明時代・海棲文明時代: シードに基づいて決定
      // - それ以外: 完全ランダム（シード非依存）
      const seedStrictCenters = (this.era === '文明時代' || this.era === '海棲文明時代') && !!seededRng;
      let centers = sampleLandCenters(this, seedStrictCenters ? seededRng : null);
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
          centers = sampleLandCenters(this, seedStrictCenters ? seededRng : null);
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
      // --- ツンドラの適用（上端・下端） ---
      applyTundra(this, { colors, landNoiseAmplitude, lowlandColor, tundraColor });
      // --- 氷河の適用（上端） ---
      const preGlacierStats = computePreGlacierStats({ N, landMask, lakeMask });
      // 上端/下端を氷河で上書き（ノイズ付き）
      // 海/湖: +0、低地・乾燥地・ツンドラ: +landGlacierExtraRows、高地: +highlandGlacierExtraRows
      const computedTopGlacierRows = computeTopGlacierRowsFromAverageTemperature(
        this,
        preGlacierStats.seaCount / (preGlacierStats.total || 1)
      );
      applyGlaciers(this, {
        colors,
        glacierNoiseTable,
        landNoiseAmplitude,
        computedTopGlacierRows,
        shallowSeaColor,
        deepSeaColor,
        lowlandColor,
        tundraColor,
        desertColor,
        highlandColor,
        alpineColor,
        glacierColor
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
      // 結果をemit（平面グリッド用に displayColors も明示的に渡す）
      this.$emit('generated', buildGeneratedPayload({
        centerParameters: localCenterParameters,
        gridData,
        deterministicSeed: this.deterministicSeed,
        preGlacierStats,
        computedTopGlacierRows
      }));
    }
  }
}
</script>

<style scoped>
</style>


