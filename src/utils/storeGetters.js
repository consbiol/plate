// Typed-ish safe access helpers for Vuex getters (and nested objects returned by getters).
// Goal: keep components readable and avoid scattered optional chaining boilerplate.

import { bestEffort } from './bestEffort.js';

export function getGetter(store, key, fallback = null) {
    return bestEffort(() => {
        const g = store?.getters;
        if (!g) return fallback;
        const v = g[key];
        return (typeof v === 'undefined') ? fallback : v;
    }, { fallback });
}

export function getGetterPath(store, path, fallback = null) {
    return bestEffort(() => {
        const g = store?.getters;
        if (!g) return fallback;
        if (!Array.isArray(path) || path.length === 0) return fallback;
        let cur = g;
        for (let i = 0; i < path.length; i++) {
            const k = path[i];
            if (cur == null) return fallback;
            cur = cur[k];
        }
        return (typeof cur === 'undefined') ? fallback : cur;
    }, { fallback });
}


