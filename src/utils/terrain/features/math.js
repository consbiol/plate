// 小さな数値ユーティリティ

export function clamp01(x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return x;
}

export function clamp(min, x, max) {
    if (x < min) return min;
    if (x > max) return max;
    return x;
}


