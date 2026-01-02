import { updateGeneratorParams, updateRenderSettings } from '../../store/api.js';
import { bestEffort } from '../../utils/bestEffort.js';
import {
    buildStorePatchesFromLocal,
    applyGeneratorParamsToLocal,
    applyRenderSettingsToLocal
} from '../../utils/storeSync.js';

/**
 * Contract note:
 * These helpers operate on a Vue component instance ("vm") but keep the type loose on purpose.
 * The important part is the *shape* we expect vm to provide.
 *
 * @typedef {Object<string, any>} LocalParams
 *
 * @typedef {Object} StoreSyncVm
 * @property {any} $store                      Vuex store instance (required for store writes)
 * @property {LocalParams} local               Local editable params object (required)
 * @property {boolean} isSyncingLocalFromStore Guard flag to prevent store<->local feedback loops (required)
 *
 * @typedef {Object} SyncOptions
 * @property {Object} paramDefaults            Defaults used by patch builder (e.g. PARAM_DEFAULTS)
 */

/**
 * Run `fn` while holding the "store->local sync" guard on the component instance.
 * @param {StoreSyncVm} vm
 * @param {Function} fn
 */
export function withSyncGuard(vm, fn) {
    if (!vm) return;
    vm.isSyncingLocalFromStore = true;
    try { fn?.(); } finally { vm.isSyncingLocalFromStore = false; }
}

/**
 * local -> store: build patches and dispatch them.
 * Intended to be called from a deep watcher on `local`.
 *
 * @param {StoreSyncVm} vm
 * @param {SyncOptions} options
 */
export function syncStoreFromLocal(vm, { paramDefaults }) {
    if (!vm || !vm.$store || !vm.local) return;
    const { genPatch, renderPatch } = buildStorePatchesFromLocal(vm.local, paramDefaults);
    if (genPatch && Object.keys(genPatch).length > 0) updateGeneratorParams(vm.$store, genPatch);
    if (renderPatch && Object.keys(renderPatch).length > 0) updateRenderSettings(vm.$store, renderPatch);
}

/**
 * store(generatorParams) -> local: apply generator params into local.
 *
 * @param {StoreSyncVm} vm
 * @param {Object|null} generatorParams
 * @param {{after?: Function}} [options]
 */
export function syncLocalFromStoreGeneratorParams(vm, generatorParams, { after } = {}) {
    if (!vm || !vm.local) return;
    if (!generatorParams || typeof generatorParams !== 'object') return;
    withSyncGuard(vm, () => {
        applyGeneratorParamsToLocal(vm.local, generatorParams);
    });
    bestEffort(() => after?.());
}

/**
 * store(renderSettings) -> local: apply render settings into local.
 *
 * @param {StoreSyncVm} vm
 * @param {Object|null} renderSettings
 */
export function syncLocalFromStoreRenderSettings(vm, renderSettings) {
    if (!vm || !vm.local) return;
    if (!renderSettings || typeof renderSettings !== 'object') return;
    withSyncGuard(vm, () => {
        applyRenderSettingsToLocal(vm.local, renderSettings);
    });
}


