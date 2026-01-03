/**
 * Sphere view popup/iframe の srcdoc 用HTMLを生成する（副作用なし）。
 * イベント配線は Sphere_Display.vue 側で行う。
 */
export function buildSpherePopupHtml() {
  return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Sphere View</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body{margin:0;padding:0;font-family:system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;background:#000;color:#fff}
      h1{margin:0;font-size:14px}
      .row{margin:0}
      /* キャンバスのボーダ/角丸をなくして余白を最小化 */
      canvas{display:block;margin:0 auto;border:none;border-radius:0;background:#000}
      .controls{display:flex;gap:6px;justify-content:center;align-items:center;margin-top:0}
      button{padding:4px 6px;border:1px solid #ccc;border-radius:2px;background:#f7f7f7;cursor:pointer}
      button:hover{background:#eee}

      /* resize中だけ出すスピナー（再初期化はしない） */
      .canvas-wrap{position:relative; width:100%; display:flex; justify-content:center; margin-top:0; padding:0}
      .spinner-overlay{
        position:absolute;
        inset:0;
        display:none;
        align-items:center;
        justify-content:center;
        pointer-events:none;
        background:rgba(0,0,0,0.25);
      }
      .spinner-overlay.is-on{display:flex;}
      .spinner{
        width:26px;height:26px;
        border:3px solid rgba(255,255,255,0.35);
        border-top-color:#fff;
        border-radius:50%;
        animation:spin 0.8s linear infinite;
      }
      @keyframes spin{to{transform:rotate(360deg)}}
      @media (prefers-reduced-motion: reduce){
        .spinner{animation:none;}
      }
    </style>
  </head>
  <body>
    <h1>Sphere (front view)</h1>
    <div class="controls">
      <button id="rotate-btn">Rotate</button>
      <button id="faster-btn">Faster</button>
      <button id="slower-btn">Slower</button>
      <button id="sunshadow-btn">太陽の影: OFF</button>
      <span id="speed-label" style="margin-left:6px;color:#666;"></span>
    </div>
    <div class="canvas-wrap">
      <canvas id="sphere-canvas"></canvas>
      <div id="resize-spinner" class="spinner-overlay" aria-hidden="true">
        <div class="spinner"></div>
      </div>
    </div>
    <script>
      (function() {
        const spinner = () => document.getElementById('resize-spinner');
        let spinnerHideTimer = null;
        function showSpinnerBriefly() {
          try {
            const el = spinner();
            if (!el) return;
            el.classList.add('is-on');
            if (spinnerHideTimer) clearTimeout(spinnerHideTimer);
            // 連続resizeでは最後のイベントから少し待って消す
            spinnerHideTimer = setTimeout(() => {
              try { el.classList.remove('is-on'); } catch (e) { /* ignore */ }
            }, 120);
          } catch (e) { /* ignore */ }
        }
        function resizeCanvasToPopup() {
          try {
            const c = document.getElementById('sphere-canvas');
            if (!c) return;
            // 計算: 両側の余白を考慮して幅を決定
            // 余白を減らす（ウィンドウ端との隙間を最小にする）
            const availW = Math.max(16, document.documentElement.clientWidth);
            const availH = Math.max(16, document.documentElement.clientHeight);
            // ヘッダ/コントロール領域の高さを差し引いて、キャンバスが占有できる領域を厳密に計算する
            const headerEl = document.querySelector('h1');
            const controlsEl = document.querySelector('.controls');
            const headerH = headerEl ? headerEl.getBoundingClientRect().height : 0;
            const controlsH = controlsEl ? controlsEl.getBoundingClientRect().height : 0;
            // ギリギリまで詰める（小さなギャップは1px）
            const gap = 1;
            const availHForCanvas = Math.max(16, availH - headerH - controlsH - gap);
            // 最大キャンバスサイズを制限（ユーザ指定: 320x320）
            const MAX_CANVAS_SIZE = 320;
            const constrainedAvail = Math.min(availW, availHForCanvas, MAX_CANVAS_SIZE);
            const desiredSphereR = Math.floor(constrainedAvail / 2);
            const margin = 0;
            const size = Math.max(16, desiredSphereR * 2 + margin);
            // サイズ設定（CSS とピクセルサイズ）
            c.width = size;
            c.height = size;
            c.style.width = size + 'px';
            c.style.height = size + 'px';
            try {
              c.style.maxWidth = MAX_CANVAS_SIZE + 'px';
              c.style.maxHeight = MAX_CANVAS_SIZE + 'px';
            } catch (e) { /* ignore */ }
            // レンダラが参照できるように固定球半径を dataset に設定
            try { c.dataset.fixedSphereR = String(desiredSphereR); } catch (e) { /* ignore */ }
            // 外部でサイズ変化を監視している可能性があるので resize イベントを発火
            window.dispatchEvent(new Event('resize'));
          } catch (e) { /* ignore */ }
        }
        window.addEventListener('DOMContentLoaded', resizeCanvasToPopup);
        window.addEventListener('resize', () => {
          // サイズ変更中に「描画が追いつくまでの間」だけ見せる軽量スピナー
          showSpinnerBriefly();
          resizeCanvasToPopup();
        });
        // もし iframe が onload で即時呼ぶ場合に備えて少し遅延呼び出しも行う
        setTimeout(resizeCanvasToPopup, 50);
      })();
    </script>
  </body>
</html>`;
}


