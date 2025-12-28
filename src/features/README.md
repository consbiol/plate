## `src/features/`

このディレクトリは **「UIフレームワークに依存しない、アプリの機能（feature）単位のコード」** を置きます。
Vueコンポーネント（`src/components/*`）から呼ばれても、できるだけ副作用を持たない形に寄せます。

### 目的

- **巨大コンポーネントの分割**: HTML生成・集計などを切り出し、Vue側は「状態とイベント配線」に集中させる
- **テスト/再利用の容易化**: pure関数化し、入力→出力が見える構造にする
- **AI/人間が追いやすい**: 「どこに何があるか」を feature で引けるようにする

### サブディレクトリ

- `popup/`: popup/iframe の `srcdoc` や popup 用HTMLを生成する関数群
- `sphere/`: Sphere（球体ビュー）関連のロジック（CPU/WebGLレンダラ、ノイズ、補助関数など）
- `stats/`: gridData の集計・統計算出などの関数群

### 入口（まずここを読む）

- `popup/README.md`: popup/iframe 向けHTML生成の責務と一覧
- `sphere/README.md`: Sphere（CPU/WebGL）の構成、更新フロー、vm契約


