<template>
  <div class="parameters-display">
    <button @click="onClickGenerate" style="margin-bottom: 12px; margin-left: 8px;">
      Generate (Popup + Render)
    </button>
    <button @click="onClickGenerateSphere" style="margin-bottom: 12px; margin-left: 8px;">
      Generate sphere
    </button>
    <div style="margin-bottom: 8px;">
      <label>陸の中心点の数 y: </label>
      <input type="number" min="1" max="10" v-model.number="local.centersY" @change="emitField('centersY', local.centersY)" />
    </div>
    <div style="margin-bottom: 8px;">
      <label>陸の割合 x: </label>
      <input type="number" min="0.01" max="0.99" step="0.1" v-model.number="local.seaLandRatio" @change="emitField('seaLandRatio', local.seaLandRatio)" />
    </div>
    <div style="margin-bottom: 8px;">
      <label>中心間の排他距離 (グリッド): </label>
      <input type="number" min="1" max="50" step="1" v-model.number="local.minCenterDistance" @change="emitField('minCenterDistance', local.minCenterDistance)" />
    </div>
    <div style="margin-bottom: 8px;">
      <label>浅瀬・深海間の距離閾値 (グリッド): </label>
      <input type="number" min="1" max="20" step="1" v-model.number="local.baseSeaDistanceThreshold" @change="emitField('baseSeaDistanceThreshold', local.baseSeaDistanceThreshold)" />
    </div>
    <div style="margin-bottom: 8px;">
      <label>平均気温 (°C): </label>
      <input type="number" min="-50" max="60" step="2" v-model.number="averageTemperature" />
      <span style="margin-left:8px">{{ Math.round(averageTemperature) }}</span>
    </div>
    <div style="margin-bottom: 8px;">
      <label>低地・乾燥地間の距離閾値 (グリッド): </label>
      <input type="number" min="1" max="30" step="1" v-model.number="local.baseLandDistanceThreshold" @change="emitField('baseLandDistanceThreshold', local.baseLandDistanceThreshold)" />
    </div>
    <details style="margin-bottom:8px;max-width:600px;margin-left:auto;margin-right:auto;">
      <summary style="cursor:pointer;font-weight:bold;margin-bottom:6px;">低地・乾燥地間の距離閾値（帯別）</summary>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;">
        <div style="width:48%;"><label>帯01 (極): </label><input type="number" min="0" max="60" step="1" v-model.number="local.landDistanceThreshold1" @change="emitField('landDistanceThreshold1', local.landDistanceThreshold1)" /></div>
        <div style="width:48%;"><label>帯02: </label><input type="number" min="0" max="60" step="1" v-model.number="local.landDistanceThreshold2" @change="emitField('landDistanceThreshold2', local.landDistanceThreshold2)" /></div>
        <div style="width:48%;"><label>帯03: </label><input type="number" min="0" max="60" step="1" v-model.number="local.landDistanceThreshold3" @change="emitField('landDistanceThreshold3', local.landDistanceThreshold3)" /></div>
        <div style="width:48%;"><label>帯04: </label><input type="number" min="0" max="60" step="1" v-model.number="local.landDistanceThreshold4" @change="emitField('landDistanceThreshold4', local.landDistanceThreshold4)" /></div>
        <div style="width:48%;"><label>帯05: </label><input type="number" min="0" max="60" step="1" v-model.number="local.landDistanceThreshold5" @change="emitField('landDistanceThreshold5', local.landDistanceThreshold5)" /></div>
        <div style="width:48%;"><label>帯06: </label><input type="number" min="0" max="60" step="1" v-model.number="local.landDistanceThreshold6" @change="emitField('landDistanceThreshold6', local.landDistanceThreshold6)" /></div>
        <div style="width:48%;"><label>帯07: </label><input type="number" min="0" max="60" step="1" v-model.number="local.landDistanceThreshold7" @change="emitField('landDistanceThreshold7', local.landDistanceThreshold7)" /></div>
        <div style="width:48%;"><label>帯08: </label><input type="number" min="0" max="60" step="1" v-model.number="local.landDistanceThreshold8" @change="emitField('landDistanceThreshold8', local.landDistanceThreshold8)" /></div>
        <div style="width:48%;"><label>帯09: </label><input type="number" min="0" max="60" step="1" v-model.number="local.landDistanceThreshold9" @change="emitField('landDistanceThreshold9', local.landDistanceThreshold9)" /></div>
        <div style="width:48%;"><label>帯10 (赤道): </label><input type="number" min="0" max="60" step="1" v-model.number="local.landDistanceThreshold10" @change="emitField('landDistanceThreshold10', local.landDistanceThreshold10)" /></div>
      </div>
      <div style="width:100%;margin-top:8px;">
        <label>帯の縦揺らぎ（行数）: </label>
        <input type="number" min="0" max="50" step="1" v-model.number="local.landBandVerticalWobbleRows" @change="emitField('landBandVerticalWobbleRows', local.landBandVerticalWobbleRows)" />
        <span style="margin-left:8px;color:#666">（0で固定）</span>
      </div>
      <div style="width:100%;margin-top:6px;">
        <label>帯揺らぎの X スケール: </label>
        <input type="number" min="0" max="1" step="0.01" v-model.number="local.landBandWobbleXScale" @change="emitField('landBandWobbleXScale', local.landBandWobbleXScale)" />
        <span style="margin-left:8px;color:#666">（ノイズの横スケール）</span>
      </div>
    </details>
    <div style="margin-bottom: 8px;">
      <label>シード: </label>
      <input type="text" v-model="local.deterministicSeed" @change="emitField('deterministicSeed', local.deterministicSeed)" placeholder="任意（空=完全ランダム）" />
    </div>
    <div style="margin-bottom: 8px;">
      <label>雲量: </label>
      <input type="range" min="0" max="1" step="0.1" v-model.number="local.cloudAmount" @change="emitField('cloudAmount', local.cloudAmount)" />
      <span style="margin-left:8px">{{ (local.cloudAmount || 0).toFixed(2) }}</span>
    </div>
    <div style="margin-bottom: 8px;">
      <label>上端・下端氷河グリッド数: </label>
      <span>{{ Math.round(local.topGlacierRows) }}</span>
    </div>
    <div style="margin-bottom: 8px;">
      <label>陸(低地・乾燥地・ツンドラ)の氷河追加グリッド数: </label>
      <input type="number" min="0" max="50" step="1" v-model.number="local.landGlacierExtraRows" @change="emitField('landGlacierExtraRows', local.landGlacierExtraRows)" />
    </div>
    <div style="margin-bottom: 8px;">
      <label>上端・下端ツンドラグリッド追加数: </label>
      <input type="number" min="0" max="50" step="1" v-model.number="local.tundraExtraRows" @change="emitField('tundraExtraRows', local.tundraExtraRows)" />
    </div>
    <div style="margin-bottom: 8px;">
      <label>高地の氷河追加グリッド数: </label>
      <input type="number" min="0" max="50" step="1" v-model.number="local.highlandGlacierExtraRows" @change="emitField('highlandGlacierExtraRows', local.highlandGlacierExtraRows)" />
    </div>
    <div style="margin-bottom: 8px;">
      <label>高山の氷河追加グリッド数: </label>
      <input type="number" min="0" max="50" step="1" v-model.number="local.alpineGlacierExtraRows" @change="emitField('alpineGlacierExtraRows', local.alpineGlacierExtraRows)" />
    </div>
    <div style="margin-bottom: 8px;">
      <label>湖の数（平均）: </label>
      <input type="number" min="0" max="10" step="0.5" v-model.number="local.averageLakesPerCenter" @change="emitField('averageLakesPerCenter', local.averageLakesPerCenter)" />
    </div>
    <div style="margin-bottom: 8px;">
      <label>高地の数（平均）: </label>
      <input type="number" min="0" max="10" step="0.5" v-model.number="local.averageHighlandsPerCenter" @change="emitField('averageHighlandsPerCenter', local.averageHighlandsPerCenter)" />
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
          <input type="number" min="0.1" max="3.0" step="0.1" v-model.number="param.influenceMultiplier" style="width: 100px;" @change="emitCenterParams" />
        </div>
        <div style="margin-bottom: 4px;">
          <label style="display: inline-block; width: 150px;">減衰率 (kDecay): </label>
          <input type="number" min="0.5" max="5.0" step="0.1" v-model.number="param.kDecayVariation" style="width: 100px;" @change="emitCenterParams" />
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
      :gridWidth="gridWidth"
      :gridHeight="gridHeight"
      :seaLandRatio="local.seaLandRatio"
      :centersY="local.centersY"
      :minCenterDistance="local.minCenterDistance"
      :noiseAmp="0.15"
      :kDecay="3.0"
      :baseSeaDistanceThreshold="local.baseSeaDistanceThreshold"
      :baseLandDistanceThreshold="local.baseLandDistanceThreshold"
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
      :landBandWobbleXScale="local.landBandWobbleXScale"
      :averageTemperature="averageTemperature"
      :topTundraRows="topTundraRowsComputed"
      :topGlacierRows="local.topGlacierRows"
      :landGlacierExtraRows="local.landGlacierExtraRows"
      :highlandGlacierExtraRows="local.highlandGlacierExtraRows"
      :alpineGlacierExtraRows="local.alpineGlacierExtraRows"
      :averageLakesPerCenter="local.averageLakesPerCenter"
      :averageHighlandsPerCenter="local.averageHighlandsPerCenter"
      :centerParameters="mutableCenterParams"
      :generateSignal="generateSignal"
        :deterministicSeed="local.deterministicSeed"
      @generated="onGenerated"
    />

    <!-- 非表示の球表示コンポーネント -->
    <Sphere_Display
      ref="sphere"
      :gridWidth="gridWidth"
      :gridHeight="gridHeight"
      :gridData="gridDataLocal"
      :polarBufferRows="75"
      :cloudAmount="local.cloudAmount"
    />
  </div>
