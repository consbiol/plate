export function getCellClassWeight(cell) {
    if (cell && cell.terrain) {
        if (cell.terrain.type === 'sea') return 1.0;
        if (cell.terrain.type === 'land') {
            const l = cell.terrain.land;
            if (l === 'desert') return 0.4;
            if (l === 'lake') return 1.0;
            return 0.8;
        }
    }
    return 1.0;
}

export function sampleClassWeightBilinear(u, v, width, height, gridData) {
    // u,v in [0,1], bilinear in grid index space (0..width-1, 0..height-1), u wraps, v clamps
    if (!gridData || gridData.length !== width * height) return 1.0;
    const x = Math.max(0, Math.min(width - 1, u * (width - 1)));
    const y = Math.max(0, Math.min(height - 1, v * (height - 1)));
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = Math.min(width - 1, x0 + 1);
    const y1 = Math.min(height - 1, y0 + 1);
    const tx = x - x0;
    const ty = y - y0;
    const idx00 = y0 * width + x0;
    const idx10 = y0 * width + x1;
    const idx01 = y1 * width + x0;
    const idx11 = y1 * width + x1;
    const w00 = getCellClassWeight(gridData[idx00]);
    const w10 = getCellClassWeight(gridData[idx10]);
    const w01 = getCellClassWeight(gridData[idx01]);
    const w11 = getCellClassWeight(gridData[idx11]);
    const wx0 = w00 * (1 - tx) + w10 * tx;
    const wx1 = w01 * (1 - tx) + w11 * tx;
    return wx0 * (1 - ty) + wx1 * ty;
}

export function sampleClassWeightSmooth(u, v, width, height, gridData, rUV) {
    // 3x3 サンプル（中心+斜め含め9タップ）、uはトーラス、vはクランプ
    const du = Math.max(0, rUV || 0);
    const dv = Math.max(0, rUV || 0);
    let sum = 0;
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            const uu = u + dx * du;
            const vv = v + dy * dv;
            const uuWrapped = ((uu % 1) + 1) % 1;
            const vvClamped = Math.max(0, Math.min(1, vv));
            sum += sampleClassWeightBilinear(uuWrapped, vvClamped, width, height, gridData);
            count += 1;
        }
    }
    return sum / Math.max(1, count);
}


