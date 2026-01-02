# `src/features/storeSync/`

local ⇄ store 同期（入力値の永続化 / 複数コンポーネント間共有）を担当します。

## 入口

- `localStoreSync.js`
  - `syncStoreFromLocal(vm, { paramDefaults })`
    - local → store（patch生成→dispatch）
  - `syncLocalFromStoreGeneratorParams(vm, generatorParams, { after })`
  - `syncLocalFromStoreRenderSettings(vm, renderSettings)`
  - `withSyncGuard(vm, fn)`
    - `isSyncingLocalFromStore` を立てて循環更新を防ぐ。

## vm 契約（重要）

`localStoreSync.js` 内の `StoreSyncVm` typedef を参照。
最低限:

- `vm.$store`
- `vm.local`
- `vm.isSyncingLocalFromStore`

## どこから呼ばれる？

- `src/components/Parameters_Display.vue`
  - `mounted` と `watch(local/storeGeneratorParams/storeRenderSettings)` で使用。


