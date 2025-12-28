# `src/store/`

Vuex ストアの構成と運用ルールをまとめます。

## 方針（重要）

- **Vuex modules は使わない**
  - 既存の `getters/actions/mutations` 名の互換性を維持するため、**state はフラット**のまま
  - 代わりに **ファイル分割（slice）**で整理する

- **永続化（localStorage）は安全側**
  - UI設定・生成パラメータ・描画設定のみを保存する
  - `gridData` のような巨大データは **保存しない**（容量/性能/破損リスク）

## エントリ

- `index.js`
  - `createUiSlice` / `createGeneratorSlice` / `createRenderSlice` / `createWorldSlice` を合成して `createStore()` する
  - plugin で `safePersistState(state)` を subscribe

- `persist.js`
  - `safeLoadPersistedState()`: localStorage からロード（許可キーだけ返す）
  - `safePersistState(state)`: localStorage へ保存（許可キーだけ保存）

## slice（責務の分割）

> `src/store/slices/*` は「state/getters/mutations/actions のまとまり」です。

- `slices/ui.js`
  - UI表示・操作の設定（例: `era`, `planeGridCellPx`, `averageTemperature`）

- `slices/generator.js`
  - **地形生成に影響する**パラメータ（`generatorParams`）
  - `PARAM_DEFAULTS` をベースにしつつ、許可キーだけ受け付ける（安全なpatch）

- `slices/render.js`
  - **描画にのみ影響する**パラメータ（`renderSettings`）
  - 例: `f_cloud`, `cloudPeriod`, polar系, landTint系

- `slices/world.js`
  - 生成結果（`gridWidth`, `gridHeight`, `gridData`）
  - `gridData` は **永続化しない**（起動時は空）

## 永続化されるもの / されないもの

- **永続化される**
  - `averageTemperature`
  - `planeGridCellPx`
  - `era`
  - `generatorParams`
  - `renderSettings`

- **永続化されない**
  - `gridData`（巨大）
  - ※ `gridWidth/gridHeight` は `world.js` に存在するが、`persist.js` は保存しない設計

## 新しいパラメータを追加する手順（おすすめ）

1. **用途を決める**
   - 生成に影響 → `slices/generator.js`（`generatorParams`）
   - 描画にのみ影響 → `slices/render.js`（`renderSettings`）
   - UI表示・操作 → `slices/ui.js`

2. **slice に追加**
   - デフォルト値
   - patch許可（allowed keys）
   - getter/action（必要なら）

3. **永続化の要否を決める**
   - 永続化するなら `persist.js` の `safeLoadPersistedState` / `safePersistState` にキーを追加
   - 大きい/壊れやすいデータは永続化しない（`gridData` と同じ扱い）


