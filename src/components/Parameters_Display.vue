<template>
  <div class="parameters-display">
    <GeneratorActions
      :disabled="!!(climateTurn && climateTurn.isRunning)"
      @generate="onClickGenerate"
      @update="onClickUpdate"
      @revise="onClickReviseHighFrequency"
      @drift="onClickDrift"
    />

    <TurnPanel
      :climateTurn="climateTurn"
      :turnSpeed="turnSpeed"
      :turnSliderExp="turnSliderExp"
      :selectedTurnYr="selectedTurnYr"
      :turnYrOptions="turnYrOptions"
      @turn-start="onClickTurnStart"
      @turn-stop="onClickTurnStop"
      @open-climate-popup="openClimatePopup"
      @update-turn-slider-exp="turnSliderExp = $event"
      @change-turn-yr="onTurnYrSelect"
    />
    
    <div class="param-row">
      <label>陸の中心点の数 y: </label>
      <input type="number" min="1" max="10" v-model.number="local.centersY" />
    </div>
    <div class="param-row">
      <label>陸の割合 x: </label>
      <input type="number" min="0.01" max="0.99" step="0.1" v-model.number="local.seaLandRatio" />
    </div>
    <div class="param-row">
      <label>中心間の排他距離 (グリッド): </label>
      <input type="number" min="1" max="50" step="1" :value="computedMinCenterDistance" disabled />
      <span class="hint">(自動計算)</span>
    </div>
    <div class="param-row">
      <label>浅瀬・深海間の距離閾値 (グリッド): </label>
      <input type="number" min="1" max="20" step="1" v-model.number="local.baseSeaDistanceThreshold" />
    </div>
    <div class="param-row">
      <label>平均気温 (°C): </label>
      <input type="number" min="-50" max="60" step="2" v-model.number="averageTemperature" />
      <span class="hint">{{ Math.round(averageTemperature) }}</span>
    </div>
    <div class="param-row">
      <label>低地・乾燥地 閾値（帯別）を自動更新: </label>
      <input type="checkbox" v-model="local.landDistanceThresholdAuto" />
      <span class="hint">
        （ON: 平均気温×GIテーブルで帯01〜10を自動更新 / OFF: 帯01〜10を手動上書き）
      </span>
    </div>
    <div class="param-row">
      <label>低地・乾燥地間の距離閾値 (グリッド): </label>
      <input type="number" min="-60" max="60" step="1" :value="landDistanceThresholdAverage" disabled />
      <span class="hint">（帯別平均）</span>
    </div>
    <details class="band-details">
      <summary class="band-summary">低地・乾燥地間の距離閾値（帯別）</summary>
      <div class="band-grid">
        <div class="band-item"><label>帯01 (極): </label><input type="number" min="-60" max="60" step="1" v-model.number="local.landDistanceThreshold1" :disabled="!!local.landDistanceThresholdAuto" /></div>
        <div class="band-item"><label>帯02: </label><input type="number" min="-60" max="60" step="1" v-model.number="local.landDistanceThreshold2" :disabled="!!local.landDistanceThresholdAuto" /></div>
        <div class="band-item"><label>帯03: </label><input type="number" min="-60" max="60" step="1" v-model.number="local.landDistanceThreshold3" :disabled="!!local.landDistanceThresholdAuto" /></div>
        <div class="band-item"><label>帯04: </label><input type="number" min="-60" max="60" step="1" v-model.number="local.landDistanceThreshold4" :disabled="!!local.landDistanceThresholdAuto" /></div>
        <div class="band-item"><label>帯05: </label><input type="number" min="-60" max="60" step="1" v-model.number="local.landDistanceThreshold5" :disabled="!!local.landDistanceThresholdAuto" /></div>
        <div class="band-item"><label>帯06: </label><input type="number" min="-60" max="60" step="1" v-model.number="local.landDistanceThreshold6" :disabled="!!local.landDistanceThresholdAuto" /></div>
        <div class="band-item"><label>帯07: </label><input type="number" min="-60" max="60" step="1" v-model.number="local.landDistanceThreshold7" :disabled="!!local.landDistanceThresholdAuto" /></div>
        <div class="band-item"><label>帯08: </label><input type="number" min="-60" max="60" step="1" v-model.number="local.landDistanceThreshold8" :disabled="!!local.landDistanceThresholdAuto" /></div>
        <div class="band-item"><label>帯09: </label><input type="number" min="-60" max="60" step="1" v-model.number="local.landDistanceThreshold9" :disabled="!!local.landDistanceThresholdAuto" /></div>
        <div class="band-item"><label>帯10 (赤道): </label><input type="number" min="-60" max="60" step="1" v-model.number="local.landDistanceThreshold10" :disabled="!!local.landDistanceThresholdAuto" /></div>
      </div>
      <div class="band-footer">
        <label>帯の縦揺らぎ（行数）: </label>
        <input type="number" min="0" max="50" step="1" v-model.number="local.landBandVerticalWobbleRows" />
        <span class="hint">（0で固定）</span>
      </div>
    </details>
    <div class="param-row">
      <label>シード: </label>
      <input type="text" v-model="local.deterministicSeed" placeholder="任意（空=完全ランダム）" />
    </div>
    <div class="param-row">
      <label>平面地図のグリッド1マスのピクセル数: </label>
      <input type="range" min="1" max="10" step="1" v-model.number="planeGridCellPx" />
      <span class="hint">{{ planeGridCellPx }} px</span>
    </div>
    <div class="param-row">
      <label>時代: </label>
      <select v-model="local.era" @change="onEraChange">
        <option v-for="e in eras" :key="e" :value="e">{{ e }}</option>
      </select>
    </div>
    <div class="param-row">
      <label>上端・下端氷河グリッド数: </label>
      <span>{{ topGlacierRowsDisplayed }}</span>
    </div>
    <div class="param-row">
      <label>陸(低地・乾燥地・ツンドラ)の氷河追加グリッド数: </label>
      <input type="number" min="0" max="50" step="1" v-model.number="local.landGlacierExtraRows" />
    </div>
    <div class="param-row">
      <label>上端・下端ツンドラグリッド追加数: </label>
      <input type="number" min="0" max="50" step="1" v-model.number="local.tundraExtraRows" />
    </div>
    <div class="param-row">
      <label>高地の氷河追加グリッド数: </label>
      <input type="number" min="0" max="50" step="1" v-model.number="local.highlandGlacierExtraRows" />
    </div>
    <div class="param-row">
      <label>高山の氷河追加グリッド数: </label>
      <input type="number" min="0" max="50" step="1" v-model.number="local.alpineGlacierExtraRows" />
    </div>
    <div class="param-row">
      <label>湖の数（平均）: </label>
      <input type="number" min="0" max="10" step="0.5" v-model.number="local.averageLakesPerCenter" />
    </div>
    <div class="param-row">
      <label>高地の数（平均）: </label>
      <span>{{ computedAverageHighlandsPerCenter.toFixed(2) }}</span>
    </div>
    <div class="param-row">
      <label>都市生成確率 (低地, 海隣接で×10): </label>
      <input type="number" min="0" max="1" step="0.001" v-model.number="local.cityProbability" />
    </div>
    <div class="param-row">
      <label>耕作地生成確率 (低地, 海隣接で×10): </label>
      <input type="number" min="0" max="1" step="0.01" v-model.number="local.cultivatedProbability" />
    </div>
    <div class="param-row">
      <label>苔類進出地生成確率 (低地, 海隣接で×100): </label>
      <input type="number" min="0" max="1" step="0.01" v-model.number="local.bryophyteProbability" />
    </div>
    <div class="param-row">
      <label>汚染地クラスター数（マップ全体）: </label>
      <input type="number" min="0" max="1000" step="1" v-model.number="local.pollutedAreasCount" />
    </div>
    <div class="param-row">
      <label>海棲都市生成確率 (浅瀬, 陸隣接で×10): </label>
      <input type="number" min="0" max="1" step="0.001" v-model.number="local.seaCityProbability" />
    </div>
    <div class="param-row">
      <label>海棲耕作地生成確率 (浅瀬, 陸隣接で×10): </label>
      <input type="number" min="0" max="1" step="0.01" v-model.number="local.seaCultivatedProbability" />
    </div>
    <div class="param-row">
      <label>海棲汚染地クラスター数（マップ全体）: </label>
      <input type="number" min="0" max="1000" step="1" v-model.number="local.seaPollutedAreasCount" />
    </div>
    <div class="param-row">
      <label>大陸中心点を赤で表示: </label>
      <input type="checkbox" v-model="local.showCentersRed" />
    </div>
    <div class="param-row">
      <label>中心点近傍バイアス: </label>
      <input type="number" min="0" max="3" step="0.1" v-model.number="local.centerBias" />
      <span class="hint">{{ (local.centerBias || 0).toFixed(2) }}</span>
    </div>
    

    <!-- 非表示の計算コンポーネント（テンプレート内に配置することで使用済みとして認識される） -->
    <Grids_Calculation
      ref="calc"
      :runSignal="runSignal"
      :runQueue="runQueue"
      :gridWidth="gridWidth"
      :gridHeight="gridHeight"
      :seaLandRatio="local.seaLandRatio"
      :centersY="local.centersY"
      :minCenterDistance="computedMinCenterDistance"
      :noiseAmp="0.15"
      :kDecay="3.0"
      :baseSeaDistanceThreshold="local.baseSeaDistanceThreshold"
      :baseLandDistanceThreshold="landDistanceThresholdAverage"
      :tundraExtraRows="local.tundraExtraRows"
      :landDistanceThreshold1="local.landDistanceThreshold1"
      :landDistanceThreshold2="local.landDistanceThreshold2"
      :landDistanceThreshold3="local.landDistanceThreshold3"
      :landDistanceThreshold4="local.landDistanceThreshold4"
      :landDistanceThreshold5="local.landDistanceThreshold5"
      :landDistanceThreshold6="local.landDistanceThreshold6"
      :landDistanceThreshold7="local.landDistanceThreshold7"
      :landDistanceThreshold8="local.landDistanceThreshold8"
      :landDistanceThreshold9="local.landDistanceThreshold9"
      :landDistanceThreshold10="local.landDistanceThreshold10"
      :landBandVerticalWobbleRows="local.landBandVerticalWobbleRows"
      :averageTemperature="averageTemperature"
      :topTundraRows="topTundraRowsComputed"
      :topGlacierRows="local.topGlacierRows"
      :landGlacierExtraRows="local.landGlacierExtraRows"
      :highlandGlacierExtraRows="local.highlandGlacierExtraRows"
      :alpineGlacierExtraRows="local.alpineGlacierExtraRows"
      :averageLakesPerCenter="local.averageLakesPerCenter"
      :averageHighlandsPerCenter="computedAverageHighlandsPerCenter"
      :centerParameters="mutableCenterParams"
        :deterministicSeed="local.deterministicSeed"
      :era="local.era || storeEra"
      :cityGenerationProbability="local.cityProbability"
      :cultivatedGenerationProbability="local.cultivatedProbability"
      :bryophyteGenerationProbability="local.bryophyteProbability"
      :pollutedAreasCount="local.pollutedAreasCount"
      :seaCityGenerationProbability="local.seaCityProbability"
      :seaCultivatedGenerationProbability="local.seaCultivatedProbability"
      :seaPollutedAreasCount="local.seaPollutedAreasCount"
      :showCentersRed="local.showCentersRed"
      :centerBias="local.centerBias"
      @run-consumed="onRunConsumed"
      @run-busy="onRunBusy"
      @run-idle="onRunIdle"
      @generated="onGenerated"
      @revised="onRevised"
      @drifted="onGenerated"
    />

    <!-- 非表示の球表示コンポーネント -->
    <Sphere_Display
      ref="sphere"
    />
  </div>
