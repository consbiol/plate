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
import { generateLakes, applyLakeColors, applyLowlandAroundLakes } from '../utils/terrain/lakes.js';
import { generateHighlands } from '../utils/terrain/highlands.js';
import { generateAlpines } from '../utils/terrain/alpines.js';
import { generateFeatures } from '../utils/terrain/features.js';
import { getBiasedCityProbability } from '../utils/terrain/features/probability.js';
import { computeDistanceMap } from '../utils/pathfinding/distanceMap.js';
import { applyGlaciers } from '../utils/terrain/glaciers.js';
import { applyTundra } from '../utils/terrain/tundra.js';
import { dilateLandMask, removeSingleCellIslands, jitterCoastline } from '../utils/terrain/landmask.js';
import { sampleLandCenters, computeScoresForCenters, computeOwnerCenterIdx, computeEffectiveMinCenterDistance } from '../utils/terrain/centers.js';
import { mapSeaLandRatio } from '../utils/terrain/ratio.js';
import { buildVisualNoiseGrid, getDirections8 } from '../utils/terrain/noiseGrid.js';
import { classifyBaseColors } from '../utils/terrain/classifyColors.js';
import { buildCenterLandCells } from '../utils/terrain/centerCells.js';
import { buildGridData, markCentersOnGridData } from '../utils/terrain/gridData.js';
import { applySeededLogToCenterParameters } from '../utils/terrain/centerParams.js';
import { computePreGlacierStats, buildGeneratedPayload } from '../utils/terrain/output.js';
import { computeTopGlacierRowsFromAverageTemperature, getSmoothedGlacierRows, computeTopGlacierRowsPure } from '../utils/terrain/glacierRows.js';
import { buildGenerationJobInputs, GENERATION_JOB_INPUT_KEYS } from '../utils/terrain/jobInputs.js';
import { buildDriftStateSnapshot, buildWorkerInputs, buildDepsSnapshot } from '../utils/terrain/workerPayload.js';
import { runGenerate as runGenerateTerrain, runDrift as runDriftTerrain, runReviseHighFrequency as runReviseHighFrequencyTerrain } from '../utils/terrain/terrainRunner.js';
import { noise2D as noise2DUtil, fractalNoise2D as fractalNoise2DUtil } from '../utils/noise.js';
import { poissonSample } from '../utils/stats/poisson.js';
import { PARAM_DEFAULTS } from '../utils/paramsDefaults.js';
import { getClimateVars } from '../store/api.js';
import { bestEffort } from '../utils/bestEffort.js';
import { RUN_MODES } from '../constants/runQueue.js';

/**
 * Public API payload contract:
 * `runGenerate` emits/produces `TerrainEventPayload` (generated),
 * `runDrift` emits/produces `TerrainEventPayload` (drifted),
 * `runReviseHighFrequency` emits/produces `TerrainEventPayload` (revised).
 *
 * @typedef {import('../types/index.js').TerrainEventPayload} TerrainEventPayload
 * @typedef {import('../types/index.js').TerrainRunCommand} TerrainRunCommand
 * @typedef {import('../types/index.js').TerrainHighFrequencyCache} TerrainHighFrequencyCache
 */
