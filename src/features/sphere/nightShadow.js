export function getNightConfig(width) {
    const w = Math.max(1, Math.floor(width || 1));
    const len = Math.floor(w / 2); // hemisphere = half columns
    const start = 0; // fixed in "sun longitude" space (no rotation offset)
    const grad = 10; // 10 columns at each edge are gradient region
    return { w, start, len, grad };
}

// alpha in [0,1]: 0 = no shadow, 1 = fully black
export function nightAlphaForCol(col, width) {
    const cfg = getNightConfig(width);
    const w = cfg.w;
    const len = cfg.len;
    const grad = Math.max(0, Math.floor(cfg.grad || 0));
    if (len <= 0) return 0;
    const x = ((Math.floor(col) % w) + w) % w;
    const s = ((cfg.start % w) + w) % w;
    const distFromStart = ((x - s) % w + w) % w; // 0..w-1
    if (distFromStart >= len) return 0; // outside night
    if (grad <= 1) return 1;
    const dEdge = Math.min(distFromStart, (len - 1) - distFromStart); // 0 at edge, grows inward
    if (dEdge >= grad - 1) return 1;
    return Math.max(0, Math.min(1, dEdge / (grad - 1)));
}

export function isCityCell(cell) {
    // 「cityグリッド」または海棲都市をライト対象とする
    return !!(cell && (cell.city || cell.seaCity));
}

export function getCityLightRgb() {
    // 宇宙から見た都市の光（明るい黄色）
    return [255, 240, 140];
}


