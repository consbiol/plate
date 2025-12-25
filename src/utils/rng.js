// --- シード対応RNG（mulberry32 + xmur3） ---
// Grids_Calculation.vue で使っている決定論RNGをコンポーネント外に切り出し、
// 「同じ seed / 同じ labels なら同じ乱数列」を保証する。
//
// 注意:
// - 既存ロジックの乱数消費順を変えないため、呼び出し側で rng() の回数/順序を変えないこと。

export function xmur3(str) {
    const s = String(str);
    let h = 1779033703 ^ s.length;
    for (let i = 0; i < s.length; i++) {
        h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    return function () {
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        h ^= h >>> 16;
        return h >>> 0;
    };
}

export function mulberry32(a) {
    return function () {
        let t = (a += 0x6D2B79F5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function createSeededRng(seed) {
    if (seed === null || seed === undefined || seed === '') return null;
    const seedFn = xmur3(seed);
    const s = seedFn();
    return mulberry32(s);
}

// サブRNG（サブストリーム）生成: ベースseedにラベルを連結して独立RNGを作る
export function createDerivedRng(seed, ...labels) {
    if (seed === null || seed === undefined || seed === '') return null;
    const seedStr = [String(seed), ...labels.map((v) => String(v))].join('|');
    const h = xmur3(seedStr)();
    return mulberry32(h);
}