const LAND_BAND_MIN = 1;
const LAND_BAND_MAX = 10;
const DIRS_8 = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], /*0,0*/ [1, 0],
  [-1, 1], [0, 1], [1, 1]
];
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
    // 統合シグナル: runSignal が増えたら runQueue を処理する
    runSignal: { type: Number, required: false, default: 0 },
    // キュー（FIFO）: 親が enqueue し、子が runSignal で順に処理する
    // @type {TerrainRunCommand[]}
    runQueue: { type: Array, required: false, default: () => [] },
    gridWidth: { type: Number, required: true },
    gridHeight: { type: Number, required: true },
    seaLandRatio: { type: Number, required: true },
    centersY: { type: Number, required: true },
    minCenterDistance: { type: Number, required: true },
    noiseAmp: { type: Number, required: true, default: 0.08 },
    kDecay: { type: Number, required: true, default: 2.0 },
    // 単独1セル島の削除確率（0..1）
    singleCellRemovalProb: { type: Number, required: false, default: 0.5 },
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
    showCentersRed: { type: Boolean, required: false, default: false },
    // 中心点近傍の陸生成バイアス（0で無効、値を上げると中心付近が陸になりやすい）
    centerBias: { type: Number, required: false, default: 0.8 },
    // 指定要素のみ決定化するためのシード（未指定時は従来通り）
    deterministicSeed: { type: [Number, String], required: false, default: null },
    // 時代（パレット切替用、未指定ならデフォルト色）
    era: { type: String, required: false, default: null },
    // Web Worker を使用するかどうか
    useTerrainWorker: { type: Boolean, required: false, default: true }
  },
  data() {
    return {
      // prop を直接変更しないための内部ステート
      internalTopGlacierRows: this.topGlacierRows,
      lastReturnedGlacierRows: null,
      lastGenerationInputs: null,
      // Generate時に「高頻度更新に必要なものだけ」キャッシュする
      /** @type {TerrainHighFrequencyCache|null} */
      hfCache: null,
      // 帯の縦揺らぎは Generate 時に固定（Revise では固定値を使う）
      wobbleRowsFixed: null,
      // 低頻度タスク側の baseLandDistanceThreshold を固定（Revise では固定値を使う）
      baseLandDistanceThresholdFixed: null,
      // Drift中は deterministicSeed 由来の派生RNG（shape-profile等）を無効化して「全ノイズをランダム」にする
      forceRandomDerivedRng: false,
      // Generate に既に入っていて、新しい生成リクエストが来たか
      isGenerateRunning: false,
      pendingGenerateOptions: null,

      // --- Drift の「ターン」状態（ドリフト実行1回 = 1ターン） ---
      driftTurn: 0,
      // 現在のフェーズ（true=接近, false=反発）
      driftIsApproach: true,
      superPloom_calc: 0,
      superPloom_history: [],
      // Parameters Output に出す用（直近ターンの値）
      driftMetrics: null,

      // runContext が渡されないケースのフォールバック用（payloadを自己記述化する）
      emitSeq: 0,

      // Parent UI hook: busy/idle (for debugging and safer UI gating)
      isRunBusy: false,
      isDrainRunning: false,
      terrainWorker: null,
      terrainWorkerSeq: 0,
      terrainWorkerPending: {},
      terrainWorkerFailed: false,
      workerHasHfCache: false
    };
  },
  watch: {
    runSignal() {
      this._drainRunQueue();
    }
  },
  beforeUnmount() {
    this._terminateTerrainWorker();
  },
  methods: {
    _setRunBusy(busy, payload = null) {
      const next = !!busy;
      if (this.isRunBusy === next) return;
      this.isRunBusy = next;
      this.$emit(next ? 'run-busy' : 'run-idle', payload);
    },
    _getTerrainWorker() {
      if (this.terrainWorkerFailed) return null;
      if (this.terrainWorker) return this.terrainWorker;
      if (typeof Worker === 'undefined') return null;
      try {
        const worker = new Worker(new URL('../utils/terrain/terrainWorker.js', import.meta.url), { type: 'module' });
        worker.onmessage = (event) => this._onTerrainWorkerMessage(event);
        worker.onerror = (err) => {
          this.terrainWorkerFailed = true;
          this.workerHasHfCache = false;
          this.$emit('run-worker-error', { error: err || new Error('Worker error') });
          this._rejectAllTerrainWorkerPending(err || new Error('Worker error'));
        };
        this.terrainWorker = worker;
        return worker;
      } catch (e) {
        this.terrainWorkerFailed = true;
        this.workerHasHfCache = false;
        this.$emit('run-worker-error', { error: e || new Error('Worker error') });
        return null;
      }
    },
    _rejectAllTerrainWorkerPending(err) {
      const pending = this.terrainWorkerPending || {};
      for (const id of Object.keys(pending)) {
        const p = pending[id];
        if (p && p.timeoutId) clearTimeout(p.timeoutId);
        if (p && typeof p.reject === 'function') p.reject(err);
      }
      this.terrainWorkerPending = {};
    },
    _onTerrainWorkerMessage(event) {
      const data = event && event.data ? event.data : {};
      const { id, outputs, error, missing } = data;
      if (!id) return;
      const pending = this.terrainWorkerPending && this.terrainWorkerPending[id];
      if (!pending) return;
      if (pending.timeoutId) clearTimeout(pending.timeoutId);
      delete this.terrainWorkerPending[id];
      if (error) {
        const details = Array.isArray(missing) && missing.length > 0 ? `: ${missing.join(', ')}` : '';
        pending.reject(new Error(`${error}${details}`));
        return;
      }
      pending.resolve(outputs || null);
    },
    _postTerrainWorkerJob({ runMode, runContext, timeoutMs = 30000 }) {
      const worker = this._getTerrainWorker();
      if (!worker) return null;
      const includeHfCache = !this.workerHasHfCache;
      const inputs = this._buildWorkerInputs({ runMode, runContext, includeHfCache });
      if (inputs && inputs.generationInputs) this.lastGenerationInputs = inputs.generationInputs;
      const depsSnapshot = this._buildWorkerDepsSnapshot({ includeHfCache });
      const id = `${Date.now()}-${++this.terrainWorkerSeq}`;
      return new Promise((resolve, reject) => {
        const timeoutId = Number.isFinite(timeoutMs) && timeoutMs > 0
          ? setTimeout(() => {
            if (this.terrainWorkerPending && this.terrainWorkerPending[id]) {
              delete this.terrainWorkerPending[id];
              reject(new Error('Worker timeout'));
            }
          }, timeoutMs)
          : null;
        this.terrainWorkerPending[id] = { resolve, reject, timeoutId };
        try {
          worker.postMessage({ id, inputs, depsSnapshot });
        } catch (e) {
          if (timeoutId) clearTimeout(timeoutId);
          delete this.terrainWorkerPending[id];
          reject(e);
        }
      });
    },
    _terminateTerrainWorker() {
      if (this.terrainWorker) {
        this.terrainWorker.terminate();
        this.terrainWorker = null;
      }
      this.terrainWorkerPending = {};
      this.workerHasHfCache = false;
    },
    _normalizeRunCommand(cmd) {
      const c = cmd || {};
      const mode = c && c.mode ? String(c.mode) : '';
      const rc = c && c.runContext ? c.runContext : null;
      const rawOptions = (c && typeof c.options === 'object' && c.options) ? c.options : null;

      if (mode === RUN_MODES.REVISE) {
        // default: emit true (button path). Turn-tick uses direct call with emit:false.
        const emit =
          rawOptions && typeof rawOptions.emit === 'boolean'
            ? rawOptions.emit
            : true;
        return { mode, runContext: rc, options: { emit } };
      }
      if (mode === RUN_MODES.UPDATE) {
        return { mode, runContext: rc, options: { preserveCenterCoordinates: true } };
      }
      if (mode === RUN_MODES.GENERATE) {
        return { mode, runContext: rc, options: { preserveCenterCoordinates: false } };
      }
      if (mode === RUN_MODES.DRIFT) {
        return { mode, runContext: rc, options: null };
      }
      return { mode: '', runContext: rc, options: null };
    },
    _getClimateAverageTemperatureCelsius() {
      const climateVars = getClimateVars(this.$store);
      if (climateVars && typeof climateVars.averageTemperature_calc === 'number') {
        return climateVars.averageTemperature_calc - 273.15;
      }
      return null;
    },
    async _drainRunQueue() {
      if (this.isDrainRunning) return;
      this.isDrainRunning = true;
      const q = Array.isArray(this.runQueue) ? this.runQueue : [];
      if (q.length === 0) {
        this.isDrainRunning = false;
        return;
      }

      let consumed = 0;
      this._setRunBusy(true, { queueLength: q.length });
      try {
        for (let i = 0; i < q.length; i++) {
          const norm = this._normalizeRunCommand(q[i] || null);
          const mode = norm.mode;
          const options = norm.options;
          const rc = norm.runContext;

          if (!mode) { consumed++; continue; }

          if (mode === RUN_MODES.REVISE) {
            await this.runReviseHighFrequency({ ...(options || {}), runContext: rc });
            consumed++;
            continue;
          }
          if (mode === RUN_MODES.DRIFT) {
            await this.runDrift({ runContext: rc });
            consumed++;
            continue;
          }
          if (mode === RUN_MODES.UPDATE || mode === RUN_MODES.GENERATE) {
            const preserve = (options && typeof options.preserveCenterCoordinates === 'boolean')
              ? !!options.preserveCenterCoordinates
              : (mode === RUN_MODES.UPDATE);
            await this._scheduleGenerate({ preserveCenterCoordinates: preserve, runContext: rc });
            consumed++;
            continue;
          }
          // unknown => consume and ignore
          consumed++;
        }
      } finally {
        this._setRunBusy(false, { consumed });
        this.isDrainRunning = false;
      }
      if (consumed > 0) this.$emit('run-consumed', consumed);
    },
    _makeFallbackRunId() {
      this.emitSeq = (Number(this.emitSeq) || 0) + 1;
      return `${Date.now()}-${this.emitSeq}`;
    },
    /**
     * Ensure payload run context exists even when parent forgets to pass it.
     * @param {{runContext?: any, defaultRunMode?: ('generate'|'update'|'revise'|'drift')|null}} arg
     */
    _ensureRunContext({ runContext = null, defaultRunMode = null } = {}) {
      const rc = runContext || null;
      const runMode = (rc && rc.runMode) ? rc.runMode : (defaultRunMode || null);
      const hasRunId = rc && (typeof rc.runId !== 'undefined') && rc.runId !== null;
      const runId = hasRunId ? rc.runId : this._makeFallbackRunId();
      return { runMode, runId };
    },
    async _scheduleGenerate(options = {}) {
      const opts = {
        preserveCenterCoordinates: false,
        runContext: null,
        ...options
      };
      if (this.isGenerateRunning) {
        this.pendingGenerateOptions = opts;
        return;
      }
      this._setRunBusy(true, { mode: opts.preserveCenterCoordinates ? 'update' : 'generate' });
      this.isGenerateRunning = true;
      try {
        await this.runGenerate(opts);
      } finally {
        this.isGenerateRunning = false;
        this._setRunBusy(false, { mode: opts.preserveCenterCoordinates ? 'update' : 'generate' });
      }
      if (this.pendingGenerateOptions) {
        const next = this.pendingGenerateOptions;
        this.pendingGenerateOptions = null;
        await this._scheduleGenerate(next);
      }
    },
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
        _getLandDistanceThresholdForRow: (...args) => this._getLandDistanceThresholdForRow(...args)
      };
    },
    _buildClassifyCtx() {
      return {
        gridWidth: this.gridWidth,
        gridHeight: this.gridHeight,
        baseSeaDistanceThreshold: this.baseSeaDistanceThreshold,
        getLandDistanceThresholdForRow: (...args) => this._getLandDistanceThresholdForRow(...args)
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
    _getDerivedRngForFeatures(...labels) {
      if (this.forceRandomDerivedRng) return null;
      return createDerivedRng(this.deterministicSeed, ...labels);
    },
    _buildLakeLowlandCtx() {
      return {
        gridWidth: this.gridWidth,
        gridHeight: this.gridHeight,
        torusWrap: (...args) => this.torusWrap(...args),
        _getLandDistanceThresholdForRow: (...args) => this._getLandDistanceThresholdForRow(...args)
      };
    },
    _buildGenerationJobInputs() {
      const source = this._collectGenerationJobInputSource();
      return buildGenerationJobInputs(source);
    },
    _buildWorkerInputs({ runMode, runContext, includeHfCache = true }) {
      const generationInputs = this._buildGenerationJobInputs();
      const driftState = buildDriftStateSnapshot({
        driftTurn: this.driftTurn,
        driftIsApproach: this.driftIsApproach,
        superPloom_calc: this.superPloom_calc,
        superPloom_history: this.superPloom_history,
        driftMetrics: this.driftMetrics
      });
      return buildWorkerInputs({
        runMode,
        runContext,
        generationInputs,
        hfCache: includeHfCache ? this.hfCache : null,
        driftState
      });
    },
    _buildWorkerDepsSnapshot({ includeHfCache = true } = {}) {
      return buildDepsSnapshot({
        props: {
          gridWidth: this.gridWidth,
          gridHeight: this.gridHeight,
          centersY: this.centersY,
          minCenterDistance: this.minCenterDistance,
          deterministicSeed: this.deterministicSeed
        },
        state: {
          driftTurn: this.driftTurn,
          driftIsApproach: this.driftIsApproach,
          superPloom_calc: this.superPloom_calc,
          superPloom_history: this.superPloom_history,
          driftMetrics: this.driftMetrics
        },
        hfCache: includeHfCache ? this.hfCache : null
      });
    },
    _applyWorkerOutputs(outputs) {
      if (!outputs || typeof outputs !== 'object') return;
      const { hfCache, driftState } = outputs;
      if (hfCache && typeof hfCache === 'object') {
        this.hfCache = hfCache;
        this.workerHasHfCache = true;
      }
      if (driftState && typeof driftState === 'object') {
        if (Number.isFinite(driftState.driftTurn)) this.driftTurn = driftState.driftTurn;
        if (typeof driftState.driftIsApproach === 'boolean') this.driftIsApproach = driftState.driftIsApproach;
        if (Number.isFinite(driftState.superPloom_calc)) this.superPloom_calc = driftState.superPloom_calc;
        if (Array.isArray(driftState.superPloom_history)) this.superPloom_history = driftState.superPloom_history.slice();
        if (typeof driftState.driftMetrics !== 'undefined') this.driftMetrics = driftState.driftMetrics;
      }
    },
    _collectGenerationJobInputSource() {
      const source = {};
      for (const key of GENERATION_JOB_INPUT_KEYS) {
        source[key] = this[key];
      }
      return source;
    },
    _buildGenerationJobSpec() {
      const generationInputs = Object.freeze(this._buildGenerationJobInputs());
      const gridWidth = Number.isFinite(generationInputs.gridWidth)
        ? generationInputs.gridWidth
        : this.gridWidth;
      const gridHeight = Number.isFinite(generationInputs.gridHeight)
        ? generationInputs.gridHeight
        : this.gridHeight;
      return {
        generationInputs,
        gridWidth,
        gridHeight,
        N: (gridWidth || 0) * (gridHeight || 0)
      };
    },
    _buildCenterCellsCtx() {
      return {
        gridWidth: this.gridWidth,
        gridHeight: this.gridHeight
      };
    },
    _buildAlpinesCtx() {
      return {
        gridWidth: this.gridWidth,
        gridHeight: this.gridHeight,
        torusWrap: (...args) => this.torusWrap(...args)
      };
    },
    // サブRNG（サブストリーム）生成: ベースの deterministicSeed にラベルを連結して独立RNGを作る
    _getDerivedRng(...labels) {
      if (this.forceRandomDerivedRng) return null;
      return createDerivedRng(this.deterministicSeed, ...labels);
    },
    _buildRunnerDeps() {
      return {
        buildGenerationJobSpec: () => this._buildGenerationJobSpec(),
        getSeededRng: () => this._getSeededRng(),
        resetDriftStateForGenerate: (opts) => this._resetDriftStateForGenerate(opts),
        buildSeededLog: (...args) => this._buildSeededLog(...args),
        precomputeGenerateFixedTables: (opts) => this._precomputeGenerateFixedTables(opts),
        computeCentersAndParamsForGenerate: (opts) => this._computeCentersAndParamsForGenerate(opts),
        computeScoresThresholdAndLandMaskForGenerate: (opts) => this._computeScoresThresholdAndLandMaskForGenerate(opts),
        ensureRunContext: (opts) => this._ensureRunContext(opts),
        buildWorld: (opts) => this._buildWorld(opts),
        precomputeDriftFixedTables: (opts) => this._precomputeDriftFixedTables(opts),
        computeCenterParametersForDrift: (opts) => this._computeCenterParametersForDrift(opts),
        computeScoresThresholdAndLandMaskForDrift: (opts) => this._computeScoresThresholdAndLandMaskForDrift(opts),
        reviseReclassifyDesert: (opts) => this._reviseReclassifyDesert(opts),
        reviseRestoreLowlandAroundLakes: (opts) => this._reviseRestoreLowlandAroundLakes(opts),
        reviseComputeGlacierRows: (opts) => this._reviseComputeGlacierRows(opts),
        reviseApplyTundra: (opts) => this._reviseApplyTundra(opts),
        reviseApplyGlaciers: (opts) => this._reviseApplyGlaciers(opts),
        reviseRebuildGridDataAndSanitizeFeatures: (opts) => this._reviseRebuildGridDataAndSanitizeFeatures(opts),
        computeEffectiveMinCenterDistance: () => this._computeEffectiveMinCenterDistance(),
        torusDistance: (x1, y1, x2, y2) => this.torusDistance(x1, y1, x2, y2),
        setForceRandomDerivedRng: (value) => { this.forceRandomDerivedRng = value; },
        props: {
          gridWidth: this.gridWidth,
          gridHeight: this.gridHeight,
          centersY: this.centersY,
          minCenterDistance: this.minCenterDistance,
          deterministicSeed: this.deterministicSeed
        },
        state: {
          driftTurn: this.driftTurn,
          driftIsApproach: this.driftIsApproach,
          superPloom_calc: this.superPloom_calc,
          superPloom_history: this.superPloom_history,
          driftMetrics: this.driftMetrics
        },
        hfCache: this.hfCache
      };
    },
    _getGlacierRowsStateAccessors(stateKey) {
      if (stateKey == null) {
        return {
          getInternal: () => this.internalTopGlacierRows,
          setInternal: (v) => { this.internalTopGlacierRows = v; },
          getLast: () => this.lastReturnedGlacierRows,
          setLast: (v) => { this.lastReturnedGlacierRows = v; }
        };
      }
      if (!this._glacierRowsState) this._glacierRowsState = {};
      if (!this._glacierRowsState[stateKey]) {
        this._glacierRowsState[stateKey] = {
          internalTopGlacierRows: null,
          lastReturnedGlacierRows: null
        };
      }
      const s = this._glacierRowsState[stateKey];
      return {
        getInternal: () => s.internalTopGlacierRows,
        setInternal: (v) => { s.internalTopGlacierRows = v; },
        getLast: () => s.lastReturnedGlacierRows,
        setLast: (v) => { s.lastReturnedGlacierRows = v; }
      };
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
      if (band < LAND_BAND_MIN) return LAND_BAND_MIN;
      if (band > LAND_BAND_MAX) return LAND_BAND_MAX;
      return band;
    },
    // 指定行/列の land distance threshold を返す
    _getLandDistanceThresholdForRow(y, x) {
      const b = this._getLatBandIndex(y, x);
      const idx = Math.min(LAND_BAND_MAX, Math.max(LAND_BAND_MIN, b));
      const propName = `landDistanceThreshold${idx}`;
      const v = Number(this[propName]);
      return Number.isFinite(v)
        ? v
        : Number(PARAM_DEFAULTS && PARAM_DEFAULTS[propName]);
    },
    // seaLandRatio に応じて中心間の最低距離を計算する
    // マッピング: 0.2 -> 20, 0.6 -> 30, 1.0 -> 40（線形補間）。範囲外はクランプ。
    _computeEffectiveMinCenterDistance() {
      return computeEffectiveMinCenterDistance(this.seaLandRatio, PARAM_DEFAULTS && PARAM_DEFAULTS.seaLandRatio);
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
    _generateLakes(centers, centerLandCells, landMask, seededRng, seededLog) {
      const ctx = this._buildLakesCtx();
      return generateLakes(ctx, centers, centerLandCells, landMask, seededRng, seededLog);
    },
    // 高地生成（各中心ごと）
    _generateHighlands(centers, centerLandCellsPre, preLandMask, lakeMask, colors, highlandColor, seededRng, seededLog) {
      // 実装は `src/utils/terrain/highlands.js` に分離（機能不変）
      // ctx を作って依存を明示（挙動不変）
      const ctx = this._buildHighlandsCtx();
      const highlandMask = generateHighlands(ctx, centers, centerLandCellsPre, preLandMask, lakeMask, seededRng, seededLog);
      if (highlandMask) {
        for (let i = 0; i < highlandMask.length; i++) {
          if (highlandMask[i]) colors[i] = highlandColor;
        }
      }
      return highlandMask;
    },
    // 高山生成（高地に隣接しない高地セル）
    _generateAlpines(colors, highlandColor, lowlandColor, desertColor, alpineColor, directions) {
      // 実装は `src/utils/terrain/alpines.js` に分離（機能不変）
      return generateAlpines(this._buildAlpinesCtx(), colors, highlandColor, lowlandColor, desertColor, alpineColor, directions);
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
      if (!preserveCenterCoordinates) {
        this.superPloom_calc = 0;
        this.superPloom_history = [];
        this.driftTurn = 0;
        this.driftIsApproach = true; // start with Approach phase
        // clear high-frequency caches so Generate starts from fresh state
        bestEffort(() => { this.hfCache = null; });
        // reset glacier smoothing/internal state to avoid carrying previous generate's cache
        bestEffort(() => { this._glacierRowsState = null; });
        bestEffort(() => { this.internalTopGlacierRows = null; });
        bestEffort(() => { this.lastReturnedGlacierRows = null; });
      }
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
        centers = sampleLandCenters({
          gridWidth: this.gridWidth,
          gridHeight: this.gridHeight,
          centersY: this.centersY,
          minCenterDistance: this.minCenterDistance,
          torusDistance: (x1, y1, x2, y2) => this.torusDistance(x1, y1, x2, y2)
        }, seedStrictCenters ? seededRng : null, effectiveMinCenterDistance);
        // ノイズから中心パラメータを生成（propsは直接変更しない）
        localCenterParameters = centers.map((c) => {
          if (seededRng) {
            const u1 = seededRng() * 2 - 1; // [-1,1)
            return {
              x: c.x,
              y: c.y,
              // さらにばらつきを縮小（影響は狭いレンジ、減衰は強め）
              influenceMultiplier: 0.9 + u1 * 0.05, // [0.85, 0.95]
              kDecayVariation: this.kDecay * (1.3 + u1 * 0.1) // [1.2, 1.4] × kDecay
            };
          } else {
            const n1 = this.noise2D(c.x * 0.1, c.y * 0.1);
            return {
              x: c.x,
              y: c.y,
              // さらにばらつきを縮小（影響は狭いレンジ、減衰は強め）
              influenceMultiplier: 0.9 + n1 * 0.05,
              kDecayVariation: this.kDecay * (1.3 + n1 * 0.1)
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
        const res = computeScoresForCenters({
          gridWidth: this.gridWidth,
          gridHeight: this.gridHeight,
          kDecay: this.kDecay,
          centerBias: this.centerBias,
          fractalNoise2D: (x, y, octaves, persistence) => this.fractalNoise2D(x, y, octaves, persistence),
          noise2D: (x, y) => this.noise2D(x, y),
          noiseAmp: this.noiseAmp,
          torusDistance: (x1, y1, x2, y2) => this.torusDistance(x1, y1, x2, y2),
          torusDirection: (x1, y1, x2, y2) => this.torusDirection(x1, y1, x2, y2),
          derivedRng: (...labels) => this._getDerivedRng(...labels)
        }, nextCenters, localCenterParameters);
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
            nextCenters = sampleLandCenters({
              gridWidth: this.gridWidth,
              gridHeight: this.gridHeight,
              centersY: this.centersY,
              minCenterDistance: this.minCenterDistance,
              torusDistance: (x1, y1, x2, y2) => this.torusDistance(x1, y1, x2, y2)
            }, seedStrictCenters ? seededRng : null, effectiveMinCenterDistance);
          }
        }
      }
      const landMask = new Array(N).fill(false);
      for (let i = 0; i < N; i++) landMask[i] = scores[i] >= threshold;
      return { centers: nextCenters, scores, threshold, landMask };
    },
    _buildWorld({
      emitEvent,
      runContext = null,
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
      const stage0 = () => {
        // Stage 0: shared precomputations
        const noiseGrid = buildVisualNoiseGrid({
          gridWidth: this.gridWidth,
          gridHeight: this.gridHeight,
          era: this.era,
          derivedRng: (...args) => this._getDerivedRng(...args)
        }, { N, seededRng });
        const ownerCenterIdx = computeOwnerCenterIdx({
          gridWidth: this.gridWidth,
          gridHeight: this.gridHeight,
          torusDistance: (x1, y1, x2, y2) => this.torusDistance(x1, y1, x2, y2)
        }, centers);
        return { noiseGrid, ownerCenterIdx };
      };
      const stage1 = () => {
        // Stage 1: land mask refinement (dilate/island/jitter)
        const dilated = dilateLandMask(this, {
          landMask,
          scores,
          threshold,
          expansionBias: 0.12,
          maxIterations: 10
        });
        const noIslands = removeSingleCellIslands(this, {
          landMask: dilated,
          seededRng,
          singleCellRemovalProb: this.singleCellRemovalProb
        });
        const preJitterLandMask = noIslands.slice();
        const jittered = jitterCoastline(this, {
          landMask: noIslands,
          scores,
          threshold,
          seededRng
        });
        return { landMask: jittered, preJitterLandMask };
      };
      const stage2 = ({ noiseGrid, landMask }) => {
        // Stage 2: distance maps + base classification
        const seaNoiseAmplitude = 1.5;
        const landNoiseAmplitude = 2.5;
        const {
          deepSeaColor, shallowSeaColor, lowlandColor, desertColor,
          highlandColor, alpineColor, tundraColor, glacierColor
        } = this._getBaseColors();
        const directions = getDirections8();
        const distanceToLand = computeDistanceMap({
          sourceMask: landMask,
          sourceValue: true,
          N,
          directions,
          gridWidth: this.gridWidth,
          torusWrap: (x, y) => this.torusWrap(x, y)
        });

        const distanceToSea = computeDistanceMap({
          sourceMask: landMask,
          sourceValue: false,
          N,
          directions,
          gridWidth: this.gridWidth,
          torusWrap: (x, y) => this.torusWrap(x, y)
        });

        const colors = classifyBaseColors({
          gridWidth: this.gridWidth,
          gridHeight: this.gridHeight,
          baseSeaDistanceThreshold: this.baseSeaDistanceThreshold,
          getLandDistanceThresholdForRow: (gy, gx) => this._getLandDistanceThresholdForRow(gy, gx)
        }, {
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

        return {
          seaNoiseAmplitude,
          landNoiseAmplitude,
          deepSeaColor,
          shallowSeaColor,
          lowlandColor,
          desertColor,
          highlandColor,
          alpineColor,
          tundraColor,
          glacierColor,
          distanceToSea,
          distanceToLand,
          colors
        };
      };

      const { noiseGrid, ownerCenterIdx } = stage0();
      const { landMask: refinedLandMask, preJitterLandMask } = stage1();
      const {
        seaNoiseAmplitude,
        landNoiseAmplitude,
        deepSeaColor,
        shallowSeaColor,
        lowlandColor,
        desertColor,
        highlandColor,
        alpineColor,
        tundraColor,
        glacierColor,
        distanceToSea,
        distanceToLand,
        colors
      } = stage2({ noiseGrid, landMask: refinedLandMask });

      // 各中心の陸セル一覧を前計算（湖/高地で再利用）
      const { centerLandCells, centerLandCellsPre } = buildCenterLandCells(this._buildCenterCellsCtx(), {
        centers,
        ownerCenterIdx,
        landMask: refinedLandMask,
        preLandMask: preJitterLandMask
      });
      // 湖生成と適用（ジッター後のマスクに基づく）
      const { lakeMask, lakesList } = this._generateLakes(
        centers,
        centerLandCells,
        refinedLandMask,
        seededRng,
        seededLog
      );
      applyLakeColors(colors, lakeMask, shallowSeaColor);
      bestEffort(() => {
        applyLowlandAroundLakes(this._buildLakeLowlandCtx(), {
          colors,
          lakesList,
          lakeMask,
          baseLandThr: this.baseLandDistanceThreshold,
          desertColor,
          lowlandColor
        });
      });

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
      this._generateAlpines(colors, highlandColor, lowlandColor, desertColor, alpineColor, getDirections8());

      // Revise用に「ツンドラ/氷河適用前」の色を保存（湖/高地/高山の結果は保持）
      const preTundraColors = colors.slice();

      // --- 先に氷河row（基準）を計算 ---
      const preGlacierStats = computePreGlacierStats({ N, landMask: refinedLandMask, lakeMask });
      const ratioOcean = preGlacierStats.seaCount / (preGlacierStats.total || 1);
      // 海率の影響は「陸の氷河形成」にのみ適用し、海/湖は標準（0.7相当）で固定する
      // 要件: generate 時は「平滑化なし（放射平衡温度由来）」の topGlacierRows を使いたい。
      // ここでは store の気候モデルが出す averageTemperature_calc (K) があればそれを優先して使い、
      // 一時的に this.averageTemperature と this.glacier_alpha を上書きして computeTopGlacierRowsFromAverageTemperature を呼び、
      // 平滑化を実質無効（glacier_alpha=1）にして即値を取得します。
      let glacierRows;
      try {
        const climateRawC = this._getClimateAverageTemperatureCelsius();
        glacierRows = this._computeGlacierRowsForRatio({ ratioOcean, climateRawC });
      } catch (e) {
        glacierRows = this._computeGlacierRowsForRatio({ ratioOcean, climateRawC: null });
      }
      const {
        computedTopGlacierRowsLand,
        computedTopGlacierRowsWater,
        computedSmoothedTopGlacierRowsLand,
        computedSmoothedTopGlacierRowsWater
      } = glacierRows;

      // --- ツンドラの適用（上端・下端） ---
      const tundraExtraRows = Number.isFinite(Number(this.tundraExtraRows))
        ? Math.max(0, Number(this.tundraExtraRows))
        : Math.max(0, (this.topTundraRows || 0) - (this.topGlacierRows || 0));
      const computedTopTundraRows = Math.max(0, computedTopGlacierRowsWater + tundraExtraRows);
      applyTundra({
        gridWidth: this.gridWidth,
        gridHeight: this.gridHeight,
        era: this.era,
        derivedRng: (...args) => this._getDerivedRng(...args),
        topTundraRows: this.topTundraRows
      }, {
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
      applyGlaciers({
        gridWidth: this.gridWidth,
        gridHeight: this.gridHeight,
        landGlacierExtraRows: this.landGlacierExtraRows,
        highlandGlacierExtraRows: this.highlandGlacierExtraRows,
        alpineGlacierExtraRows: this.alpineGlacierExtraRows
      }, {
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
        landMask: refinedLandMask,
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
      } = generateFeatures(this._buildFeaturesCtx(), {
        N,
        landMask: refinedLandMask,
        colors,
        lowlandColor,
        shallowSeaColor,
        seededRng,
        derivedRng: (...labels) => this._getDerivedRngForFeatures(...labels)
      });

      // 各グリッドのプロパティ構造を作成
      const gridData = buildGridData({
        gridWidth: this.gridWidth,
        gridHeight: this.gridHeight
      }, {
        N,
        colors,
        landMask: refinedLandMask,
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
      markCentersOnGridData({
        gridWidth: this.gridWidth,
        gridHeight: this.gridHeight,
        showCentersRed: this.showCentersRed
      }, { gridData, centers });

      // 高頻度更新に必要なデータをキャッシュ
      const hfCache = {
        N,
        centers,
        landMask: refinedLandMask,
        lakeMask,
        lakesList: lakesList || [],
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

      const ensured = this._ensureRunContext({
        runContext,
        defaultRunMode: (emitEvent === 'drifted') ? 'drift' : null
      });
      const payload = buildGeneratedPayload({
        eventType: emitEvent,
        runMode: ensured.runMode,
        runId: ensured.runId,
        centerParameters: localCenterParameters,
        gridData,
        deterministicSeed: this.deterministicSeed,
        preGlacierStats,
        computedTopGlacierRows,
        ...(driftMetrics ? { driftMetrics } : null)
      });
      return { payload, hfCache };
    },
    _emitTerrainPayload(payload) {
      if (!payload) return;
      const type = (payload.eventType === 'generated' || payload.eventType === 'revised' || payload.eventType === 'drifted')
        ? payload.eventType
        : 'generated';
      this.$emit(type, payload);
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
        return {
          x: c.x,
          y: c.y,
          influenceMultiplier: 0.9 + u1 * 0.05,
          kDecayVariation: this.kDecay * (1.3 + u1 * 0.1)
        };
      });
    },
    _computeScoresThresholdAndLandMaskForDrift({ N, centers, localCenterParameters }) {
      // スコアと閾値計算（中心点は固定）。中心点が陸にならないケースでも resample はしない。
      const res = computeScoresForCenters({
        gridWidth: this.gridWidth,
        gridHeight: this.gridHeight,
        kDecay: this.kDecay,
        centerBias: this.centerBias,
        fractalNoise2D: (x, y, octaves, persistence) => this.fractalNoise2D(x, y, octaves, persistence),
        noise2D: (x, y) => this.noise2D(x, y),
        noiseAmp: this.noiseAmp,
        torusDistance: (x1, y1, x2, y2) => this.torusDistance(x1, y1, x2, y2),
        torusDirection: (x1, y1, x2, y2) => this.torusDirection(x1, y1, x2, y2),
        derivedRng: (...labels) => this._getDerivedRng(...labels)
      }, centers, localCenterParameters);
      const scores = res.scores;
      const sorted = scores.slice().sort((a, b) => a - b);
      const effectiveSeaLandRatio = Math.min(0.999, Math.max(0.0, mapSeaLandRatio(this.seaLandRatio)));
      const k = Math.floor((1 - effectiveSeaLandRatio) * N);
      const threshold = sorted[Math.max(0, Math.min(sorted.length - 1, k))];
      const landMask = new Array(N).fill(false);
      for (let i = 0; i < N; i++) landMask[i] = scores[i] >= threshold;
      return { scores, threshold, landMask };
    },
    /**
     * Full generation. Called by runSignal watcher (mode: generate/update) and emits `generated`.
     * @param {{preserveCenterCoordinates?: boolean}} [options]
     * @returns {TerrainEventPayload} emitted payload
     */
    async runGenerate({ preserveCenterCoordinates = false, runContext = null } = {}) {
      const runMode = preserveCenterCoordinates ? 'update' : 'generate';
      const worker = this.useTerrainWorker ? this._getTerrainWorker() : null;
      if (!worker && this.useTerrainWorker) {
        this.$emit('run-worker-error', { error: new Error('Worker unavailable') });
        return null;
      }
      if (worker) {
        try {
          const outputs = await this._postTerrainWorkerJob({ runMode, runContext });
          if (outputs) {
            this._applyWorkerOutputs(outputs);
            const payload = outputs.payload || null;
            this._emitTerrainPayload(payload);
            return payload;
          }
        } catch (e) {
          this.terrainWorkerFailed = true;
          this.$emit('run-worker-error', { error: e || new Error('Worker error') });
          this._terminateTerrainWorker();
          return null;
        }
      }
      if (!this.useTerrainWorker) {
        const result = runGenerateTerrain(this, {
          preserveCenterCoordinates,
          runContext,
          deps: this._buildRunnerDeps()
        });
        if (result && result.state) Object.assign(this, result.state);
        const payload = result && result.payload ? result.payload : result;
        this._emitTerrainPayload(payload);
        return payload;
      }
      return null;
    },
    // Drift:大陸移動アルゴリズム
    /**
     * One drift turn. Called by runSignal watcher (mode: drift) and emits `drifted`.
     * @returns {TerrainEventPayload} emitted payload
     */
    async runDrift({ runContext = null } = {}) {
      const worker = this.useTerrainWorker ? this._getTerrainWorker() : null;
      if (!worker && this.useTerrainWorker) {
        this.$emit('run-worker-error', { error: new Error('Worker unavailable') });
        return null;
      }
      if (worker) {
        try {
          const outputs = await this._postTerrainWorkerJob({ runMode: 'drift', runContext });
          if (outputs) {
            this._applyWorkerOutputs(outputs);
            const payload = outputs.payload || null;
            this._emitTerrainPayload(payload);
            return payload;
          }
        } catch (e) {
          this.terrainWorkerFailed = true;
          this.$emit('run-worker-error', { error: e || new Error('Worker error') });
          this._terminateTerrainWorker();
          return null;
        }
      }
      if (!this.useTerrainWorker) {
        const result = runDriftTerrain(this, {
          runContext,
          deps: this._buildRunnerDeps()
        });
        if (result && result.state) Object.assign(this, result.state);
        const payload = result && result.payload ? result.payload : result;
        this._emitTerrainPayload(payload);
        return payload;
      }
      return null;
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
      bestEffort(() => {
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
      });
    },
    _computeGlacierRowsForRatio({ ratioOcean, climateRawC }) {
      if (Number.isFinite(climateRawC)) {
        const computedTopGlacierRowsLand = computeTopGlacierRowsPure(climateRawC, ratioOcean, 'land');
        const computedTopGlacierRowsWater = computeTopGlacierRowsPure(climateRawC, 0.7, 'water');
        return {
          computedTopGlacierRowsLand,
          computedTopGlacierRowsWater,
          computedSmoothedTopGlacierRowsLand: computedTopGlacierRowsLand,
          computedSmoothedTopGlacierRowsWater: computedTopGlacierRowsWater
        };
      }
      return {
        computedTopGlacierRowsLand: computeTopGlacierRowsFromAverageTemperature({
          averageTemperature: this.averageTemperature,
          glacierAlpha: this.glacier_alpha,
          seaLandRatio: this.seaLandRatio,
          state: this._getGlacierRowsStateAccessors('land')
        }, ratioOcean, 'land'),
        computedTopGlacierRowsWater: computeTopGlacierRowsFromAverageTemperature({
          averageTemperature: this.averageTemperature,
          glacierAlpha: this.glacier_alpha,
          seaLandRatio: this.seaLandRatio,
          state: this._getGlacierRowsStateAccessors('water')
        }, 0.7, 'water'),
        computedSmoothedTopGlacierRowsLand: getSmoothedGlacierRows({
          state: this._getGlacierRowsStateAccessors('land')
        }, ratioOcean, 'land'),
        computedSmoothedTopGlacierRowsWater: getSmoothedGlacierRows({
          state: this._getGlacierRowsStateAccessors('water')
        }, 0.7, 'water')
      };
    },
    _reviseComputeGlacierRows({ c }) {
      const ratioOcean = (c.preGlacierStats && c.preGlacierStats.total)
        ? (c.preGlacierStats.seaCount / (c.preGlacierStats.total || 1))
        : 0.7;
      // Prefer climate raw radiative temperature (averageTemperature_calc) when available to avoid using smoothed store averageTemperature.
      const climateVars = getClimateVars(this.$store);
      const climateRawC = (climateVars && typeof climateVars.averageTemperature_calc === 'number')
        ? (climateVars.averageTemperature_calc - 273.15)
        : null;
      return this._computeGlacierRowsForRatio({ ratioOcean, climateRawC });
    },
    _reviseApplyTundra({ c, colors, computedTopGlacierRowsWater }) {
      const tundraExtraRows = Number.isFinite(Number(this.tundraExtraRows))
        ? Math.max(0, Number(this.tundraExtraRows))
        : Math.max(0, (this.topTundraRows || 0) - (this.topGlacierRows || 0));
      const computedTopTundraRows = Math.max(0, computedTopGlacierRowsWater + tundraExtraRows);
      applyTundra({
        gridWidth: this.gridWidth,
        gridHeight: this.gridHeight,
        era: this.era,
        derivedRng: (...args) => this._getDerivedRng(...args),
        topTundraRows: this.topTundraRows
      }, {
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
      applyGlaciers({
        gridWidth: this.gridWidth,
        gridHeight: this.gridHeight,
        landGlacierExtraRows: this.landGlacierExtraRows,
        highlandGlacierExtraRows: this.highlandGlacierExtraRows,
        alpineGlacierExtraRows: this.alpineGlacierExtraRows
      }, {
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
      const gridData = buildGridData({
        gridWidth: this.gridWidth,
        gridHeight: this.gridHeight
      }, {
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
      markCentersOnGridData({
        gridWidth: this.gridWidth,
        gridHeight: this.gridHeight,
        showCentersRed: this.showCentersRed
      }, { gridData, centers: c.centers });

      // --- 苔類進出（軽量版） ---
      // Generate の「苔クラスター生成」は重いので、Revise では
      // 「non-lowland → lowland に戻ったセル」だけ苔を再サンプルする。
      // これにより、氷河→低地復活などの後でも苔率が毎ターンの気候計算へ反映され続ける。
      const isBryophyteEra = (this.era === '苔類進出時代');
      const isLandCultivationEra = (this.era === '文明時代' || this.era === '海棲文明時代');
      const isLandCityEra = (this.era === '文明時代');
      const isSeaCultivationEra = (this.era === '文明時代' || this.era === '海棲文明時代');
      const isSeaCityEra = (this.era === '海棲文明時代');
      const baseBryo = Math.max(0, Number(this.bryophyteGenerationProbability || 0));
      const baseCult = Math.max(0, Number(this.cultivatedGenerationProbability || 0));
      const baseCity = Math.max(0, Number(this.cityGenerationProbability || 0));
      const countPollutedAreas = Math.max(0, Math.floor(Number(this.pollutedAreasCount || 0)));
      const baseSeaCult = Math.max(0, Number(this.seaCultivatedGenerationProbability || 0));
      const baseSeaCity = Math.max(0, Number(this.seaCityGenerationProbability || 0));
      const countSeaPollutedAreas = Math.max(0, Math.floor(Number(this.seaPollutedAreasCount || 0)));
      
      const isAdjacentToSea = (gx, gy) => {
        for (let di = 0; di < DIRS_8.length; di++) {
          const d = DIRS_8[di];
          const w = this.torusWrap(gx + d[0], gy + d[1]);
          if (!w) continue;
          const nIdx = w.y * this.gridWidth + w.x;
          if (!c.landMask[nIdx]) return true;
        }
        return false;
      };
      const isAdjacentToLand = (gx, gy) => {
        for (let di = 0; di < DIRS_8.length; di++) {
          const d = DIRS_8[di];
          const w = this.torusWrap(gx + d[0], gy + d[1]);
          if (!w) continue;
          const nIdx = w.y * this.gridWidth + w.x;
          if (c.landMask[nIdx]) return true;
        }
        return false;
      };

      // 汚染は本来「クラスター生成（重い）」だが、Reviseでは軽量に扱う。
      // 目標セル数 ≒ countAreas * 20（generateFeatures の targetMean=20 に合わせる）
      // ただし、Revise では「戻ったセルだけ」なので、概算確率で十分。
      let lowlandCount = 0;
      let shallowCount = 0;
      for (let i = 0; i < N; i++) {
        const cell = gridData[i];
        if (!cell || !cell.terrain) continue;
        if (cell.terrain.type === 'land') {
          if (cell.terrain.land === 'lowland') lowlandCount++;
        } else {
          if (cell.terrain.sea === 'shallow') shallowCount++;
        }
      }
      const pPollutedApprox = Math.min(1, (countPollutedAreas > 0) ? ((countPollutedAreas * 20) / Math.max(1, lowlandCount)) : 0);
      const pSeaPollutedApprox = Math.min(1, (countSeaPollutedAreas > 0) ? ((countSeaPollutedAreas * 20) / Math.max(1, shallowCount)) : 0);
      // city bias 設定（generateFeatures と同等の定数）
      const cityBiasScale = 0.01;
      const cityBiasMin = 0.05;
      const cityBiasMax = 8.0;

      // 不整合なら削除（地形に合わないフラグを落とす）
      for (let i = 0; i < N; i++) {
        const cell = gridData[i];
        if (!cell || !cell.terrain) continue;
        if (cell.terrain.type === 'land') {
          const land = cell.terrain.land;
          const isLowland = (land === 'lowland');
          if (!isLowland) {
            // 変更: 都市/耕作/汚染/海棲系をツンドラ上でも維持する仕様に合わせる。
            // non-lowland のうち、以下の landTypes の場合のみ完全削除する:
            // glacier, desert, highland, alpine
            const landType = land;
            const fullyIneligible = (landType === 'glacier' || landType === 'desert' || landType === 'highland' || landType === 'alpine');
            if (fullyIneligible) {
              // これらは明確に文明要素が維持できないと判断してフラグを消す
              cell.city = false;
              cell.cultivated = false;
              cell.polluted = false;
              cell.bryophyte = false;
            } else {
              // それ以外（例: tundra）は苔/都市/耕作/汚染を維持する
            }
          }
          // non-lowland → lowland に戻った場合のみ、苔を軽量に再サンプル
          else if (isBryophyteEra) {
            const prev = base[i];
            const prevIsLowland = !!(prev && prev.terrain && prev.terrain.type === 'land' && prev.terrain.land === 'lowland');
            if (!prevIsLowland && !cell.bryophyte && !cell.city && !cell.cultivated && !cell.polluted) {
              const gx = i % this.gridWidth;
              const gy = Math.floor(i / this.gridWidth);
              const adjSea = isAdjacentToSea(gx, gy);
              const p = Math.min(1, adjSea ? (baseBryo * 100) : baseBryo);
              if (p > 0) {
                const rng = createDerivedRng(this.deterministicSeed, 'bryophyte-revise', `i${i}`) || Math.random;
                if (rng() < p) cell.bryophyte = true;
              }
            }
          }
          // non-lowland → lowland に戻った場合のみ、文明要素を軽量に再サンプル
          else if (isLandCultivationEra || isLandCityEra) {
            const prev = base[i];
            const prevIsLowland = !!(prev && prev.terrain && prev.terrain.type === 'land' && prev.terrain.land === 'lowland');
            if (!prevIsLowland) {
              const gx = i % this.gridWidth;
              const gy = Math.floor(i / this.gridWidth);
              const adjSea = isAdjacentToSea(gx, gy);
              if (isLandCultivationEra) {
                // cultivated（先に）
                if (!cell.cultivated) {
                  const pCult = Math.min(1, adjSea ? (baseCult * 5) : baseCult);
                  if (pCult > 0) {
                    const rng = createDerivedRng(this.deterministicSeed, 'cultivated-revise', `i${i}`) || Math.random;
                    if (rng() < pCult) cell.cultivated = true;
                  }
                }
              }
              if (isLandCityEra) {
                // city（後で）
                if (!cell.city) {
                  const pcCity = getBiasedCityProbability({
                    fractalNoise2D: (x, y, o, p, s) => this.fractalNoise2D(x, y, o, p, s),
                    gx,
                    gy,
                    baseProbability: baseCity,
                    isAdjacentFn: isAdjacentToSea,
                    biasScale: cityBiasScale,
                    biasMin: cityBiasMin,
                    biasMax: cityBiasMax,
                    adjacencyMultiplier: 5
                  });
                  if (pcCity > 0) {
                    const rng = createDerivedRng(this.deterministicSeed, 'city-revise', `i${i}`) || Math.random;
                    if (rng() < pcCity) cell.city = true;
                  }
                }
              }
              // polluted（概算、低地/都市/農地上）
              if (isLandCityEra && countPollutedAreas > 0 && !cell.polluted) {
                // 生成側は「海岸セル重み10」だが、Reviseは戻りセルだけなので簡易に海岸優遇のみ残す
                const w = adjSea ? 10 : 1;
                const p = Math.min(1, pPollutedApprox * w);
                if (p > 0) {
                  const rng = createDerivedRng(this.deterministicSeed, 'polluted-revise', `i${i}`) || Math.random;
                  if (rng() < p) cell.polluted = true;
                }
              }
            }
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
          // non-shallow → shallow に戻った場合のみ、海棲文明要素を軽量に再サンプル
          else if (isSeaCultivationEra || isSeaCityEra) {
            const prev = base[i];
            const prevIsShallow = !!(prev && prev.terrain && prev.terrain.type === 'sea' && prev.terrain.sea === 'shallow');
            if (!prevIsShallow) {
              const gx = i % this.gridWidth;
              const gy = Math.floor(i / this.gridWidth);
              const adjLand = isAdjacentToLand(gx, gy);
              if (isSeaCultivationEra) {
                // seaCultivated（先に）
                if (!cell.seaCultivated) {
                  const pSeaCult = Math.min(1, adjLand ? (baseSeaCult * 5) : baseSeaCult);
                  if (pSeaCult > 0) {
                    const rng = createDerivedRng(this.deterministicSeed, 'sea-cultivated-revise', `i${i}`) || Math.random;
                    if (rng() < pSeaCult) cell.seaCultivated = true;
                  }
                }
              }
              if (isSeaCityEra) {
                // seaCity（後で）
                if (!cell.seaCity) {
                  const pcSeaCity = getBiasedCityProbability({
                    fractalNoise2D: (x, y, o, p, s) => this.fractalNoise2D(x, y, o, p, s),
                    gx,
                    gy,
                    baseProbability: baseSeaCity,
                    isAdjacentFn: isAdjacentToLand,
                    biasScale: cityBiasScale,
                    biasMin: cityBiasMin,
                    biasMax: cityBiasMax,
                    adjacencyMultiplier: 5
                  });
                  if (pcSeaCity > 0) {
                    const rng = createDerivedRng(this.deterministicSeed, 'sea-city-revise', `i${i}`) || Math.random;
                    if (rng() < pcSeaCity) cell.seaCity = true;
                  }
                }
              }
              // seaPolluted（概算、浅瀬/海棲都市/海棲農地上）
              if (isSeaCityEra && countSeaPollutedAreas > 0 && !cell.seaPolluted) {
                const w = adjLand ? 10 : 1;
                const p = Math.min(1, pSeaPollutedApprox * w);
                if (p > 0) {
                  const rng = createDerivedRng(this.deterministicSeed, 'sea-polluted-revise', `i${i}`) || Math.random;
                  if (rng() < p) cell.seaPolluted = true;
                }
              }
            }
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
    /**
     * High-frequency revise (no full regen). Used both by runSignal watcher (mode: revise) and turn-loop logic.
     * @param {{emit?: boolean}} [options] - emit `revised` if true
     * @returns {TerrainEventPayload|undefined} payload when cache is available; otherwise undefined
     */
    async runReviseHighFrequency({ emit = true, runContext = null } = {}) {
      const worker = this.useTerrainWorker ? this._getTerrainWorker() : null;
      if (!worker && this.useTerrainWorker) {
        this.$emit('run-worker-error', { error: new Error('Worker unavailable') });
        return null;
      }
      if (worker) {
        try {
          const outputs = await this._postTerrainWorkerJob({ runMode: 'revise', runContext });
          if (outputs) {
            this._applyWorkerOutputs(outputs);
            const payload = outputs.payload || null;
            if (emit) this._emitTerrainPayload(payload);
            return payload;
          }
        } catch (e) {
          this.terrainWorkerFailed = true;
          this.$emit('run-worker-error', { error: e || new Error('Worker error') });
          this._terminateTerrainWorker();
          return null;
        }
      }
      if (!this.useTerrainWorker) {
        const payload = runReviseHighFrequencyTerrain(this, {
          emit,
          runContext,
          deps: this._buildRunnerDeps()
        });
        if (emit) this._emitTerrainPayload(payload);
        return payload;
      }
      return null;
    }
  }
}
</script>

<style scoped>
</style>


