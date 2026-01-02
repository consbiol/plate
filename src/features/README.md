## `src/features/`

このディレクトリは **「UIフレームワークに依存しない、アプリの機能（feature）単位のコード」** を置きます。
Vueコンポーネント（`src/components/*`）から呼ばれても、できるだけ副作用を持たない形に寄せます。

### 目的

- **巨大コンポーネントの分割**: HTML生成・集計などを切り出し、Vue側は「状態とイベント配線」に集中させる
- **テスト/再利用の容易化**: pure関数化し、入力→出力が見える構造にする
- **AI/人間が追いやすい**: 「どこに何があるか」を feature で引けるようにする

### サブディレクトリ

- `popup/`: popup/iframe の `srcdoc` や popup 用HTML・controller
- `sphere/`: Sphere（球体ビュー）関連のロジック（CPU/WebGLレンダラ、ノイズ、補助関数など）
- `stats/`: gridData の集計・統計算出、Parameters_Display の stats 組み立て
- `climate/`: terrain→climate 反映など、気候モデル更新のユーティリティ
- `storeSync/`: local ⇄ store 同期のユーティリティ（循環防止ガード含む）

### 入口（まずここを読む）

- `popup/README.md`: popup/iframe 向けHTML生成の責務と一覧
- `sphere/README.md`: Sphere（CPU/WebGL）の構成、更新フロー、vm契約
- `stats/README.md`: stats の型と、どこで更新されるか
- `climate/README.md`: 地形更新後の気候反映フロー
- `storeSync/README.md`: local⇄store 同期の契約（vm shape）

### 全体データフロー（最短で追う）

1. **UI操作**（`Parameters_Display.vue` / 子コンポーネント）
2. **地形計算**（`Grids_Calculation.vue`）
   - emits: `generated` / `revised` / `drifted` (`TerrainEventPayload`)
3. **受け側**（`Parameters_Display.vue`）
   - stats更新: `features/stats/parametersStats.js`
   - popup更新: `features/popup/*Controller.js` + `*Html.js`
   - climate更新: `features/climate/updateAfterTerrain.js`
4. **store**（`store/api.js` → `store/read.js` / `store/write.js`）


