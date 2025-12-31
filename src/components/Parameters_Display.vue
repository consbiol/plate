<template>
  <div class="parameters-display">
    <button @click="onClickGenerate" style="margin-bottom: 12px; margin-left: 8px;">
      Generate (Popup + Render)
    </button>
    <button @click="onClickUpdate" style="margin-bottom: 12px; margin-left: 8px;">
      Update (中心点を保持して再生成)
    </button>
    <button @click="onClickReviseHighFrequency" style="margin-bottom: 12px; margin-left: 8px;">
      Revise 氷河・乾燥地
    </button>
    <button @click="onClickDrift" style="margin-bottom: 12px; margin-left: 8px;">
      Drift 大陸中心点 + ノイズ再抽選
    </button>

    <div style="margin: 10px 8px 18px 8px; padding: 10px; border: 1px solid #ddd; border-radius: 6px; max-width: 720px; margin-left:auto; margin-right:auto; text-align:left;">
      <div style="font-weight:bold; margin-bottom:6px;">ターン進行</div>
      <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
        <button @click="onClickTurnStart" :disabled="!!climateTurn.isRunning">ターン進行</button>
        <button @click="onClickTurnStop" :disabled="!climateTurn.isRunning">ターン停止</button>
        <button @click="adjustTurnSpeed(-0.1)">-</button>
        <span>Turn_speed: <b>{{ (climateTurn.Turn_speed || 1).toFixed(1) }}</b> sec/turn</span>
        <button @click="adjustTurnSpeed(0.1)">+</button>
        <button @click="openClimatePopup">気候パラメータ</button>
      </div>
      <div style="margin-top:6px; color:#333;">
        Time_turn: <b>{{ climateTurn.Time_turn }}</b> /
        Turn_yr: <b>{{ climateTurn.Turn_yr }}</b> yr/turn /
        Time_yr: <b>{{ climateTurn.Time_yr }}</b> yr /
        時代: <b>{{ climateTurn.era }}</b>
      </div>
    </div>
    
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
    <!-- greenIndex UI removed: managed by climate model / generator params -->
    <div style="margin-bottom: 8px;">
      <label>低地・乾燥地 閾値（帯別）を自動更新: </label>
      <input type="checkbox" v-model="local.landDistanceThresholdAuto" />
      <span style="margin-left:8px;color:#666">
        （ON: 平均気温×GIテーブルで帯01〜10を自動更新 / OFF: 帯01〜10を手動上書き）
      </span>
    </div>
    <div style="margin-bottom: 8px;">
      <label>低地・乾燥地間の距離閾値 (グリッド): </label>
      <input type="number" min="-60" max="60" step="1" :value="landDistanceThresholdAverage" disabled />
      <span style="margin-left:8px;color:#666">（帯別平均）</span>
    </div>
    <details style="margin-bottom:8px;max-width:600px;margin-left:auto;margin-right:auto;">
      <summary style="cursor:pointer;font-weight:bold;margin-bottom:6px;">低地・乾燥地間の距離閾値（帯別）</summary>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;">
        <div style="width:48%;"><label>帯01 (極): </label><input type="number" min="-60" max="60" step="1" v-model.number="local.landDistanceThreshold1" :disabled="!!local.landDistanceThresholdAuto" /></div>
        <div style="width:48%;"><label>帯02: </label><input type="number" min="-60" max="60" step="1" v-model.number="local.landDistanceThreshold2" :disabled="!!local.landDistanceThresholdAuto" /></div>
        <div style="width:48%;"><label>帯03: </label><input type="number" min="-60" max="60" step="1" v-model.number="local.landDistanceThreshold3" :disabled="!!local.landDistanceThresholdAuto" /></div>
        <div style="width:48%;"><label>帯04: </label><input type="number" min="-60" max="60" step="1" v-model.number="local.landDistanceThreshold4" :disabled="!!local.landDistanceThresholdAuto" /></div>
        <div style="width:48%;"><label>帯05: </label><input type="number" min="-60" max="60" step="1" v-model.number="local.landDistanceThreshold5" :disabled="!!local.landDistanceThresholdAuto" /></div>
        <div style="width:48%;"><label>帯06: </label><input type="number" min="-60" max="60" step="1" v-model.number="local.landDistanceThreshold6" :disabled="!!local.landDistanceThresholdAuto" /></div>
        <div style="width:48%;"><label>帯07: </label><input type="number" min="-60" max="60" step="1" v-model.number="local.landDistanceThreshold7" :disabled="!!local.landDistanceThresholdAuto" /></div>
        <div style="width:48%;"><label>帯08: </label><input type="number" min="-60" max="60" step="1" v-model.number="local.landDistanceThreshold8" :disabled="!!local.landDistanceThresholdAuto" /></div>
        <div style="width:48%;"><label>帯09: </label><input type="number" min="-60" max="60" step="1" v-model.number="local.landDistanceThreshold9" :disabled="!!local.landDistanceThresholdAuto" /></div>
        <div style="width:48%;"><label>帯10 (赤道): </label><input type="number" min="-60" max="60" step="1" v-model.number="local.landDistanceThreshold10" :disabled="!!local.landDistanceThresholdAuto" /></div>
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
    <!-- UI cloud slider removed: f_cloud is managed by climate model and renderSettings -->
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
      :updateSignal="updateSignal"
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
import { computeLandDistanceThresholdsByGreenIndex } from '../utils/terrain/landDistanceThresholdsByGreenIndex.js';
import { computeGridTypeCounts } from '../features/stats/gridTypeCounts.js';
import { buildParametersOutputHtml } from '../features/popup/parametersOutputHtml.js';
import { buildClimateOutputHtml } from '../features/popup/climateOutputHtml.js';
import { buildPlaneSphereShellHtml } from '../features/popup/planeSphereShellHtml.js';
import { buildPlaneHtml as buildPlaneHtmlUtil } from '../features/popup/planeHtml.js';
import { buildStorePatchesFromLocal, applyGeneratorParamsToLocal, applyRenderSettingsToLocal } from '../utils/storeSync.js';
import { deepClone } from '../utils/clone.js';
import { computeRadiativeEquilibriumTempK } from '../utils/climate/model.js';
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
    this._syncLocalFromStoreGeneratorParams();
    // greenIndex と平均気温に応じて「低地・乾燥地間の距離閾値（帯別）」を初期反映
    this.applyGreenIndexToLandDistanceThresholds();
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
      mutableCenterParams: deepClone(this.centerParameters || []),
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
      climatePopupRef: null,
      stats: null,
      // store<->local 同期のループ防止フラグ
      isSyncingLocalFromStore: false,
      // ターン進行のタイマー（setTimeout）
      turnTimer: null,
      // generate/update/drift のどれで onGenerated が呼ばれたかを判定するためのフラグ
      lastRunMode: null
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
    storeRenderSettings() {
      return this.$store?.getters?.renderSettings ?? null;
    },
    climateTurn() {
      return this.$store?.getters?.climateTurn ?? { Time_turn: 0, Time_yr: 0, Turn_yr: 50000, Turn_speed: 1.0, isRunning: false, era: this.storeEra };
    },
    climateVars() {
      return this.$store?.getters?.climateVars ?? null;
    },
    climateHistory() {
      return this.$store?.getters?.climateHistory ?? null;
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
        this._syncStoreFromLocal();
      }
    }
  },
  methods: {
    async _applyRevisedPayload(payload, { updatePlane = true } = {}) {
      // Turn中の「順序保証」用: Grids_Calculation の revise 結果を、emit経由ではなく同期的に反映する。
      const gridData = (payload && Array.isArray(payload.gridData)) ? payload.gridData : [];
      if (!this.stats) this.stats = {};
      if (payload && typeof payload.computedTopGlacierRows === 'number') {
        this.stats = { ...(this.stats || {}), computedTopGlacierRows: payload.computedTopGlacierRows };
      }

      // Plane用の表示色は、必要なとき（updatePlane=true）だけ計算して更新
      if (updatePlane) {
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
      }

      // 統計（グリッド種類カウント）を更新して、Parameters popupにも反映
      this._updateGridTypeCountsFromGridData(gridData);
      this.openOrUpdatePopup();

      // グリッドデータをローカル/ストアにも反映して Sphere などが最新の氷河描写を使えるようにする
      this.gridDataLocal = Array.isArray(gridData) ? gridData : [];
      try {
        await this.$store?.dispatch?.('updateGridData', Array.isArray(gridData) ? gridData : []);
      } catch (e) { /* ignore */ }

      // 気候モデルの地形面積率も更新（これを advanceClimateOneTurn より前に行う）
      try {
        const era = this.local && this.local.era ? this.local.era : this.storeEra;
        await this.$store?.dispatch?.('updateClimateTerrainFractions', {
          gridTypeCounts: this.stats && this.stats.gridTypeCounts ? this.stats.gridTypeCounts : null,
          preGlacierStats: (this.stats && this.stats.preGlacier) ? this.stats.preGlacier : null,
          gridWidth: this.gridWidth,
          gridHeight: this.gridHeight,
          era
        });
      } catch (e) { /* ignore */ }

      // Plane iframe 更新は「外に見える部分」なので、必要なときだけ
      if (updatePlane) {
        this.updatePlaneIframeOnly();
      }
    },
    applyGreenIndexToLandDistanceThresholds() {
      // OFFのときは手動上書きを尊重して何もしない
      if (!this.local || !this.local.landDistanceThresholdAuto) return;
      // store -> local 同期中に走ると循環するためガード
      if (this.isSyncingLocalFromStore) return;
      // greenIndex is sourced from the climate model / generator params (store). Prefer climate.vars.greenIndex if available.
      const climateVars = this.$store?.getters?.climateVars ?? null;
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
    _syncStoreFromLocal() {
      // generatorParams と renderSettings に分配して store に反映する
      const { genPatch, renderPatch } = buildStorePatchesFromLocal(this.local, PARAM_DEFAULTS);
      try {
        if (Object.keys(genPatch).length > 0) this.$store?.dispatch?.('updateGeneratorParams', genPatch);
        if (Object.keys(renderPatch).length > 0) this.$store?.dispatch?.('updateRenderSettings', renderPatch);
      } catch (e) { /* ignore */ }
    },
    _syncLocalFromStoreGeneratorParams() {
      const gp = this.storeGeneratorParams;
      if (!gp || typeof gp !== 'object') return;
      // local -> store の watcher と衝突しないようにガード
      this.isSyncingLocalFromStore = true;
      try {
        applyGeneratorParamsToLocal(this.local, gp);
      } finally {
        this.isSyncingLocalFromStore = false;
      }
      // store->local 同期が終わったら、greenIndex に基づく帯別閾値を最新化する
      try {
        this.applyGreenIndexToLandDistanceThresholds();
      } catch (e) { /* ignore */ }
    },
    _syncLocalFromStoreRenderSettings() {
      const rs = this.storeRenderSettings;
      if (!rs || typeof rs !== 'object') return;
      this.isSyncingLocalFromStore = true;
      try {
        applyRenderSettingsToLocal(this.local, rs);
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
      this.onClickTurnStop();
      this.lastRunMode = 'generate';
      // 1) 気候を先に初期化（generate時の純粋な放射平衡温度に基づいた topGlacierRows を作るため）
      try {
        const era = (this.local && this.local.era) ? this.local.era : this.storeEra;
        const seed = (this.local && typeof this.local.deterministicSeed !== 'undefined') ? this.local.deterministicSeed : '';
        this.$store?.dispatch?.('initClimateFromGenerate', { era, deterministicSeed: seed });
        // climateVars に averageTemperature_calc (K) が入っている想定
        const cv = this.$store?.getters?.climateVars || {};
        if (cv && typeof cv.averageTemperature_calc === 'number') {
          const rawC = cv.averageTemperature_calc - 273.15;
          try {
            const rows = computeGlacierBaseRowsFromTemperature(rawC);
            this.local.topGlacierRows = Math.round(rows);
          } catch (e) { /* ignore */ }
        } else if (typeof this.averageTemperature === 'number') {
          // フォールバック: 既存の平滑済み平均気温を使う
          this.updateAverageTemperature(this.averageTemperature);
        }

      } catch (e) { /* ignore */ }

      // 構造（幅/高さ/バージョン）に影響する完全再生成なのでビルドバージョンを上げてiframe差し替えを促す
      this.planeBuildVersion = (this.planeBuildVersion || 0) + 1;
      this.generateSignal += 1;
    },
    onClickUpdate() {
      this.onClickTurnStop();
      this.lastRunMode = 'update';
      // 中心点座標を保持して再生成（iframeの完全差し替えは行わない）
      this.updateSignal += 1;
    },
    onClickReviseHighFrequency() {
      this.onClickTurnStop();
      // Generate後のキャッシュを前提とした高頻度更新
      this.reviseSignal += 1;
    },
    onClickDrift() {
      this.onClickTurnStop();
      this.lastRunMode = 'drift';
      // 中心点をドリフトさせてフル再生成（ノイズは全てランダム）
      this.planeBuildVersion = (this.planeBuildVersion || 0) + 1;
      this.driftSignal += 1;
    },
    
    onGenerated(payload) {
      // 1) パラメータの出力HTMLをポップアップ表示・更新
      this.mutableCenterParams = deepClone(payload.centerParameters || []);
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
        this.stats = { ...(this.stats || {}), computedTopGlacierRows: payload.computedTopGlacierRows };
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

      // 4) 気候モデル: generateSignal のときだけ初期化（update/drift では初期化しない）
      try {
        const era = (this.local && this.local.era) ? this.local.era : this.storeEra;
        const seed = (this.local && typeof this.local.deterministicSeed !== 'undefined') ? this.local.deterministicSeed : '';
        // 初期化は generate 操作のときのみ行う（update/revise/drift の emit では行わない）
        if (this.lastRunMode === 'generate') {
          this.$store?.dispatch?.('initClimateFromGenerate', { era, deterministicSeed: seed });
        }
        // 地形面積率は常に最新に更新（同期で commit される）
        this.$store?.dispatch?.('updateClimateTerrainFractions', {
          gridTypeCounts: this.stats.gridTypeCounts,
          preGlacierStats: payload.preGlacierStats || null,
          gridWidth: this.gridWidth,
          gridHeight: this.gridHeight,
          era
        });
        // updateClimateTerrainFractions が反映された直後の store state を使って
        // 放射平衡温度を再計算し、averageTemperature_calc を最新化して popup に反映する。
        //
        // NOTE:
        // - これは近似（albedo等が簡略）であり、ターン進行中の自動 update（60ターン毎など）で
        //   毎回上書きすると averageTemperature_calc が一時的に大きく跳ねるため、
        //   ユーザーが明示的に Generate を押したときだけ実行する。
        if (this.lastRunMode === 'generate') {
          try {
            const curClimate = this.$store?.getters?.climate ?? null;
            if (curClimate) {
              const out = computeRadiativeEquilibriumTempK(curClimate, { conservative: true });
              if (out && typeof out.averageTemperature_calc === 'number') {
                // patchClimate mutation を使って vars.averageTemperature_calc を更新
                try { this.$store.commit('patchClimate', { vars: { ...(curClimate.vars || {}), averageTemperature_calc: out.averageTemperature_calc, Sol: out.Sol, f_cloud: out.f_cloud } }); } catch (e) { /* ignore */ }
              }
            }
          } catch (e) { /* ignore */ }
        }
        this.openOrUpdateClimatePopup();
      } catch (e) { /* ignore */ }
      this.lastRunMode = null;
      // 最後にポップアップを更新
      this.openOrUpdatePopup();
    },

    async onRevised(payload) {
      // Revise は Plane map のみ更新（Sphereは更新しない）
      await this._applyRevisedPayload(payload, { updatePlane: true });
    },

    // ---------------------------
    // Turn UI / Climate popup
    // ---------------------------
    openOrUpdateClimatePopup() {
      const w = (this.climatePopupRef && !this.climatePopupRef.closed)
        ? this.climatePopupRef
        : null;
      if (!w) return;
      try {
        const doc = w.document;
        const curClimate = this.$store?.getters?.climate ?? null;
        const html = buildClimateOutputHtml({
          climate: curClimate,
          climateTurn: this.climateTurn,
          climateVars: this.climateVars,
          climateHistory: this.climateHistory
        });
        doc.open();
        doc.write(html);
        doc.close();
      } catch (e) { /* ignore */ }
    },
    openClimatePopup() {
      const w = window.open('', 'ClimateParameters', 'width=520,height=820,scrollbars=yes');
      if (!w) return;
      this.climatePopupRef = w;
      this.openOrUpdateClimatePopup();
    },
    adjustTurnSpeed(delta) {
      const cur = Number(this.climateTurn.Turn_speed || 1.0);
      let next = cur + Number(delta || 0);
      if (!isFinite(next)) next = 1.0;
      next = Math.max(0.1, Math.min(10, Math.round(next * 10) / 10));
      this.$store?.dispatch?.('updateTurnSpeed', next);
    },
    onClickTurnStart() {
      // まだ初期化されていない場合は、現在のUI時代で初期化（シード未指定ならランダム）
      try {
        const c = this.$store?.getters?.climate;
        const needInit = !c || !c.constants || c.constants.solarFlareUpRate == null;
        if (needInit) {
          const era = (this.local && this.local.era) ? this.local.era : this.storeEra;
          const seed = (this.local && typeof this.local.deterministicSeed !== 'undefined') ? this.local.deterministicSeed : '';
          this.$store?.dispatch?.('initClimateFromGenerate', { era, deterministicSeed: seed });
          // terrain は未生成ならデフォルトのまま（Generate後は onGenerated で更新される）
        }
      } catch (e) { /* ignore */ }
      // 気候ポップアップを開く（なければ）
      if (!this.climatePopupRef || this.climatePopupRef.closed) this.openClimatePopup();
      // ターン進行中は sphere 回転OFF
      try { this.$refs?.sphere?.setRotationEnabled?.(false); } catch (e) { /* ignore */ }
      this.$store?.dispatch?.('setTurnRunning', true);
      this._scheduleNextTurnTick(0);
    },
    onClickTurnStop() {
      this.$store?.dispatch?.('setTurnRunning', false);
      if (this.turnTimer) {
        clearTimeout(this.turnTimer);
        this.turnTimer = null;
      }
      // 停止中は sphere 回転ON
      try { this.$refs?.sphere?.setRotationEnabled?.(true); } catch (e) { /* ignore */ }
    },
    _scheduleNextTurnTick(waitMs) {
      if (!this.$store?.getters?.climateTurn?.isRunning) return;
      if (this.turnTimer) {
        clearTimeout(this.turnTimer);
        this.turnTimer = null;
      }
      const w = Math.max(0, Number(waitMs) || 0);
      this.turnTimer = setTimeout(() => {
        this._runOneTurnTick();
      }, w);
    },
    async _runOneTurnTick() {
      if (!this.$store?.getters?.climateTurn?.isRunning) return;
      const start = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

      // Step8: ターンごとの地形更新（重要）
      // 要件: 「同一ターン内で最新地形の面積率を使って気候を計算」するため、
      // 1) 地形(Revise) → 2) 面積率(store)更新 → 3) 気候を1ターン進める の順序にする。
      try {
        const turn = this.$store?.getters?.climateTurn;
        const nextTurn = (turn && typeof turn.Time_turn === 'number') ? (turn.Time_turn + 1) : 1;
        const shouldUpdatePlane = (nextTurn % 5 === 0);
        const calc = this.$refs?.calc || null;
        if (calc && typeof calc.runReviseHighFrequency === 'function') {
          const revisedPayload = calc.runReviseHighFrequency({ emit: false });
          if (revisedPayload) {
            await this._applyRevisedPayload(revisedPayload, { updatePlane: shouldUpdatePlane });
          }
        }
      } catch (e) { /* ignore */ }

      try {
        await this.$store?.dispatch?.('advanceClimateOneTurn');
      } catch (e) { /* ignore */ }

      // 気候の出力を既存ストアへ統合（描画/地形UIが追従できるように）
      try {
        const v = this.$store?.getters?.climateVars;
        const turn = this.$store?.getters?.climateTurn;
        const calc = this.$refs?.calc || null;
        if (v && typeof v.averageTemperature === 'number') {
          this.$store?.dispatch?.('updateAverageTemperature', v.averageTemperature);
          // 氷河行数は平均気温に連動するので、UI側ローカルも更新
          this.updateAverageTemperature(v.averageTemperature);
        }
        if (v && typeof v.f_cloud === 'number') {
          this.$store?.dispatch?.('updateRenderSettings', { f_cloud: v.f_cloud });
        }
        if (v && typeof v.greenIndex === 'number') {
          this.$store?.dispatch?.('updateGeneratorParams', { greenIndex: v.greenIndex });
        }
        // 自動時代遷移が発生した場合はUIにも反映（store era）
        if (turn && turn.era && this.storeEra !== turn.era) {
          this.$store?.dispatch?.('updateEra', turn.era);
        }
        // 120ターンごとに update（中心点保持の再生成）
        try {
          if (turn && typeof turn.Time_turn === 'number' && (turn.Time_turn % 120 === 0)) {
            const calc = this.$refs?.calc || null;
            calc?.runGenerate?.({ preserveCenterCoordinates: true });
          }
        } catch (e) { /* ignore */ }
        // drift は "2000000/Turn_yr" ターンごと（最小1ターン）
        try {
          if (turn && typeof turn.Time_turn === 'number' && typeof turn.Turn_yr === 'number') {
            const interval = Math.max(1, Math.round(2000000 / Math.max(1, turn.Turn_yr)));
            if (interval > 0 && (turn.Time_turn % interval === 0)) {
              calc?.runDrift?.();
            }
          }
        } catch (e) { /* ignore */ }
      } catch (e) { /* ignore */ }

      // ポップアップを更新（開いていれば）
      this.openOrUpdateClimatePopup();

      const end = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      const elapsed = end - start;
      const speedSec = Number(this.$store?.getters?.climateTurn?.Turn_speed || 1.0);
      const targetMs = Math.max(100, speedSec * 1000);
      const waitMs = (elapsed >= targetMs) ? 100 : Math.max(0, targetMs - elapsed);
      this._scheduleNextTurnTick(waitMs);
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

      // Sphere 更新（Generate時はSphereも更新する。Reviseでは呼ばれない設計）
      try {
        const w = (this.planePopupRef && !this.planePopupRef.closed) ? this.planePopupRef : null;
        if (!w) return;
        const doc = w.document;
        const sif = doc.getElementById('sphere-iframe');
        if (!sif) return;
        // If sphere iframe already attached and parent sphere component has initialized, request redraw
        const sphComp = (this.$refs && this.$refs.sphere) ? this.$refs.sphere : null;
        if (sphComp && this._sphereWin) {
          // 雲量など「描画用スナップショット」を Generate/Update/Drift のタイミングでだけ反映
          try {
            if (typeof sphComp.applyCloudSnapshot === 'function') sphComp.applyCloudSnapshot();
          } catch (e) { /* ignore */ }
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

