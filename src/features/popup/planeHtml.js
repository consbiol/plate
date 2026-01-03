/**
 * 平面地図(Plane) iframe の srcdoc 用HTMLを生成する。
 * - `displayColors` は (gridWidth+2)*(gridHeight+2) の配列（枠込み）を想定。
 * - iframe 内に `window.__updatePlane()` を用意し、親からリロードなし更新ができるようにする。
 *
 * NOTE: 文字列内の `</script>` は HTML パーサを壊しやすいので、互換のため分割して出力する。
 */
export function buildPlaneHtml({ displayColors, cell, displayW, displayH, buildVersion }) {
  const colors = Array.isArray(displayColors) ? displayColors : [];
  const c = Number(cell) || 3;
  const w = Number(displayW) || 1;
  const h = Number(displayH) || 1;
  const v = Number(buildVersion) || 0;

  return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Plane Map</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body{margin:0;padding:0;font-family:system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;background:#000;color:#fff;display:flex;flex-direction:column;height:100vh;box-sizing:border-box;}
      h1{margin:0 0 6px;font-size:16px}
      canvas{border:1px solid #666;border-radius:4px;display:block;margin:0 auto;background:#000}
      .row{margin:2px 0;text-align:center}

      /* update中だけ出すスピナー（再初期化はしない） */
      /* Make canvas container pannable by drag. Hide native scrollbars but keep scrollability.
         Provide a stylish custom grab cursor (SVG data URL) with fallback to native 'grab'. */
      .canvas-wrap{
        position:relative;
        width:100%;
        display:flex;
        justify-content:center;
        align-items:center;
        /* fill remaining vertical space so internal scrolling is constrained to this element */
        flex:1 1 auto;
        overflow:auto;
        -ms-overflow-style:none;
        scrollbar-width:none;
        touch-action:none;
        /* custom stylish cursor: white rounded square with dark grip */
        cursor: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><rect x='4' y='4' width='24' height='24' rx='6' fill='%23ffffff' stroke='%23000000' stroke-width='1.5' opacity='0.95'/><rect x='9' y='11' width='14' height='3' rx='1.5' fill='%23000000' opacity='0.6'/></svg>") 16 16, grab;
      }
      /* hide native scrollbars but keep scrolling capability */
      .canvas-wrap::-webkit-scrollbar{display:none;width:0;height:0}
      .spinner-overlay{
        position:absolute;
        inset:0;
        display:none;
        align-items:center;
        justify-content:center;
        pointer-events:none;
        background:rgba(0,0,0,0.20);
      }
      .spinner-overlay.is-on{display:flex;}
      .spinner{
        width:24px;height:24px;
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
    <h1>Plane Map</h1>
    <div class="row">${w} x ${h} cells, ${c}px each</div>
    <div class="canvas-wrap">
      <canvas id="plane-canvas"></canvas>
      <div id="plane-spinner" class="spinner-overlay" aria-hidden="true">
        <div class="spinner"></div>
      </div>
    </div>
    <script>
      (function(){
        try {
          var cvs = document.getElementById('plane-canvas');
          if (!cvs) return;
          var ctx = cvs.getContext('2d');
          if (!ctx) return;

          // ダブルバッファ（ちらつき防止）
          var back = document.createElement('canvas');
          var bctx = back.getContext('2d');

          function draw(colors, w, h, cell) {
            try {
              w = Math.max(1, w|0);
              h = Math.max(1, h|0);
              cell = Math.max(1, cell|0);
              cvs.width = w * cell;
              cvs.height = h * cell;
              back.width = cvs.width;
              back.height = cvs.height;
              var i = 0;
              for (var y = 0; y < h; y++) {
                for (var x = 0; x < w; x++) {
                  var col = (colors && colors[i]) ? colors[i] : '#000000';
                  i++;
                  bctx.fillStyle = col;
                  bctx.fillRect(x * cell, y * cell, cell, cell);
                }
              }
              ctx.clearRect(0, 0, cvs.width, cvs.height);
              ctx.drawImage(back, 0, 0);
            } catch (e) { /* swallowed draw errors */ }
          }

          // バージョン情報（親が比較して差し替え判断する）
          window.__planeVersion = ${v};
          // update 回数カウンタ（再生成閾値に達したら親が再作成する）
          window.__planeUpdateCount = 0;
          // 内部で持つ一時RAFハンドル
          window.__planeRAF = null;
          window.__pendingPlane = null;
          // spinner (update indicator)
          window.__planeSpinnerTimer = null;
          function _planeSpinnerEl() { return document.getElementById('plane-spinner'); }
          function _showPlaneSpinner() {
            try {
              var el = _planeSpinnerEl();
              if (!el) return;
              el.classList.add('is-on');
              if (window.__planeSpinnerTimer) clearTimeout(window.__planeSpinnerTimer);
              // 連続updateでも最後から少し待って消える
              window.__planeSpinnerTimer = setTimeout(function(){
                try { el.classList.remove('is-on'); } catch(e){}
              }, 250);
            } catch(e) {}
          }

          // cleanup API（親が呼べる）
          window.__cleanupPlane = function() {
            try {
              try { if (window.__planeRAF) { cancelAnimationFrame(window.__planeRAF); window.__planeRAF = null; } } catch(e){}
              try { if (window.__planeTimer) { clearInterval(window.__planeTimer); window.__planeTimer = null; } } catch(e){}
              try { if (window.__planeSpinnerTimer) { clearTimeout(window.__planeSpinnerTimer); window.__planeSpinnerTimer = null; } } catch(e){}
              window.__pendingPlane = null;
              try { if (window.__planeOnResize) window.removeEventListener('resize', window.__planeOnResize); } catch(e){}

              // WebGL resource cleanup (if any)
              try {
                var cvs = document.getElementById('plane-canvas');
                if (cvs) {
                  var gl = cvs.getContext('webgl2') || cvs.getContext('webgl') || cvs.getContext('experimental-webgl');
                  if (gl) {
                    try {
                      if (Array.isArray(window.__planeTextures)) {
                        window.__planeTextures.forEach(function(t){ try { gl.deleteTexture(t); } catch(e){} });
                      }
                      if (Array.isArray(window.__planeBuffers)) {
                        window.__planeBuffers.forEach(function(b){ try { gl.deleteBuffer(b); } catch(e){} });
                      }
                      if (Array.isArray(window.__planePrograms)) {
                        window.__planePrograms.forEach(function(p){ try { gl.deleteProgram(p); } catch(e){} });
                      }
                      if (Array.isArray(window.__planeShaders)) {
                        window.__planeShaders.forEach(function(s){ try { gl.deleteShader(s); } catch(e){} });
                      }
                    } catch(e) {}
                    try {
                      var loseExt = gl.getExtension && (gl.getExtension('WEBGL_lose_context') || gl.getExtension('MOZ_WEBGL_lose_context') || gl.getExtension('WEBKIT_WEBGL_lose_context'));
                      if (loseExt && typeof loseExt.loseContext === 'function') {
                        try { loseExt.loseContext(); } catch(e) {}
                      }
                    } catch(e) {}
                  }
                }
              } catch(e) {}

              try { window.__planeTextures = null; } catch(e){}
              try { window.__planeBuffers = null; } catch(e){}
              try { window.__planePrograms = null; } catch(e){}
              try { window.__planeShaders = null; } catch(e){}
              try { window.__planeOnResize = null; } catch(e){}
            } catch (e) { /* swallowed */ }
          };

          // 親から呼べる更新関数（iframeリロード不要）
          window.__updatePlane = function(colors, w, h, cell, showSpinner) {
            window.__pendingPlane = { colors: colors, w: w, h: h, cell: cell };
            // generate/update/drift のときだけスピナーを出す（reviseでは出さない）
            if (showSpinner === true) _showPlaneSpinner();
            if (window.__planeRAF) return;
            window.__planeRAF = requestAnimationFrame(function(){
              window.__planeRAF = null;
              var p = window.__pendingPlane;
              window.__pendingPlane = null;
              if (!p) return;
              draw(p.colors, p.w, p.h, p.cell);
              window.__planeUpdateCount = (window.__planeUpdateCount || 0) + 1;
            });
          };

          // 初期描画
          window.__updatePlane(${JSON.stringify(colors)}, ${w}, ${h}, ${c}, false);
          // srcdoc 差し替え直後（generate/drift など）に fn が間に合わないケースでも見えるよう、
          // ロード時に短時間だけスピナーを表示（revise は通常 srcdoc 差し替えしない想定）
          try { _showPlaneSpinner(); } catch(e) {}

          // --- Drag-to-scroll support (hide scrollbars, allow panning by pointer drag) ---
          try {
            var wrap = document.querySelector('.canvas-wrap');
            if (wrap) {
              // Ensure scrollable area reflects canvas size
              wrap.style.overflow = 'auto';
              var isDown = false;
              var startX = 0, startY = 0, startScrollLeft = 0, startScrollTop = 0;
              wrap.addEventListener('pointerdown', function(ev){
                // left button only (for mouse); pointer events cover touch too
                if (typeof ev.button !== 'undefined' && ev.button !== 0) return;
                isDown = true;
                try { wrap.setPointerCapture && wrap.setPointerCapture(ev.pointerId); } catch(e){}
                startX = ev.clientX;
                startY = ev.clientY;
                startScrollLeft = wrap.scrollLeft;
                startScrollTop = wrap.scrollTop;
                // show grabbing cursor while dragging (fallback to native grabbing)
                try { wrap.style.cursor = 'grabbing'; } catch(e){}
                ev.preventDefault();
              }, { passive: false });
              // change cursor to 'grab' when pointer enters, revert when leaves
              wrap.addEventListener('pointerenter', function(){ try { wrap.style.cursor = 'grab'; } catch(e){} });
              wrap.addEventListener('pointerleave', function(){ if (!isDown) try { wrap.style.cursor = 'default'; } catch(e){} });
              wrap.addEventListener('pointermove', function(ev){
                if (!isDown) return;
                var dx = ev.clientX - startX;
                var dy = ev.clientY - startY;
                wrap.scrollLeft = startScrollLeft - dx;
                wrap.scrollTop = startScrollTop - dy;
              });
              ['pointerup','pointercancel','pointerleave'].forEach(function(n){
                wrap.addEventListener(n, function(ev){
                  if (!isDown) return;
                  isDown = false;
                  try { wrap.releasePointerCapture && wrap.releasePointerCapture(ev.pointerId); } catch(e){}
                  // restore hover grab cursor if pointer still over element, otherwise default
                  try {
                    var rect = wrap.getBoundingClientRect();
                    if (ev.clientX >= rect.left && ev.clientX <= rect.right && ev.clientY >= rect.top && ev.clientY <= rect.bottom) {
                      wrap.style.cursor = 'grab';
                    } else {
                      wrap.style.cursor = 'default';
                    }
                  } catch(e) { wrap.style.cursor = 'default'; }
                });
              });
            }
          } catch(e) { /* ignore drag init errors */ }
        } catch (e) { /* ignore init errors */ }
      })();
    </scr${''}ipt>
  </body>
</html>`;
}


