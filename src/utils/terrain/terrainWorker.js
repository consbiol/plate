import {
  runGenerateWithDeps,
  runDriftWithDeps,
  runReviseHighFrequencyWithDeps
} from './terrainRunner.js';
import { buildWorkerOutputs } from './workerPayload.js';
import {
  createWorkerDepsWithFunctions,
  createDefaultWorkerDepsFunctions,
  getMissingWorkerDepsFunctions
} from './workerDepsFactory.js';

const post = (data) => {
  if (typeof self !== 'undefined' && self && typeof self.postMessage === 'function') {
    self.postMessage(data);
  }
};

let cachedDepsSnapshot = null;
let cachedHfCache = null;

const runByMode = (deps, { runMode, runContext }) => {
  if (runMode === 'generate' || runMode === 'update') {
    return runGenerateWithDeps(deps, {
      preserveCenterCoordinates: runMode === 'update',
      runContext
    });
  }
  if (runMode === 'drift') {
    return runDriftWithDeps(deps, { runContext });
  }
  if (runMode === 'revise') {
    return runReviseHighFrequencyWithDeps(deps, { emit: false, runContext });
  }
  return { payload: null, state: null };
};

if (typeof self !== 'undefined') {
  self.onmessage = (event) => {
    const data = event && event.data ? event.data : {};
    const { id, deps, depsSnapshot, depsFunctions, inputs } = data;
    if (!inputs || typeof inputs !== 'object') {
      post({ id, error: 'Missing inputs' });
      return;
    }
    const mergedSnapshot = (() => {
      const baseSnapshot = (depsSnapshot && typeof depsSnapshot === 'object')
        ? depsSnapshot
        : (cachedDepsSnapshot && typeof cachedDepsSnapshot === 'object' ? cachedDepsSnapshot : null);
      if (!baseSnapshot) return null;
      if (!inputs.generationInputs || typeof inputs.generationInputs !== 'object') return baseSnapshot;
      return {
        ...baseSnapshot,
        props: {
          ...(baseSnapshot.props || {}),
          ...inputs.generationInputs
        }
      };
    })();
    if (mergedSnapshot && !mergedSnapshot.hfCache && cachedHfCache) {
      mergedSnapshot.hfCache = cachedHfCache;
    }
    const resolvedDeps = deps
      || createWorkerDepsWithFunctions({
        depsSnapshot: mergedSnapshot,
        functions: depsFunctions || createDefaultWorkerDepsFunctions({ depsSnapshot: mergedSnapshot })
      });
    if (!resolvedDeps || typeof resolvedDeps !== 'object') {
      post({ id, error: 'Missing deps' });
      return;
    }
    const missing = getMissingWorkerDepsFunctions(resolvedDeps);
    if (missing.length > 0) {
      post({ id, error: 'Missing deps functions', missing });
      return;
    }
    try {
      const result = runByMode(resolvedDeps, inputs);
      const payload = (result && typeof result === 'object' && Object.prototype.hasOwnProperty.call(result, 'payload'))
        ? result.payload
        : result;
      const state = (result && typeof result === 'object' && Object.prototype.hasOwnProperty.call(result, 'state'))
        ? result.state
        : null;
      const nextHfCache = (state && state.hfCache)
        ? state.hfCache
        : (resolvedDeps && resolvedDeps.hfCache ? resolvedDeps.hfCache : null);
      const outputs = buildWorkerOutputs({
        payload,
        hfCache: nextHfCache,
        driftState: resolvedDeps && resolvedDeps.state ? resolvedDeps.state : null
      });
      if (outputs && outputs.hfCache) {
        cachedHfCache = outputs.hfCache;
        if (mergedSnapshot) {
          cachedDepsSnapshot = { ...mergedSnapshot, hfCache: outputs.hfCache };
        }
      } else if (mergedSnapshot) {
        cachedDepsSnapshot = mergedSnapshot;
      }
      post({ id, outputs });
    } catch (e) {
      post({ id, error: e && e.message ? e.message : 'Worker error' });
    }
  };
}
