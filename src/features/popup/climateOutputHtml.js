function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[c]));
}

function fmtNum(v, digits = 6) {
    const n = Number(v);
    if (!isFinite(n)) return '-';
    // 大小で表示桁を調整
    const abs = Math.abs(n);
    if (abs >= 1000) return n.toFixed(0);
    if (abs >= 10) return n.toFixed(2);
    if (abs >= 1) return n.toFixed(3);
    return n.toFixed(digits);
}

export function buildClimateOutputHtml({ climateTurn, climateVars, climateHistory } = {}) {
    const t = climateTurn || {};
    const v = climateVars || {};
    const h = climateHistory || {};
    const points = Array.isArray(h.averageTemperatureEvery10) ? h.averageTemperatureEvery10 : [];

    const jsonPoints = escapeHtml(JSON.stringify(points.slice(-300)));

    return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>気候パラメータ</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body{font-family:system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;line-height:1.5;padding:16px}
      h1{font-size:18px;margin:0 0 12px}
      .row{margin-bottom:6px}
      label{display:inline-block;min-width:240px;color:#333}
      .section-title{font-weight:bold;margin-top:16px;margin-bottom:8px}
      .muted{color:#666}
      canvas{border:1px solid #ccc;border-radius:6px;display:block;margin:8px 0;max-width:100%}
      .grid{display:grid;grid-template-columns: 1fr;gap:4px}
    </style>
  </head>
  <body>
    <h1>気候パラメータ</h1>
    <div class="row"><label>Time_turn (turn):</label><span>${escapeHtml(t.Time_turn ?? '-')}</span></div>
    <div class="row"><label>Turn_yr (yr/turn):</label><span>${escapeHtml(t.Turn_yr ?? '-')}</span></div>
    <div class="row"><label>Time_yr (yr):</label><span>${escapeHtml(t.Time_yr ?? '-')}</span></div>
    <div class="row"><label>時代:</label><span>${escapeHtml(t.era ?? '-')}</span></div>
    <div class="row"><label>Turn_speed (sec/turn):</label><span>${escapeHtml(t.Turn_speed ?? '-')}</span></div>
    <div class="row"><label>状態:</label><span>${escapeHtml(t.isRunning ? '進行中' : '停止中')}</span></div>

    <div class="section-title">大気・放射</div>
    <div class="grid">
      <div class="row"><label>solarEvolution:</label><span>${fmtNum(v.solarEvolution, 6)}</span></div>
      <div class="row"><label>greenIndex:</label><span>${fmtNum(v.greenIndex, 4)}</span></div>
      <div class="row"><label>averageTemperature_calc (K):</label><span>${fmtNum(v.averageTemperature_calc, 3)}</span></div>
      <div class="row"><label>averageTemperature_calc (℃):</label><span>${fmtNum((typeof v.averageTemperature_calc === 'number') ? (v.averageTemperature_calc - 273.15) : NaN, 3)}</span></div>
      <div class="row"><label>CO2_abs_total (bar/turn):</label><span>${fmtNum(v.CO2_abs_total, 10)}</span></div>
      <div class="row"><label>CO2_release_total (bar/turn):</label><span>${fmtNum(v.CO2_release_total, 10)}</span></div>
      <div class="row"><label>O2_abs_total (bar/turn):</label><span>${fmtNum(v.O2_abs_total, 10)}</span></div>
      <div class="row"><label>O2_release_total (bar/turn):</label><span>${fmtNum(v.O2_release_total, 10)}</span></div>
      <div class="row"><label>Pressure (bar):</label><span>${fmtNum(v.Pressure, 6)}</span></div>
      <div class="row"><label>f_N2 (bar):</label><span>${fmtNum(v.f_N2, 6)}</span></div>
      <div class="row"><label>f_O2 (bar):</label><span>${fmtNum(v.f_O2, 6)}</span></div>
      <div class="row"><label>f_CO2 (bar):</label><span>${fmtNum(v.f_CO2, 8)}</span></div>
      <div class="row"><label>f_CH4 (bar):</label><span>${fmtNum(v.f_CH4, 10)}</span></div>
      <div class="row"><label>f_Ar (bar):</label><span>${fmtNum(v.f_Ar, 6)}</span></div>
      <div class="row"><label>f_H2 (bar):</label><span>${fmtNum(v.f_H2, 10)}</span></div>
      <div class="row"><label>f_cloud:</label><span>${fmtNum(v.f_cloud, 6)}</span></div>
      <div class="row"><label>albedo:</label><span>${fmtNum(v.albedo, 6)}</span></div>
      <div class="row"><label>H2O_eff:</label><span>${fmtNum(v.H2O_eff, 6)}</span></div>
      <div class="row"><label>Sol (W/m2):</label><span>${fmtNum(v.Sol, 3)}</span> <span class="muted">(地球現在≈1361)</span></div>
      <div class="row"><label>averageTemperature (℃):</label><span>${fmtNum(v.averageTemperature, 4)}</span></div>
    </div>

    <div class="section-title">averageTemperature（10ターンごと）</div>
    <canvas id="tempChart" width="900" height="320"></canvas>
    <div class="muted">表示点数: ${escapeHtml(points.slice(-300).length)}</div>

    <script>
      (function(){
        const points = JSON.parse('${jsonPoints}');
        const canvas = document.getElementById('tempChart');
        if (!canvas || !canvas.getContext) return;
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        ctx.clearRect(0,0,W,H);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0,0,W,H);
        const padL = 60, padR = 20, padT = 20, padB = 40;
        const plotW = W - padL - padR;
        const plotH = H - padT - padB;
        if (!points || points.length < 2) {
          ctx.fillStyle = '#666';
          ctx.font = '14px system-ui, sans-serif';
          ctx.fillText('データが不足しています（10ターン毎に記録）', padL, padT + 20);
          return;
        }
        let minY = Infinity, maxY = -Infinity;
        for (const p of points) {
          const y = Number(p.value);
          if (!isFinite(y)) continue;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
        if (!isFinite(minY) || !isFinite(maxY)) return;
        if (minY === maxY) { minY -= 1; maxY += 1; }

        const x0 = Number(points[0].turn);
        const x1 = Number(points[points.length - 1].turn);
        const spanX = (x1 - x0) || 1;

        const xToPx = (x) => padL + (Number(x) - x0) * plotW / spanX;
        const yToPx = (y) => padT + (maxY - Number(y)) * plotH / (maxY - minY);

        // axes
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padL, padT);
        ctx.lineTo(padL, padT + plotH);
        ctx.lineTo(padL + plotW, padT + plotH);
        ctx.stroke();

        // y ticks
        ctx.fillStyle = '#444';
        ctx.font = '12px system-ui, sans-serif';
        const ticks = 5;
        for (let i=0;i<=ticks;i++){
          const ty = minY + (maxY - minY) * (i / ticks);
          const py = yToPx(ty);
          ctx.strokeStyle = '#eee';
          ctx.beginPath();
          ctx.moveTo(padL, py);
          ctx.lineTo(padL + plotW, py);
          ctx.stroke();
          ctx.fillStyle = '#444';
          ctx.fillText(ty.toFixed(1), 8, py + 4);
        }

        // line
        ctx.strokeStyle = '#0b6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        let started = false;
        for (const p of points) {
          const x = Number(p.turn);
          const y = Number(p.value);
          if (!isFinite(x) || !isFinite(y)) continue;
          const px = xToPx(x);
          const py = yToPx(y);
          if (!started) { ctx.moveTo(px, py); started = true; }
          else ctx.lineTo(px, py);
        }
        ctx.stroke();

        // labels
        ctx.fillStyle = '#333';
        ctx.fillText('turn', padL + plotW/2 - 10, H - 10);
        ctx.save();
        ctx.translate(14, padT + plotH/2 + 10);
        ctx.rotate(-Math.PI/2);
        ctx.fillText('℃', 0, 0);
        ctx.restore();
      })();
    </script>
  </body>
</html>`;
}


