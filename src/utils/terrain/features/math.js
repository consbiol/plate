// 小さな数値ユーティリティ
import { clamp as clampValue, clamp01 as clamp01Value } from '../../math.js';

export function clamp01(x) {
    return clamp01Value(x);
}

export function clamp(min, x, max) {
    return clampValue(x, min, max);
}


