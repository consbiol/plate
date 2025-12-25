// 汎用ノイズ関数（地形生成や描画の補助）
// - Grids_Calculation.vue から切り出し（機能不変）

export function noise2D(x, y) {
    const s = Math.sin((x * 12.9898) + (y * 78.233)) * 43758.5453;
    const t = s - Math.floor(s);
    return t * 2 - 1;
}

export function fractalNoise2D(x, y, octaves = 3, persistence = 0.4, scale = 0.1) {
    let value = 0;
    let amplitude = 1;
    let frequency = scale;
    let maxValue = 0;
    for (let i = 0; i < octaves; i++) {
        value += noise2D(x * frequency, y * frequency) * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= 2;
    }
    return value / maxValue;
}


