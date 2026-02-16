
// 緯度帯インデックスを取得（1..10）。両極から5行ごとに帯を区切る。
// y: grid y coordinate
// gridHeight: total grid height
// wobbleShift: vertical shift amount for this column (derived from wobbleShiftByX[x])
// wobbleRows: magnitude of wobble (used to check if wobble is active)
export function getLatBandIndex(y, gridHeight, wobbleShift, wobbleRows) {
    let yShifted = y;
    if (wobbleRows > 0) {
        // wobbleShift is a scalar (shift amount for this x)
        const shift = wobbleShift || 0;
        yShifted = Math.max(0, Math.min(gridHeight - 1, y + shift));
    }
    const dPole = Math.min(yShifted, gridHeight - 1 - yShifted);
    const band = Math.floor(dPole / 5) + 1;
    if (band < 1) return 1;
    if (band > 10) return 10;
    return band;
}

// Get threshold for a specific cell, given the pre-resolved band thresholds array
export function getLandDistanceThreshold({ y, wobbleShift, wobbleRows, gridHeight, bandThresholds }) {
    const b = getLatBandIndex(y, gridHeight, wobbleShift, wobbleRows);
    // bandThresholds is 0-indexed (band 1 -> index 0)
    if (Array.isArray(bandThresholds)) {
        const val = bandThresholds[b - 1];
        if (Number.isFinite(val)) return val;
    }
    return 0;
}
