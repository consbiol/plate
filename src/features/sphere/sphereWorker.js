import { drawSphereCPU } from './rendererCpu.js';

let offscreenCanvas = null;
let currentConfig = null;
let isRotating = false;
let rotationColumns = 0;
let rotationMsPerGrid = 100;
let minMsPerGrid = 20;
let maxMsPerGrid = 5000;
let lastTimestamp = null;
let accumMs = 0;
let rafId = null;

// Ensure _precompute is persisted across frames inside the worker
let precomputeCache = null;

function renderFrame() {
    if (!offscreenCanvas || !currentConfig) return;

    // Inject the locally tracked rotation and precompute state into the config
    const renderConfig = {
        ...currentConfig,
        _rotationColumns: rotationColumns,
        _precompute: precomputeCache
    };

    drawSphereCPU(renderConfig, offscreenCanvas);

    // Save the precompute cache updated by drawSphereCPU
    precomputeCache = renderConfig._precompute;
}

function loop(ts) {
    if (!isRotating) return;

    const msPerGrid = Math.max(minMsPerGrid, Math.min(maxMsPerGrid, rotationMsPerGrid));
    const delta = ts - (lastTimestamp || ts);
    lastTimestamp = ts;
    accumMs += delta;
    
    let advanced = false;
    while (accumMs >= msPerGrid) {
        accumMs -= msPerGrid;
        const width = currentConfig ? (currentConfig.gridWidth || 1) : 1;
        rotationColumns = (rotationColumns + 1) % width;
        advanced = true;
    }

    if (advanced) {
        renderFrame();
    }

    rafId = requestAnimationFrame(loop);
}

function startRotation() {
    if (isRotating) return;
    isRotating = true;
    lastTimestamp = performance.now();
    accumMs = 0;
    rafId = requestAnimationFrame(loop);
    
    // Send immediate speed update back to main thread for UI
    postMessage({ type: 'speedUpdated', rotationMsPerGrid });
}

function stopRotation() {
    isRotating = false;
    if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
    lastTimestamp = null;
    accumMs = 0;
}

self.onmessage = function (e) {
    const { type, payload } = e.data;

    switch (type) {
        case 'init':
            offscreenCanvas = e.data.canvas;
            break;

        case 'updateConfig':
            currentConfig = payload;
            // If we're not rotating, just render a single frame when config updates
            if (!isRotating && offscreenCanvas) {
                renderFrame();
            }
            break;

        case 'setRotation':
            if (payload.enabled) {
                startRotation();
            } else {
                stopRotation();
            }
            break;

        case 'adjustSpeed':
            {
                const faster = payload.faster;
                const next = faster ? (rotationMsPerGrid / 1.5) : (rotationMsPerGrid * 1.5);
                rotationMsPerGrid = Math.max(minMsPerGrid, Math.min(maxMsPerGrid, Math.round(next)));
                
                if (isRotating) {
                    lastTimestamp = performance.now();
                }
                
                // Notify main thread of new speed
                postMessage({ type: 'speedUpdated', rotationMsPerGrid });
            }
            break;

        case 'requestRedraw':
            if (!isRotating) {
                renderFrame();
            }
            break;
            
        case 'dispose':
            stopRotation();
            offscreenCanvas = null;
            currentConfig = null;
            precomputeCache = null;
            break;
    }
};
