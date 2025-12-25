// 隣接判定と「1グリッド島」判定

import { DIRS4, DIRS8 } from './constants';

export function makeIsAdjacent(vm, landMask, wantLand) {
    return (gx, gy) => {
        for (const d of DIRS4) {
            const w = vm.torusWrap(gx + d.dx, gy + d.dy);
            if (!w) continue;
            const nIdx = w.y * vm.gridWidth + w.x;
            const isLand = !!landMask[nIdx];
            if (wantLand ? isLand : !isLand) return true;
        }
        return false;
    };
}

// 1グリッド島（周囲8近傍に陸が存在しない）なら city 開始セルにしない
export function isOneCellIsland(vm, landMask, gx, gy) {
    const idx0 = gy * vm.gridWidth + gx;
    if (!landMask[idx0]) return false; // 陸でなければ対象外
    for (const d of DIRS8) {
        const w = vm.torusWrap(gx + d.dx, gy + d.dy);
        if (!w) continue;
        const nIdx = w.y * vm.gridWidth + w.x;
        if (landMask[nIdx]) return false; // 近傍に陸があれば1セル島ではない
    }
    return true;
}


