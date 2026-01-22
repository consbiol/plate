## `src/types/`

このディレクトリは **JSDoc の `import()` 用に「型の形」を集約**するためのものです。

- **目的**: ランタイム依存を増やさずに、イベントpayloadや統計オブジェクト等の「契約」を1箇所に固定する  
- **前提**: ここにある `*.js` は基本的に **types-only**（実行時に使うロジックは置かない）  
- **使い方**: 呼び出し側では `@typedef {import('../types/index.js').TerrainEventPayload} TerrainEventPayload` のように参照する

### ファイル

- **`index.js`**: 型のエントリポイント（よく使う typedef を再export）
- **`terrain.js`**: Terrainイベント/コマンド/共通payloadの型
- **`stats.js`**: 統計（GridTypeCounts/ParametersStats）の型
- **`terrainCache.js`**: 高頻度revise用のキャッシュ型

