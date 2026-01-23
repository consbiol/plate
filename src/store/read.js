import { getGetter } from '../utils/storeGetters.js';
import { GETTERS } from './keys.js';

/**
 * @typedef {any} Store
 *
 * @typedef {Object} ClimateTurn
 * @property {number} Time_turn
 * @property {number} Time_yr
 * @property {number} Turn_yr
 * @property {number} Turn_speed
 * @property {boolean} isRunning
 * @property {string} [era]
 *
 * @typedef {Object<string, any>} ClimateVars
 */

// ---------------------------
// Getters (read)
// ---------------------------

// --- ERA ---
/** @param {Store} store @returns {string|null} */
export function getEra(store) {
    return getGetter(store, GETTERS.ERA, null);
}

// --- GRID ---
/** @param {Store} store @param {number} [fallback=200] @returns {number} */
export function getGridWidth(store, fallback = 200) {
    const v = getGetter(store, GETTERS.GRID_WIDTH, fallback);
    return (typeof v === 'number') ? v : fallback;
}
/** @param {Store} store @param {number} [fallback=100] @returns {number} */
export function getGridHeight(store, fallback = 100) {
    const v = getGetter(store, GETTERS.GRID_HEIGHT, fallback);
    return (typeof v === 'number') ? v : fallback;
}

// --- RENDER ---
/** @param {Store} store @returns {Object|null} */
export function getGeneratorParams(store) {
    return getGetter(store, GETTERS.GENERATOR_PARAMS, null);
}
/** @param {Store} store @returns {Object|null} */
export function getRenderSettings(store) {
    return getGetter(store, GETTERS.RENDER_SETTINGS, null);
}
/** @param {Store} store @param {number} [fallback=3] @returns {number} */
export function getPlaneGridCellPx(store, fallback = 3) {
    const v = getGetter(store, GETTERS.PLANE_GRID_CELL_PX, fallback);
    return (typeof v === 'number') ? v : fallback;
}

// --- CLIMATE ---
/** @param {Store} store @returns {Object|null} */
export function getClimate(store) {
    return getGetter(store, GETTERS.CLIMATE, null);
}
/** @param {Store} store @returns {ClimateTurn|null} */
export function getClimateTurn(store) {
    return getGetter(store, GETTERS.CLIMATE_TURN, null);
}
/** @param {Store} store @returns {ClimateVars|null} */
export function getClimateVars(store) {
    return getGetter(store, GETTERS.CLIMATE_VARS, null);
}
/** @param {Store} store @returns {any} */
export function getClimateHistory(store) {
    return getGetter(store, GETTERS.CLIMATE_HISTORY, null);
}
/** @param {Store} store @param {number} [fallback=15] @returns {number} */
export function getAverageTemperature(store, fallback = 15) {
    const v = getGetter(store, GETTERS.AVERAGE_TEMPERATURE, fallback);
    return (typeof v === 'number') ? v : fallback;
}


