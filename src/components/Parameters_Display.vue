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
      <input type="number" min="0.01" max="0.99" step="0.01" v-model.number="local.seaLandRatio" @change="emitField('seaLandRatio', local.seaLandRatio)" />
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
      <label>低地・乾燥地間の距離閾値 (グリッド): </label>
      <input type="number" min="1" max="30" step="1" v-model.number="local.baseLandDistanceThreshold" @change="emitField('baseLandDistanceThreshold', local.baseLandDistanceThreshold)" />
    </div>
    <div style="margin-bottom: 8px;">
      <label>上端・下端ツンドラグリッド数: </label>
      <input type="number" min="0" max="50" step="1" v-model.number="local.topTundraRows" @change="emitField('topTundraRows', local.topTundraRows)" />
    </div>
    <div style="margin-bottom: 8px;">
      <label>上端・下端氷河グリッド数: </label>
      <input type="number" min="0" max="50" step="1" v-model.number="local.topGlacierRows" @change="emitField('topGlacierRows', local.topGlacierRows)" />
    </div>
    <div style="margin-bottom: 8px;">
      <label>陸(低地・乾燥地・ツンドラ)の氷河追加グリッド数: </label>
      <input type="number" min="0" max="50" step="1" v-model.number="local.landGlacierExtraRows" @change="emitField('landGlacierExtraRows', local.landGlacierExtraRows)" />
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
      <input type="number" min="0" max="10" step="0.1" v-model.number="local.averageLakesPerCenter" @change="emitField('averageLakesPerCenter', local.averageLakesPerCenter)" />
    </div>
    <div style="margin-bottom: 8px;">
      <label>高地の数（平均）: </label>
      <input type="number" min="0" max="10" step="0.1" v-model.number="local.averageHighlandsPerCenter" @change="emitField('averageHighlandsPerCenter', local.averageHighlandsPerCenter)" />
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
      :topTundraRows="local.topTundraRows"
      :topGlacierRows="local.topGlacierRows"
      :landGlacierExtraRows="local.landGlacierExtraRows"
      :highlandGlacierExtraRows="local.highlandGlacierExtraRows"
      :alpineGlacierExtraRows="local.alpineGlacierExtraRows"
      :averageLakesPerCenter="local.averageLakesPerCenter"
      :averageHighlandsPerCenter="local.averageHighlandsPerCenter"
      :centerParameters="mutableCenterParams"
      :generateSignal="generateSignal"
      @generated="onGenerated"
    />

    <!-- 非表示の球表示コンポーネント -->
    <Sphere_Display
      ref="sphere"
      :gridWidth="gridWidth"
      :gridHeight="gridHeight"
      :gridData="gridDataLocal"
      :polarBufferRows="75"
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
    // 上端・下端ツンドラグリッド数（デフォルト: 10）: 上下端から何グリッド分をツンドラに上書きするかの基準値。
    topTundraRows: { type: Number, required: false, default: 10 },
    // 上端・下端氷河グリッド数（デフォルト: 3）: 上下端から何グリッド分を氷河に上書きするかの基準値（海/湖は追加なし）。
    topGlacierRows: { type: Number, required: false, default: 3 },
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
      gridData: { type: Array, required: false, default: () => [] }
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
        minCenterDistance: this.minCenterDistance,
        baseSeaDistanceThreshold: this.baseSeaDistanceThreshold,
        baseLandDistanceThreshold: this.baseLandDistanceThreshold,
        topTundraRows: this.topTundraRows,
        topGlacierRows: this.topGlacierRows,
        landGlacierExtraRows: this.landGlacierExtraRows,
        highlandGlacierExtraRows: this.highlandGlacierExtraRows,
        alpineGlacierExtraRows: this.alpineGlacierExtraRows,
        averageLakesPerCenter: this.averageLakesPerCenter,
        averageHighlandsPerCenter: this.averageHighlandsPerCenter
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
    minCenterDistance(val) { this.local.minCenterDistance = val; },
    baseSeaDistanceThreshold(val) { this.local.baseSeaDistanceThreshold = val; },
    baseLandDistanceThreshold(val) { this.local.baseLandDistanceThreshold = val; },
    topTundraRows(val) { this.local.topTundraRows = val; },
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
  methods: {
    emitField(field, value) {
      this.$emit(`update:${field}`, value);
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
      console.log('Parameters_Display onGenerated payload', payload);
      // 1) パラメータの出力HTMLをポップアップ表示・更新
      this.mutableCenterParams = JSON.parse(JSON.stringify(payload.centerParameters || []));
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
          <div>座標 (x, y): (${escape(p.x)}, ${escape(p.y)})</div>
          <div>影響係数: ${escape(p.influenceMultiplier)}</div>
          <div>減衰率 kDecay: ${escape(p.kDecayVariation)}</div>
          <div>方向角度 (deg): ${Math.round(((p.directionAngle || 0) * 180) / Math.PI) % 360}</div>
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
    <div class="row"><label>陸の中心点の数 y:</label><span>${escape(params.centersY)}</span></div>
    <div class="row"><label>陸の割合 x:</label><span>${escape(params.seaLandRatio)}</span></div>
    <div class="row"><label>中心間の排他距離 (グリッド):</label><span>${escape(params.minCenterDistance)}</span></div>
    <div class="row"><label>浅瀬・深海間距離閾値:</label><span>${escape(params.baseSeaDistanceThreshold)}</span></div>
    <div class="row"><label>低地・乾燥地間距離閾値:</label><span>${escape(params.baseLandDistanceThreshold)}</span></div>
    <div class="row"><label>上端・下端ツンドラグリッド数:</label><span>${escape(params.topTundraRows)}</span></div>
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