</template>

<script>
// このコンポーネントは「パラメータ入力／表示」と「計算トリガ」を担当します。
// - 生成ボタンで非表示の計算子を起動し、結果は親(App)とポップアップへ出力します。
// - 入力欄の値は内部state(local)に保持し、必要に応じて親へemitします。
import Grids_Calculation from './Grids_Calculation.vue';
import Sphere_Display from './Sphere_Display.vue';
export default {
  name: 'Parameters_Display',
  components: { Grids_Calculation, Sphere_Display },
  props: {
    // 陸の中心点の数（デフォルト: 5）: 地形生成の起点となる中心点の個数。多いほど複雑な地形になります。
    centersY: { type: Number, required: false, default: 5 },
    // 陸の割合（デフォルト: 0.2）: 全グリッド中、陸地が占める割合。0.2は20%が陸地、80%が海を意味します。
    seaLandRatio: { type: Number, required: false, default: 0.2 },
    // 中心間の排他距離（デフォルト: 20グリッド）: 各中心点間の最小距離。近すぎると重複した地形になります。
    minCenterDistance: { type: Number, required: false, default: 20 },
    // 浅瀬・深海間の距離閾値（デフォルト: 5グリッド）: 海グリッドが浅瀬か深海かを判定する距離の基準値。大きいほど浅瀬が広がります。
    baseSeaDistanceThreshold: { type: Number, required: false, default: 5 },
    // 低地・乾燥地間の距離閾値（デフォルト: 10グリッド）: 陸グリッドが低地か乾燥地かを判定する距離の基準値。大きいほど低地が広がります。
    baseLandDistanceThreshold: { type: Number, required: false, default: 10 },
    // 低地・乾燥地間の距離閾値（帯ごと、上端/下端から5グリッド単位、帯1..帯10）
    landDistanceThreshold1: { type: Number, required: false, default: 35 },
    landDistanceThreshold2: { type: Number, required: false, default: 35 },
    landDistanceThreshold3: { type: Number, required: false, default: 35 },
    landDistanceThreshold4: { type: Number, required: false, default: 35 },
    landDistanceThreshold5: { type: Number, required: false, default: 25 },
    landDistanceThreshold6: { type: Number, required: false, default: 10 },
    landDistanceThreshold7: { type: Number, required: false, default: 5 },
    landDistanceThreshold8: { type: Number, required: false, default: 10 },
    landDistanceThreshold9: { type: Number, required: false, default: 25 },
    landDistanceThreshold10: { type: Number, required: false, default: 35 },
    // 帯の縦揺らぎ（行数）: 0で無効
    landBandVerticalWobbleRows: { type: Number, required: false, default: 2 },
    // 帯揺らぎの X スケール（ノイズのサンプリング横スケール）
    landBandWobbleXScale: { type: Number, required: false, default: 0.05 },
    // 上端・下端ツンドラグリッド追加数（デフォルト: 7）: 上端・下端氷河グリッド数からの追加グリッド数
    tundraExtraRows: { type: Number, required: false, default: 7 },
    // 上端・下端氷河グリッド数（デフォルト: 5）: 上下端から何グリッド分を氷河に上書きするかの基準値（海/湖は追加なし）。
    topGlacierRows: { type: Number, required: false, default: 5 },
    // 陸(低地・乾燥地・ツンドラ)の氷河追加グリッド数（デフォルト: 5）: 陸地タイプに応じて氷河上書き範囲を追加するグリッド数。
    landGlacierExtraRows: { type: Number, required: false, default: 5 },
    // 高地の氷河追加グリッド数（デフォルト: 15）: 高地タイプに応じて氷河上書き範囲を追加するグリッド数。
    highlandGlacierExtraRows: { type: Number, required: false, default: 15 },
    // 高山の氷河追加グリッド数（デフォルト: 20）: 高山タイプに応じて氷河上書き範囲を追加するグリッド数。
    alpineGlacierExtraRows: { type: Number, required: false, default: 20},
    // 湖の数（平均）（デフォルト: 1）: 各中心点あたりの平均的な湖の個数。ポアソン分布で決定されます。
    averageLakesPerCenter: { type: Number, required: false, default: 2 },
    // 高地の数（平均）（デフォルト: 1）: 各中心点あたりの平均的な高地の個数。ポアソン分布で決定されます。サイズは湖の10倍、形状はメイン方向に沿った帯状で横方向にノイズ性の広がりを持ちます。色は灰色がかった茶色（茶色気味）です。
    averageHighlandsPerCenter: { type: Number, required: false, default: 5 },
    // 中心点のパラメータ配列（デフォルト: 空配列）: 各中心点の影響係数、減衰率、方向角度などの詳細パラメータ。
    centerParameters: { type: Array, required: false, default: () => [] },
    // 親(App)から現在の描画用色配列（+2枠つき）を渡してもらう
      gridData: { type: Array, required: false, default: () => [] },
    // 雲量（0..1）: 被覆度優先で効く
    cloudAmount: { type: Number, required: false, default: 0.4 }
  },
  mounted() {
    // 初期表示時に平均気温から氷河行数を算出（デフォルト 15℃ → 5）
    this.updateAverageTemperature();
  },
  data() {
    return {
      // グリッド幅・高さ（初期値: 200x100）
      gridWidth: 200,
      gridHeight: 100,
      gridDataLocal: [],
      local: {
        centersY: this.centersY,
        seaLandRatio: this.seaLandRatio,
        cloudAmount: this.cloudAmount,
        minCenterDistance: this.minCenterDistance,
        baseSeaDistanceThreshold: this.baseSeaDistanceThreshold,
        baseLandDistanceThreshold: this.baseLandDistanceThreshold,
        tundraExtraRows: this.tundraExtraRows,
        topGlacierRows: this.topGlacierRows,
        landBandVerticalWobbleRows: this.landBandVerticalWobbleRows,
        landBandWobbleXScale: this.landBandWobbleXScale,
        landDistanceThreshold1: this.landDistanceThreshold1,
        landDistanceThreshold2: this.landDistanceThreshold2,
        landDistanceThreshold3: this.landDistanceThreshold3,
        landDistanceThreshold4: this.landDistanceThreshold4,
        landDistanceThreshold5: this.landDistanceThreshold5,
        landDistanceThreshold6: this.landDistanceThreshold6,
        landDistanceThreshold7: this.landDistanceThreshold7,
        landDistanceThreshold8: this.landDistanceThreshold8,
        landDistanceThreshold9: this.landDistanceThreshold9,
        landDistanceThreshold10: this.landDistanceThreshold10,
        landGlacierExtraRows: this.landGlacierExtraRows,
        highlandGlacierExtraRows: this.highlandGlacierExtraRows,
        alpineGlacierExtraRows: this.alpineGlacierExtraRows,
        averageLakesPerCenter: this.averageLakesPerCenter,
        averageHighlandsPerCenter: this.averageHighlandsPerCenter,
        deterministicSeed: ''
      },
      // 中心点のパラメータはdeepコピーして編集可能にする
      mutableCenterParams: JSON.parse(JSON.stringify(this.centerParameters || [])),
      generateSignal: 0,
      popupRef: null,
      stats: null
    };
  },
  watch: {
    centersY(val) { this.local.centersY = val; },
    seaLandRatio(val) { this.local.seaLandRatio = val; },
    cloudAmount(val) { this.local.cloudAmount = val; },
    minCenterDistance(val) { this.local.minCenterDistance = val; },
    baseSeaDistanceThreshold(val) { this.local.baseSeaDistanceThreshold = val; },
    baseLandDistanceThreshold(val) { this.local.baseLandDistanceThreshold = val; },
    tundraExtraRows(val) { this.local.tundraExtraRows = val; },
    landDistanceThreshold1(val) { this.local.landDistanceThreshold1 = val; },
    landDistanceThreshold2(val) { this.local.landDistanceThreshold2 = val; },
    landDistanceThreshold3(val) { this.local.landDistanceThreshold3 = val; },
    landDistanceThreshold4(val) { this.local.landDistanceThreshold4 = val; },
    landDistanceThreshold5(val) { this.local.landDistanceThreshold5 = val; },
    landDistanceThreshold6(val) { this.local.landDistanceThreshold6 = val; },
    landDistanceThreshold7(val) { this.local.landDistanceThreshold7 = val; },
    landDistanceThreshold8(val) { this.local.landDistanceThreshold8 = val; },
    landDistanceThreshold9(val) { this.local.landDistanceThreshold9 = val; },
    landDistanceThreshold10(val) { this.local.landDistanceThreshold10 = val; },
    landBandVerticalWobbleRows(val) { this.local.landBandVerticalWobbleRows = val; },
    landBandWobbleXScale(val) { this.local.landBandWobbleXScale = val; },
    topGlacierRows(val) { this.local.topGlacierRows = val; },
    landGlacierExtraRows(val) { this.local.landGlacierExtraRows = val; },
    highlandGlacierExtraRows(val) { this.local.highlandGlacierExtraRows = val; },
    alpineGlacierExtraRows(val) { this.local.alpineGlacierExtraRows = val; },
    averageLakesPerCenter(val) { this.local.averageLakesPerCenter = val; },
    averageHighlandsPerCenter(val) { this.local.averageHighlandsPerCenter = val; },
    centerParameters: {
      handler(val) {
        this.mutableCenterParams = JSON.parse(JSON.stringify(val || []));
      },
      deep: true
    }
  },
  computed: {
    averageTemperature: {
      get() {
        if (this.$store && this.$store.getters && typeof this.$store.getters.averageTemperature === 'number') {
          return this.$store.getters.averageTemperature;
        }
        return 15;
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
    topTundraRowsComputed() {
      const glacier = (this.local && typeof this.local.topGlacierRows === 'number') ? this.local.topGlacierRows : 0;
      const extra = (this.local && typeof this.local.tundraExtraRows === 'number') ? this.local.tundraExtraRows : 0;
      return Math.max(0, glacier + extra);
    }
  },
  methods: {
    emitField(field, value) {
      this.$emit(`update:${field}`, value);
    },
    // 平均気温から上端・下端氷河グリッド数を線形補間で算出（2℃刻み入力想定）
    updateAverageTemperature(value) {
      const t = (typeof value === 'number') ? value
        : (this.$store && this.$store.getters && typeof this.$store.getters.averageTemperature === 'number'
            ? this.$store.getters.averageTemperature : 15);
      const anchors = [
        { t: -25, val: 45 },
        { t: -15, val: 35 },
        { t: -5,  val: 25 },
        { t: 5,   val: 15 },
        { t: 10,  val: 10 },
        { t: 15,  val: 5  },
        { t: 25,  val: -5 }
      ];
      let v;
      if (t <= anchors[0].t) {
        v = anchors[0].val + (t - anchors[0].t) * (-1); // 10℃あたり+10 → 1℃で+1（温度低下で増える＝傾き-1）
      } else if (t >= anchors[anchors.length - 1].t) {
        const last = anchors[anchors.length - 1];
        v = last.val + (t - last.t) * (-1);
      } else {
        for (let i = 0; i < anchors.length - 1; i++) {
          const a = anchors[i];
          const b = anchors[i + 1];
          if (t >= a.t && t <= b.t) {
            const ratio = (t - a.t) / (b.t - a.t);
            v = a.val + ratio * (b.val - a.val);
            break;
          }
        }
      }
      // 端数は四捨五入。負も許容（海氷河は作成しないよう計算側でガード）
      this.local.topGlacierRows = Math.round(v);
      this.emitField('topGlacierRows', this.local.topGlacierRows);
    },
    emitCenterParams() {
      this.$emit('update:centerParameters', JSON.parse(JSON.stringify(this.mutableCenterParams)));
    },
    updateDirection(idx, degVal) {
      const deg = (degVal % 360 + 360) % 360;
      const rad = (deg * Math.PI) / 180;
      if (this.mutableCenterParams[idx]) {
        this.mutableCenterParams[idx].directionAngle = rad;
        this.emitCenterParams();
      }
    },
    onClickGenerate() {
      this.generateSignal += 1;
    },
    onClickGenerateSphere() {
      if (this.$refs.sphere) {
        this.$refs.sphere.openSpherePopup();
      }
    },
    onGenerated(payload) {
      // 1) パラメータの出力HTMLをポップアップ表示・更新
      this.mutableCenterParams = JSON.parse(JSON.stringify(payload.centerParameters || []));
      if (payload && typeof payload.deterministicSeed !== 'undefined') {
        this.local.deterministicSeed = payload.deterministicSeed || '';
      }
      this.openOrUpdatePopup();
      // 2) 親へ伝搬（AppからTerrain_Displayへ受け渡し用）
      this.$emit('generated', {
        gridData: payload.gridData || null,
        gridWidth: this.gridWidth,
        gridHeight: this.gridHeight,
        centerParameters: payload.centerParameters
      });
      // 2.5) Sphere 用にローカルにも保持
      this.gridDataLocal = Array.isArray(payload.gridData) ? payload.gridData : [];
      // 3) UI表示用の統計を保存
      if (payload.lowlandDistanceToSeaStats) {
        this.stats = {
          lowlandDistanceToSea: payload.lowlandDistanceToSeaStats
        };
      }
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
      const params = this.local;
      const centers = this.mutableCenterParams || [];
      const escape = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
      const centersHtml = centers.map((p, i) => `
        <div style="margin-bottom:8px;padding:8px;border:1px solid #ddd;border-radius:4px;">
          <div style="font-weight:bold;margin-bottom:4px;">中心点 ${i + 1}:</div>
          <div>座標 (x, y): (${escape(p.x)}, ${escape(p.y)}) <span style="color:#666">（シード固定）</span></div>
          <div>影響係数: ${escape(p.influenceMultiplier)} <span style="color:#666">（シード固定）</span></div>
          <div>減衰率 kDecay: ${escape(p.kDecayVariation)} <span style="color:#666">（シード固定）</span></div>
          <div>方向角度 (deg): ${Math.round(((p.directionAngle || 0) * 180) / Math.PI) % 360} <span style="color:#666">（シード固定）</span></div>
          <div style="margin-top:6px;font-weight:bold;">[シードで決定される項目]</div>
          <div>高地の個数（シード）: ${escape((p.seededHighlandsCount != null ? p.seededHighlandsCount : 0))}</div>
          <div>高地クラスター（開始セル/サイズ）:</div>
          <ul style="margin:4px 0 6px 16px;">
            ${
              (Array.isArray(p.seededHighlandClusters) && p.seededHighlandClusters.length > 0)
                ? p.seededHighlandClusters.map(c => `<li>start=(${escape(c.x)}, ${escape(c.y)}), size=${escape(c.size)}</li>`).join('')
                : '<li>(なし)</li>'
            }
          </ul>
          <div>湖の開始セル（シード）:</div>
          <ul style="margin:4px 0 0 16px;">
            ${
              (Array.isArray(p.seededLakeStarts) && p.seededLakeStarts.length > 0)
                ? p.seededLakeStarts.map(c => `<li>(${escape(c.x)}, ${escape(c.y)})</li>`).join('')
                : '<li>(なし)</li>'
            }
          </ul>
        </div>
      `).join('');
      return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Parameters Output</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body{font-family:system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;line-height:1.5;padding:16px}
      h1{font-size:18px;margin:0 0 12px}
      .row{margin-bottom:6px}
      label{display:inline-block;min-width:220px;color:#333}
      .section-title{font-weight:bold;margin-top:16px;margin-bottom:8px}
    </style>
  </head>
  <body>
    <h1>Parameters</h1>
        <div class="row"><label>シード:</label><span>${escape(params.deterministicSeed || '(未指定)')}</span></div>
    <div class="row"><label>陸の中心点の数 y:</label><span>${escape(params.centersY)}</span></div>
    <div class="row"><label>陸の割合 x:</label><span>${escape(params.seaLandRatio)}</span></div>
    <div class="row"><label>中心間の排他距離 (グリッド):</label><span>${escape(params.minCenterDistance)}</span></div>
    <div class="row"><label>浅瀬・深海間距離閾値:</label><span>${escape(params.baseSeaDistanceThreshold)}</span></div>
    <div class="row"><label>低地・乾燥地間距離閾値:</label><span>${escape(params.baseLandDistanceThreshold)}</span></div>
    <div class="row"><label>上端・下端ツンドラ追加グリッド数:</label><span>${escape(params.tundraExtraRows)}</span></div>
    <div class="row"><label>上端・下端ツンドラ総グリッド数:</label><span>${escape(this.topTundraRowsComputed)}</span></div>
    <div class="row"><label>上端・下端氷河グリッド数:</label><span>${escape(params.topGlacierRows)}</span></div>
    <div class="row"><label>陸(低地・乾燥地・ツンドラ)の氷河追加グリッド数:</label><span>${escape(params.landGlacierExtraRows)}</span></div>
    <div class="row"><label>高地の氷河追加グリッド数:</label><span>${escape(params.highlandGlacierExtraRows)}</span></div>
    <div class="row"><label>高山の氷河追加グリッド数:</label><span>${escape(params.alpineGlacierExtraRows)}</span></div>
    <div class="row"><label>グリッド幅×高さ:</label><span>${escape(this.gridWidth)} × ${escape(this.gridHeight)}</span></div>
    <div class="row"><label>湖の数（平均）:</label><span>${escape(params.averageLakesPerCenter)}</span></div>
    <div class="section-title">各中心点のパラメーター:</div>
    ${centersHtml}
  </body>
</html>`;
    }
  }
}
</script>

<style scoped>
</style>

