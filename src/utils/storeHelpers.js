import { bestEffort } from './bestEffort.js';

export function safeDispatch(store, action, payload) {
    return bestEffort(() => store?.dispatch?.(action, payload), { fallback: null });
}

export function safeCommit(store, mutation, payload) {
    return bestEffort(() => store?.commit?.(mutation, payload), { fallback: null });
}


