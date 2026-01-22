/**
 * Shared stats-related types (JSDoc typedefs).
 * Used by Parameters_Display and popup HTML builders.
 */

/**
 * Grid type counts derived from terrain gridData.
 * Keep keys aligned with `computeGridTypeCounts` in `src/features/stats/gridTypeCounts.js`.
 *
 * @typedef {Object} GridTypeCounts
 * @property {number} deepSea
 * @property {number} shallowSea
 * @property {number} glacier
 * @property {number} lowland
 * @property {number} desert
 * @property {number} highland
 * @property {number} alpine
 * @property {number} lake
 * @property {number} tundra
 * @property {number} bryophyte
 * @property {number} city
 * @property {number} cultivated
 * @property {number} polluted
 * @property {number} seaCity
 * @property {number} seaCultivated
 * @property {number} seaPolluted
 * @property {number} total
 */

/**
 * Stats object kept on Parameters_Display for UI state + popup output.
 *
 * NOTE:
 * Some keys are projections of the unified terrain event payload (see `src/types/terrain.js`).
 *
 * @typedef {Object} ParametersStats
 * @property {import('./terrain.js').PreGlacierStats|null} [preGlacier]
 * @property {import('./terrain.js').LowlandDistanceToSeaStats|null} [lowlandDistanceToSea]
 * @property {import('./terrain.js').DriftMetrics|null} [driftMetrics]
 * @property {GridTypeCounts|null} [gridTypeCounts]
 * @property {number|null} [computedTopGlacierRows]
 */

// Types-only token export for tooling.
export const __types = null;
// Backward-compat alias (older imports may use this name).
export const __statsTypes = __types;


