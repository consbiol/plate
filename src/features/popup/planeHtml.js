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
      body{margin:0;padding:12px;font-family:system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;background:#000;color:#fff}
      h1{margin:0 0 8px;font-size:16px}
      canvas{border:1px solid #666;border-radius:4px;display:block;margin:8px auto;background:#000}
      .row{margin:4px 0;text-align:center}
    </style>
  </head>
  <body>
    <h1>Plane Map</h1>
    <div class="row">${w} x ${h} cells, ${c}px each</div>
    <canvas id="plane-canvas"></canvas>
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
            } catch (e) { /* ignore draw errors */ }
          }

          // バージョン情報（親が比較して差し替え判断する）
          window.__planeVersion = ${v};
          // update 回数カウンタ（再生成閾値に達したら親が再作成する）
          window.__planeUpdateCount = 0;
          // 内部で持つ一時RAFハンドル
          window.__planeRAF = null;
          window.__pendingPlane = null;

          // cleanup API（親が呼べる）
          window.__cleanupPlane = function() {
            try {
              try { if (window.__planeRAF) { cancelAnimationFrame(window.__planeRAF); window.__planeRAF = null; } } catch(e){}
              try { if (window.__planeTimer) { clearInterval(window.__planeTimer); window.__planeTimer = null; } } catch(e){}
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
            } catch (e) { /* ignore */ }
          };

          // 親から呼べる更新関数（iframeリロード不要）
          window.__updatePlane = function(colors, w, h, cell) {
            window.__pendingPlane = { colors: colors, w: w, h: h, cell: cell };
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
          window.__updatePlane(${JSON.stringify(colors)}, ${w}, ${h}, ${c});
        } catch (e) { /* ignore init errors */ }
      })();
    </scr${''}ipt>
  </body>
</html>`;
}


