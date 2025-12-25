// トーラス接続の定義:
// - 左右端は通常のラップ（0↔gridWidth-1）
// - 上端は「左半分↔右半分」を同じ上端行(y=0)で接続
// - 下端は「左半分↔右半分」を同じ下端行(y=gridHeight-1)で接続

// トーラス上の距離（xは通常ラップ、yは端で半分ずらして接続）
export function torusDistance(gridWidth, gridHeight, x1, y1, x2, y2) {
    const dx = Math.min(Math.abs(x1 - x2), gridWidth - Math.abs(x1 - x2));
    let dy = Math.abs(y1 - y2);
    if (y1 === 0 && y2 === 0) {
        const halfSize = gridWidth / 2;
        if ((x1 < halfSize && x2 >= halfSize) || (x1 >= halfSize && x2 < halfSize)) {
            const leftX = x1 < halfSize ? x1 : x2;
            const rightX = x1 >= halfSize ? x1 : x2;
            dy = Math.min(dy, Math.abs(leftX + halfSize - rightX));
        }
    } else if (y1 === gridHeight - 1 && y2 === gridHeight - 1) {
        const halfSize = gridWidth / 2;
        if ((x1 < halfSize && x2 >= halfSize) || (x1 >= halfSize && x2 < halfSize)) {
            const leftX = x1 < halfSize ? x1 : x2;
            const rightX = x1 >= halfSize ? x1 : x2;
            dy = Math.min(dy, Math.abs(leftX + halfSize - rightX));
        }
    }
    return Math.hypot(dx, dy);
}

// トーラス上での最短経路の方向ベクトルを計算（角度計算用）
// 戻り値: { dx, dy } トーラス上での最短経路の方向
export function torusDirection(gridWidth, gridHeight, x1, y1, x2, y2) {
    const halfSize = gridWidth / 2;
    let bestDx = 0;
    let bestDy = 0;
    let bestDist = Infinity;

    // すべての可能な経路を試して最短のものを選ぶ
    const candidates = [];

    // 通常の経路（ラップなし）
    candidates.push({ dx: x2 - x1, dy: y2 - y1 });

    // x方向のラップを考慮
    const dx1 = x2 - x1;
    const dx2 = x2 > x1 ? x2 - gridWidth - x1 : x2 + gridWidth - x1;
    candidates.push({ dx: dx1, dy: y2 - y1 });
    candidates.push({ dx: dx2, dy: y2 - y1 });

    // 上端でのトーラス接続を考慮
    if (y1 === 0 && y2 === 0) {
        if ((x1 < halfSize && x2 >= halfSize) || (x1 >= halfSize && x2 < halfSize)) {
            const leftX = x1 < halfSize ? x1 : x2;
            const rightX = x1 >= halfSize ? x1 : x2;
            candidates.push({ dx: rightX - leftX - halfSize, dy: 0 });
        }
    } else if (y1 === gridHeight - 1 && y2 === gridHeight - 1) {
        if ((x1 < halfSize && x2 >= halfSize) || (x1 >= halfSize && x2 < halfSize)) {
            const leftX = x1 < halfSize ? x1 : x2;
            const rightX = x1 >= halfSize ? x1 : x2;
            candidates.push({ dx: rightX - leftX - halfSize, dy: 0 });
        }
    }

    // 上端から下端へのトーラス接続を考慮
    if (y1 === 0) {
        const wrappedX = x1 < halfSize ? x1 + halfSize : x1 - halfSize;
        candidates.push({ dx: wrappedX - x1, dy: gridHeight - 1 - y1 });
    }
    if (y1 === gridHeight - 1) {
        const wrappedX = x1 < halfSize ? x1 + halfSize : x1 - halfSize;
        candidates.push({ dx: wrappedX - x1, dy: 0 - y1 });
    }

    // 最短経路を選ぶ
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
// 戻り値: ラップ後の座標（無効ならnull）
export function torusWrap(gridWidth, gridHeight, x, y) {
    let wx = x;
    let wy = y;
    // 左右端の通常ラップ
    if (wx < 0) wx += gridWidth;
    if (wx >= gridWidth) wx -= gridWidth;
    const halfSize = gridWidth / 2;
    if (wy < 0) {
        // 上端越境: 上端行(0)に固定し、xを半幅シフトして接続
        if (wx < halfSize) {
            wx = wx + halfSize;
        } else {
            wx = wx - halfSize;
        }
        wy = 0;
    } else if (wy >= gridHeight) {
        // 下端越境: 下端行(gridHeight-1)に固定し、xを半幅シフトして接続
        if (wx < halfSize) {
            wx = wx + halfSize;
        } else {
            wx = wx - halfSize;
        }
        wy = gridHeight - 1;
    }
    if (wy < 0 || wy >= gridHeight) {
        return null;
    }
    return { x: wx, y: wy };
}


