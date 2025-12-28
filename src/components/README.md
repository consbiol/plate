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

### `Sphere_Display.vue`（球体ビュー）の構成メモ

- **目的**: popup/iframe 内の `canvas` を描画するだけに寄せ、重いロジックは `src/features/sphere/` に集約

- **CPUレンダラ**
  - 実体: `src/features/sphere/rendererCpu.js`
  - 呼び出し側: `Sphere_Display.vue` → `drawSphereCPU(this, canvas)`

- **WebGLレンダラ**
  - 互換エントリ: `src/features/sphere/rendererWebgl.js`（re-export ハブ）
  - 実体:
    - `src/features/sphere/webgl/shaders.js`: shaderソース
    - `src/features/sphere/webgl/init.js`: program/uniform 初期化 + 初回テクスチャ作成
    - `src/features/sphere/webgl/draw.js`: 毎フレームのuniform更新 + draw
    - `src/features/sphere/webgl/textures.js`: mapTex/classTex の作成・更新（WebGL upload）
    - `src/features/sphere/webgl/pixelBuilders.js`: テクスチャ用のピクセル生成（純粋ロジック寄り）
    - `src/features/sphere/webgl/updateTextures.js`: vm（Vue）から呼べる更新ユーティリティ（uniform更新も含む）
    - `src/features/sphere/webgl/dispose.js`: WebGLリソースの明示破棄

- **テクスチャ更新（重要）**
  - `gridData` / `gridWidth` / `gridHeight` / `era` / `landTint*` / 極設定（polar*）が変わったら
    `updateSphereTexturesWebGL(vm)` で **mapTex/classTex を再アップロード**し、関連uniformも更新する
  - `Sphere_Display.vue` では watcher の連続発火を rAF で「1フレーム1回」に集約している

- **破棄/再オープン**
  - popup を閉じるときは `cleanupSpherePopup()` が走り、WebGL利用時は `disposeSphereWebGL(this)` でGPUリソースを解放する

- **WebGL context lost**
  - `webglcontextlost` / `webglcontextrestored` を監視し、復旧時に再init→再描画する


