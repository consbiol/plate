# `src/features/sphere/`

Sphere（球体ビュー）関連の **ロジック集約ディレクトリ**です。`src/components/Sphere_Display.vue` は「popup/iframe 内 canvas の配線＋描画呼び出し」に寄せ、重い処理や純粋ロジックはここへ寄せています。

## 全体像（CPU / WebGL）

- **CPU 描画**
  - 実装: `rendererCpu.js`
  - 特徴: ImageData で直接描画。WebGL が使えない/落ちた場合でも動作しやすい。

- **WebGL 描画**
  - 互換エントリ: `rendererWebgl.js`（re-export ハブ）
  - 実装本体: `webgl/` 配下
  - 特徴: shader で球体投影と各種オーバーレイ（雲/夜側など）を行う。テクスチャ更新やリソース破棄を明示できる。

## データフロー（重要）

1. **`gridData` → 色/分類 → テクスチャ**
   - mapTex: `gridData` を色（displayColors）に変換し、`width×height` の RGBA ピクセルに落とす
   - classTex: cloud weight（R）/ city mask（G）を `width×height` に落とす

2. **描画**
   - CPU: `drawSphereCPU(vm, canvas)`
   - WebGL: `drawSphereWebGL(vm)`（`vm._glTex` / `vm._glClassTex` を参照）

3. **更新**
   - WebGL は初期化時にテクスチャを作るだけだと stale になるため、
     `updateSphereTexturesWebGL(vm)` で **mapTex/classTex を再アップロード**し、関連 uniform も更新する。

## 主要ファイルと責務

### 共通（WebGL/CPUから参照されやすい純粋ロジック）

- `colorParse.js`
  - `parseColorToRgb()`: `'#RRGGBB'` / `rgb(...)` を `[r,g,b]` に。

- `nightShadow.js`
  - `getNightConfig()`, `nightAlphaForCol()`: 夜側の影（太陽影）係数
  - `isCityCell()`: 都市ライト対象セルの判定

- `classWeight.js`
  - `getCellClassWeight()` とサンプリング系: 雲の重み付け（海/陸/砂漠など）

- `cloudNoise.js`
  - タイル可能ノイズ/FBM 等（雲用）

### CPU

- `rendererCpu.js`
  - `drawSphereCPU(vm, canvas)` の本体（CPUレンダラ）

### WebGL

- `rendererWebgl.js`
  - public API の re-export（呼び出し側の import を安定させる）

- `webgl/shaders.js`
  - vertex/fragment shader のソース定義

- `webgl/init.js`
  - WebGL program 構築、uniform ロケーション取得、初回テクスチャ作成
  - `vm._gl*`（program/texture/uniform 等）を保持

- `webgl/draw.js`
  - 毎フレームの uniform 更新（回転オフセット等）と draw

- `webgl/textures.js`
  - `createSphereTextures(gl, vm)`: 初回作成
  - `updateSphereTextures(gl, vm, opts)`: 既存テクスチャへの再アップロード（サイズ変更時は作り直し）

- `webgl/pixelBuilders.js`
  - mapTex/classTex 用のピクセル配列生成（純粋ロジック寄り）

- `webgl/updateTextures.js`
  - Vue 側から呼びやすい `updateSphereTexturesWebGL(vm)`（uniform 更新も含む）

- `webgl/dispose.js`
  - `disposeSphereWebGL(vm)`: texture/program/buffer/shader を明示破棄

## `vm`（Vueコンポーネント）に要求する“契約”

WebGL/CPUともに、実装は互換性優先で `vm` を受け取ります。最低限、以下のプロパティ/関数が必要です（`Sphere_Display.vue` が提供する想定）。

- **データ**
  - `gridWidth`, `gridHeight`, `gridData`
  - `era`
  - `f_cloud`, `cloudPeriod`, `polarCloudBoost`
  - `polarBufferRows`, `polarAvgRows`, `polarBlendRows`, `polarNoiseStrength`, `polarNoiseScale`
  - `landTintColor`, `landTintStrength`
  - `parseColorToRgb()`

- **WebGL内部状態（初期化後に付与される）**
  - `vm._gl`, `vm._glProg`, `vm._glUniforms`
  - `vm._glTex`, `vm._glClassTex`, `vm._glTexWidth`, `vm._glTexHeight`

## 実運用上の注意

- **watcher連打対策**
  - `Sphere_Display.vue` はテクスチャ更新を rAF で「1フレームに1回」へ集約している。

- **popup open/close**
  - close 時は `disposeSphereWebGL()` を呼んで GPU リソースを解放する（リーク回避）。

- **WebGL context lost**
  - `webglcontextlost/restored` を監視し、復旧時に再 init→再描画する。


