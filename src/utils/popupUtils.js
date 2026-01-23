// Utility helpers for opening/writing popups and setting iframe contents.
// Naming rule: "popup*" deals with Window/Document, "iframe*" deals with iframe elements.

import { bestEffort } from './bestEffort.js';

export function popupOpenOrReuse(existingRef, name, features) {
    return bestEffort(
        () => ((existingRef && !existingRef.closed) ? existingRef : window.open('', name, features)),
        { fallback: null }
    );
}

export function popupWriteHtml(doc, html) {
    if (!doc) return;
    bestEffort(() => {
        doc.open();
        doc.write(html);
        doc.close();
    });
}
