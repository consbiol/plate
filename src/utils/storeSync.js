/**
 * store <-> local 同期のヘルパ（Parameters_Display.vue 向け）
 * - 目的: 同期ルール（除外キー、patch分割、差分反映）を1箇所に集約して見通しを良くする
 * - 注意: ここは「挙動不変」を優先し、Vueのリアクティブ更新量を減らすため差分がある時だけ代入する
 */

import { getGeneratorAllowedKeys, RENDER_LOCAL_SYNC_KEYS } from './paramKeys.js';

/**
 * local の値から store に投げる patch を生成する。
 * - generatorParams: PARAM_DEFAULTS 由来のキー（f_cloud除外） + deterministicSeed + minCenterDistance
 * - renderSettings: 現状は f_cloud のみ（数値かつ finite のときだけ）
 */
export function buildStorePatchesFromLocal(local, paramDefaults) {
    const safeLocal = local && typeof local === 'object' ? local : {};

    // f_cloud は renderSettings に移管（generatorParams からは除外）
    const generatorAllowed = new Set(getGeneratorAllowedKeys(paramDefaults));
    const renderAllowed = new Set(RENDER_LOCAL_SYNC_KEYS);

    const genPatch = {};
    const renderPatch = {};

    for (const k of Object.keys(safeLocal)) {
        if (generatorAllowed.has(k)) genPatch[k] = safeLocal[k];
        if (renderAllowed.has(k)) {
            const v = safeLocal[k];
            // f_cloud は数値でない値で上書きしない（undefined や非数で既定値に戻る問題を防止）
            if (typeof v === 'number' && isFinite(v)) renderPatch[k] = v;
        }
    }

    return { genPatch, renderPatch };
}

/**
 * store の generatorParams を local に反映する（local に存在するキーだけ、差分があるときだけ代入）。
 * - f_cloud は互換のため除外（renderSettings 側が正）
 * @returns {boolean} local を変更したか
 */
export function applyGeneratorParamsToLocal(local, generatorParams) {
    if (!local || typeof local !== 'object') return false;
    if (!generatorParams || typeof generatorParams !== 'object') return false;
    let changed = false;
    for (const k of Object.keys(generatorParams)) {
        if (k === 'f_cloud') continue;
        if (!Object.prototype.hasOwnProperty.call(local, k)) continue;
        if (local[k] !== generatorParams[k]) {
            local[k] = generatorParams[k];
            changed = true;
        }
    }
    return changed;
}

/**
 * store の renderSettings を local に反映する（現状は f_cloud のみ）。
 * @returns {boolean} local を変更したか
 */
export function applyRenderSettingsToLocal(local, renderSettings) {
    if (!local || typeof local !== 'object') return false;
    if (!renderSettings || typeof renderSettings !== 'object') return false;
    if (!Object.prototype.hasOwnProperty.call(local, 'f_cloud')) return false;
    if (typeof renderSettings.f_cloud === 'undefined') return false;
    if (local.f_cloud === renderSettings.f_cloud) return false;
    local.f_cloud = renderSettings.f_cloud;
    return true;
}


