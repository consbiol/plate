// UIの seaLandRatio を内部の生成用比率へスムーズにマッピング（機能不変）

function clamp(v, a, b) {
    return Math.min(b, Math.max(a, v));
}

export function mapSeaLandRatio(ui) {
    ui = clamp(Number(ui) || 0, 0, 1);
    const x0 = 0.3, y0 = 0.07;
    const x1 = 0.9, y1 = 0.7;
    if (ui <= x0) {
        // 0..x0 を 0..y0 に線形マップ
        return (ui / x0) * y0;
    } else if (ui >= x1) {
        // x1..1 を y1..1 に線形マップ
        return y1 + ((ui - x1) / (1 - x1)) * (1 - y1);
    }
    // 中央区間は smoothstep(3t^2-2t^3) で滑らかに補間
    const t = (ui - x0) / (x1 - x0);
    const s = t * t * (3 - 2 * t);
    return y0 + s * (y1 - y0);
}


