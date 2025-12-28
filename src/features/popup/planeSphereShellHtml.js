/**
 * Plane & Sphere 用の popup の「外枠」HTML（iframe2枚のみ）。
 * iframe の中身は親コンポーネントが srcdoc で注入する。
 */
export function buildPlaneSphereShellHtml() {
    return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Plane & Sphere View</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html,body{height:100%;margin:0}
      .wrap{display:flex;gap:8px;height:100vh;padding:8px;box-sizing:border-box;background:#000;color:#fff}
      iframe{flex:1;border:1px solid #444;border-radius:6px;background:#000}
    </style>
  </head>
  <body>
    <div class="wrap">
      <iframe id="plane-iframe" title="Plane Map"></iframe>
      <iframe id="sphere-iframe" title="Sphere View"></iframe>
    </div>
  </body>
</html>`;
}


