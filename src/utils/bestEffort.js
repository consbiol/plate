/**
 * Run a function and swallow any exception.
 * Use this to replace try/catch blocks that intentionally swallow errors.
 *
 * @template T
 * @param {() => T} fn
 * @param {{ fallback?: T }} [options]
 * @returns {T|undefined}
 */
export function bestEffort(fn, options = {}) {
    try {
        return fn();
    } catch (e) {
        return options.fallback;
    }
}

/**
 * Async version of bestEffort.
 *
 * @template T
 * @param {() => (Promise<T>|T)} fn
 * @param {{ fallback?: T }} [options]
 * @returns {Promise<T|undefined>}
 */
export async function bestEffortAsync(fn, options = {}) {
    try {
        return await fn();
    } catch (e) {
        return options.fallback;
    }
}


