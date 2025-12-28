<template>
  <div class="parameters-display">
    <button @click="onClickGenerate" style="margin-bottom: 12px; margin-left: 8px;">
      Generate (Popup + Render)
    </button>
    <button @click="onClickUpdate" style="margin-bottom: 12px; margin-left: 8px;">
      Update (中心座標維持)
    </button>
    <button @click="onClickReviseHighFrequency" style="margin-bottom: 12px; margin-left: 8px;">
      Revise 氷河・乾燥地
    </button>
    <button @click="onClickDrift" style="margin-bottom: 12px; margin-left: 8px;">
      Drift 大陸中心点 + ノイズ再抽選
    </button>
    
    <div style="margin-bottom: 8px;">
      <label>陸の中心点の数 y: </label>
      <input type="number" min="1" max="10" v-model.number="local.centersY" />
    </div>
    <div style="margin-bottom: 8px;">
      <label>陸の割合 x: </label>
      <input type="number" min="0.01" max="0.99" step="0.1" v-model.number="local.seaLandRatio" />
    </div>
    <div style="margin-bottom: 8px;">
      <label>中心間の排他距離 (グリッド): </label>
      <input type="number" min="1" max="50" step="1" :value="computedMinCenterDistance" disabled />
      <span style="margin-left:8px;color:#666">(自動計算)</span>
    </div>
    <div style="margin-bottom: 8px;">
      <label>浅瀬・深海間の距離閾値 (グリッド): </label>
      <input type="number" min="1" max="20" step="1" v-model.number="local.baseSeaDistanceThreshold" />
    </div>
    <div style="margin-bottom: 8px;">
      <label>平均気温 (°C): </label>
      <input type="number" min="-50" max="60" step="2" v-model.number="averageTemperature" />
      <span style="margin-left:8px">{{ Math.round(averageTemperature) }}</span>
    </div>
    <div style="margin-bottom: 8px;">
      <label>低地・乾燥地間の距離閾値 (グリッド): </label>
      <input type="number" min="-60" max="60" step="1" :value="landDistanceThresholdAverage" disabled />
      <span style="margin-left:8px;color:#666">（帯別平均）</span>
    </div>
    <details style="margin-bottom:8px;max-width:600px;margin-left:auto;margin-right:auto;">
      <summary style="cursor:pointer;font-weight:bold;margin-bottom:6px;">低地・乾燥地間の距離閾値（帯別）</summary>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;">
        <div style="width:48%;"><label>帯01 (極): </label><input type="number" min="-60" max="60" step="1" v-model.number="local.landDistanceThreshold1" /></div>
        <div style="width:48%;"><label>帯02: </label><input type="number" min="-60" max="60" step="1" v-model.number="local.landDistanceThreshold2" /></div>
        <div style="width:48%;"><label>帯03: </label><input type="number" min="-60" max="60" step="1" v-model.number="local.landDistanceThreshold3" /></div>
        <div style="width:48%;"><label>帯04: </label><input type="number" min="-60" max="60" step="1" v-model.number="local.landDistanceThreshold4" /></div>
        <div style="width:48%;"><label>帯05: </label><input type="number" min="-60" max="60" step="1" v-model.number="local.landDistanceThreshold5" /></div>
        <div style="width:48%;"><label>帯06: </label><input type="number" min="-60" max="60" step="1" v-model.number="local.landDistanceThreshold6" /></div>
        <div style="width:48%;"><label>帯07: </label><input type="number" min="-60" max="60" step="1" v-model.number="local.landDistanceThreshold7" /></div>
        <div style="width:48%;"><label>帯08: </label><input type="number" min="-60" max="60" step="1" v-model.number="local.landDistanceThreshold8" /></div>
        <div style="width:48%;"><label>帯09: </label><input type="number" min="-60" max="60" step="1" v-model.number="local.landDistanceThreshold9" /></div>
        <div style="width:48%;"><label>帯10 (赤道): </label><input type="number" min="-60" max="60" step="1" v-model.number="local.landDistanceThreshold10" /></div>
      </div>
      <div style="width:100%;margin-top:8px;">
        <label>帯の縦揺らぎ（行数）: </label>
        <input type="number" min="0" max="50" step="1" v-model.number="local.landBandVerticalWobbleRows" />
        <span style="margin-left:8px;color:#666">（0で固定）</span>
      </div>
    </details>
    <div style="margin-bottom: 8px;">
      <label>シード: </label>
      <input type="text" v-model="local.deterministicSeed" placeholder="任意（空=完全ランダム）" />
    </div>
    <div style="margin-bottom: 8px;">
      <label>雲量: </label>
      <input type="range" min="0" max="1" step="0.1" v-model.number="local.f_cloud" />
      <span style="margin-left:8px">{{ (local.f_cloud || 0).toFixed(2) }}</span>
    </div>
    <div style="margin-bottom: 8px;">
      <label>平面地図のグリッド1マスのピクセル数: </label>
      <input type="range" min="1" max="10" step="1" v-model.number="planeGridCellPx" />
      <span style="margin-left:8px">{{ planeGridCellPx }} px</span>
    </div>
    <div style="margin-bottom: 8px;">
      <label>時代: </label>
      <select v-model="local.era" @change="onEraChange">
        <option v-for="e in eras" :key="e" :value="e">{{ e }}</option>
      </select>
    </div>
    <div style="margin-bottom: 8px;">
      <label>上端・下端氷河グリッド数: </label>
      <span>{{ topGlacierRowsDisplayed }}</span>
    </div>
    <div style="margin-bottom: 8px;">
      <label>陸(低地・乾燥地・ツンドラ)の氷河追加グリッド数: </label>
      <input type="number" min="0" max="50" step="1" v-model.number="local.landGlacierExtraRows" />
    </div>
    <div style="margin-bottom: 8px;">
      <label>上端・下端ツンドラグリッド追加数: </label>
      <input type="number" min="0" max="50" step="1" v-model.number="local.tundraExtraRows" />
    </div>
    <div style="margin-bottom: 8px;">
      <label>高地の氷河追加グリッド数: </label>
      <input type="number" min="0" max="50" step="1" v-model.number="local.highlandGlacierExtraRows" />
    </div>
    <div style="margin-bottom: 8px;">
      <label>高山の氷河追加グリッド数: </label>
      <input type="number" min="0" max="50" step="1" v-model.number="local.alpineGlacierExtraRows" />
    </div>
    <div style="margin-bottom: 8px;">
      <label>湖の数（平均）: </label>
      <input type="number" min="0" max="10" step="0.5" v-model.number="local.averageLakesPerCenter" />
    </div>
    <div style="margin-bottom: 8px;">
      <label>高地の数（平均）: </label>
      <span>{{ computedAverageHighlandsPerCenter.toFixed(2) }}</span>
    </div>
    <div style="margin-bottom: 8px;">
      <label>都市生成確率 (低地, 海隣接で×10): </label>
      <input type="number" min="0" max="1" step="0.001" v-model.number="local.cityProbability" />
    </div>
    <div style="margin-bottom: 8px;">
      <label>耕作地生成確率 (低地, 海隣接で×10): </label>
      <input type="number" min="0" max="1" step="0.01" v-model.number="local.cultivatedProbability" />
    </div>
    <div style="margin-bottom: 8px;">
      <label>苔類進出地生成確率 (低地, 海隣接で×100): </label>
      <input type="number" min="0" max="1" step="0.01" v-model.number="local.bryophyteProbability" />
    </div>
    <div style="margin-bottom: 8px;">
      <label>汚染地クラスター数（マップ全体）: </label>
      <input type="number" min="0" max="1000" step="1" v-model.number="local.pollutedAreasCount" />
    </div>
    <div style="margin-bottom: 8px;">
      <label>海棲都市生成確率 (浅瀬, 陸隣接で×10): </label>
      <input type="number" min="0" max="1" step="0.001" v-model.number="local.seaCityProbability" />
    </div>
    <div style="margin-bottom: 8px;">
      <label>海棲耕作地生成確率 (浅瀬, 陸隣接で×10): </label>
      <input type="number" min="0" max="1" step="0.01" v-model.number="local.seaCultivatedProbability" />
    </div>
    <div style="margin-bottom: 8px;">
      <label>海棲汚染地クラスター数（マップ全体）: </label>
      <input type="number" min="0" max="1000" step="1" v-model.number="local.seaPollutedAreasCount" />
    </div>
    <div style="margin-bottom: 8px;">
      <label>大陸中心点を赤で表示: </label>
      <input type="checkbox" v-model="local.showCentersRed" />
    </div>
    <div style="margin-bottom: 8px;">
      <label>中心点近傍バイアス: </label>
      <input type="number" min="0" max="3" step="0.1" v-model.number="local.centerBias" />
      <span style="margin-left:8px">{{ (local.centerBias || 0).toFixed(2) }}</span>
    </div>

    <div v-if="centerParameters && centerParameters.length > 0" style="margin-top: 20px; text-align: left; max-width: 600px; margin-left: auto; margin-right: auto;">
      <div style="font-weight: bold; margin-bottom: 8px;">各中心点のパラメーター:</div>
      <div v-for="(param, idx) in mutableCenterParams" :key="idx" style="margin-bottom: 8px; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
        <div style="font-weight: bold; margin-bottom: 4px;">中心点 {{ idx + 1 }}:</div>
        <div style="margin-bottom: 4px;">
          <label style="display: inline-block; width: 150px;">座標 (x, y): </label>
          <span style="display: inline-block; width: 100px;">({{ param.x }}, {{ param.y }})</span>
        </div>
        <div style="margin-bottom: 4px;">
          <label style="display: inline-block; width: 150px;">影響係数 (influence): </label>
          <input type="number" min="0.1" max="3.0" step="0.1" v-model.number="param.influenceMultiplier" style="width: 100px;" />
        </div>
        <div style="margin-bottom: 4px;">
          <label style="display: inline-block; width: 150px;">減衰率 (kDecay): </label>
          <input type="number" min="0.5" max="5.0" step="0.1" v-model.number="param.kDecayVariation" style="width: 100px;" />
        </div>
        <div>
          <label style="display: inline-block; width: 150px;">方向角度 (direction): </label>
          <input
            type="number"
            min="0"
            max="360"
            step="1"
            :value="Math.round((param.directionAngle || 0) * 180 / Math.PI) % 360"
            @input="updateDirection(idx, $event.target.value)"
            style="width: 100px;"
          />°
        </div>
      </div>
    </div>

    <div v-if="stats && stats.lowlandDistanceToSea" style="margin-top: 16px; text-align: left; max-width: 600px; margin-left: auto; margin-right: auto;">
      <div style="font-weight: bold; margin-bottom: 6px;">低地グリッドの海まで距離（BFS距離）:</div>
      <div class="row"><label style="display:inline-block;min-width:160px;">平均:</label><span>{{ stats.lowlandDistanceToSea.avg.toFixed(2) }}</span></div>
      <div class="row"><label style="display:inline-block;min-width:160px;">最小:</label><span>{{ stats.lowlandDistanceToSea.min.toFixed(2) }}</span></div>
      <div class="row"><label style="display:inline-block;min-width:160px;">最大:</label><span>{{ stats.lowlandDistanceToSea.max.toFixed(2) }}</span></div>
      <div class="row"><label style="display:inline-block;min-width:160px;">低地グリッド数:</label><span>{{ stats.lowlandDistanceToSea.count }}</span></div>
    </div>

    <!-- 非表示の計算コンポーネント（テンプレート内に配置することで使用済みとして認識される） -->
    <Grids_Calculation
      ref="calc"
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
      :generateSignal="generateSignal"
      :updateSignal="updateSignal"
      :reviseSignal="reviseSignal"
      :driftSignal="driftSignal"
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
      @generated="onGenerated"
      @revised="onRevised"
      @drifted="onGenerated"
    />

    <!-- 非表示の球表示コンポーネント -->
    <Sphere_Display
      ref="sphere"
      :gridWidth="gridWidth"
      :gridHeight="gridHeight"
      :gridData="gridDataLocal"
      :polarBufferRows="75"
      :f_cloud="local.f_cloud"
      :era="storeEra"
    />
  </div>
