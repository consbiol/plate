// vm._getDerivedRng の薄いラッパ（呼び出し箇所を統一する）
import { pickRng } from '../../rng.js';

const resolveDerivedRng = (ctx, derivedRng) => (
    derivedRng
    || (ctx && typeof ctx.derivedRng === 'function' ? ctx.derivedRng : null)
    || (ctx && typeof ctx._getDerivedRng === 'function' ? ctx._getDerivedRng : null)
);

export function getStartRng(ctx, key, gx, gy, fallbackRng, derivedRng) {
    const getRng = resolveDerivedRng(ctx, derivedRng);
    return pickRng(getRng ? getRng(key, gx, gy) : null, fallbackRng);
}

export function getClusterRng(ctx, key, gx, gy, derivedRng) {
    const getRng = resolveDerivedRng(ctx, derivedRng);
    return pickRng(getRng ? getRng(key, gx, gy) : null);
}


