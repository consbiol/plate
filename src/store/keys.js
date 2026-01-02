// Central registry of Vuex getter/action/mutation names used by the UI layer.
// Keep these in one place so renames don't require hunting string literals across components.

export const GETTERS = Object.freeze({
    // --- ERA ---
    ERA: 'era', // selected era label (UI + climate init)

    // --- GRID ---
    GRID_WIDTH: 'gridWidth', // terrain width
    GRID_HEIGHT: 'gridHeight', // terrain height
    GRID_DATA: 'gridData', // raw terrain grid (width*height)

    // --- RENDER ---
    RENDER_SETTINGS: 'renderSettings', // sphere/plane render knobs
    PLANE_GRID_CELL_PX: 'planeGridCellPx', // plane cell size (px)

    // --- GENERATOR ---
    GENERATOR_PARAMS: 'generatorParams', // generator knobs (greenIndex etc.)

    // --- CLIMATE ---
    CLIMATE: 'climate', // climate state snapshot
    CLIMATE_TURN: 'climateTurn', // turn runner state (Time_turn, Turn_yr...)
    CLIMATE_VARS: 'climateVars', // climate outputs (averageTemperature, greenIndex...)
    CLIMATE_HISTORY: 'climateHistory', // climate history series
    AVERAGE_TEMPERATURE: 'averageTemperature', // UI-managed average temperature (°C)
    F_CLOUD: 'f_cloud' // render/cloud amount (0..1)
});

export const ACTIONS = Object.freeze({
    // --- CLIMATE / TURN ---
    SET_TURN_RUNNING: 'setTurnRunning', // start/stop turn runner
    UPDATE_TURN_SPEED: 'updateTurnSpeed', // change Turn_speed
    ADVANCE_CLIMATE_ONE_TURN: 'advanceClimateOneTurn', // advance climate simulation
    INIT_CLIMATE_FROM_GENERATE: 'initClimateFromGenerate', // init climate constants from era/seed
    UPDATE_CLIMATE_TERRAIN_FRACTIONS: 'updateClimateTerrainFractions', // push terrain fractions into climate

    // --- ERA ---
    UPDATE_ERA: 'updateEra', // change era label

    // --- GRID ---
    UPDATE_GRID_WIDTH: 'updateGridWidth',
    UPDATE_GRID_HEIGHT: 'updateGridHeight',
    UPDATE_GRID_DATA: 'updateGridData',

    // --- RENDER ---
    UPDATE_RENDER_SETTINGS: 'updateRenderSettings',
    UPDATE_PLANE_GRID_CELL_PX: 'updatePlaneGridCellPx',
    UPDATE_AVERAGE_TEMPERATURE: 'updateAverageTemperature',

    // --- GENERATOR ---
    UPDATE_GENERATOR_PARAMS: 'updateGeneratorParams'
});

export const MUTATIONS = Object.freeze({
    PATCH_CLIMATE: 'patchClimate' // partial update of climate state
});


