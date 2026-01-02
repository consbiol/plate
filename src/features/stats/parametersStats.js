import { computeGridTypeCounts } from './gridTypeCounts.js';

/**
 * @typedef {import('../../types/index.js').TerrainEventPayload} TerrainEventPayload
 * @typedef {import('../../types/index.js').ParametersStats} ParametersStats
 */

/**
 * Build/merge Parameters_Display stats from a terrain event payload.
 * Keeps existing keys unless explicitly overwritten.
 *
 * Rules:
 * - `driftMetrics` is cleared when payload does not provide it (so stale drift UI doesn't linger)
 * - `gridTypeCounts` is recomputed from payload.gridData when available
 *
 * @param {ParametersStats|null} prevStats
 * @param {TerrainEventPayload} payload
 * @param {{gridWidth: number, gridHeight: number}} dims
 * @returns {ParametersStats}
 */
export function buildParametersStatsFromTerrainPayload(prevStats, payload, { gridWidth, gridHeight }) {
    const next = { ...(prevStats || {}) };

    if (payload && payload.preGlacierStats) next.preGlacier = payload.preGlacierStats;
    if (payload && typeof payload.computedTopGlacierRows === 'number') next.computedTopGlacierRows = payload.computedTopGlacierRows;

    // Optional stats
    if (payload && payload.lowlandDistanceToSeaStats) next.lowlandDistanceToSea = payload.lowlandDistanceToSeaStats;

    // Clear drift metrics unless provided
    if (payload && payload.driftMetrics) next.driftMetrics = payload.driftMetrics;
    else next.driftMetrics = null;

    // Always keep gridTypeCounts aligned with current gridData when possible
    const gridData = payload && Array.isArray(payload.gridData) ? payload.gridData : null;
    if (gridData) {
        next.gridTypeCounts = computeGridTypeCounts({ gridData, gridWidth, gridHeight });
    }

    return next;
}

/**
 * Recompute gridTypeCounts from gridData (used by revise path).
 * @param {ParametersStats|null} prevStats
 * @param {any[]} gridData
 * @param {{gridWidth: number, gridHeight: number}} dims
 * @returns {ParametersStats}
 */
export function buildParametersStatsWithGridTypeCounts(prevStats, gridData, { gridWidth, gridHeight }) {
    const next = { ...(prevStats || {}) };
    next.gridTypeCounts = computeGridTypeCounts({ gridData, gridWidth, gridHeight });
    return next;
}


