export function getLatBandIndex(y, gridHeight, wobbleShift, wobbleRows) {
    let yShifted = y;
    if (wobbleRows > 0) {
        const shift = wobbleShift || 0;
        yShifted = Math.max(0, Math.min(gridHeight - 1, y + shift));
    }
    const dPole = Math.min(yShifted, gridHeight - 1 - yShifted);
    const band = Math.floor(dPole / 5) + 1;
    if (band < 1) return 1;
    if (band > 10) return 10;
    return band;
}

export function getLandDistanceThreshold({ y, wobbleShift, wobbleRows, gridHeight, bandThresholds }) {
    const b = getLatBandIndex(y, gridHeight, wobbleShift, wobbleRows);
    if (Array.isArray(bandThresholds)) {
        const val = bandThresholds[b - 1];
        if (Number.isFinite(val)) return val;
    }
    return 0;
}