</template>

<script>
// このコンポーネントは「パラメータ入力／表示」と「計算トリガ」を担当します。
// - 生成ボタンで非表示の計算子を起動し、結果は親(App)とポップアップへ出力します。
// - 入力欄の値は内部state(local)に保持し、必要に応じて親へemitします。
import Grids_Calculation from './Grids_Calculation.vue';
import Sphere_Display from './Sphere_Display.vue';
import { deriveDisplayColorsFromGridData, getEraTerrainColors } from '../utils/colors.js';
import { ERAS, GRID_DEFAULTS, PARAM_DEFAULTS, createLocalParams } from '../utils/paramsDefaults.js';
import { computeGlacierBaseRowsFromTemperature } from '../utils/terrain/glacierAnchors.js';
import { computeGridTypeCounts } from '../features/stats/gridTypeCounts.js';
import { buildParametersOutputHtml } from '../features/popup/parametersOutputHtml.js';
import { buildPlaneSphereShellHtml } from '../features/popup/planeSphereShellHtml.js';
import { buildPlaneHtml as buildPlaneHtmlUtil } from '../features/popup/planeHtml.js';
export default {
  name: 'Parameters_Display',
  components: { Grids_Calculation, Sphere_Display },
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
    // 大陸中心点を赤で表示（デフォルト: ON）
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
    this._syncLocalFromStoreGeneratorParams();
  },
  data() {
    return {
      // グリッド幅・高さ（初期値: 200x100）
      gridWidth: GRID_DEFAULTS.gridWidth,
      gridHeight: GRID_DEFAULTS.gridHeight,
      gridDataLocal: [],
      // ポップアップ描画用の平面色（+2枠込み）
      planeDisplayColors: [],
      // 平面地図専用ポップアップ
      planePopupRef: null,
      local: createLocalParams(this),
      // UI で選べる時代一覧（store.era と対応）
      eras: ERAS,
      // 中心点のパラメータはdeepコピーして編集可能にする
      mutableCenterParams: JSON.parse(JSON.stringify(this.centerParameters || [])),
      generateSignal: 0,
      updateSignal: 0,
      reviseSignal: 0,
      driftSignal: 0,
      // plane iframe のビルドバージョン（構造変化時はインクリメント）
      planeBuildVersion: 0,
      // sphere の非リロード更新回数管理
      sphereUpdateCount: 0,
      sphereMaxUpdates: 200,
      popupRef: null,
      stats: null,
      // store<->local 同期のループ防止フラグ
      isSyncingLocalFromStore: false
    };
  },
  computed: {
    // store ガードを各所に散らさないための共通アクセサ
    storeEra() {
      return this.$store?.getters?.era ?? null;
    },
    storeGeneratorParams() {
      return this.$store?.getters?.generatorParams ?? null;
    },
    storeRenderSettings: {
      get() {
        return this.$store?.getters?.renderSettings ?? null;
      },
      set(val) {
        try {
          if (this.$store && val && typeof val === 'object') {
            this.$store.dispatch('updateRenderSettings', val);
          }
        } catch (e) {
          // ignore
        }
      }
    },
    averageTemperature: {
      get() {
        const v = this.$store?.getters?.averageTemperature;
        return (typeof v === 'number') ? v : 15;
      },
      set(val) {
        let num = Number(val);
        if (!isFinite(num)) return;
        // 2℃刻みにスナップし、許容範囲へクランプ
        num = Math.round(num / 2) * 2;
        if (num < -50) num = -50;
        if (num > 60) num = 60;
        if (this.$store) {
          this.$store.dispatch('updateAverageTemperature', num);
        }
        this.updateAverageTemperature(num);
      }
    },
    planeGridCellPx: {
      get() {
        const v = this.$store?.getters?.planeGridCellPx;
        return (typeof v === 'number') ? v : 3;
      },
      set(val) {
        let v = Math.round(Number(val));
        if (!isFinite(v)) v = 3;
        if (v < 1) v = 1;
        if (v > 10) v = 10;
        this.$store?.dispatch?.('updatePlaneGridCellPx', v);
      }
    },
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
    }
    ,
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
        this._syncLocalFromStoreGeneratorParams();
      }
    },
    storeRenderSettings: {
      deep: true,
      handler() {
        this._syncLocalFromStoreRenderSettings();
      }
    },
    // local の入力変更を store に反映（v-model での変更を自動で拾う）
    local: {
      deep: true,
      handler() {
        if (this.isSyncingLocalFromStore) return;
        this._syncStoreFromLocal();
      }
    }
  },
  methods: {
    _syncStoreFromLocal() {
      // generatorParams と renderSettings に分配して store に反映する
      const local = this.local || {};
      // f_cloud は renderSettings に移管（generatorParams からは除外）
      const generatorAllowed = new Set([
        ...Object.keys(PARAM_DEFAULTS).filter((k) => k !== 'f_cloud'),
        'deterministicSeed',
        'minCenterDistance'
      ]);
      const renderAllowed = new Set([
        'f_cloud'
      ]);
      const genPatch = {};
      const renderPatch = {};
      for (const k of Object.keys(local)) {
        if (generatorAllowed.has(k)) genPatch[k] = local[k];
        if (renderAllowed.has(k)) renderPatch[k] = local[k];
      }
      try {
        // Avoid dispatching if values match current store (prevents reactive loops)
        if (Object.keys(genPatch).length > 0) {
          const curGen = this.storeGeneratorParams || {};
          let needGen = false;
          for (const k of Object.keys(genPatch)) {
            if (curGen[k] !== genPatch[k]) { needGen = true; break; }
          }
          if (needGen) this.$store?.dispatch?.('updateGeneratorParams', genPatch);
        }
        if (Object.keys(renderPatch).length > 0) {
          const curRender = this.storeRenderSettings || {};
          let needRender = false;
          for (const k of Object.keys(renderPatch)) {
            if (curRender[k] !== renderPatch[k]) { needRender = true; break; }
          }
          if (needRender) this.$store?.dispatch?.('updateRenderSettings', renderPatch);
        }
      } catch (e) { /* ignore */ }
    },
    _syncLocalFromStoreGeneratorParams() {
      const gp = this.storeGeneratorParams;
      if (!gp || typeof gp !== 'object') return;
      // local -> store の watcher と衝突しないようにガード
      this.isSyncingLocalFromStore = true;
      try {
        // local に存在するキーだけ上書き（local.era 等は store別管理のため触らない）
        for (const k of Object.keys(gp)) {
          if (Object.prototype.hasOwnProperty.call(this.local, k)) {
            this.local[k] = gp[k];
          }
        }
      } finally {
        this.isSyncingLocalFromStore = false;
      }
    },
    _syncLocalFromStoreRenderSettings() {
      const rs = this.storeRenderSettings;
      if (!rs || typeof rs !== 'object') return;
      this.isSyncingLocalFromStore = true;
      try {
        // 現状 UI で扱っているのは f_cloud のみ
        if (Object.prototype.hasOwnProperty.call(this.local, 'f_cloud') && typeof rs.f_cloud !== 'undefined') {
          this.local.f_cloud = rs.f_cloud;
        }
      } finally {
        this.isSyncingLocalFromStore = false;
      }
    },
    onEraChange() {
      this.$store?.dispatch?.('updateEra', this.local.era);
    },
    // 平均気温から上端・下端氷河グリッド数を線形補間で算出（2℃刻み入力想定）
    updateAverageTemperature(value) {
      const t = (typeof value === 'number') ? value
        : this.averageTemperature;
      const v = computeGlacierBaseRowsFromTemperature(t);
      // 端数は四捨五入。負も許容（海氷河は作成しないよう計算側でガード）
      this.local.topGlacierRows = Math.round(v);
    },
    updateDirection(idx, degVal) {
      const deg = (degVal % 360 + 360) % 360;
      const rad = (deg * Math.PI) / 180;
      if (this.mutableCenterParams[idx]) {
        this.mutableCenterParams[idx].directionAngle = rad;
      }
    },
    onClickGenerate() {
      // 構造（幅/高さ/バージョン）に影響する完全再生成なのでビルドバージョンを上げてiframe差し替えを促す
      this.planeBuildVersion = (this.planeBuildVersion || 0) + 1;
      this.generateSignal += 1;
    },
    onClickUpdate() {
      // Generate と同等のフル再生成だが、中心点の座標(x,y)は「現在の値」を維持する。
      this.planeBuildVersion = (this.planeBuildVersion || 0) + 1;
      this.updateSignal += 1;
    },
    onClickReviseHighFrequency() {
      // Generate後のキャッシュを前提とした高頻度更新
      this.reviseSignal += 1;
    },
    onClickDrift() {
      // 中心点をドリフトさせてフル再生成（ノイズは全てランダム）
      this.planeBuildVersion = (this.planeBuildVersion || 0) + 1;
      this.driftSignal += 1;
    },
    
    
    onGenerated(payload) {
      // 1) パラメータの出力HTMLをポップアップ表示・更新
      this.mutableCenterParams = JSON.parse(JSON.stringify(payload.centerParameters || []));
      if (payload && typeof payload.deterministicSeed !== 'undefined') {
        this.local.deterministicSeed = payload.deterministicSeed || '';
      }
      // 1.1) 氷河上書き前の陸/海比をローカルに保持（湖は海扱い）
      if (payload && payload.preGlacierStats) {
        if (!this.stats) this.stats = {};
        this.stats.preGlacier = payload.preGlacierStats;
      }
      // 1.1.1) 計算側が実際に使った「上端・下端氷河row（基準）」を保存してUI表示を一致させる
      if (payload && typeof payload.computedTopGlacierRows === 'number') {
        if (!this.stats) this.stats = {};
        this.stats.computedTopGlacierRows = payload.computedTopGlacierRows;
      }
      // 1.2) 平面表示色（+2枠）を計算してポップアップ用に保持
      try {
        const era = this.local && this.local.era ? this.local.era : this.storeEra;
        const eraColors = getEraTerrainColors(era);
        const displayColors = Array.isArray(payload.gridData)
          ? deriveDisplayColorsFromGridData(payload.gridData, this.gridWidth, this.gridHeight, undefined, eraColors, /*preferPalette*/ true)
          : [];
        this.planeDisplayColors = Array.isArray(displayColors) ? displayColors : [];
      } catch (e) {
        this.planeDisplayColors = [];
      }
      // 1.3) 平面地図専用ポップアップを更新（初回は作成、続きは差分更新）
      this.openOrUpdatePlanePopup();
      // 非リロードでの差分更新を試みる（Plane + Sphere）
      this.updatePlaneAndSphereIframes();
      // 2) 親へ伝搬（AppからTerrain_Displayへ受け渡し用）
      this.$emit('generated', {
        gridData: payload.gridData || null,
        gridWidth: this.gridWidth,
        gridHeight: this.gridHeight,
        centerParameters: payload.centerParameters
      });
      // 2.5) Sphere 用にローカルにも保持
      this.gridDataLocal = Array.isArray(payload.gridData) ? payload.gridData : [];
      // 2.6) store にもグリッド結果を保存（Terrain_Display / Sphere_Display が store 依存になるため）
      try {
        this.$store?.dispatch?.('updateGridWidth', Number(this.gridWidth) || this.$store.getters.gridWidth);
        this.$store?.dispatch?.('updateGridHeight', Number(this.gridHeight) || this.$store.getters.gridHeight);
        this.$store?.dispatch?.('updateGridData', Array.isArray(payload.gridData) ? payload.gridData : []);
      } catch (e) { /* ignore */ }
      // 3) UI表示用の統計を保存
      if (!this.stats) this.stats = {};
      if (payload.lowlandDistanceToSeaStats) {
        this.stats.lowlandDistanceToSea = payload.lowlandDistanceToSeaStats;
      }
      if (payload && payload.driftMetrics) {
        this.stats.driftMetrics = payload.driftMetrics;
      } else {
        // Drift以外（Generate/Revise）では古い表示が残らないようクリア
        this.stats.driftMetrics = null;
      }
      // 3.1) グリッド種類のカウント（合計 N）
      const gridData = Array.isArray(payload.gridData) ? payload.gridData : [];
      this.stats.gridTypeCounts = computeGridTypeCounts({
        gridData,
        gridWidth: this.gridWidth,
        gridHeight: this.gridHeight
      });
      // 最後にポップアップを更新
      this.openOrUpdatePopup();
    },

    onRevised(payload) {
      // Revise は Plane map のみ更新（Sphereは更新しない）
      const gridData = (payload && Array.isArray(payload.gridData)) ? payload.gridData : [];
      if (!this.stats) this.stats = {};
      if (payload && typeof payload.computedTopGlacierRows === 'number') {
        this.stats.computedTopGlacierRows = payload.computedTopGlacierRows;
      }

      // 平面表示色（+2枠）を更新
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

      // 統計（グリッド種類カウント）を更新して、Parameters popupにも反映
      this._updateGridTypeCountsFromGridData(gridData);
      this.openOrUpdatePopup();

      // Plane iframe だけ差し替え（sphere iframeは触らない）
      this.updatePlaneIframeOnly();
    },

    _updateGridTypeCountsFromGridData(gridData) {
      if (!this.stats) this.stats = {};
      this.stats.gridTypeCounts = computeGridTypeCounts({
        gridData,
        gridWidth: this.gridWidth,
        gridHeight: this.gridHeight
      });
    },
    openOrUpdatePopup() {
      const w = this.popupRef && !this.popupRef.closed ? this.popupRef : window.open('', 'ParametersOutput', 'width=520,height=700');
      this.popupRef = w;
      if (!w) return;
      const doc = w.document;
      const html = this.buildOutputHtml();
      doc.open();
      doc.write(html);
      doc.close();
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
    openOrUpdatePlanePopup() {
      // build plane and sphere HTML and embed them into two iframes within a single popup
      const w = this._getOrOpenPlaneSpherePopup();
      if (!w) return;
      const doc = w.document;

      // 1) 外枠（iframe2枚だけ）を先に描画
      this._writeDoc(doc, buildPlaneSphereShellHtml());

      // 2) iframeの中身を流し込む（srcdoc）
      const planeHtml = this.buildPlaneHtml();
      const sphereHtml = this._getSphereHtmlForIframe();
      this._setPlaneSphereIframes(doc, planeHtml, sphereHtml);
    },
    updatePlaneIframeOnly() {
      // 既存の Plane&Sphere popup があれば、Plane iframe だけ更新する。
      // srcdoc差し替えは iframe をリロードしてちらつくため、可能なら iframe 内の関数で canvas だけ再描画する。
      const w = (this.planePopupRef && !this.planePopupRef.closed) ? this.planePopupRef : null;
      if (!w) {
        // 無ければ従来通り作成（この場合は sphere iframe も初期化される）
        this.openOrUpdatePlanePopup();
        return;
      }
      try {
        const doc = w.document;
        const pif = doc.getElementById('plane-iframe');
        if (!pif) {
          this.openOrUpdatePlanePopup();
          return;
        }
        // 1) まずは「リロードなし更新」を試す
        const pw = pif.contentWindow;
        const fn = pw && typeof pw.__updatePlane === 'function' ? pw.__updatePlane : null;
        const pv = pw && typeof pw.__planeVersion !== 'undefined' ? pw.__planeVersion : null;
        const displayColors = Array.isArray(this.planeDisplayColors) ? this.planeDisplayColors : [];
        const cell = Number(this.planeGridCellPx) || 3;
        const displayW = this.gridWidth + 2;
        const displayH = this.gridHeight + 2;
        // バージョンが異なれば iframe を完全差し替えして内部スクリプトを更新する
        if (pv !== null && pv !== this.planeBuildVersion) {
          const planeHtml = this.buildPlaneHtml();
          pif.srcdoc = planeHtml;
          return;
        }
        if (fn) {
          try {
            // updateCount が一定回数を越えていれば内部で cleanup させ、srcdoc で再作成する
            const updateCount = pw.__planeUpdateCount || 0;
            const MAX_UPDATES = 200;
            if (updateCount >= MAX_UPDATES && typeof pw.__cleanupPlane === 'function') {
              try { pw.__cleanupPlane(); } catch (e) { /* ignore cleanup errors */ }
              const planeHtml = this.buildPlaneHtml();
              pif.srcdoc = planeHtml;
              return;
            }
            fn(displayColors, displayW, displayH, cell);
            if (typeof pw.__planeUpdateCount === 'number') pw.__planeUpdateCount++;
            else pw.__planeUpdateCount = 1;
            return;
          } catch (e) {
            // フォールバックして再描画
            const planeHtml = this.buildPlaneHtml();
            pif.srcdoc = planeHtml;
            return;
          }
        }
        // 2) 初回/互換: srcdoc差し替え（ちらつきやすい）
        const planeHtml = this.buildPlaneHtml();
        pif.srcdoc = planeHtml;
      } catch (e) {
        this.openOrUpdatePlanePopup();
      }
    },
    // 更新: Plane と Sphere を非リロードで可能なら差分更新する（Generate/Revise 共通で使える）
    updatePlaneAndSphereIframes() {
      // Plane 更新
      this.updatePlaneIframeOnly();

      // Sphere iframe 更新（Generate時はSphereも更新する。Reviseでは呼ばれない設計）
      try {
        const w = (this.planePopupRef && !this.planePopupRef.closed) ? this.planePopupRef : null;
        if (!w) return;
        const doc = w.document;
        const sif = doc.getElementById('sphere-iframe');
        if (!sif) return;
        // If sphere iframe already attached and parent sphere component has initialized, request redraw
        const sphComp = (this.$refs && this.$refs.sphere) ? this.$refs.sphere : null;
        if (sphComp && this._sphereWin) {
          // Use update count to avoid indefinite non-reload updates (resource leakage)
          if ((this.sphereUpdateCount || 0) >= (this.sphereMaxUpdates || 200)) {
            try { sphComp.cleanupSpherePopup(); } catch (e) { /* ignore cleanup errors */ }
            // re-create iframe content
            const sphereHtml = this._getSphereHtmlForIframe();
            try { sif.srcdoc = sphereHtml; } catch (e) { /* ignore srcdoc set errors */ }
            this.sphereUpdateCount = 0;
            return;
          }
          try {
            sphComp.requestRedraw();
            this.sphereUpdateCount = (this.sphereUpdateCount || 0) + 1;
            return;
          } catch (e) {
            // fallback: replace srcdoc
            const sphereHtml = this._getSphereHtmlForIframe();
            try { sif.srcdoc = sphereHtml; } catch (e) { /* ignore srcdoc set errors */ }
            this.sphereUpdateCount = 0;
            return;
          }
        } else {
          // not attached yet: replace srcdoc so onload attaches
          const sphereHtml = this._getSphereHtmlForIframe();
          try { sif.srcdoc = sphereHtml; } catch (e) { /* ignore srcdoc set errors */ }
          this.sphereUpdateCount = 0;
          return;
        }
        } catch (e) { /* ignore overall update errors */ }
    },
    _getOrOpenPlaneSpherePopup() {
      const w = (this.planePopupRef && !this.planePopupRef.closed)
        ? this.planePopupRef
        : window.open('', 'PlaneSphereView', 'width=1400,height=900,scrollbars=yes');
      this.planePopupRef = w;
      return w;
    },
    _writeDoc(doc, html) {
      if (!doc) return;
      doc.open();
      doc.write(html);
      doc.close();
    },
    _getSphereHtmlForIframe() {
      const sph = (this.$refs && this.$refs.sphere) ? this.$refs.sphere : null;
      if (sph && typeof sph.buildHtml === 'function') return sph.buildHtml();
      return '<!doctype html><html><body><div>Sphere unavailable</div></body></html>';
    },
    _setPlaneSphereIframes(doc, planeHtml, sphereHtml) {
      // set iframe contents from parent so we can wire sphere canvas to component methods
      try {
        const pif = doc.getElementById('plane-iframe');
        const sif = doc.getElementById('sphere-iframe');
        if (pif) pif.srcdoc = planeHtml;
        if (!sif) return;
        // Sphere は可能なら再利用してリロードを避ける（ちらつき防止）
        // 初回は srcdoc を流し込み、onload で親側に canvas を渡す
        sif.srcdoc = sphereHtml;
        sif.onload = () => {
          this._attachSphereToIframe(sif);
        };
      } catch (e) { void e; }
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
</style>

