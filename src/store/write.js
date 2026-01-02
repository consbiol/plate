import { safeDispatch, safeCommit } from '../utils/storeHelpers.js';
import { ACTIONS, MUTATIONS } from './keys.js';

/**
 * @typedef {any} Store
 */

// ---------------------------
// Actions (write)
// ---------------------------

// --- CLIMATE / TURN ---
/** @param {Store} store @param {boolean} isRunning @returns {any} */
export function setTurnRunning(store, isRunning) {
    return safeDispatch(store, ACTIONS.SET_TURN_RUNNING, !!isRunning);
}
/** @param {Store} store @param {number} speed @returns {any} */
export function updateTurnSpeed(store, speed) {
    return safeDispatch(store, ACTIONS.UPDATE_TURN_SPEED, speed);
}
/** @param {Store} store @returns {any} */
export function advanceClimateOneTurn(store) {
    return safeDispatch(store, ACTIONS.ADVANCE_CLIMATE_ONE_TURN);
}
/**
 * @param {Store} store
 * @param {{era: string, deterministicSeed: any, resetTurnYrToEraDefault: boolean}} arg
 * @returns {any}
 */
export function initClimateFromGenerate(store, { era, deterministicSeed, resetTurnYrToEraDefault }) {
    return safeDispatch(store, ACTIONS.INIT_CLIMATE_FROM_GENERATE, { era, deterministicSeed, resetTurnYrToEraDefault });
}
/** @param {Store} store @param {Object} payload @returns {any} */
export function updateClimateTerrainFractions(store, payload) {
    return safeDispatch(store, ACTIONS.UPDATE_CLIMATE_TERRAIN_FRACTIONS, payload);
}

// --- ERA ---
/** @param {Store} store @param {string} era @returns {any} */
export function updateEra(store, era) {
    return safeDispatch(store, ACTIONS.UPDATE_ERA, era);
}

// --- GRID ---
/** @param {Store} store @param {number} w @returns {any} */
export function updateGridWidth(store, w) {
    return safeDispatch(store, ACTIONS.UPDATE_GRID_WIDTH, w);
}
/** @param {Store} store @param {number} h @returns {any} */
export function updateGridHeight(store, h) {
    return safeDispatch(store, ACTIONS.UPDATE_GRID_HEIGHT, h);
}
/** @param {Store} store @param {any[]} data @returns {any} */
export function updateGridData(store, data) {
    return safeDispatch(store, ACTIONS.UPDATE_GRID_DATA, data);
}

// --- RENDER ---
/** @param {Store} store @param {number} px @returns {any} */
export function updatePlaneGridCellPx(store, px) {
    return safeDispatch(store, ACTIONS.UPDATE_PLANE_GRID_CELL_PX, px);
}
/** @param {Store} store @param {number} celsius @returns {any} */
export function updateAverageTemperature(store, celsius) {
    return safeDispatch(store, ACTIONS.UPDATE_AVERAGE_TEMPERATURE, celsius);
}
/** @param {Store} store @param {Object} patch @returns {any} */
export function updateRenderSettings(store, patch) {
    return safeDispatch(store, ACTIONS.UPDATE_RENDER_SETTINGS, patch);
}

// --- GENERATOR ---
/** @param {Store} store @param {Object} patch @returns {any} */
export function updateGeneratorParams(store, patch) {
    return safeDispatch(store, ACTIONS.UPDATE_GENERATOR_PARAMS, patch);
}

// ---------------------------
// Mutations (write)
// ---------------------------
/** @param {Store} store @param {Object} patch @returns {any} */
export function patchClimate(store, patch) {
    return safeCommit(store, MUTATIONS.PATCH_CLIMATE, patch);
}


