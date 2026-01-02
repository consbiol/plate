/**
 * Types for cached intermediate terrain generation data.
 * Primarily used by `Grids_Calculation.vue` for high-frequency revise (hfCache).
 */

/**
 * High-frequency cache saved after a full generate/drift, then used by `runReviseHighFrequency`.
 * Keep keys aligned with `Grids_Calculation.vue` assignment to `this.hfCache`.
 *
 * @typedef {Object} TerrainHighFrequencyCache
 * @property {number} N
 * @property {Array<{x:number,y:number}>} centers
 * @property {boolean[]} landMask
 * @property {boolean[]|null} lakeMask
 * @property {any[]} lakesList
 * @property {number[]} noiseGrid
 * @property {number[]} distanceToSea
 * @property {number[]} distanceToLand
 * @property {any[]} preTundraColors
 *
 * @property {number[]} glacierNoiseTable
 * @property {number[]} tundraNoiseTopTable
 * @property {number[]} tundraNoiseBottomTable
 *
 * @property {string} shallowSeaColor
 * @property {string} deepSeaColor
 * @property {string} lowlandColor
 * @property {string} desertColor
 * @property {string} highlandColor
 * @property {string} alpineColor
 * @property {string} tundraColor
 * @property {string} glacierColor
 *
 * @property {number} seaNoiseAmplitude
 * @property {number} landNoiseAmplitude
 *
 * @property {import('./index.js').PreGlacierStats|null} preGlacierStats
 * @property {any[]} gridDataBase
 */

// Types-only token export for tooling.
export const __types = null;


