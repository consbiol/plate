# `src/features/climate/`

terrain（地形）更新後に **climate（気候モデル）へ反映する処理**をまとめます。

## 入口

- `updateAfterTerrain.js`
  - `updateClimateTerrainFractionsFromStats(store, { gridTypeCounts, preGlacierStats, gridWidth, gridHeight, era })`
    - 地形面積率（gridTypeCounts 等）を store の気候モデルへ反映。
  - `recomputeAndPatchRadiativeEquilibrium(store)`
    - Generate直後などに放射平衡温度を再計算し、`patchClimate` で `vars.averageTemperature_calc` を更新。

## どこから呼ばれる？

- `src/components/Parameters_Display.vue`
  - `onGenerated()` / `_applyRevisedPayload()` から呼ばれる。

## 設計メモ

- 気候更新は **副作用（store更新）**を伴うため、Vueコンポーネント内に散らすより feature に寄せる。
- 例外は握りつぶし（safe）で、UIを止めない方針。


