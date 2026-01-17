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

export function buildClimateOutputHtml({ climateTurn, climateVars, climate } = {}) {
  const t = climateTurn || {};
  const v = climateVars || {};
  const c = climate || {};
  const constants = c.constants || {};


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
      <div class="row"><label>averageTemperature (℃):</label><span>${fmtNum(v.averageTemperature, 4)}</span></div>
      <div class="row"><label>averageTemperature_calc (K):</label><span>${fmtNum(v.averageTemperature_calc, 3)}</span></div>
      <div class="row"><label>averageTemperature_calc (℃):</label><span>${fmtNum((typeof v.averageTemperature_calc === 'number') ? (v.averageTemperature_calc - 273.15) : NaN, 3)}</span></div>
      <div class="row"><label>CO2_abs_total (bar/turn):</label><span>${fmtNum(v.CO2_abs_total, 10)}</span></div>
      <div class="row"><label>CO2_release_total (bar/turn):</label><span>${fmtNum(v.CO2_release_total, 10)}</span></div>
      <div class="row"><label>CO2_abs_rock (bar/turn):</label><span>${fmtNum(v.CO2_abs_rock, 10)}</span></div>
      <div class="row"><label>f_weather:</label><span>${fmtNum(v.f_weather, 6)}</span></div>
      <div class="row"><label>CO2_abs_plant (bar/turn):</label><span>${fmtNum(v.CO2_abs_plant, 10)}</span></div>
      <div class="row"><label>CO2_release_volcano (bar/turn):</label><span>${fmtNum(v.CO2_release_volcano, 10)}</span></div>
      <div class="row"><label>O2_abs (bar/turn):</label><span>${fmtNum((typeof v.O2_abs === 'number') ? v.O2_abs : v.O2_abs_total, 10)}</span></div>
      <div class="row"><label>land_abs_eff:</label><span>${fmtNum(v.land_abs_eff, 6)}</span></div>
      <div class="row"><label>O2_prod (bar/turn):</label><span>${fmtNum((typeof v.O2_prod === 'number') ? v.O2_prod : v.O2_release_total, 10)}</span></div>
      <div class="row"><label>ocean_plantO2_base:</label><span>${fmtNum(v.ocean_plantO2_base, 6)}</span></div>
      <div class="row"><label>land_plantO2:</label><span>${fmtNum(v.land_plantO2, 6)}</span></div>
      <div class="row"><label>fungal_factor:</label><span>${fmtNum(v.fungal_factor, 6)}</span></div>
      <div class="row"><label>Pressure (bar):</label><span>${fmtNum(v.Pressure, 6)}</span></div>
      ${(() => {
      // N2
      const raw = Number(v.f_N2);
      const isPpm = (typeof raw === 'number') && raw <= 0.001;
      const display = isPpm ? fmtNum(raw * 1e6, 0) : fmtNum(raw, 6);
      const label = 'f_N2 ' + (isPpm ? '(ppm)' : '(bar)') + ':';
      return `<div class="row"><label>${label}</label><span>${display}</span></div>`;
    })()}
      ${(() => {
      // O2
      const raw = Number(v.f_O2);
      const isPpm = (typeof raw === 'number') && raw <= 0.001;
      const display = isPpm ? fmtNum(raw * 1e6, 0) : fmtNum(raw, 6);
      const label = 'f_O2 ' + (isPpm ? '(ppm)' : '(bar)') + ':';
      return `<div class="row"><label>${label}</label><span>${display}</span></div>`;
    })()}
      ${(() => {
      // CO2
      const raw = Number(v.f_CO2);
      const isPpm = (typeof raw === 'number') && raw <= 0.001;
      const display = isPpm ? fmtNum(raw * 1e6, 0) : fmtNum(raw, 8);
      const label = 'f_CO2 ' + (isPpm ? '(ppm)' : '(bar)') + ':';
      return `<div class="row"><label>${label}</label><span>${display}</span></div>`;
    })()}
      ${(() => {
      // CH4
      const raw = Number(v.f_CH4);
      const isPpm = (typeof raw === 'number') && raw <= 0.001;
      const display = isPpm ? fmtNum(raw * 1e6, 0) : fmtNum(raw, 10);
      const label = 'f_CH4 ' + (isPpm ? '(ppm)' : '(bar)') + ':';
      return `<div class="row"><label>${label}</label><span>${display}</span></div>`;
    })()}
      ${(() => {
      // Ar
      const raw = Number(v.f_Ar);
      const isPpm = (typeof raw === 'number') && raw <= 0.001;
      const display = isPpm ? fmtNum(raw * 1e6, 0) : fmtNum(raw, 6);
      const label = 'f_Ar ' + (isPpm ? '(ppm)' : '(bar)') + ':';
      return `<div class="row"><label>${label}</label><span>${display}</span></div>`;
    })()}
      ${(() => {
      // H2
      const raw = Number(v.f_H2);
      const isPpm = (typeof raw === 'number') && raw <= 0.001;
      const display = isPpm ? fmtNum(raw * 1e6, 0) : fmtNum(raw, 10);
      const label = 'f_H2 ' + (isPpm ? '(ppm)' : '(bar)') + ':';
      return `<div class="row"><label>${label}</label><span>${display}</span></div>`;
    })()}
      <div class="row"><label>f_cloud:</label><span>${fmtNum(v.f_cloud, 6)}</span></div>
      <div class="row"><label>albedo:</label><span>${fmtNum(v.albedo, 6)}</span></div>
      <div class="row"><label>H2O_eff:</label><span>${fmtNum(v.H2O_eff, 6)}</span> <span class="muted">→地球現在1</span></div>
      <div class="row"><label>T_sat (℃):</label><span>${fmtNum(constants.T_sat, 3)}</span> <span class="muted">→地球型28℃</span></div>
      <div class="row"><label>dT (℃):</label><span>${fmtNum(constants.dT, 3)}</span> <span class="muted">→地球型15℃</span></div>
      <div class="row"><label>H2O_max:</label><span>${fmtNum(constants.H2O_max, 6)}</span> <span class="muted">→地球型1.65</span></div>
      <div class="row"><label>Sol (W/m2):</label><span>${fmtNum(v.Sol, 3)}</span> <span class="muted">(地球現在≈1361)</span></div>
      <div class="row"><label>Radiation_cooling:</label><span>${fmtNum(v.Radiation_cooling, 6)}</span></div>
      <div class="row"><label>solarFlareUpRate:</label><span>${fmtNum(constants.solarFlareUpRate, 6)}</span> <span class="muted">→地球型0.3</span></div>
      <div class="row"><label>argonCapacity:</label><span>${fmtNum(constants.argonCapacity, 6)}</span> <span class="muted">→地球型0.0101</span></div>
      <div class="row"><label>initial_H2 (bar):</label><span>${fmtNum(constants.initial_H2, 10)}</span> <span class="muted">→地球型0.01</span></div>
      <div class="row"><label>initial_CH4:</label><span>${fmtNum(constants.initial_CH4, 8)}</span></div>
    </div>

    
  </body>
</html>`;
}


