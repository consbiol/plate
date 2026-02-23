// vm._getDerivedRng の薄いラッパ（呼び出し箇所を統一する）
import { pickRng } from '../../rng.js';

export function getStartRng(ctx, key, gx, gy, fallbackRng) {
    return pickRng(ctx._getDerivedRng(key, gx, gy), fallbackRng);
}

export function getClusterRng(ctx, key, gx, gy) {
    return pickRng(ctx._getDerivedRng(key, gx, gy));
}


