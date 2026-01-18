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

// 有効数字で3桁表示（例: 1.178 -> 1.18, 0.283514 -> 0.284, 123456 -> 123000）
// NOTE:
// - 丸めで桁上がりする（例: 9.995 -> 10.0）ケースがあるため、丸め後の値で表示桁を再計算する
// - toFixed は小数点桁数が 0..100 の範囲外だと RangeError になるためクランプする
function fmtSig(v, sig = 3) {
  const n = Number(v);
  if (!isFinite(n)) return '-';
  if (n === 0) return '0';
  const sign = n < 0 ? -1 : 1;
  const abs = Math.abs(n);

  const exponent0 = Math.floor(Math.log10(abs));
  const factorExp = exponent0 - (sig - 1);
  const factor = Math.pow(10, factorExp);
  // 極端に小さい値で factor が 0 にアンダーフローするケースを避ける（指数表記は許容）
  if (!isFinite(factor) || factor === 0) return (sign * abs).toPrecision(sig);

  const roundedAbs = Math.round(abs / factor) * factor;
  const rounded = sign * roundedAbs;

  // 丸め後に桁上がりした場合に備え、丸め後の exponent で表示小数点桁を決める
  const abs2 = Math.abs(roundedAbs);
  if (abs2 === 0) return '0';
  const exponent2 = Math.floor(Math.log10(abs2));
  const decimalsRaw = (sig - 1) - exponent2;
  const decimals = Math.max(0, Math.min(100, decimalsRaw));
  return rounded.toFixed(decimals);
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
      <div class="row"><label>solarEvolution:</label><span>${fmtSig(v.solarEvolution, 3)}</span></div>
      <div class="row"><label>greenIndex:</label><span>${fmtSig(v.greenIndex, 3)}</span></div>
      <div class="row"><label>averageTemperature (℃):</label><span>${fmtSig(v.averageTemperature, 3)}</span></div>
      <div class="row"><label>averageTemperature_calc (K):</label><span>${fmtSig(v.averageTemperature_calc, 3)}</span></div>
      <div class="row"><label>averageTemperature_calc (℃):</label><span>${fmtSig((typeof v.averageTemperature_calc === 'number') ? (v.averageTemperature_calc - 273.15) : NaN, 3)}</span></div>
      <div class="row"><label>CO2_abs_total (bar/turn):</label><span>${fmtSig(v.CO2_abs_total, 3)}</span></div>
      <div class="row"><label>CO2_release_total (bar/turn):</label><span>${fmtSig(v.CO2_release_total, 3)}</span></div>
      <div class="row"><label>CO2_abs_rock (bar/turn):</label><span>${fmtSig(v.CO2_abs_rock, 3)}</span></div>
      <div class="row"><label>CO2_abs_plant (bar/turn):</label><span>${fmtSig(v.CO2_abs_plant, 3)}</span></div>
      <div class="row"><label>CO2_abs_ocean (bar/turn):</label><span>${fmtSig(v.CO2_abs_ocean, 3)}</span></div>
      <div class="row"><label>CO2_abs_carbonate (bar/turn):</label><span>${fmtSig(v.CO2_abs_carbonate, 3)}</span></div>
      <div class="row"><label>CO2_release_volcano (bar/turn):</label><span>${fmtSig(v.CO2_release_volcano, 3)}</span></div>
      <div class="row"><label>CO2_release_ocean (bar/turn):</label><span>${fmtSig(v.CO2_release_ocean, 3)}</span></div>
      <div class="row"><label>CO2_release_carbonate (bar/turn):</label><span>${fmtSig(v.CO2_release_carbonate, 3)}</span></div>
      <div class="row"><label>O2_abs (bar/turn):</label><span>${fmtSig((typeof v.O2_abs === 'number') ? v.O2_abs : v.O2_abs_total, 3)}</span></div>
      <div class="row"><label>land_abs_eff:</label><span>${fmtSig(v.land_abs_eff, 3)}</span></div>
      <div class="row"><label>O2_prod (bar/turn):</label><span>${fmtSig((typeof v.O2_prod === 'number') ? v.O2_prod : v.O2_release_total, 3)}</span></div>
      <div class="row"><label>ocean_plantO2_base:</label><span>${fmtNum(v.ocean_plantO2_base, 6)}</span></div>
      <div class="row"><label>land_plantO2:</label><span>${fmtNum(v.land_plantO2, 6)}</span></div>
      <div class="row"><label>fungal_factor:</label><span>${fmtNum(v.fungal_factor, 6)}</span></div>
      <div class="row"><label>Pressure (bar):</label><span>${fmtSig(v.Pressure, 3)}</span></div>
      ${(() => {
      // N2
      const raw = Number(v.f_N2);
      const isPpm = (typeof raw === 'number') && raw <= 0.01;
      const ppm = raw * 1e6;
      const display = isPpm ? ((Math.abs(ppm) < 100) ? String(Math.round(ppm)) : fmtSig(ppm, 3)) : fmtSig(raw, 3);
      const label = 'f_N2 ' + (isPpm ? '(ppm)' : '(bar)') + ':';
      return `<div class="row"><label>${label}</label><span>${display}</span></div>`;
    })()}
      ${(() => {
      // O2
      const raw = Number(v.f_O2);
      const isPpm = (typeof raw === 'number') && raw <= 0.01;
      const ppm = raw * 1e6;
      const display = isPpm ? ((Math.abs(ppm) < 100) ? String(Math.round(ppm)) : fmtSig(ppm, 3)) : fmtSig(raw, 3);
      const label = 'f_O2 ' + (isPpm ? '(ppm)' : '(bar)') + ':';
      return `<div class="row"><label>${label}</label><span>${display}</span></div>`;
    })()}
      ${(() => {
      // CO2
      const raw = Number(v.f_CO2);
      const isPpm = (typeof raw === 'number') && raw <= 0.01;
      const ppm = raw * 1e6;
      const display = isPpm ? ((Math.abs(ppm) < 100) ? String(Math.round(ppm)) : fmtSig(ppm, 3)) : fmtSig(raw, 3);
      const label = 'f_CO2 ' + (isPpm ? '(ppm)' : '(bar)') + ':';
      return `<div class="row"><label>${label}</label><span>${display}</span></div>`;
    })()}
      ${(() => {
      // CH4
      const raw = Number(v.f_CH4);
      const isPpm = (typeof raw === 'number') && raw <= 0.01;
      const ppm = raw * 1e6;
      const display = isPpm ? ((Math.abs(ppm) < 100) ? String(Math.round(ppm)) : fmtSig(ppm, 3)) : fmtSig(raw, 3);
      const label = 'f_CH4 ' + (isPpm ? '(ppm)' : '(bar)') + ':';
      return `<div class="row"><label>${label}</label><span>${display}</span></div>`;
    })()}
      ${(() => {
      // Ar
      const raw = Number(v.f_Ar);
      const isPpm = (typeof raw === 'number') && raw <= 0.01;
      const ppm = raw * 1e6;
      const display = isPpm ? ((Math.abs(ppm) < 100) ? String(Math.round(ppm)) : fmtSig(ppm, 3)) : fmtSig(raw, 3);
      const label = 'f_Ar ' + (isPpm ? '(ppm)' : '(bar)') + ':';
      return `<div class="row"><label>${label}</label><span>${display}</span></div>`;
    })()}
      ${(() => {
      // H2
      const raw = Number(v.f_H2);
      const isPpm = (typeof raw === 'number') && raw <= 0.01;
      const ppm = raw * 1e6;
      const display = isPpm ? ((Math.abs(ppm) < 100) ? String(Math.round(ppm)) : fmtSig(ppm, 3)) : fmtSig(raw, 3);
      const label = 'f_H2 ' + (isPpm ? '(ppm)' : '(bar)') + ':';
      return `<div class="row"><label>${label}</label><span>${display}</span></div>`;
    })()}
      <div class="row"><label>f_cloud:</label><span>${fmtSig(v.f_cloud, 3)}</span></div>
      <div class="row"><label>albedo:</label><span>${fmtSig(v.albedo, 3)}</span></div>
      <div class="row"><label>H2O_eff:</label><span>${fmtNum(v.H2O_eff, 6)}</span> <span class="muted">→地球現在1</span></div>
      <div class="row"><label>T_sat (℃):</label><span>${fmtNum(constants.T_sat, 3)}</span> <span class="muted">→地球型28℃</span></div>
      <div class="row"><label>dT (℃):</label><span>${fmtNum(constants.dT, 3)}</span> <span class="muted">→地球型15℃</span></div>
      <div class="row"><label>H2O_max:</label><span>${fmtNum(constants.H2O_max, 6)}</span> <span class="muted">→地球型1.65</span></div>
      <div class="row"><label>Sol (W/m2):</label><span>${fmtNum(v.Sol, 3)}</span> <span class="muted">(地球現在≈1361)</span></div>
      <div class="row"><label>Radiation_cooling:</label><span>${fmtSig(v.Radiation_cooling, 3)}</span></div>
      <div class="row"><label>solarFlareUpRate:</label><span>${fmtSig(constants.solarFlareUpRate, 3)}</span> <span class="muted">→地球型0.3</span></div>
      <div class="row"><label>argonCapacity:</label><span>${fmtSig(constants.argonCapacity, 3)}</span> <span class="muted">→地球型0.0101</span></div>
      <div class="row"><label>initial_H2 (bar):</label><span>${fmtSig(constants.initial_H2, 3)}</span> <span class="muted">→地球型0.01</span></div>
      <div class="row"><label>initial_CH4:</label><span>${fmtSig(constants.initial_CH4, 3)}</span></div>
    </div>

    
  </body>
</html>`;
}


