// centerParameters への「シード決定情報」の反映

export function applySeededLogToCenterParameters({
  centers,
  centerParameters,
  seededLog
}) {
  // 収集したシード決定情報を centerParameters に埋め込む
  for (let ci = 0; ci < centers.length; ci++) {
    const log = (seededLog && seededLog[ci]) ? seededLog[ci] : {};
    centerParameters[ci] = {
      ...(centerParameters[ci] || {}),
      seededHighlandsCount: log.highlandsCount || 0,
      seededHighlandClusters: Array.isArray(log.highlandClusters) ? log.highlandClusters : [],
      seededLakeStarts: Array.isArray(log.lakeStarts) ? log.lakeStarts : []
    };
  }
}


