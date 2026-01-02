/**
 * Shared terrain-related types (JSDoc typedefs).
 * Keep these here so both generators and UI consumers reference one canonical shape.
 */

/**
 * @typedef {'generated'|'revised'|'drifted'} TerrainEventType
 *
 * @typedef {'generate'|'update'|'revise'|'drift'} TerrainRunMode
 *
 * @typedef {Object} TerrainRunContext
 * @property {number|string|null} [runId]
 * @property {TerrainRunMode|null} [runMode]
 *
 * @typedef {Object} TerrainRunCommand
 * @property {TerrainRunMode|null} [mode]
 * @property {any} [options]
 * @property {TerrainRunContext|null} [runContext]
 *
 * @typedef {Object} PreGlacierStats
 * @property {number} landCount
 * @property {number} seaCount
 * @property {number} total
 * @property {number} landRatio
 *
 * @typedef {Object} DriftMetrics
 * @property {number} [superPloom_calc]
 * @property {number} [superPloom]
 * @property {string} [phase]
 * @property {number} [avgDist]
 *
 * @typedef {Object} LowlandDistanceToSeaStats
 * @property {number} avg
 * @property {number} min
 * @property {number} max
 * @property {number} count
 *
 * @typedef {Object} CenterParameter
 * @property {number} x
 * @property {number} y
 * @property {number} [influenceMultiplier]
 * @property {number} [kDecayVariation]
 *
 * @typedef {Object} TerrainEventPayload
 * @property {TerrainEventType} eventType
 * @property {TerrainRunMode|null} [runMode]
 * @property {number|string|null} [runId]
 * @property {Array|null} [gridData]
 * @property {CenterParameter[]} [centerParameters]
 * @property {number|string|null} [deterministicSeed]
 * @property {PreGlacierStats|null} [preGlacierStats]
 * @property {number|null} [computedTopGlacierRows]
 * @property {DriftMetrics|null} [driftMetrics]
 * @property {LowlandDistanceToSeaStats|null} [lowlandDistanceToSeaStats]
 */

// This file is "types-only"; export tokens so tooling can import it for JSDoc `import()`.
export const __types = null;
// Backward-compat alias (older imports may use this name).
export const __terrainTypes = __types;


