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
      body{margin:0;padding:12px;font-family:system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;background:#000;color:#fff}
      h1{margin:0 0 8px;font-size:16px}
      .row{margin:4px 0}
      canvas{display:block;margin:8px auto;border:1px solid #ccc;border-radius:4px;background:#000}
      .controls{display:flex;gap:8px;justify-content:center;align-items:center;margin-top:6px}
      button{padding:6px 10px;border:1px solid #ccc;border-radius:4px;background:#f7f7f7;cursor:pointer}
      button:hover{background:#eee}
    </style>
  </head>
  <body>
    <h1>Sphere (front view)</h1>
    <div class="row">Projection: Mercator → Sphere (front hemisphere)</div>
    <div class="controls">
      <button id="rotate-btn">Rotate</button>
      <button id="faster-btn">Faster</button>
      <button id="slower-btn">Slower</button>
      <button id="sunshadow-btn">太陽の影: OFF</button>
      <span id="speed-label" style="margin-left:6px;color:#666;"></span>
    </div>
    <canvas id="sphere-canvas" width="700" height="700"></canvas>
  </body>
</html>`;
}


