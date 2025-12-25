// vm._getDerivedRng の薄いラッパ（呼び出し箇所を統一する）

export function getStartRng(vm, key, gx, gy, fallbackRng) {
    return vm._getDerivedRng(key, gx, gy) || fallbackRng || Math.random;
}

export function getClusterRng(vm, key, gx, gy) {
    return vm._getDerivedRng(key, gx, gy) || Math.random;
}


