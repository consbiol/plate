// vm._getDerivedRng の薄いラッパ（呼び出し箇所を統一する）

export function getStartRng(ctx, key, gx, gy, fallbackRng) {
    return ctx._getDerivedRng(key, gx, gy) || fallbackRng || Math.random;
}

export function getClusterRng(ctx, key, gx, gy) {
    return ctx._getDerivedRng(key, gx, gy) || Math.random;
}


