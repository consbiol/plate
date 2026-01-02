# `src/features/stats/`

stats（集計/統計）を担当する feature です。Vue コンポーネントは **stats を直接いじるのではなく**、基本的にここにある関数を通して更新します。

## 入口（よく使う）

- `gridTypeCounts.js`
  - `computeGridTypeCounts({ gridData, gridWidth, gridHeight })`
  - **gridData から種類別カウント**（deepSea/lowland/city…）を作る。

- `parametersStats.js`
  - `buildParametersStatsFromTerrainPayload(prevStats, payload, dims)`
  - `buildParametersStatsWithGridTypeCounts(prevStats, gridData, dims)`
  - `Parameters_Display.vue` が保持する `stats` を **payload から一括更新**する。

## 型（契約）

- `src/types/stats.js`
  - `ParametersStats`
  - `GridTypeCounts`

- `src/types/terrain.js`
  - `TerrainEventPayload`（stats更新の入力元）

## どこから呼ばれる？

- `src/components/Parameters_Display.vue`
  - `onGenerated()` で `buildParametersStatsFromTerrainPayload`
  - `_applyRevisedPayload()` で `buildParametersStatsWithGridTypeCounts`


