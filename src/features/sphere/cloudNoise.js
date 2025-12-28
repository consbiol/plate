// --- Cloud (CPU) tileable noise helpers ---
export function rand2(ix, iy) {
    // integer-ish inputs recommended
    const s = Math.sin(ix * 12.9898 + iy * 78.233) * 43758.5453;
    return s - Math.floor(s);
}

export function valueNoiseTile(u, v, period) {
    const p = Math.max(2, Math.floor(period || 16));
    const x = u * p;
    const y = v * p;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const x1 = (x0 + 1) % p;
    const y1 = (y0 + 1) % p;
    const i00 = rand2(x0 % p, y0 % p);
    const i10 = rand2(x1 % p, y0 % p);
    const i01 = rand2(x0 % p, y1 % p);
    const i11 = rand2(x1 % p, y1 % p);
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = i00 + (i10 - i00) * sx;
    const b = i01 + (i11 - i01) * sx;
    return a + (b - a) * sy; // 0..1-ish
}

export function fbmTile(u, v, basePeriod) {
    let vsum = 0;
    let amp = 0.55;
    let period = Math.max(2, Math.floor(basePeriod || 16));
    for (let i = 0; i < 4; i++) {
        const n = valueNoiseTile(u, v, period);
        vsum += amp * n;
        amp *= 0.5;
        period *= 2;
    }
    // normalize roughly to 0..1
    return Math.max(0, Math.min(1, vsum / 1.5));
}