</template>

<script>
// このコンポーネントは「パラメータ入力／表示」と「計算トリガ」を担当します。
// - 生成ボタンで非表示の計算子を起動し、結果は親(App)とポップアップへ出力します。
// - 入力欄の値は内部state(local)に保持し、必要に応じて親へemitします。
// NOTE: 地形生成トリガ（runQueue/runSignal）の契約は `src/components/README.md` を参照。
import Grids_Calculation from './Grids_Calculation.vue';
import Sphere_Display from './Sphere_Display.vue';
import GeneratorActions from './ui/GeneratorActions.vue';
import TurnPanel from './ui/TurnPanel.vue';
/* CenterParametersEditor and StatsPanel removed from template; keep imports removed */
import { deriveDisplayColorsFromGridData, getEraTerrainColors } from '../utils/colors.js';
import { ERAS, GRID_DEFAULTS, PARAM_DEFAULTS, createLocalParams } from '../utils/paramsDefaults.js';
import { computeGlacierBaseRowsFromTemperature } from '../utils/terrain/glacierAnchors.js';
import { computeLandDistanceThresholdsByGreenIndex } from '../utils/terrain/landDistanceThresholdsByGreenIndex.js';
import { buildParametersStatsFromTerrainPayload, buildParametersStatsWithGridTypeCounts } from '../features/stats/parametersStats.js';
import { buildParametersOutputHtml } from '../features/popup/parametersOutputHtml.js';
import { buildClimateOutputHtml } from '../features/popup/climateOutputHtml.js';
import { buildPlaneHtml as buildPlaneHtmlUtil } from '../features/popup/planeHtml.js';
import { deepClone } from '../utils/clone.js';
import { bestEffort, bestEffortAsync } from '../utils/bestEffort.js';
import { RUN_MODES, RUN_QUEUE_MAX } from '../constants/runQueue.js';
import { recomputeAndPatchRadiativeEquilibrium, updateClimateTerrainFractionsFromStats } from '../features/climate/updateAfterTerrain.js';
import {
  getEra,
  getGeneratorParams,
  getRenderSettings,
  getClimate,
  getClimateTurn,
  getClimateVars,
  getClimateHistory,
  getAverageTemperature,
  getPlaneGridCellPx,
  getGridWidth,
  getGridHeight,
  updateTurnSpeed,
  updateAverageTemperature as storeUpdateAverageTemperature,
  updatePlaneGridCellPx,
  updateGeneratorParams,
  updateRenderSettings,
  updateEra,
  updateGridWidth,
  updateGridHeight,
  updateGridData,
  initClimateFromGenerate,
  setTurnRunning,
  advanceClimateOneTurn,
  patchClimate
} from '../store/api.js';
import {
  syncStoreFromLocal,
  syncLocalFromStoreGeneratorParams,
  syncLocalFromStoreRenderSettings
} from '../features/storeSync/localStoreSync.js';
import { openOrUpdatePlaneSpherePopup, updatePlaneIframeOnly, updatePlaneAndSphereIframes } from '../features/popup/planeSpherePopupController.js';
import { openOrUpdatePopup as openOrUpdateHtmlPopup, openOrReusePopup, writePopupIfOpen } from '../features/popup/htmlPopupController.js';
import {
  TURN_MIN_WAIT_MS,
  TURN_LAG_FALLBACK_WAIT_MS,
  TURN_PLANE_UPDATE_EVERY_TURNS,
  TURN_REGENERATE_EVERY_TURNS,
  DRIFT_INTERVAL_YEARS,
  SPHERE_MAX_NON_RELOAD_UPDATES
} from '../constants/sim.js';

