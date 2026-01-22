## `src/components/`

Vueコンポーネント置き場です。

### 大まかな役割

- `Parameters_Display.vue`: **入力UI + 計算トリガ + popup/iframe 連携 + 生成結果の親へのemit**
- `Grids_Calculation.vue`: **地形生成の計算専用コンポーネント**（UIは持たない）
- `Sphere_Display.vue`: **球体ビュー（popup/iframe 内 canvas）描画専用**

※平面地図は現在 `Parameters_Display.vue` の iframe（`planeHtml.js`）で描画する構成です。

### 方針

- UI/DOM依存が薄い処理（集計、HTML生成、純粋計算）は `src/features/` へ寄せる
- `utils/terrain/*` は生成アルゴリズムの部品群（できるだけ副作用を局所化）

### 地形生成トリガ（runQueue/runSignal）契約メモ（重要）

- **目的**: `generate/update/revise/drift` の実行要求を「1本の仕組み」に統一し、順序・追跡・安全性を担保する

- **用語**
  - **runQueue**: 実行要求のFIFOキュー（要素型: `TerrainRunCommand`）
  - **runSignal**: キュー処理のトリガ（数値カウンタ。増えるたびに `Grids_Calculation.vue` がキューを処理）
  - **runContext**: `{ runMode, runId }`。payload を自己記述化するために付与される

- **基本フロー**
  - `Parameters_Display.vue` が `runQueue` に `{ mode, options, runContext }` を **enqueue** → `runSignal += 1`
  - `Grids_Calculation.vue` は `runSignal` を監視し、`runQueue` を **先頭から順に処理（FIFO）**
  - 子は処理件数を `run-consumed` で親へ通知し、親が `runQueue.splice(0, n)` で **dequeue**

- **順序保証**
  - runQueue は基本FIFO（投入順に実行）
  - 例外として **`revise` は coalesce**（キュー内に既にあれば「最後の1件」を置換し、中間reviseを抑制）

- **安全弁**
  - **runQueue上限**: 親はキューが一定数を超えたら古い要求を捨て、無限増加を防ぐ
  - **turn中enqueueガード**: `climateTurn.isRunning` 中は原則 enqueue しない（内部の自動update/driftなどは allow する）
  - **busy/idle**: 子は `run-busy` / `run-idle` を emit し、親は状態把握に使える

- **ターン進行中の特殊ケース（直呼びrevise）**
  - 気候ターン進行（turn tick）では「同一ターン内の順序保証」のため、
    `Parameters_Display.vue` が `calc.runReviseHighFrequency({ emit:false, ... })` を **直接呼び出して戻り値を同期反映**する
  - これは「キュー経由にしない」意図的な例外（結果を同一tick内で確実に使うため）

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


