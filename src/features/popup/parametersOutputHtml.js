function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[c]));
}

function fmtPct(num, den) {
    if (!den || den <= 0) return '0.00%';
    return (num * 100 / den).toFixed(2) + '%';
}

function buildCentersHtml(centers) {
    const escape = (v) => escapeHtml(v);
    return (centers || []).map((p, i) => `
    <div style="margin-bottom:8px;padding:8px;border:1px solid #ddd;border-radius:4px;">
      <div style="font-weight:bold;margin-bottom:4px;">中心点 ${i + 1}:</div>
      <div>座標 (x, y): (${escape(p.x)}, ${escape(p.y)}) <span style="color:#666">（シード固定）</span></div>
      <div>影響係数: ${escape(p.influenceMultiplier)} <span style="color:#666">（シード固定）</span></div>
      <div>減衰率 kDecay: ${escape(p.kDecayVariation)} <span style="color:#666">（シード固定）</span></div>
      <div>方向角度 (deg): ${Math.round(((p.directionAngle || 0) * 180) / Math.PI) % 360} <span style="color:#666">（シード固定）</span></div>
      <div style="margin-top:6px;font-weight:bold;">[シードで決定される項目]</div>
      <div>高地の個数（シード）: ${escape((p.seededHighlandsCount != null ? p.seededHighlandsCount : 0))}</div>
      <div>高地クラスター（開始セル/サイズ）:</div>
      <ul style="margin:4px 0 6px 16px;">
        ${(Array.isArray(p.seededHighlandClusters) && p.seededHighlandClusters.length > 0)
            ? p.seededHighlandClusters.map(c => `<li>start=(${escape(c.x)}, ${escape(c.y)}), size=${escape(c.size)}</li>`).join('')
            : '<li>(なし)</li>'
        }
      </ul>
      <div>湖の開始セル（シード）:</div>
      <ul style="margin:4px 0 0 16px;">
        ${(Array.isArray(p.seededLakeStarts) && p.seededLakeStarts.length > 0)
            ? p.seededLakeStarts.map(c => `<li>(${escape(c.x)}, ${escape(c.y)})</li>`).join('')
            : '<li>(なし)</li>'
        }
      </ul>
    </div>
  `).join('');
}

/**
 * Parameters Output popup 用のHTMLを生成する（副作用なし）。
 * `Parameters_Display.vue` の buildOutputHtml と互換の出力になるように維持する。
 */
