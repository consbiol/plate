export function clamp(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
}

export function clamp01(value) {
    if (value <= 0) return 0;
    if (value >= 1) return 1;
    return value;
}
