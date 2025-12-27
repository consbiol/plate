// 温度 → 氷河row（基準値）のアンカーと補間
// - Parameters_Display.vue / glacierRows.js で共通利用する

export const GLACIER_TEMP_ANCHORS = [
    { t: -25, val: 42 },
    { t: -15, val: 32 },
    { t: -5, val: 22 },
    { t: 5, val: 12 },
    { t: 10, val: 7 },
    { t: 15, val: 2 },
    { t: 25, val: -8 }
];

export const GLACIER_LAND_ANCHOR = { t: 15, val: 2 };

// 線形補間＋外挿（外側は「1℃上がると row が1減る」＝傾き -1）
export function computeGlacierBaseRowsFromTemperature(t) {
    const anchors = GLACIER_TEMP_ANCHORS;
    if (t <= anchors[0].t) {
        return anchors[0].val + (t - anchors[0].t) * (-1);
    }
    const last = anchors[anchors.length - 1];
    if (t >= last.t) {
        return last.val + (t - last.t) * (-1);
    }
    for (let i = 0; i < anchors.length - 1; i++) {
        const a = anchors[i];
        const b = anchors[i + 1];
        if (t >= a.t && t <= b.t) {
            const ratio = (t - a.t) / (b.t - a.t);
            return a.val + ratio * (b.val - a.val);
        }
    }
    return 0;
}


