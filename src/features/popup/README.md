# `src/features/popup/`

popup/iframe の `srcdoc` に流し込む **HTML文字列を生成する feature** を集約します。

Vueコンポーネント側（例: `src/components/Parameters_Display.vue`）は、
ここで生成した HTML を `iframe.srcdoc` にセットするだけに寄せ、UIロジックと分離します。

## 何がある？

- `parametersOutputHtml.js`
  - 生成パラメータの出力ビュー（Parameters Output）用の HTML を生成

- `planeHtml.js`
  - 平面マップ（Plane Map）用の HTML を生成

- `planeSphereShellHtml.js`
  - 平面＋球シェル（Plane / Sphere Shell）用の HTML を生成

## 設計方針

- **入力→出力**が見える pure 関数に寄せる（DOM操作・window依存を持ち込まない）
- popup/iframe 側の **イベント配線**（ボタンのclick等）は、可能なら Vue 側で `postMessage` / `addEventListener` などを介して行う
- HTMLは「最低限のCSS/JS」に留め、アプリ側の状態は Vuex / Vue 側で一元管理する


