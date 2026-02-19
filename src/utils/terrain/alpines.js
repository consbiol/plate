// 高山生成（高地に隣接しない高地セル）
// Grids_Calculation.vue から切り出し（機能不変）。

export function generateAlpines(ctx, colors, highlandColor, lowlandColor, desertColor, alpineColor, directions) {
    const N = ctx.gridWidth * ctx.gridHeight;
    const alpineMask = new Array(N).fill(false);
    for (let gy = 0; gy < ctx.gridHeight; gy++) {
        for (let gx = 0; gx < ctx.gridWidth; gx++) {
            const idx = gy * ctx.gridWidth + gx;
            if (colors[idx] !== highlandColor) continue;
            let touchesLowlandOrDesert = false;
            for (const dir of directions) {
                const wrapped = ctx.torusWrap(gx + dir.dx, gy + dir.dy);
                if (!wrapped) continue;
                const nIdx = wrapped.y * ctx.gridWidth + wrapped.x;
                const c = colors[nIdx];
                if (c === lowlandColor || c === desertColor) {
                    touchesLowlandOrDesert = true;
                    break;
                }
            }
            if (!touchesLowlandOrDesert) {
                alpineMask[idx] = true;
            }
        }
    }
    for (let i = 0; i < N; i++) {
        if (alpineMask[i]) {
            colors[i] = alpineColor;
        }
    }
}


