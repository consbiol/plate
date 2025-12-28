// トーラス接続の定義（変更）:
// - 左右端は通常のラップ（0↔gridWidth-1）を維持
// - 上下（y方向）の特殊なトーラス接続は削除（垂直方向はラップしない）

// トーラス上の距離（xはラップ考慮、yは通常差分）
export function torusDistance(gridWidth, gridHeight, x1, y1, x2, y2) {
    const dx = Math.min(Math.abs(x1 - x2), gridWidth - Math.abs(x1 - x2));
    const dy = Math.abs(y1 - y2);
    return Math.hypot(dx, dy);
}

// トーラス上での最短経路の方向ベクトルを計算（角度計算用）
// 戻り値: { dx, dy } （xはラップを考慮、yは単純差分）
export function torusDirection(gridWidth, gridHeight, x1, y1, x2, y2) {
    let bestDx = 0;
    let bestDy = 0;
    let bestDist = Infinity;

    const candidates = [];
    // 直接経路（ラップなし）
    candidates.push({ dx: x2 - x1, dy: y2 - y1 });
    // x方向のラップを考慮した経路
    const dxWrap = x2 > x1 ? x2 - gridWidth - x1 : x2 + gridWidth - x1;
    candidates.push({ dx: dxWrap, dy: y2 - y1 });

    for (const cand of candidates) {
        const dist = Math.hypot(cand.dx, cand.dy);
        if (dist < bestDist) {
            bestDist = dist;
            bestDx = cand.dx;
            bestDy = cand.dy;
        }
    }

    return { dx: bestDx, dy: bestDy };
}

// トーラス上の座標ラップ（近傍探索やBFSで使用）
// - x は左右でラップ
// - y が範囲外の場合は無効（null）を返す（上下の特殊接続は削除）
export function torusWrap(gridWidth, gridHeight, x, y) {
    let wx = x;
    // 左右端の通常ラップ
    if (wx < 0) wx += gridWidth;
    if (wx >= gridWidth) wx -= gridWidth;
    if (y < 0 || y >= gridHeight) return null;
    return { x: wx, y };
}


