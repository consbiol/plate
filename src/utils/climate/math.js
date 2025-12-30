export function clamp(v, min, max) {
    const x = Number(v);
    if (!isFinite(x)) return min;
    return Math.max(min, Math.min(max, x));
}

export function clamp01(v) {
    return clamp(v, 0, 1);
}


