import { getClimate, patchClimate, updateClimateTerrainFractions } from '../../store/api.js';
import { computeRadiativeEquilibriumTempK } from '../../utils/climate/model.js';
import { bestEffort } from '../../utils/bestEffort.js';

/**
 * @typedef {import('../../types/index.js').PreGlacierStats} PreGlacierStats
 * @typedef {import('../../types/index.js').GridTypeCounts} GridTypeCounts
 */

/**
 * Push terrain fractions into climate model.
 * @param {any} store
 * @param {{gridTypeCounts: GridTypeCounts|null, preGlacierStats: PreGlacierStats|null, gridWidth: number, gridHeight: number, era: string}} arg
 */
export function updateClimateTerrainFractionsFromStats(store, { gridTypeCounts, preGlacierStats, gridWidth, gridHeight, era }) {
    bestEffort(() => updateClimateTerrainFractions(store, { gridTypeCounts, preGlacierStats, gridWidth, gridHeight, era }));
}

/**
 * Recompute radiative equilibrium and patch climate vars (used after manual Generate).
 * @param {any} store
 */
export function recomputeAndPatchRadiativeEquilibrium(store) {
    bestEffort(() => {
        const curClimate = getClimate(store);
        if (!curClimate) return;
        const out = computeRadiativeEquilibriumTempK(curClimate, { conservative: true });
        if (!out || typeof out.averageTemperature_calc !== 'number') return;
        patchClimate(store, {
            vars: {
                ...(curClimate.vars || {}),
                averageTemperature_calc: out.averageTemperature_calc,
                Sol: out.Sol,
                f_cloud: out.f_cloud
            }
        });
    });
}


