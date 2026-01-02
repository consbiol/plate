// Simulation / rendering cadence constants (to avoid magic numbers spread across UI logic).

// ---------------------------
// Turn runner / simulation cadence
// ---------------------------
export const TURN_MIN_WAIT_MS = 100;
export const TURN_LAG_FALLBACK_WAIT_MS = 100;
export const TURN_PLANE_UPDATE_EVERY_TURNS = 5;
export const TURN_SPHERE_UPDATE_EVERY_TURNS = 5;
export const TURN_REGENERATE_EVERY_TURNS = 120;

// Large interval constants (years)
export const DRIFT_INTERVAL_YEARS = 2000000;

// ---------------------------
// Popup / iframe non-reload update limits (avoid resource leakage)
// ---------------------------
export const PLANE_MAX_NON_RELOAD_UPDATES = 200;
export const SPHERE_MAX_NON_RELOAD_UPDATES = 200;


