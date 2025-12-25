# Terrain utilities (`src/utils/terrain/`)

このディレクトリは、地形生成ロジックを **責務ごとの小さなモジュール**に分割して配置しています。  
Vueコンポーネント（主に `src/components/Grids_Calculation.vue`）は「手順のオーケストレーション」を担当し、ここは **純粋関数/薄いヘルパー**中心です。

## 入口（よく使うもの）

- **`features.js`**: 文明要素（都市/耕作/苔類/汚染）＋海棲文明要素を生成する窓口（`generateFeatures()`）
- **`lakes.js`**: 湖の生成（`generateLakes()`）
- **`highlands.js`**: 高地の生成（`generateHighlands()`）
- **`alpines.js`**: 高山の生成（`generateAlpines()`）
- **`glaciers.js`**: 氷河の適用（上端/下端）（`applyGlaciers()`）
- **`tundra.js`**: ツンドラの適用（上端/下端）（`applyTundra()`）

## runGenerate の下支え（オーケストレーター向け）

- **`centers.js`**
  - `sampleLandCenters(vm, rng)`: 中心点サンプリング
  - `computeScoresForCenters(vm, centers, centerParameters)`: スコア計算
  - `computeOwnerCenterIdx(vm, centers)`: 最寄り中心の割当
- **`landmask.js`**
  - `dilateLandMask(...)`: 陸マスク膨張
  - `removeSingleCellIslands(...)`: 単独小島削除
  - `jitterCoastline(...)`: 海岸線ジッター
- **`ratio.js`**: UIの `seaLandRatio` を内部生成比率に滑らかにマップ（`mapSeaLandRatio()`）
- **`noiseGrid.js`**: 見た目ノイズの事前計算（`buildVisualNoiseGrid()`）＋8近傍定義（`getDirections8()`）
- **`classifyColors.js`**: 距離マップ＋ノイズから基本色（海/浅瀬/低地/乾燥地）を分類（`classifyBaseColors()`）
- **`centerCells.js`**: 各中心の陸セル一覧を集計（`buildCenterLandCells()`）
- **`gridData.js`**: `gridData` の組み立て＋中心点マーキング（`buildGridData()` / `markCentersOnGridData()`）
- **`centerParams.js`**: `seededLog` を `centerParameters` に反映（`applySeededLogToCenterParameters()`）
- **`output.js`**
  - `computePreGlacierStats(...)`: 氷河上書き前の陸/海比を算出
  - `buildGeneratedPayload(...)`: emit payload の組み立て
- **`glacierRows.js`**: 平均気温→氷河行数（平滑化の状態は `vm` 側で保持）

## `features/`（文明要素の内部実装）

`features.js` は窓口で、実装詳細は `features/` に分割されています。

- **`features/constants.js`**: 近傍定義（DIRS4/DIRS8）
- **`features/adjacency.js`**: 隣接判定・1グリッド島判定
- **`features/cluster.js`**: クラスタ拡張（BFS）
- **`features/pollution.js`**: 汚染地の重み付き抽選＋拡張
- **`features/probability.js`**: 都市の地域バイアス確率
- **`features/vmRng.js`**: `vm._getDerivedRng` の薄いラッパ
- **`features/math.js`**: clamp など小ユーティリティ

## 関連（別ディレクトリ）

- **`src/utils/pathfinding/distanceMap.js`**: Dijkstra距離マップ（トーラスは呼び出し側でラップ処理）


