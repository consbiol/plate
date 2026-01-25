<template>
  <div style="display:none"></div>
</template>

<script>
import { fractalNoise2D as fractalNoise2DUtil } from '../utils/noise.js';
import { buildSpherePopupHtml } from '../features/sphere/spherePopupHtml.js';
import { parseColorToRgb } from '../features/sphere/colorParse.js';
import { getNightConfig, nightAlphaForCol } from '../features/sphere/nightShadow.js';
import { rand2, valueNoiseTile, fbmTile } from '../features/sphere/cloudNoise.js';
import { getCellClassWeight, sampleClassWeightBilinear, sampleClassWeightSmooth } from '../features/sphere/classWeight.js';
import { drawSphereCPU } from '../features/sphere/rendererCpu.js';
import { initSphereWebGL, drawSphereWebGL, updateSphereTexturesWebGL, disposeSphereWebGL } from '../features/sphere/rendererWebgl.js';
import { getGetter, getGetterPath } from '../utils/storeGetters.js';
import { bestEffort } from '../utils/bestEffort.js';
import { TURN_SPHERE_UPDATE_EVERY_TURNS } from '../constants/sim.js';
export default {
  name: 'Sphere_Display',
  // props を廃止し store に完全依存する（必要な設定は store または既定値から取得）
  data() {
    return {
      // 描画に使う雲量は「スナップショット値」を保持し、UI操作（store更新）で即時反映しない。
      // Generate/Update/Drift のタイミングでのみ applyCloudSnapshot() で更新する。
      renderFCloudSnapshot: null,
      renderCloudPeriodSnapshot: null,
      renderPolarCloudBoostSnapshot: null,
      // 外部（ターン進行）からの回転ON/OFF要求を保持
      desiredRotationEnabled: true
    };
  },
  computed: {
    gridWidth() {
      return getGetter(this.$store, 'gridWidth', 200);
    },
    gridHeight() {
      return getGetter(this.$store, 'gridHeight', 100);
    },
    gridData() {
      return getGetter(this.$store, 'gridData', []);
    },
    polarBufferRows() {
      return getGetterPath(this.$store, ['renderSettings', 'polarBufferRows'], 150);
    },
    polarAvgRows() {
      return getGetterPath(this.$store, ['renderSettings', 'polarAvgRows'], 3);
    },
    polarBlendRows() {
      return getGetterPath(this.$store, ['renderSettings', 'polarBlendRows'], 12);
    },
    polarNoiseStrength() {
      return getGetterPath(this.$store, ['renderSettings', 'polarNoiseStrength'], 0.3);
    },
    polarNoiseScale() {
      return getGetterPath(this.$store, ['renderSettings', 'polarNoiseScale'], 0.01);
    },
    landTintColor() {
      return getGetterPath(this.$store, ['renderSettings', 'landTintColor'], null);
    },
    landTintStrength() {
      return getGetterPath(this.$store, ['renderSettings', 'landTintStrength'], 0.35);
    },
    era() {
      return getGetter(this.$store, 'era', null);
    },
    f_cloud() {
      return getGetter(this.$store, 'f_cloud', 0.67);
    },
    cloudPeriod() {
      return getGetterPath(this.$store, ['renderSettings', 'cloudPeriod'], 16);
    },
    polarCloudBoost() {
      return getGetterPath(this.$store, ['renderSettings', 'polarCloudBoost'], 1.0);
    },
    planeGridCellPx() {
      return getGetter(this.$store, 'planeGridCellPx', 3);
    }
  },
  // 破棄時にポップアップ/回転ループを確実に止める（メモリリーク・背景回転防止）
  beforeUnmount() {
    this.cleanupSpherePopup();
  },
  watch: {
    era() {
      // 時代変更時に即時再描画（回転していない場合の反映用）
      this.scheduleWebGLTextureRefreshAndRedraw();
    },
    gridWidth() {
      this.scheduleWebGLTextureRefreshAndRedraw();
    },
    gridHeight() {
      this.scheduleWebGLTextureRefreshAndRedraw();
    },
    gridData() {
      // 参照が差し替わったタイミングでのみ発火（deep watchは重いので避ける）
      // 描画負荷軽減のため、表示更新は TURN_SPHERE_UPDATE_EVERY_TURNS ターンごとに限定する。
      try {
        const turnObj = getGetter(this.$store, 'climateTurn', null);
        const turnNum = (turnObj && typeof turnObj.Time_turn === 'number') ? turnObj.Time_turn : null;
        const every = Math.max(1, Math.floor(Number(TURN_SPHERE_UPDATE_EVERY_TURNS) || 5));
        const shouldUpdate = (turnNum === null) ? true : (turnNum % every === 0);
        if (shouldUpdate) {
          // Sphere の更新間隔と同じタイミングで、雲（f_cloud等）のスナップショットも更新する
          // ※ store の f_cloud は毎ターン更新され得るが、描画へはスナップショットで反映させる設計のため
          this.applyCloudSnapshot();
          this.scheduleWebGLTextureRefreshAndRedraw();
        }
      } catch (e) {
        // 万一取得に失敗したらフォールバックで更新する（安全策）
        this.scheduleWebGLTextureRefreshAndRedraw();
      }
    },
    landTintColor() {
      this.scheduleWebGLTextureRefreshAndRedraw();
    },
    landTintStrength() {
      this.scheduleWebGLTextureRefreshAndRedraw();
    },
    polarBufferRows() {
      this.scheduleWebGLTextureRefreshAndRedraw();
    },
    polarAvgRows() {
      this.scheduleWebGLTextureRefreshAndRedraw();
    },
    polarBlendRows() {
      this.scheduleWebGLTextureRefreshAndRedraw();
    },
    polarNoiseStrength() {
      this.scheduleWebGLTextureRefreshAndRedraw();
    },
    polarNoiseScale() {
      this.scheduleWebGLTextureRefreshAndRedraw();
    },
    // NOTE: f_cloud は store 側を直接見ているが、描画では _renderFCloud を使うためここでは再描画しない。
    // NOTE: cloudPeriod / polarCloudBoost も store 側を直接見ているが、描画ではスナップショットを使うため
    //       ここでは再描画しない（Generate/Update/Drift時に applyCloudSnapshot() で反映）。
  },
  methods: {
    _getFCloudForRender() {
      const v = this.renderFCloudSnapshot;
      if (typeof v === 'number' && isFinite(v)) return v;
      // 初期化前フォールバック（attachToWindow前の安全策）
      return this.f_cloud;
    },
    _getCloudPeriodForRender() {
      const v = this.renderCloudPeriodSnapshot;
      if (typeof v === 'number' && isFinite(v)) return v;
      return this.cloudPeriod;
    },
    _getPolarCloudBoostForRender() {
      const v = this.renderPolarCloudBoostSnapshot;
      if (typeof v === 'number' && isFinite(v)) return v;
      return this.polarCloudBoost;
    },
    // Generate/Update/Drift のタイミングで呼んで、雲量を描画へ反映させる
    applyCloudSnapshot() {
      this.renderFCloudSnapshot = this.f_cloud;
      this.renderCloudPeriodSnapshot = this.cloudPeriod;
      this.renderPolarCloudBoostSnapshot = this.polarCloudBoost;
    },
    refreshWebGLTexturesIfNeeded() {
      if (!this._sphereCanvas) return false;
      if (!this._useWebGL) return false;
      try {
        return updateSphereTexturesWebGL(this);
      } catch (e) {
        // texture更新に失敗してもCPU描画にフォールバックはしない（既存挙動維持）。
        // 次回のrequestRedrawでWebGL描画が継続できるよう、例外は握りつぶす。
        return false;
      }
    },
    /**
     * watcherの連続発火（gridData/設定がまとめて更新されるケース）で
     * テクスチャ再アップロードが多重に走らないよう、rAFで1フレームに1回へ集約する。
     */
    scheduleWebGLTextureRefreshAndRedraw() {
      if (!this._sphereCanvas) return;
      if (!this._useWebGL) {
        this.requestRedraw();
        return;
      }
      if (this._texUpdateScheduled) return;
      this._texUpdateScheduled = true;
      this._texUpdateRafId = requestAnimationFrame(() => {
        this._texUpdateScheduled = false;
        this._texUpdateRafId = null;
        this.refreshWebGLTexturesIfNeeded();
        this.requestRedraw();
      });
    },
    // ---------------------------
    // Sun shadow (night side) overlay helpers
    // ---------------------------
    _getNightConfig(width) {
      return getNightConfig(width);
    },
    _nightAlphaForCol(col, width) {
      return nightAlphaForCol(col, width);
    },
    _isCityCell(cell) {
      // 「cityグリッド」または海棲都市をライト対象とする
      return !!(cell && (cell.city || cell.seaCity));
    },
    _getCityLightRgb() {
      // 宇宙から見た都市の光（明るい黄色）
      return [255, 240, 140];
    },
    // 描画の再実行（WebGL/CPUのどちらでも同じトリガに統一）
    requestRedraw() {
      if (!this._sphereCanvas) return;
      if (this._useWebGL) {
        // context lost中は描画しない（復旧イベントで再描画する）
        if (this._webglContextLost) return;
        this.drawWebGL();
      }
      else this.drawSphere(this._sphereCanvas);
    },
    // popup/iframe 側のHTMLを生成（表示だけ。イベント配線は別メソッドに分離）
    buildSphereHtml() {
      return buildSpherePopupHtml();
    },
    // 互換用（Parameters_Display.vue が iframe srcdoc に使う）
    buildHtml() {
      return this.buildSphereHtml();
    },
    // popup/iframe 内のボタン配線を行う（副作用）
    bindPopupControls(doc) {
      if (!doc) return;
      const rotateBtn = doc.getElementById('rotate-btn');
      if (rotateBtn) {
        rotateBtn.textContent = (this.desiredRotationEnabled ? 'Stop' : 'Rotate');
        rotateBtn.addEventListener('click', () => {
          this.toggleRotate(rotateBtn);
        });
      }
      const fasterBtn = doc.getElementById('faster-btn');
      if (fasterBtn) {
        fasterBtn.addEventListener('click', () => {
          this.adjustSpeed(true);
        });
      }
      const slowerBtn = doc.getElementById('slower-btn');
      if (slowerBtn) {
        slowerBtn.addEventListener('click', () => {
          this.adjustSpeed(false);
        });
      }
      const sunShadowBtn = doc.getElementById('sunshadow-btn');
      if (sunShadowBtn) {
        sunShadowBtn.textContent = `太陽の影: ${this._sunShadowEnabled ? 'ON' : 'OFF'}`;
        sunShadowBtn.addEventListener('click', () => {
          this.toggleSunShadow(sunShadowBtn);
        });
      }
      this.updateSpeedLabel();
    },
    // popup/iframe の window/canvas を受け取り、描画と配線をまとめてセットアップ
    attachToWindow(win, canvas) {
      if (!win || !canvas) return false;
      this._sphereWin = win;
      this._sphereCanvas = canvas;
      // 初期回転速度を 10 grid/s に設定（1 grid/s = 1000 ms, 10 grid/s = 100 ms）
      this._rotationMsPerGrid = 100;
      try {
        this._useWebGL = this.initWebGL(canvas);
      } catch (e) {
        this._useWebGL = false;
      }
      // 初回描画前に、現在の雲量をスナップショットとして取り込む
      this.applyCloudSnapshot();
      // WebGL context lost/restored を監視（GPUリセット等で真っ黒になるのを防ぐ）
      this.bindWebGLContextEvents(canvas);
      this.requestRedraw();
      this.bindPopupControls(win.document);
      // 画面が開いたタイミングで外部要求（desired）を反映
      this.setRotationEnabled(this.desiredRotationEnabled);
      return true;
    },
    // 外部から回転を明示制御する（popupが開いていない場合も「希望値」を保存）
    setRotationEnabled(enabled) {
      this.desiredRotationEnabled = !!enabled;
      // popup/iframe が開いていて canvas がある場合は即反映
      if (this.desiredRotationEnabled) {
        this.startRotationLoop();
        this._isRotating = true;
      } else {
        this.stopRotationLoop();
        this._isRotating = false;
      }
      // ボタン表示も可能なら同期
      bestEffort(() => {
        const doc = this._sphereWin && this._sphereWin.document;
        const btn = doc && doc.getElementById && doc.getElementById('rotate-btn');
        if (btn) btn.textContent = this.desiredRotationEnabled ? 'Stop' : 'Rotate';
      });
    },
    bindWebGLContextEvents(canvas) {
      if (!canvas) return;
      // 既存があれば解除して二重登録を防ぐ
      this.unbindWebGLContextEvents();
      this._webglContextLost = false;
      this._onWebglContextLost = (e) => {
        bestEffort(() => { if (e && typeof e.preventDefault === 'function') e.preventDefault(); });
        this._webglContextLost = true;
        // 描画ループが走っていると例外が出やすいので止める
        this.stopRotationLoop();
      };
      this._onWebglContextRestored = () => {
        this._webglContextLost = false;
        // 復旧時はWebGLを再初期化し、テクスチャ/描画を復元
        try {
          // 念のためJS側参照を破棄してから再init（コンテキストロスト時はdelete不要だが安全）
          bestEffort(() => disposeSphereWebGL(this));
          this._useWebGL = this.initWebGL(canvas);
          if (this._useWebGL) {
            this.refreshWebGLTexturesIfNeeded();
          }
        } catch (e) { this._useWebGL = false; }
        this.requestRedraw();
      };
      canvas.addEventListener('webglcontextlost', this._onWebglContextLost, false);
      canvas.addEventListener('webglcontextrestored', this._onWebglContextRestored, false);
    },
    unbindWebGLContextEvents() {
      const canvas = this._sphereCanvas;
      if (!canvas) return;
      bestEffort(() => {
        if (this._onWebglContextLost) {
          canvas.removeEventListener('webglcontextlost', this._onWebglContextLost, false);
        }
      });
      bestEffort(() => {
        if (this._onWebglContextRestored) {
          canvas.removeEventListener('webglcontextrestored', this._onWebglContextRestored, false);
        }
      });
      this._onWebglContextLost = null;
      this._onWebglContextRestored = null;
      this._webglContextLost = false;
    },
    // 回転ループとその状態をまとめてリセット（open/close/破棄で共通化）
    resetRotationState() {
      // rAF 停止
      this.stopRotationLoop();
      // テクスチャ更新のrAFも停止（多重スケジュール防止）
      if (this._texUpdateRafId) {
        cancelAnimationFrame(this._texUpdateRafId);
        this._texUpdateRafId = null;
      }
      this._texUpdateScheduled = false;
      // 旧実装の interval が残っている場合に備えて停止（互換用）
      if (this._rotationTimer) {
        clearInterval(this._rotationTimer);
        this._rotationTimer = null;
      }
      // 状態初期化
      this._rotationColumns = 0;
      this._rotationMsPerGrid = 100; // 10グリッド/秒
      this._minMsPerGrid = 20; // 最大50 grid/s
      this._maxMsPerGrid = 5000;
      this._lastTimestamp = null;
      this._accumMs = 0;
      this._sunShadowEnabled = false;
    },
    cleanupSpherePopup() {
      this.resetRotationState();
      // WebGL リソースを明示的に破棄（popupのopen/closeを繰り返してもGPUメモリが増えないように）
      try {
        if (this._useWebGL) disposeSphereWebGL(this);
      } catch (e) {
        // ignore
      }
      this._useWebGL = false;
      // context lost/restored listener 解除
      this.unbindWebGLContextEvents();
      // beforeunload の解除（再オープン時の多重登録防止）
      try {
        if (this._sphereWin && this._onSphereBeforeUnload && !this._sphereWin.closed) {
          this._sphereWin.removeEventListener('beforeunload', this._onSphereBeforeUnload);
        }
      } catch (e) {
        // cross-origin にはならない想定だが、念のため握りつぶす
      }
      this._onSphereBeforeUnload = null;
      // canvas/window参照を切って、watcher等からの描画呼び出しを安全にする
      this._sphereCanvas = null;
      this._sphereWin = null;
    },
    // colors utils are imported
    // color string like 'rgb(r,g,b)' or '#RRGGBB' -> [r,g,b]
    parseColorToRgb(s) {
      return parseColorToRgb(s);
    },
    _hashNoise2D(x, y) {
      const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      return s - Math.floor(s);
    },
    _fractalNoise2D(x, y, octaves = 4, persistence = 0.5) {
      // Delegate to shared noise util but preserve previous return range (0..1)
      const v = fractalNoise2DUtil(x, y, octaves, persistence, 1.0);
      // fractalNoise2DUtil returns roughly in [-1,1]; map to [0,1]
      return (v * 0.5) + 0.5;
    },
    // --- Cloud (CPU) tileable noise helpers ---
    _rand2(ix, iy) {
      return rand2(ix, iy);
    },
    _valueNoiseTile(u, v, period) {
      return valueNoiseTile(u, v, period);
    },
    _fbmTile(u, v, basePeriod) {
      return fbmTile(u, v, basePeriod);
    },
    _getCellClassWeight(cell) {
      return getCellClassWeight(cell);
    },
    _sampleClassWeightBilinear(u, v, width, height, gridData) {
      return sampleClassWeightBilinear(u, v, width, height, gridData);
    },
    _sampleClassWeightSmooth(u, v, width, height, gridData, rUV) {
      return sampleClassWeightSmooth(u, v, width, height, gridData, rUV);
    },
    // Initialize WebGL shader/texture. Returns true on success.
    initWebGL(canvas) {
      return initSphereWebGL(this, canvas);
    },
    drawWebGL() {
      return drawSphereWebGL(this);
    },
    toggleRotate(btn) {
      if (this._isRotating) {
        this.stopRotationLoop();
        this._isRotating = false;
        this.desiredRotationEnabled = false;
        if (btn) btn.textContent = 'Rotate';
      } else {
        // rAFベースの回転ループ開始
        this.startRotationLoop();
        this._isRotating = true;
        this.desiredRotationEnabled = true;
        if (btn) btn.textContent = 'Stop';
      }
    },
    toggleSunShadow(btn) {
      this._sunShadowEnabled = !this._sunShadowEnabled;
      if (btn) btn.textContent = `太陽の影: ${this._sunShadowEnabled ? 'ON' : 'OFF'}`;
      this.requestRedraw();
    },
    startRotationLoop() {
      // ensure canvas reference
      const canvas = this._sphereCanvas;
      if (!canvas) return;
      // reset timing state
      this._lastTimestamp = performance.now();
      this._accumMs = 0;
      // cancel existing
      if (this._rafId) {
        cancelAnimationFrame(this._rafId);
        this._rafId = null;
      }
      const loop = (ts) => {
        const msPerGrid = Math.max(this._minMsPerGrid || 20, Math.min(this._maxMsPerGrid || 5000, this._rotationMsPerGrid || 1000));
        const delta = ts - (this._lastTimestamp || ts);
        this._lastTimestamp = ts;
        this._accumMs += delta;
        let advanced = false;
        while (this._accumMs >= msPerGrid) {
          this._accumMs -= msPerGrid;
          const width = this.gridWidth || 1;
          this._rotationColumns = ((this._rotationColumns || 0) + 1) % width;
          advanced = true;
        }
        if (advanced) {
          if (this._useWebGL) {
            this.drawWebGL();
          } else {
            this.drawSphere(canvas);
          }
        }
        this._rafId = requestAnimationFrame(loop);
      };
      this._rafId = requestAnimationFrame(loop);
      this.updateSpeedLabel();
    },
    stopRotationLoop() {
      if (this._rafId) {
        cancelAnimationFrame(this._rafId);
        this._rafId = null;
      }
      this._lastTimestamp = null;
      this._accumMs = 0;
      this._isRotating = false;
    },
    adjustSpeed(faster) {
      const cur = this._rotationMsPerGrid || 1000;
      // 倍率調整（高速化: 半分、低速化: 1.5倍）
      const next = faster ? (cur / 1.5) : (cur * 1.5);
      this._rotationMsPerGrid = Math.max(this._minMsPerGrid || 20, Math.min(this._maxMsPerGrid || 5000, Math.round(next)));
      if (this._isRotating) {
        // リセットされるようにタイムスタンプ更新
        this._lastTimestamp = performance.now();
        this.updateSpeedLabel();
      } else {
        this.updateSpeedLabel();
      }
    },
    updateSpeedLabel() {
      const doc = this._sphereWin && this._sphereWin.document;
      if (!doc) return;
      const el = doc.getElementById('speed-label');
      if (!el) return;
      const ms = Math.max(this._minMsPerGrid || 20, Math.min(this._maxMsPerGrid || 5000, this._rotationMsPerGrid || 1000));
      const gridsPerSec = 1000 / ms;
      el.textContent = `${gridsPerSec.toFixed(2)} grid/s`;
    },
    drawSphere(canvas) {
      return drawSphereCPU(this, canvas);
    }
  }
}
</script>

<style scoped>
</style>