export function buildParametersOutputHtml({
    localParams,
    centerParams,
    stats,
    gridWidth,
    gridHeight,
    landDistanceThresholdAverage,
    topTundraRowsComputed,
    topGlacierRowsDisplayed
}) {
    const params = localParams || {};
    const centers = centerParams || [];
    const pre = (stats && stats.preGlacier) ? stats.preGlacier : null;
    const drift = (stats && stats.driftMetrics) ? stats.driftMetrics : null;
    const typeCounts = (stats && stats.gridTypeCounts) ? stats.gridTypeCounts : null;
    const totalN = typeCounts ? (typeCounts.total || (gridWidth * gridHeight)) : (gridWidth * gridHeight);
    const centersHtml = buildCentersHtml(centers);
    const escape = (v) => escapeHtml(v);

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
      .canvas-wrap{margin-top:12px}
      canvas{border:1px solid #ccc;border-radius:4px;display:block;margin:8px auto}
    </style>
  </head>
  <body>
    <h1>Parameters</h1>
    <div class="row"><label>シード:</label><span>${escape(params.deterministicSeed || '(未指定)')}</span></div>
    <div class="row"><label>陸の中心点の数 y:</label><span>${escape(params.centersY)}</span></div>
    <div class="row"><label>陸の割合 x:</label><span>${escape(params.seaLandRatio)}</span></div>
    <div class="row"><label>中心間の排他距離 (グリッド):</label><span>${escape(params.minCenterDistance)}</span></div>
    <div class="row"><label>浅瀬・深海間距離閾値:</label><span>${escape(params.baseSeaDistanceThreshold)}</span></div>
    <div class="row"><label>greenIndex (GI):</label><span>${escape((params.greenIndex != null ? Number(params.greenIndex).toFixed(2) : '1.00'))}</span></div>
    <div class="row"><label>帯別閾値 自動更新:</label><span>${escape(params.landDistanceThresholdAuto ? 'ON' : 'OFF')}</span></div>
    <div class="row"><label>低地・乾燥地間距離閾値:</label><span>${escape(landDistanceThresholdAverage)}</span></div>
    <div class="row"><label>上端・下端ツンドラ追加グリッド数:</label><span>${escape(params.tundraExtraRows)}</span></div>
    <div class="row"><label>上端・下端ツンドラ総グリッド数:</label><span>${escape(topTundraRowsComputed)}</span></div>
    <div class="row"><label>上端・下端氷河グリッド数:</label><span>${escape(topGlacierRowsDisplayed)}</span></div>
    <div class="row"><label>陸(低地・乾燥地・ツンドラ)の氷河追加グリッド数:</label><span>${escape(params.landGlacierExtraRows)}</span></div>
    <div class="row"><label>高地の氷河追加グリッド数:</label><span>${escape(params.highlandGlacierExtraRows)}</span></div>
    <div class="row"><label>高山の氷河追加グリッド数:</label><span>${escape(params.alpineGlacierExtraRows)}</span></div>
    <div class="row"><label>グリッド幅×高さ:</label><span>${escape(gridWidth)} × ${escape(gridHeight)}</span></div>
    ${pre ? `<div class="row"><label>氷河上書き前 - 陸:</label><span>${escape(pre.landCount)} (${escape((pre.landRatio * 100).toFixed(2))}% )</span></div>
             <div class="row"><label>氷河上書き前 - 海:</label><span>${escape(pre.seaCount)} (${escape((100 - (pre.landRatio * 100)).toFixed(2))}% )</span></div>` : ''
        }
    <div class="row"><label>湖の数（平均）:</label><span>${escape(params.averageLakesPerCenter)}</span></div>
    <div class="row"><label>superPloom_calc:</label><span>${drift ? escape(drift.superPloom_calc) : '-'}</span></div>
    <div class="row"><label>superPloom:</label><span>${drift ? escape(drift.superPloom) : '-'}</span></div>
    <div class="row"><label>フェーズ:</label><span>${drift ? escape(drift.phase) : '-'}</span></div>
    <div class="row"><label>平均距離:</label><span>${drift ? escape(Number(drift.avgDist).toFixed(2)) : '-'}</span></div>

    <div class="section-title">グリッド種類の内訳（合計 ${escape(totalN)}）</div>
    <div class="row"><label>深海:</label><span>${typeCounts ? escape(typeCounts.deepSea) : '-'} (${typeCounts ? fmtPct(typeCounts.deepSea, totalN) : '-'})</span></div>
    <div class="row"><label>浅瀬:</label><span>${typeCounts ? escape(typeCounts.shallowSea) : '-'} (${typeCounts ? fmtPct(typeCounts.shallowSea, totalN) : '-'})</span></div>
    <div class="row"><label>氷河:</label><span>${typeCounts ? escape(typeCounts.glacier) : '-'} (${typeCounts ? fmtPct(typeCounts.glacier, totalN) : '-'})</span></div>
    <div class="row"><label>低地:</label><span>${typeCounts ? escape(typeCounts.lowland) : '-'} (${typeCounts ? fmtPct(typeCounts.lowland, totalN) : '-'})</span></div>
    <div class="row"><label>乾燥地:</label><span>${typeCounts ? escape(typeCounts.desert) : '-'} (${typeCounts ? fmtPct(typeCounts.desert, totalN) : '-'})</span></div>
    <div class="row"><label>高地:</label><span>${typeCounts ? escape(typeCounts.highland) : '-'} (${typeCounts ? fmtPct(typeCounts.highland, totalN) : '-'})</span></div>
    <div class="row"><label>高山:</label><span>${typeCounts ? escape(typeCounts.alpine) : '-'} (${typeCounts ? fmtPct(typeCounts.alpine, totalN) : '-'})</span></div>
    <div class="row"><label>ツンドラ:</label><span>${typeCounts ? escape(typeCounts.tundra) : '-'} (${typeCounts ? fmtPct(typeCounts.tundra, totalN) : '-'})</span></div>
    <div class="row"><label>湖:</label><span>${typeCounts ? escape(typeCounts.lake) : '-'} (${typeCounts ? fmtPct(typeCounts.lake, totalN) : '-'})</span></div>
    <div class="row"><label>都市:</label><span>${typeCounts ? escape(typeCounts.city) : '-'} (${typeCounts ? fmtPct(typeCounts.city, totalN) : '-'})</span></div>
    <div class="row"><label>農地:</label><span>${typeCounts ? escape(typeCounts.cultivated) : '-'} (${typeCounts ? fmtPct(typeCounts.cultivated, totalN) : '-'})</span></div>
    <div class="row"><label>苔類進出地:</label><span>${typeCounts ? escape(typeCounts.bryophyte) : '-'} (${typeCounts ? fmtPct(typeCounts.bryophyte, totalN) : '-'})</span></div>
    <div class="row"><label>汚染地:</label><span>${typeCounts ? escape(typeCounts.polluted) : '-'} (${typeCounts ? fmtPct(typeCounts.polluted, totalN) : '-'})</span></div>
    <div class="row"><label>海棲都市:</label><span>${typeCounts ? escape(typeCounts.seaCity) : '-'} (${typeCounts ? fmtPct(typeCounts.seaCity, totalN) : '-'})</span></div>
    <div class="row"><label>海棲農地:</label><span>${typeCounts ? escape(typeCounts.seaCultivated) : '-'} (${typeCounts ? fmtPct(typeCounts.seaCultivated, totalN) : '-'})</span></div>
    <div class="row"><label>海棲汚染地:</label><span>${typeCounts ? escape(typeCounts.seaPolluted) : '-'} (${typeCounts ? fmtPct(typeCounts.seaPolluted, totalN) : '-'})</span></div>

    <div class="section-title">各中心点のパラメーター:</div>
    ${centersHtml}
  </body>
</html>`;
}


