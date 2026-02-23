import { updateGeneratorParams, updateRenderSettings } from '../../store/api.js';
import { bestEffort } from '../../utils/bestEffort.js';
import {
    buildStorePatchesFromLocal,
    applyGeneratorParamsToLocal,
    applyRenderSettingsToLocal
} from '../../utils/storeSync.js';

function withSyncGuard(vm, fn) {
    if (!vm) return;
    vm.isSyncingLocalFromStore = true;
    try { fn?.(); } finally { vm.isSyncingLocalFromStore = false; }
}

export function syncStoreFromLocal(vm, { paramDefaults }) {
    if (!vm || !vm.$store || !vm.local) return;
    const { genPatch, renderPatch } = buildStorePatchesFromLocal(vm.local, paramDefaults);
    if (genPatch && Object.keys(genPatch).length > 0) updateGeneratorParams(vm.$store, genPatch);
    if (renderPatch && Object.keys(renderPatch).length > 0) updateRenderSettings(vm.$store, renderPatch);
}

export function syncLocalFromStoreGeneratorParams(vm, generatorParams, { after } = {}) {
    if (!vm || !vm.local) return;
    if (!generatorParams || typeof generatorParams !== 'object') return;
    withSyncGuard(vm, () => {
        applyGeneratorParamsToLocal(vm.local, generatorParams);
    });
    bestEffort(() => after?.());
}

export function syncLocalFromStoreRenderSettings(vm, renderSettings) {
    if (!vm || !vm.local) return;
    if (!renderSettings || typeof renderSettings !== 'object') return;
    withSyncGuard(vm, () => {
        applyRenderSettingsToLocal(vm.local, renderSettings);
    });
}
