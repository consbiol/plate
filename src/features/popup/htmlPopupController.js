import { popupOpenOrReuse, popupWriteHtml } from '../../utils/popupUtils.js';

/**
 * @typedef {Window|null} PopupRef
 */

/**
 * Reuse existing popup window if open; otherwise open a new one and return it.
 * @param {PopupRef} existingRef
 * @param {string} name
 * @param {string} features
 * @returns {PopupRef}
 */
export function openOrReusePopup(existingRef, name, features) {
    return popupOpenOrReuse(existingRef, name, features);
}

/**
 * Write html to an existing popup if it's open.
 * @param {PopupRef} popupRef
 * @param {string} html
 * @returns {boolean} true if written
 */
export function writePopupIfOpen(popupRef, html) {
    const w = (popupRef && !popupRef.closed) ? popupRef : null;
    if (!w) return false;
    popupWriteHtml(w.document, html);
    return true;
}

/**
 * Open/reuse popup and write HTML.
 * @param {PopupRef} existingRef
 * @param {string} name
 * @param {string} features
 * @param {string} html
 * @returns {PopupRef}
 */
export function openOrUpdatePopup(existingRef, name, features, html) {
    const w = openOrReusePopup(existingRef, name, features);
    if (!w) return null;
    popupWriteHtml(w.document, html);
    return w;
}


