## `src/components/`

Vueコンポーネント置き場です。

### 大まかな役割

- `Parameters_Display.vue`: **入力UI + 計算トリガ + popup/iframe 連携 + 生成結果の親へのemit**
- `Grids_Calculation.vue`: **地形生成の計算専用コンポーネント**（UIは持たない）
- `Terrain_Display.vue`: **平面グリッドの描画専用**
- `Sphere_Display.vue`: **球体ビュー（popup/iframe 内 canvas）描画専用**

### 方針

- UI/DOM依存が薄い処理（集計、HTML生成、純粋計算）は `src/features/` へ寄せる
- `utils/terrain/*` は生成アルゴリズムの部品群（できるだけ副作用を局所化）


