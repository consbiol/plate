import { popupOpenOrReuse, popupWriteHtml, iframeSetSrcdoc, iframeSetOnload } from '../../utils/popupUtils.js';
import { buildPlaneSphereShellHtml } from './planeSphereShellHtml.js';
import { PLANE_MAX_NON_RELOAD_UPDATES } from '../../constants/sim.js';
import { bestEffort } from '../../utils/bestEffort.js';

/**
 * Contract note:
 * This controller expects a Vue component instance ("vm") with a specific shape.
 * Keep this explicit so callers and future refactors are safer.
 *
 * @typedef {Object} PlaneSpherePopupVm
 * @property {Window|null} planePopupRef
 * @property {number} planeBuildVersion
 * @property {any[]} planeDisplayColors
 * @property {number} planeGridCellPx
 * @property {number} gridWidth
 * @property {number} gridHeight
 * @property {number} sphereUpdateCount
 * @property {number} sphereMaxUpdates
 * @property {any} [$refs]
 * @property {any} [_sphereWin]                         // Sphere_Display sets this when popup is attached
 * @property {Function} buildPlaneHtml                  // (): string
 * @property {Function} _getSphereHtmlForIframe         // (): string
 * @property {Function} _attachSphereToIframe           // (iframeEl: HTMLIFrameElement|null) => void
 */

/**
 * Open (or reuse) the Plane+Sphere popup and write the shell + iframe srcdocs.
 * @param {PlaneSpherePopupVm} vm
 * @returns {void}
 */
export function openOrUpdatePlaneSpherePopup(vm) {
    const w = popupOpenOrReuse(vm.planePopupRef, 'PlaneSphereView', 'width=1400,height=900,scrollbars=yes');
    vm.planePopupRef = w;
    if (!w) return;
    const doc = w.document;

    // 1) shell (two iframes)
    popupWriteHtml(doc, buildPlaneSphereShellHtml());

    // 2) iframe contents via srcdoc
    const planeHtml = vm.buildPlaneHtml();
    const sphereHtml = vm._getSphereHtmlForIframe();
    iframeSetSrcdoc(doc, 'plane-iframe', planeHtml);
    iframeSetSrcdoc(doc, 'sphere-iframe', sphereHtml);
    iframeSetOnload(doc, 'sphere-iframe', () => {
        bestEffort(() => {
            const sif = doc.getElementById('sphere-iframe');
            vm._attachSphereToIframe(sif);
        });
    });
}

/**
 * Update Plane iframe only. Prefers non-reload update if iframe provides __updatePlane().
 * @param {PlaneSpherePopupVm} vm
 * @returns {void}
 */
export function updatePlaneIframeOnly(vm, { showSpinner = false } = {}) {
    const w = (vm.planePopupRef && !vm.planePopupRef.closed) ? vm.planePopupRef : null;
    if (!w) {
        openOrUpdatePlaneSpherePopup(vm);
        return;
    }
    try {
        const doc = w.document;
        const pif = doc.getElementById('plane-iframe');
        if (!pif) {
            openOrUpdatePlaneSpherePopup(vm);
            return;
        }
        const pw = pif.contentWindow;
        const fn = pw && typeof pw.__updatePlane === 'function' ? pw.__updatePlane : null;
        const pv = pw && typeof pw.__planeVersion !== 'undefined' ? pw.__planeVersion : null;
        const displayColors = Array.isArray(vm.planeDisplayColors) ? vm.planeDisplayColors : [];
        const cell = Number(vm.planeGridCellPx) || 3;
        const displayW = vm.gridWidth + 2;
        const displayH = vm.gridHeight + 2;

        // version mismatch => rebuild
        if (pv !== null && pv !== vm.planeBuildVersion) {
            pif.srcdoc = vm.buildPlaneHtml();
            return;
        }
        if (fn) {
            try {
                const updateCount = pw.__planeUpdateCount || 0;
                if (updateCount >= PLANE_MAX_NON_RELOAD_UPDATES && typeof pw.__cleanupPlane === 'function') {
                    bestEffort(() => pw.__cleanupPlane());
                    pif.srcdoc = vm.buildPlaneHtml();
                    return;
                }
                fn(displayColors, displayW, displayH, cell, !!showSpinner);
                return;
            } catch (e) {
                pif.srcdoc = vm.buildPlaneHtml();
                return;
            }
        }
        // fallback: replace srcdoc
        pif.srcdoc = vm.buildPlaneHtml();
    } catch (e) {
        openOrUpdatePlaneSpherePopup(vm);
    }
}

/**
 * Update Plane and (if possible) Sphere without reloading, falling back to srcdoc swap.
 * Keeps existing behaviour: uses vm.sphereUpdateCount/vm.sphereMaxUpdates to cap non-reload updates.
 * @param {PlaneSpherePopupVm} vm
 * @returns {void}
 */
export function updatePlaneAndSphereIframes(vm) {
    // generate/update/drift 時はスピナー表示
    updatePlaneIframeOnly(vm, { showSpinner: true });
    bestEffort(() => {
        const w = (vm.planePopupRef && !vm.planePopupRef.closed) ? vm.planePopupRef : null;
        if (!w) return;
        const doc = w.document;
        const sif = doc.getElementById('sphere-iframe');
        if (!sif) return;
        const sphComp = (vm.$refs && vm.$refs.sphere) ? vm.$refs.sphere : null;
        if (sphComp && vm._sphereWin) {
            bestEffort(() => {
                if (typeof sphComp.applyCloudSnapshot === 'function') sphComp.applyCloudSnapshot();
            });
            if ((vm.sphereUpdateCount || 0) >= (vm.sphereMaxUpdates || 200)) {
                bestEffort(() => sphComp.cleanupSpherePopup());
                bestEffort(() => { sif.srcdoc = vm._getSphereHtmlForIframe(); });
                vm.sphereUpdateCount = 0;
                return;
            }
            try {
                sphComp.requestRedraw();
                vm.sphereUpdateCount = (vm.sphereUpdateCount || 0) + 1;
                return;
            } catch (e) {
                bestEffort(() => { sif.srcdoc = vm._getSphereHtmlForIframe(); });
                vm.sphereUpdateCount = 0;
                return;
            }
        } else {
            bestEffort(() => { sif.srcdoc = vm._getSphereHtmlForIframe(); });
            vm.sphereUpdateCount = 0;
            return;
        }
    });
}


