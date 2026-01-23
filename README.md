## plate

地形（gridData）を生成し、パラメータ表示・統計・球体レンダリング（CPU/WebGL）・ポップアップ表示などを行う Vue 3 + Vuex のプロジェクトです。

## エントリポイント

- `src/main.js`: Vue アプリ起動、`store` を登録
- `src/App.vue`: ルート。`Parameters_Display` を表示し、生成イベントを受け取る

## 主要コンポーネント

- `src/components/Parameters_Display.vue`
  - 生成・統計・UI入力の中心
  - `generated` イベントで `gridData` を含む payload を流す
- `src/components/Grids_Calculation.vue`
  - `gridData` の組み立て（地形生成の本体）
- `src/components/Sphere_Display.vue`
  - 球体描画（CPU/WebGL）と関連するポップアップ制御

## データ（Vuex）

- `src/store/index.js`: store 組み立て
- `src/store/slices/*`: 関心ごとの slice（`world` / `render` / `generator` / `climate` / `ui`）
- `src/store/api.js`: 読み書きの薄いラッパ（UI側はここ経由が基本）
- **方針**: `gridData` のような巨大データは永続化しない（`src/store/persist.js` / `src/store/README.md`）

## features / utils の役割

- `src/features/*`: 目的別のまとまり（sphere/climate/stats/popup/storeSync）
- `src/utils/*`: 純粋関数・共通ロジック
  - `src/utils/colors.js`: 色系の入口（barrel）
  - `src/utils/terrain/*`: 地形生成・後処理
  - `src/utils/climate/*`: 気候モデル・放射計算

## 開発コマンド

```bash
npm run serve
npm run lint
npm run build
```