/**
 * Terrain generation event payload (unified shape).
 * Keep in sync with `buildTerrainEventPayload` in `src/utils/terrain/output.js`.
 *
 * @typedef {import('../types/index.js').TerrainEventPayload} TerrainEventPayload
 * @typedef {import('../types/index.js').TerrainRunCommand} TerrainRunCommand
 */

/**
 * Local UI stats shape used by StatsPanel + Parameters Output popup.
 * @typedef {import('../types/index.js').ParametersStats} ParametersStats
 */
export default {
  name: 'Parameters_Display',
  components: { Grids_Calculation, Sphere_Display, GeneratorActions, TurnPanel },
  props: {
    // 陸の中心点の数: 地形生成の起点となる中心点の個数。多いほど複雑な地形になります。
    centersY: { type: Number, required: false, default: PARAM_DEFAULTS.centersY },
    // 陸の割合: 全グリッド中、陸地が占める割合の指標
    seaLandRatio: { type: Number, required: false, default: PARAM_DEFAULTS.seaLandRatio },
    // 中心間の排他距離: 各中心点間の最小距離。近すぎると重複した地形になります。
    minCenterDistance: { type: Number, required: false, default: PARAM_DEFAULTS.minCenterDistance },
    // 浅瀬・深海間の距離閾値: 海グリッドが浅瀬か深海かを判定する距離の基準値。大きいほど浅瀬が広がります。
    baseSeaDistanceThreshold: { type: Number, required: false, default: PARAM_DEFAULTS.baseSeaDistanceThreshold },
    // 低地・乾燥地間の距離閾値: 陸グリッドが低地か乾燥地かを判定する距離の基準値。大きいほど低地が広がります。
    baseLandDistanceThreshold: { type: Number, required: false, default: PARAM_DEFAULTS.baseLandDistanceThreshold },
    // greenIndex (GI): 低地↔乾燥地の帯別距離閾値を自動決定する植生指標（基準: 1.0）
    greenIndex: { type: Number, required: false, default: PARAM_DEFAULTS.greenIndex },
    // 低地↔乾燥地の帯別距離閾値をGIで自動更新するか
    landDistanceThresholdAuto: { type: Boolean, required: false, default: PARAM_DEFAULTS.landDistanceThresholdAuto },
    // 低地・乾燥地間の距離閾値（帯ごと、上端/下端から5グリッド単位、帯1..帯10）
    landDistanceThreshold1: { type: Number, required: false, default: PARAM_DEFAULTS.landDistanceThreshold1 },
    landDistanceThreshold2: { type: Number, required: false, default: PARAM_DEFAULTS.landDistanceThreshold2 },
    landDistanceThreshold3: { type: Number, required: false, default: PARAM_DEFAULTS.landDistanceThreshold3 },
    landDistanceThreshold4: { type: Number, required: false, default: PARAM_DEFAULTS.landDistanceThreshold4 },
    landDistanceThreshold5: { type: Number, required: false, default: PARAM_DEFAULTS.landDistanceThreshold5 },
    landDistanceThreshold6: { type: Number, required: false, default: PARAM_DEFAULTS.landDistanceThreshold6 },
    landDistanceThreshold7: { type: Number, required: false, default: PARAM_DEFAULTS.landDistanceThreshold7 },
    landDistanceThreshold8: { type: Number, required: false, default: PARAM_DEFAULTS.landDistanceThreshold8 },
    landDistanceThreshold9: { type: Number, required: false, default: PARAM_DEFAULTS.landDistanceThreshold9 },
    landDistanceThreshold10: { type: Number, required: false, default: PARAM_DEFAULTS.landDistanceThreshold10 },
    // 帯の縦揺らぎ（行数）: 0で無効
    landBandVerticalWobbleRows: { type: Number, required: false, default: PARAM_DEFAULTS.landBandVerticalWobbleRows },
    // 上端・下端ツンドラグリッド追加数（デフォルト: 5）: 上端・下端氷河グリッド数からの追加グリッド数
    tundraExtraRows: { type: Number, required: false, default: PARAM_DEFAULTS.tundraExtraRows },
    // 上端・下端氷河グリッド数（デフォルト: 5）: 上下端から何グリッド分を氷河に上書きするかの基準値（海/湖は追加なし）。
    topGlacierRows: { type: Number, required: false, default: PARAM_DEFAULTS.topGlacierRows },
    // 陸(低地・乾燥地・ツンドラ)の氷河追加グリッド数（デフォルト: 3）: 陸地タイプに応じて氷河上書き範囲を追加するグリッド数。
    landGlacierExtraRows: { type: Number, required: false, default: PARAM_DEFAULTS.landGlacierExtraRows },
    // 高地の氷河追加グリッド数（デフォルト: 7）: 高地タイプに応じて氷河上書き範囲を追加するグリッド数。
    highlandGlacierExtraRows: { type: Number, required: false, default: PARAM_DEFAULTS.highlandGlacierExtraRows },
    // 高山の氷河追加グリッド数（デフォルト: 12）: 高山タイプに応じて氷河上書き範囲を追加するグリッド数。
    alpineGlacierExtraRows: { type: Number, required: false, default: PARAM_DEFAULTS.alpineGlacierExtraRows },
    // 湖の数（平均）（デフォルト: 1）: 各中心点あたりの平均的な湖の個数。ポアソン分布で決定されます。
    averageLakesPerCenter: { type: Number, required: false, default: PARAM_DEFAULTS.averageLakesPerCenter },
    // 高地の数（平均）（デフォルト: 1）: 各中心点あたりの平均的な高地の個数。ポアソン分布で決定されます。サイズは湖の10倍、形状はメイン方向に沿った帯状で横方向にノイズ性の広がりを持ちます。色は灰色がかった茶色（茶色気味）です。
    averageHighlandsPerCenter: { type: Number, required: false, default: PARAM_DEFAULTS.averageHighlandsPerCenter },
    // 中心点のパラメータ配列（デフォルト: 空配列）: 各中心点の影響係数、減衰率、方向角度などの詳細パラメータ。
    centerParameters: { type: Array, required: false, default: () => [] },
    // 雲量（0..1）: 被覆度優先で効く
    f_cloud: { type: Number, required: false, default: PARAM_DEFAULTS.f_cloud },
    // 都市生成確率（低地、海隣接で10倍）
    cityProbability: { type: Number, required: false, default: PARAM_DEFAULTS.cityProbability },
    // 耕作地生成確率（低地、海隣接で10倍）
    cultivatedProbability: { type: Number, required: false, default: PARAM_DEFAULTS.cultivatedProbability },
    // 苔類進出地生成確率（低地、海隣接で100倍）
    bryophyteProbability: { type: Number, required: false, default: PARAM_DEFAULTS.bryophyteProbability },
    // 汚染地クラスター数（マップ全体、シードで開始セルを決定）
    pollutedAreasCount: { type: Number, required: false, default: PARAM_DEFAULTS.pollutedAreasCount },
    // 海棲都市生成確率（浅瀬、陸隣接で10倍）
    seaCityProbability: { type: Number, required: false, default: PARAM_DEFAULTS.seaCityProbability },
    // 海棲耕作地生成確率（浅瀬、陸隣接で10倍）
    seaCultivatedProbability: { type: Number, required: false, default: PARAM_DEFAULTS.seaCultivatedProbability },
    // 海棲汚染地クラスター数（マップ全体、シードで開始セルを決定）
    seaPollutedAreasCount: { type: Number, required: false, default: PARAM_DEFAULTS.seaPollutedAreasCount },
    // 大陸中心点を赤で表示（デフォルト: OFF）
    showCentersRed: { type: Boolean, required: false, default: PARAM_DEFAULTS.showCentersRed },
    // 中心点近傍の陸生成バイアス（0で無効、値を上げると中心付近が陸になりやすい）
    centerBias: { type: Number, required: false, default: PARAM_DEFAULTS.centerBias }
  },
  mounted() {
    // 初期表示時に平均気温から氷河行数を算出（デフォルト 15℃ → 5）
    this.updateAverageTemperature();
    // store の era をローカル初期値に同期（なければ一覧の先頭）
    this.local.era = this.storeEra || '大森林時代';
    // store の generatorParams を local に同期（入力値の永続化＆複数コンポーネント間共有）
    syncLocalFromStoreGeneratorParams(this, this.storeGeneratorParams, { after: () => this.applyGreenIndexToLandDistanceThresholds() });
    // greenIndex と平均気温に応じて「低地・乾燥地間の距離閾値（帯別）」を初期反映
    this.applyGreenIndexToLandDistanceThresholds();
  },
  data() {
    return {
      // ---------------------------
      // Core inputs / UI state
      // ---------------------------
      // グリッド幅・高さ（初期値: 200x100）
      gridWidth: GRID_DEFAULTS.gridWidth,
      gridHeight: GRID_DEFAULTS.gridHeight,
      local: createLocalParams(this),
      // UI で選べる時代一覧（store.era と対応）
      eras: ERAS,
      // 中心点のパラメータはdeepコピーして編集可能にする
      mutableCenterParams: deepClone(this.centerParameters || []),
      // UIで選べる Turn_yr の選択肢
      turnYrOptions: [10, 20, 100, 1000, 2000, 5000, 10000, 50000, 100000],
      // store<->local 同期のループ防止フラグ
      isSyncingLocalFromStore: false,

      // ---------------------------
      // Popup refs (windows)
      // ---------------------------
      popup: {
        planePopupRef: null,
        parametersPopupRef: null,
        climatePopupRef: null
      },

      // ---------------------------
      // Calculation / rendering cache
      // ---------------------------
      cache: {
        // ポップアップ描画用の平面色（+2枠込み）
        planeDisplayColors: [],
        // plane iframe のビルドバージョン（構造変化時はインクリメント）
        planeBuildVersion: 0
      },

      // ---------------------------
      // Run command (child trigger) - unified signal
      // ---------------------------
      run: {
        // single trigger counter
        runSignal: 0,
        // queued commands (FIFO). Each item: TerrainRunCommand
        runQueue: [],
        // child busy/idle (debug/UX)
        isBusy: false
      },

      // ---------------------------
      // Run context (mode/id): used to make emitted payloads self-describing
      // ---------------------------
      runSeq: 0,
      runContext: { runMode: null, runId: null },

      // ---------------------------
      // Turn / timers
      // ---------------------------
      turn: {
        // ターン進行のタイマー（setTimeout）
        turnTimer: null
      },

      // ---------------------------
      // Popup non-reload update counters
      // ---------------------------
      sphere: {
        // sphere の非リロード更新回数管理
        sphereUpdateCount: 0,
        sphereMaxUpdates: SPHERE_MAX_NON_RELOAD_UPDATES
      },

      // ---------------------------
      // Derived stats for UI/output
      // ---------------------------
      stats: null
    };
  },
  computed: {
    // ---------------------------
    // Proxies (data organization; keep existing field names stable)
    // ---------------------------
    // NOTE: Other modules (e.g. popup controllers) expect these vm fields to exist.
    // We store them in nested objects for readability, and expose them here as proxies.
    planeDisplayColors: {
      get() { return this.cache.planeDisplayColors; },
      set(v) { this.cache.planeDisplayColors = v; }
    },
    planeBuildVersion: {
      get() { return this.cache.planeBuildVersion; },
      set(v) { this.cache.planeBuildVersion = v; }
    },
    planePopupRef: {
      get() { return this.popup.planePopupRef; },
      set(v) { this.popup.planePopupRef = v; }
    },
    popupRef: {
      get() { return this.popup.parametersPopupRef; },
      set(v) { this.popup.parametersPopupRef = v; }
    },
    climatePopupRef: {
      get() { return this.popup.climatePopupRef; },
      set(v) { this.popup.climatePopupRef = v; }
    },
    runSignal: {
      get() { return this.run.runSignal; },
      set(v) { this.run.runSignal = v; }
    },
    runQueue: {
      get() { return this.run.runQueue; },
      set(v) { this.run.runQueue = v; }
    },
    turnTimer: {
      get() { return this.turn.turnTimer; },
      set(v) { this.turn.turnTimer = v; }
    },
    sphereUpdateCount: {
      get() { return this.sphere.sphereUpdateCount; },
      set(v) { this.sphere.sphereUpdateCount = v; }
    },
    sphereMaxUpdates: {
      get() { return this.sphere.sphereMaxUpdates; },
      set(v) { this.sphere.sphereMaxUpdates = v; }
    },

    // ---------------------------
    // Store-derived state (Vuex)
    // ---------------------------
    // NOTE: prefer `src/store/api.js` wrappers; keep computed here for template readability.
    storeEra() {
      return getEra(this.$store);
    },
    storeGeneratorParams() {
      return getGeneratorParams(this.$store);
    },
    storeRenderSettings() {
      return getRenderSettings(this.$store);
    },
    climateTurn() {
      return getClimateTurn(this.$store) ?? { Time_turn: 0, Time_yr: 0, Turn_yr: 50000, Turn_speed: 1.0, isRunning: false, era: this.storeEra };
    },
    climateVars() {
      return getClimateVars(this.$store);
    },
    climateHistory() {
      return getClimateHistory(this.$store);
    },
    selectedTurnYr: {
      get() {
        const v = this.climateTurn && typeof this.climateTurn.Turn_yr === 'number' ? Number(this.climateTurn.Turn_yr) : 50000;
        return v;
      },
      set(val) {
        const n = Number(val) || 50000;
        bestEffort(() => patchClimate(this.$store, { Turn_yr: n }));
      }
    },
    turnSpeed: {
      get() {
        return Number(this.climateTurn.Turn_speed || 1.0);
      },
      set(val) {
        let v = Number(val);
        if (!isFinite(v)) v = 1.0;
        v = Math.max(0.1, Math.min(10, Math.round(v * 10) / 10));
        updateTurnSpeed(this.$store, v);
      }
    },
    turnSliderExp: {
      get() {
        const ts = Number(this.climateTurn.Turn_speed || 1.0);
        // avoid NaN
        const safeTs = (ts > 0) ? ts : 1.0;
        // UI slider operates on multiplier 'x' (larger x = faster).
        // multiplier x = 1 / sec_per_turn, so exponent = log10(x) = -log10(sec)
        return Math.log10(1.0 / safeTs);
      },
      set(val) {
        let exp = Number(val);
        if (!isFinite(exp)) exp = 0;
        // map back to seconds-per-turn: sec = 1 / (10^exp) = 10^-exp
        let v = Math.pow(10, -exp);
        v = Math.max(0.1, Math.min(10, v));
        v = Math.round(v * 10) / 10;
        updateTurnSpeed(this.$store, v);
      }
    },
    averageTemperature: {
      get() {
        return getAverageTemperature(this.$store, 15);
      },
      set(val) {
        let num = Number(val);
        if (!isFinite(num)) return;
        // 2℃刻みにスナップし、許容範囲へクランプ
        num = Math.round(num / 2) * 2;
        if (num < -50) num = -50;
        if (num > 60) num = 60;
        if (this.$store) {
          storeUpdateAverageTemperature(this.$store, num);
        }
        this.updateAverageTemperature(num);
      }
    },
    planeGridCellPx: {
      get() {
        return getPlaneGridCellPx(this.$store, 3);
      },
      set(val) {
        let v = Math.round(Number(val));
        if (!isFinite(v)) v = 3;
        if (v < 1) v = 1;
        if (v > 10) v = 10;
        updatePlaneGridCellPx(this.$store, v);
      }
    },

    // ---------------------------
    // Derived (computed from local/UI + store snapshots)
    // ---------------------------
    computedAverageHighlandsPerCenter() {
      const x = (this.local && typeof this.local.seaLandRatio === 'number') ? Number(this.local.seaLandRatio) : 0.3;
      return 2 + 10 * x;
    },
    topTundraRowsComputed() {
      const glacier = (this.local && typeof this.local.topGlacierRows === 'number') ? this.local.topGlacierRows : 0;
      const extra = (this.local && typeof this.local.tundraExtraRows === 'number') ? this.local.tundraExtraRows : 0;
      return Math.max(0, glacier + extra);
    },
    // UI表示用（計算側が生成時に使った実効値を優先）
    topGlacierRowsDisplayed() {
      if (this.stats && typeof this.stats.computedTopGlacierRows === 'number') {
        return Math.round(this.stats.computedTopGlacierRows);
      }
      const v = (this.local && typeof this.local.topGlacierRows === 'number') ? this.local.topGlacierRows : 0;
      return Math.round(v);
    },
    // 低地・乾燥地間の帯別閾値の平均（帯1..帯10 の平均を返す）
    landDistanceThresholdAverage() {
      const keys = [1,2,3,4,5,6,7,8,9,10];
      let sum = 0;
      let cnt = 0;
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const prop = this.local && typeof this.local[`landDistanceThreshold${k}`] !== 'undefined' ? this.local[`landDistanceThreshold${k}`] : null;
        if (prop !== null && typeof prop === 'number' && isFinite(prop)) {
          sum += Number(prop);
          cnt += 1;
        }
      }
      if (cnt === 0) {
        // フォールバック: 明示的なbaseがあればそれを返す、なければ0
        return (this.local && typeof this.local.baseLandDistanceThreshold === 'number') ? this.local.baseLandDistanceThreshold : 0;
      }
      // 小数は四捨五入して整数で表示
      return Math.round(sum / cnt);
    },
    // 陸の割合 x に応じた中心間の排他距離（自動計算）
    computedMinCenterDistance() {
      // 元の実装に合わせる:
      // seaLandRatio を 0.2..1.0 にクランプし、20..40 に線形補間して四捨五入する
      const raw = (this.local && Number.isFinite(this.local.seaLandRatio)) ? Number(this.local.seaLandRatio) : Number(PARAM_DEFAULTS && PARAM_DEFAULTS.seaLandRatio);
      const x = Math.max(0.2, Math.min(1.0, raw));
      const minDistance = 20 + (x - 0.2) * 25; // 20..40
      return Math.round(minDistance);
    }
  },
  watch: {
    // store 側が外部から変更された場合（将来のプリセット/復元など）に local を追従させる
    storeGeneratorParams: {
      deep: true,
      handler() {
        syncLocalFromStoreGeneratorParams(this, this.storeGeneratorParams, { after: () => this.applyGreenIndexToLandDistanceThresholds() });
      }
    },
    storeRenderSettings: {
      deep: true,
      handler() {
        syncLocalFromStoreRenderSettings(this, this.storeRenderSettings);
      }
    },
    // store era の変化（気候の自動遷移等）を local.era UI に反映
    storeEra() {
      if (!this.local) return;
      if (this.local.era !== this.storeEra) {
        this.isSyncingLocalFromStore = true;
        try { this.local.era = this.storeEra; } finally { this.isSyncingLocalFromStore = false; }
      }
    },
    // ターンが進むたびに気候ポップアップを更新（開いている場合）
    'climateTurn.Time_turn'() {
      this.openOrUpdateClimatePopup();
    },
    // 平均気温(=store)の変更に追従して、GIテーブルを再適用
    averageTemperature() {
      if (this.isSyncingLocalFromStore) return;
      this.applyGreenIndexToLandDistanceThresholds();
    },
    // greenIndex is now managed by the climate model; listen to store changes via storeGeneratorParams instead
    // 自動更新のON/OFF切り替え
    'local.landDistanceThresholdAuto'() {
      // ONにした瞬間にテーブル値へ同期（OFF→ONで最新状態に揃える）
      if (this.isSyncingLocalFromStore) return;
      this.applyGreenIndexToLandDistanceThresholds();
    },
    // local の入力変更を store に反映（v-model での変更を自動で拾う）
    local: {
      deep: true,
      handler() {
        if (this.isSyncingLocalFromStore) return;
        syncStoreFromLocal(this, { paramDefaults: PARAM_DEFAULTS });
      }
    }
  },
  methods: {
    // ---------------------------
    // Popup / rendering helpers (side effects)
    // ---------------------------
    _updatePlaneDisplayColorsFromGridData(gridData) {
      try {
        const era = this.local && this.local.era ? this.local.era : this.storeEra;
        const eraColors = getEraTerrainColors(era);
        const displayColors = (gridData && gridData.length === this.gridWidth * this.gridHeight)
          ? deriveDisplayColorsFromGridData(gridData, this.gridWidth, this.gridHeight, undefined, eraColors, /*preferPalette*/ true)
          : [];
        this.planeDisplayColors = Array.isArray(displayColors) ? displayColors : [];
      } catch (e) {
        this.planeDisplayColors = [];
      }
    },

    // ---------------------------
    // Turn UI
    // ---------------------------
    onTurnYrSelect(val) {
      const n = Number(val);
      if (!isFinite(n) || n <= 0) return;
      // computed setter will commit to store
      this.selectedTurnYr = n;
    },
    /**
     * Apply revise result without going through emit (used for strict ordering during Turn ticking).
     * @param {TerrainEventPayload} payload
     * @param {{updatePlane?: boolean}} [options]
     */
    async _applyRevisedPayload(payload, { updatePlane = true } = {}) {
      // Turn中の「順序保証」用: Grids_Calculation の revise 結果を、emit経由ではなく同期的に反映する。
      const gridData = (payload && Array.isArray(payload.gridData)) ? payload.gridData : [];
      if (!this.stats) this.stats = {};
      if (payload && typeof payload.computedTopGlacierRows === 'number') {
        this.stats = { ...(this.stats || {}), computedTopGlacierRows: payload.computedTopGlacierRows };
      }

      // Plane用の表示色は、必要なとき（updatePlane=true）だけ計算して更新
      if (updatePlane) this._updatePlaneDisplayColorsFromGridData(gridData);

      // 統計（グリッド種類カウント）を更新して、Parameters popupにも反映
      this.stats = buildParametersStatsWithGridTypeCounts(this.stats, gridData, { gridWidth: this.gridWidth, gridHeight: this.gridHeight });
      this.openOrUpdatePopup();

      // グリッドデータを store に反映して Sphere などが最新の氷河描写を使えるようにする
      await updateGridData(this.$store, Array.isArray(gridData) ? gridData : []);

      // 気候モデルの地形面積率も更新（これを advanceClimateOneTurn より前に行う）
      {
        const era = this.local && this.local.era ? this.local.era : this.storeEra;
        updateClimateTerrainFractionsFromStats(this.$store, {
          gridTypeCounts: this.stats && this.stats.gridTypeCounts ? this.stats.gridTypeCounts : null,
          preGlacierStats: (this.stats && this.stats.preGlacier) ? this.stats.preGlacier : null,
          gridWidth: this.gridWidth,
          gridHeight: this.gridHeight,
          era
        });
      }

      // Plane iframe 更新は「外に見える部分」なので、必要なときだけ
      if (updatePlane) {
        // Revise（turn中を含む）ではスピナー表示しない
        updatePlaneIframeOnly(this, { showSpinner: false });
      }
    },

    // ---------------------------
    // Local derived params (UI helpers)
    // ---------------------------
    applyGreenIndexToLandDistanceThresholds() {
      // OFFのときは手動上書きを尊重して何もしない
      if (!this.local || !this.local.landDistanceThresholdAuto) return;
      // store -> local 同期中に走ると循環するためガード
      if (this.isSyncingLocalFromStore) return;
      // greenIndex is sourced from the climate model / generator params (store). Prefer climate.vars.greenIndex if available.
      const climateVars = getClimateVars(this.$store);
      const storeGen = this.storeGeneratorParams ?? {};
      const giCandidate = (climateVars && typeof climateVars.greenIndex === 'number') ? climateVars.greenIndex : (typeof storeGen.greenIndex === 'number' ? storeGen.greenIndex : Number(PARAM_DEFAULTS.greenIndex));
      const gi = Number.isFinite(Number(giCandidate)) ? Number(giCandidate) : Number(PARAM_DEFAULTS.greenIndex);
      const next = computeLandDistanceThresholdsByGreenIndex({
        averageTemperature: this.averageTemperature,
        greenIndex: gi
      });
      if (!next || typeof next !== 'object') return;

      // deep watcher の多重発火を避けるため、ローカル更新は一括で行う
      // NOTE: ここから直接 store に dispatch すると store->local 同期と循環して
      //       "Maximum recursive updates exceeded" になりやすいので、store反映は
      //       local deep watcher（_syncStoreFromLocal）に任せる。
      this.isSyncingLocalFromStore = true;
      try {
        for (const k of Object.keys(next)) {
          if (Object.prototype.hasOwnProperty.call(this.local, k)) {
            // 値が変わるときだけ代入（不要なリアクティブ通知を減らす）
            if (this.local[k] !== next[k]) this.local[k] = next[k];
          }
        }
      } finally {
        this.isSyncingLocalFromStore = false;
      }
    },
    onEraChange() {
      updateEra(this.$store, this.local.era);
    },
    // 平均気温から上端・下端氷河グリッド数を線形補間で算出（2℃刻み入力想定）
    updateAverageTemperature(value) {
      const t = (typeof value === 'number') ? value
        : this.averageTemperature;
      const v = computeGlacierBaseRowsFromTemperature(t);
      // 端数は四捨五入。負も許容（海氷河は作成しないよう計算側でガード）
      this.local.topGlacierRows = Math.round(v);
    },

    // ---------------------------
    // Generator actions (buttons)
    // ---------------------------
    _setRunContext(runMode) {
      try {
        this.runSeq = (Number(this.runSeq) || 0) + 1;
        // string id to avoid overflow / collision
        this.runContext = { runMode, runId: `${Date.now()}-${this.runSeq}` };
      } catch (e) {
        // fallback
        this.runContext = { runMode, runId: null };
      }
    },
    _triggerRun(mode, options = null, { allowDuringTurn = false } = {}) {
      // Safety: during turn ticking, block manual/enqueued runs to keep state consistent.
      // (Turn loop uses direct revise call and explicit internal enqueues with allowDuringTurn=true.)
      if (!allowDuringTurn && this.climateTurn && this.climateTurn.isRunning) return;
      this._setRunContext(mode);
      // enqueue (FIFO). child will drain on runSignal change.
      /** @type {TerrainRunCommand} */
      const item = { mode, options: options || null, runContext: this.runContext };

      // Coalesce: reviseは「最新1件だけ」残せば十分（中間reviseを全消化する必要がない）
      if (mode === RUN_MODES.REVISE && Array.isArray(this.runQueue)) {
        let lastReviseIdx = -1;
        for (let i = this.runQueue.length - 1; i >= 0; i--) {
          if (this.runQueue[i] && this.runQueue[i].mode === RUN_MODES.REVISE) { lastReviseIdx = i; break; }
        }
        if (lastReviseIdx >= 0) {
          this.runQueue.splice(lastReviseIdx, 1, item);
          this.runSignal += 1;
          return;
        }
      }

      // Safety: cap queue size to avoid unbounded growth (e.g. repeated triggers during long generate).
      if (Array.isArray(this.runQueue) && this.runQueue.length >= RUN_QUEUE_MAX) {
        // drop oldest to keep latest commands responsive
        const overflow = (this.runQueue.length - RUN_QUEUE_MAX) + 1;
        this.runQueue.splice(0, Math.max(1, overflow));
      }
      this.runQueue.push(item);
      this.runSignal += 1;
    },
    onRunConsumed(n) {
      const k = Number(n) || 0;
      if (k <= 0) return;
      if (!Array.isArray(this.runQueue) || this.runQueue.length === 0) return;
      this.runQueue.splice(0, Math.min(k, this.runQueue.length));
    },
    onRunBusy() {
      this.run.isBusy = true;
    },
    onRunIdle() {
      this.run.isBusy = false;
    },
    _getRunModeFromPayload(payload) {
      // Prefer explicit runMode (new payload shape). Fallback to eventType mapping.
      const pMode = payload && payload.runMode ? payload.runMode : null;
      if (pMode) return pMode;
      const et = payload && payload.eventType ? String(payload.eventType) : '';
      if (et === 'revised') return RUN_MODES.REVISE;
      if (et === 'drifted') return RUN_MODES.DRIFT;
      return RUN_MODES.GENERATE;
    },
    _applyTerrainPayloadToUi({ gridData }) {
      // 1.2) 平面表示色（+2枠）を計算してポップアップ用に保持
      this._updatePlaneDisplayColorsFromGridData(gridData);
      // 1.3) 平面地図専用ポップアップを更新（初回は作成、続きは差分更新）
      openOrUpdatePlaneSpherePopup(this);
      // 非リロードでの差分更新を試みる（Plane + Sphere）
      updatePlaneAndSphereIframes(this);
    },
    _applyTerrainPayloadToStoreAndState({ payload, gridData }) {
      // 2) 親へ伝搬（AppからTerrain_Displayへ受け渡し用）
      // NOTE: The parent event is still named 'generated' for backward compatibility,
      // but the payload itself follows the unified TerrainEventPayload shape (plus width/height).
      this.$emit('generated', { ...(payload || {}), gridWidth: this.gridWidth, gridHeight: this.gridHeight });
      // 2.6) store にもグリッド結果を保存（Terrain_Display / Sphere_Display が store 依存になるため）
      updateGridWidth(this.$store, Number(this.gridWidth) || getGridWidth(this.$store, this.gridWidth));
      updateGridHeight(this.$store, Number(this.gridHeight) || getGridHeight(this.$store, this.gridHeight));
      updateGridData(this.$store, gridData);
      // 3) UI表示用の統計を保存（payload + gridData から一括で組み立て）
      this.stats = buildParametersStatsFromTerrainPayload(this.stats, payload, { gridWidth: this.gridWidth, gridHeight: this.gridHeight });
    },
    _applyTerrainPayloadToClimate({ payload, runMode }) {
      // 4) 気候モデル: generate のときだけ初期化（update/drift では初期化しない）
      bestEffort(() => {
        const era = (this.local && this.local.era) ? this.local.era : this.storeEra;
        const seed = (this.local && typeof this.local.deterministicSeed !== 'undefined') ? this.local.deterministicSeed : '';
        // 初期化は generate 操作のときのみ行う（turn進行中は絶対に初期化しない）
        if (runMode === 'generate' && !this.climateTurn?.isRunning) {
          // Generate では「時代デフォルトへ戻す」仕様（必須）
          initClimateFromGenerate(this.$store, { era, deterministicSeed: seed, resetTurnYrToEraDefault: true });
        }
        // 地形面積率は常に最新に更新（同期で commit される）
        updateClimateTerrainFractionsFromStats(this.$store, {
          gridTypeCounts: this.stats.gridTypeCounts,
          preGlacierStats: payload.preGlacierStats || null,
          gridWidth: this.gridWidth,
          gridHeight: this.gridHeight,
          era
        });
        // Generate時のみ: 放射平衡温度を再計算して popup に反映
        if (runMode === 'generate' && !this.climateTurn?.isRunning) {
          bestEffort(() => recomputeAndPatchRadiativeEquilibrium(this.$store));
        }
        this.openOrUpdateClimatePopup();
      });
    },
    onClickGenerate() {
      this.onClickTurnStop();
      // Generate
      this._triggerRun(RUN_MODES.GENERATE);
      // 1) 気候を先に初期化（generate時の純粋な放射平衡温度に基づいた topGlacierRows を作るため）
      bestEffort(() => {
        const era = (this.local && this.local.era) ? this.local.era : this.storeEra;
        const seed = (this.local && typeof this.local.deterministicSeed !== 'undefined') ? this.local.deterministicSeed : '';
        // Generate では「時代デフォルトへ戻す」仕様（必須）
        initClimateFromGenerate(this.$store, { era, deterministicSeed: seed, resetTurnYrToEraDefault: true });
        // climateVars に averageTemperature_calc (K) が入っている想定
        const cv = getClimateVars(this.$store) || {};
        if (cv && typeof cv.averageTemperature_calc === 'number') {
          const rawC = cv.averageTemperature_calc - 273.15;
          bestEffort(() => {
            const rows = computeGlacierBaseRowsFromTemperature(rawC);
            this.local.topGlacierRows = Math.round(rows);
          });
        } else if (typeof this.averageTemperature === 'number') {
          // フォールバック: 既存の平滑済み平均気温を使う
          this.updateAverageTemperature(this.averageTemperature);
        }

      });

      // 構造（幅/高さ/バージョン）に影響する完全再生成なのでビルドバージョンを上げてiframe差し替えを促す
      this.planeBuildVersion = (this.planeBuildVersion || 0) + 1;
    },
    onClickUpdate() {
      this.onClickTurnStop();
      // Update: keep center coords
      this._triggerRun(RUN_MODES.UPDATE, { preserveCenterCoordinates: true });
    },
    onClickReviseHighFrequency() {
      this.onClickTurnStop();
      // Revise (high frequency)
      this._triggerRun(RUN_MODES.REVISE, { emit: true });
    },
    onClickDrift() {
      this.onClickTurnStop();
      // Drift
      this._triggerRun(RUN_MODES.DRIFT);
      // 中心点をドリフトさせてフル再生成（ノイズは全てランダム）
      this.planeBuildVersion = (this.planeBuildVersion || 0) + 1;
    },
    
    // ---------------------------
    // Terrain event handlers
    // ---------------------------
    /** @param {TerrainEventPayload} payload */
    onGenerated(payload) {
      const runMode = this._getRunModeFromPayload(payload);

      // 1) パラメータの出力HTMLをポップアップ表示・更新
      this.mutableCenterParams = deepClone(payload.centerParameters || []);
      if (payload && typeof payload.deterministicSeed !== 'undefined') {
        this.local.deterministicSeed = payload.deterministicSeed || '';
      }
      const gridData = Array.isArray(payload.gridData) ? payload.gridData : [];
      this._applyTerrainPayloadToUi({ gridData });
      this._applyTerrainPayloadToStoreAndState({ payload, gridData });
      this._applyTerrainPayloadToClimate({ payload, runMode });
      // 最後にポップアップを更新
      this.openOrUpdatePopup();
    },

    /** @param {TerrainEventPayload} payload */
    async onRevised(payload) {
      // Revise は Plane map のみ更新（Sphereは更新しない）
      await this._applyRevisedPayload(payload, { updatePlane: true });
    },

    // ---------------------------
    // Turn UI / Climate popup
    // ---------------------------
    openOrUpdateClimatePopup() {
      const curClimate = getClimate(this.$store);
      const html = buildClimateOutputHtml({
        climate: curClimate,
        climateTurn: this.climateTurn,
        climateVars: this.climateVars,
        climateHistory: this.climateHistory
      });
      writePopupIfOpen(this.climatePopupRef, html);
    },
    openClimatePopup() {
      this.climatePopupRef = openOrReusePopup(this.climatePopupRef, 'ClimateParameters', 'width=520,height=820,scrollbars=yes');
      if (!this.climatePopupRef) return;
      this.openOrUpdateClimatePopup();
    },
    adjustTurnSpeed(delta) {
      const cur = Number(this.climateTurn.Turn_speed || 1.0);
      let next = cur + Number(delta || 0);
      if (!isFinite(next)) next = 1.0;
      next = Math.max(0.1, Math.min(10, Math.round(next * 10) / 10));
      updateTurnSpeed(this.$store, next);
    },
    onClickTurnStart() {
      // まだ初期化されていない場合は、現在のUI時代で初期化（シード未指定ならランダム）
      bestEffort(() => {
        const c = getClimate(this.$store);
        const needInit = !c || !c.constants || c.constants.solarFlareUpRate == null;
        if (needInit) {
          const era = (this.local && this.local.era) ? this.local.era : this.storeEra;
          const seed = (this.local && typeof this.local.deterministicSeed !== 'undefined') ? this.local.deterministicSeed : '';
          // turn開始時の初期化は、現在の Turn_yr（UI選択）を維持する
          initClimateFromGenerate(this.$store, { era, deterministicSeed: seed, resetTurnYrToEraDefault: false });
          // terrain は未生成ならデフォルトのまま（Generate後は onGenerated で更新される）
        }
      });
      // 気候ポップアップを開く（なければ）
      if (!this.climatePopupRef || this.climatePopupRef.closed) this.openClimatePopup();
      // ターン進行中は sphere 回転OFF
      bestEffort(() => this.$refs?.sphere?.setRotationEnabled?.(false));
      setTurnRunning(this.$store, true);
      this._scheduleNextTurnTick(0);
    },
    onClickTurnStop() {
      setTurnRunning(this.$store, false);
      if (this.turnTimer) {
        clearTimeout(this.turnTimer);
        this.turnTimer = null;
      }
      // 停止中は sphere 回転ON
      bestEffort(() => this.$refs?.sphere?.setRotationEnabled?.(true));
    },
    _scheduleNextTurnTick(waitMs) {
      if (!getClimateTurn(this.$store)?.isRunning) return;
      if (this.turnTimer) {
        clearTimeout(this.turnTimer);
        this.turnTimer = null;
      }
      const w = Math.max(0, Number(waitMs) || 0);
      this.turnTimer = setTimeout(() => {
        this._runOneTurnTick();
      }, w);
    },
    // Turn tick step 1: terrain revise + apply (must happen before climate advance)
    async _runTurnTerrainStep() {
      // Step8: ターンごとの地形更新（重要）
      // 要件: 「同一ターン内で最新地形の面積率を使って気候を計算」するため、
      // 1) 地形(Revise) → 2) 面積率(store)更新 → 3) 気候を1ターン進める の順序にする。
      await bestEffortAsync(async () => {
        const turn = getClimateTurn(this.$store);
        const nextTurn = (turn && typeof turn.Time_turn === 'number') ? (turn.Time_turn + 1) : 1;
        const shouldUpdatePlane = (nextTurn % TURN_PLANE_UPDATE_EVERY_TURNS === 0);
        const calc = this.$refs?.calc || null;
        if (calc && typeof calc.runReviseHighFrequency === 'function') {
          // turn tick 内の revise も必ず runContext を付与して payload を自己記述化する
          this._setRunContext(RUN_MODES.REVISE);
          const revisedPayload = calc.runReviseHighFrequency({ emit: false, runContext: this.runContext });
          if (revisedPayload) {
            await this._applyRevisedPayload(revisedPayload, { updatePlane: shouldUpdatePlane });
          }
        }
      });
    },
    // Turn tick step 2: advance climate + reflect to store + schedule internal runs
    async _runTurnClimateStep() {
      await advanceClimateOneTurn(this.$store);

      // 気候の出力を既存ストアへ統合（描画/地形UIが追従できるように）
      bestEffort(() => {
        const v = getClimateVars(this.$store);
        const turn = getClimateTurn(this.$store);
        if (v && typeof v.averageTemperature === 'number') {
          storeUpdateAverageTemperature(this.$store, v.averageTemperature);
          // 氷河行数は平均気温に連動するので、UI側ローカルも更新
          this.updateAverageTemperature(v.averageTemperature);
        }
        if (v && typeof v.f_cloud === 'number') {
          updateRenderSettings(this.$store, { f_cloud: v.f_cloud });
        }
        if (v && typeof v.greenIndex === 'number') {
          updateGeneratorParams(this.$store, { greenIndex: v.greenIndex });
        }
        // 自動時代遷移が発生した場合はUIにも反映（store era）
        if (turn && turn.era && this.storeEra !== turn.era) {
          updateEra(this.$store, turn.era);
        }
        // 120ターンごとに update（中心点保持の再生成）
        bestEffort(() => {
          if (turn && typeof turn.Time_turn === 'number' && (turn.Time_turn % TURN_REGENERATE_EVERY_TURNS === 0)) {
            // turn中の自動 regenerate は 'update' として扱う（climate turn state を初期化しない）
            this._triggerRun(RUN_MODES.UPDATE, { preserveCenterCoordinates: true }, { allowDuringTurn: true });
          }
        });
        // drift は "2000000/Turn_yr" ターンごと（最小1ターン）
        bestEffort(() => {
          if (turn && typeof turn.Time_turn === 'number' && typeof turn.Turn_yr === 'number') {
            const interval = Math.max(1, Math.round(DRIFT_INTERVAL_YEARS / Math.max(1, turn.Turn_yr)));
            if (interval > 0 && (turn.Time_turn % interval === 0)) {
              this._triggerRun(RUN_MODES.DRIFT, null, { allowDuringTurn: true });
            }
          }
        });
      });
    },
    async _runOneTurnTick() {
      if (!getClimateTurn(this.$store)?.isRunning) return;
      const start = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

      await this._runTurnTerrainStep();
      await this._runTurnClimateStep();

      // ポップアップを更新（開いていれば）
      this.openOrUpdateClimatePopup();

      const end = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      const elapsed = end - start;
      const speedSec = Number(getClimateTurn(this.$store)?.Turn_speed || 1.0);
      const targetMs = Math.max(TURN_MIN_WAIT_MS, speedSec * 1000);
      const waitMs = (elapsed >= targetMs) ? TURN_LAG_FALLBACK_WAIT_MS : Math.max(0, targetMs - elapsed);
      this._scheduleNextTurnTick(waitMs);
    },

    openOrUpdatePopup() {
      const html = this.buildOutputHtml();
      this.popupRef = openOrUpdateHtmlPopup(this.popupRef, 'ParametersOutput', 'width=520,height=700,scrollbars=yes', html);
    },
    buildOutputHtml() {
      return buildParametersOutputHtml({
        localParams: this.local,
        centerParams: this.mutableCenterParams || [],
        stats: this.stats,
        gridWidth: this.gridWidth,
        gridHeight: this.gridHeight,
        landDistanceThresholdAverage: this.landDistanceThresholdAverage,
        topTundraRowsComputed: this.topTundraRowsComputed,
        topGlacierRowsDisplayed: this.topGlacierRowsDisplayed
      });
    },
    _getSphereHtmlForIframe() {
      const sph = (this.$refs && this.$refs.sphere) ? this.$refs.sphere : null;
      if (sph && typeof sph.buildHtml === 'function') return sph.buildHtml();
      return '<!doctype html><html><body><div>Sphere unavailable</div></body></html>';
    },
    _attachSphereToIframe(sif) {
      try {
        const sw = sif.contentWindow;
        if (!sw) return;
        const sdoc = sw.document;
        const canvas = sdoc.getElementById('sphere-canvas');
        if (!canvas) return;
        const sph = (this.$refs && this.$refs.sphere) ? this.$refs.sphere : null;
        if (!sph) return;
        // iframe内の球ビューは Sphere_Display 側でセットアップ（HTML生成とイベント配線を分離）
        sph.attachToWindow(sw, canvas);
        sw.addEventListener('beforeunload', () => { sph.cleanupSpherePopup(); });
      } catch (e) { void e; }
    },
    buildPlaneHtml() {
      const displayColors = Array.isArray(this.planeDisplayColors) ? this.planeDisplayColors : [];
      const cell = Number(this.planeGridCellPx) || 3;
      const displayW = this.gridWidth + 2;
      const displayH = this.gridHeight + 2;
      const buildVersion = this.planeBuildVersion || 0;
      return buildPlaneHtmlUtil({
        displayColors,
        cell,
        displayW,
        displayH,
        buildVersion
      });
    }
  }
}
</script>

<style scoped>
.param-row {
  margin-bottom: 8px;
}
.hint {
  margin-left: 8px;
  color: #666;
}

.band-details {
  margin-bottom: 8px;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}
.band-summary {
  cursor: pointer;
  font-weight: bold;
  margin-bottom: 6px;
}
.band-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
.band-item {
  width: 48%;
}
.band-footer {
  width: 100%;
  margin-top: 8px;
}
</style>

