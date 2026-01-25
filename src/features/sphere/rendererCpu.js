import { deriveDisplayColorsFromGridData, getEraTerrainColors, getEraLandTint, getEraCloudTint } from '../../utils/colors.js';

/**
 * Sphere の CPU レンダラ（元 `Sphere_Display.vue` の `drawSphere` を移植）。
 *
 * 互換性重視のため、第一段階では vm（Vueコンポーネントインスタンス）をそのまま受け取り、
 * 既存のキャッシュ（vm._precompute）やユーティリティメソッド（vm.parseColorToRgb 等）に依存する。
 */
export function drawSphereCPU(vm, canvas) {
    // 高速化版レンダリング: プリマップ + ImageData + パレット参照
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    const cx = Math.floor(W / 2);
    const cy = Math.floor(H / 2);
    // If popup set a fixed sphere radius on the canvas (dataset.fixedSphereR), use it
    const datasetR = (canvas && canvas.dataset && canvas.dataset.fixedSphereR) ? parseInt(canvas.dataset.fixedSphereR, 10) : null;
    const R = (datasetR && isFinite(datasetR)) ? datasetR : Math.floor(Math.min(W, H) * 0.30);

    const width = vm.gridWidth;
    const height = vm.gridHeight;
    const maxTotalBuf = Math.max(0, height - 2);
    const totalBuf = Math.max(0, Math.min(maxTotalBuf, vm.polarBufferRows));
    const topBuf = Math.floor(totalBuf / 2);
    const bottomBuf = totalBuf - topBuf;
    // Build stretched row map: rows near both poles are repeated to simulate vertical stretching.
    // Rules: adjusted for smoother transition
    // 0..1 -> 5.0x
    // 2..4 -> 3.0x
    // 5..14 -> 2.0x
    // 15..29 -> 1.3x
    const expandedRowMapArr = [];
    let accumulated = 0;
    for (let y = 0; y < height; y++) {
        const distTop = y;
        const distBottom = height - 1 - y;
        const minDist = Math.min(distTop, distBottom);
        let factor = 1.0;
        if (minDist <= 1) factor = 5.0;
        else if (minDist <= 4) factor = 3.0;
        else if (minDist <= 14) factor = 2.0;
        else if (minDist <= 29) factor = 1.3;

        accumulated += factor;
        while (accumulated >= 1) {
            expandedRowMapArr.push(y);
            accumulated -= 1;
        }
    }
    const stretchedHeight = expandedRowMapArr.length;
    const colShift = (vm._rotationColumns || 0);
    const cityRgb = vm._getCityLightRgb();

    // プリコンピュートのキャッシュ条件: canvasサイズ / mapサイズ / bufs
    // drawSphere start
    // derive displayColors once (available outside precompute block)
    const eraColors = getEraTerrainColors(vm.era);
    let displayColors = (vm.gridData && vm.gridData.length === width * height)
        ? deriveDisplayColorsFromGridData(vm.gridData, width, height, undefined, eraColors, /*preferPalette*/ true)
        : [];

    if (!vm._precompute || vm._precompute.W !== W || vm._precompute.H !== H || vm._precompute.width !== width || vm._precompute.height !== height || vm._precompute.topBuf !== topBuf || vm._precompute.bottomBuf !== bottomBuf) {
        const displayStride = width + 2;
        const effHeight = stretchedHeight + topBuf + bottomBuf;
        const expectedDisplayLen2 = (width + 2) * (height + 2);
        if (!displayColors || displayColors.length < expectedDisplayLen2) {
            displayColors = new Array(expectedDisplayLen2);
            for (let i = 0; i < expectedDisplayLen2; i++) {
                displayColors[i] = 'rgb(80,80,80)';
            }
        }
        // パレット作成（display配列インデックス -> RGB）
        const palette = new Uint8ClampedArray(displayColors.length * 3);
        for (let i = 0; i < displayColors.length; i++) {
            const rgb = vm.parseColorToRgb(displayColors[i]);
            const outIdx = i * 3;
            palette[outIdx] = rgb[0];
            palette[outIdx + 1] = rgb[1];
            palette[outIdx + 2] = rgb[2];
        }
        // ピクセルごとのマップ参照情報を作成
        const pixels = [];
        const baseIxArr = [];
        const iyMapArr = [];
        const isPolarArr = [];
        const polarSideArr = [];
        const mercYArr = [];
        for (let py = -R; py <= R; py++) {
            for (let px = -R; px <= R; px++) {
                const x2 = px * px;
                const y2 = py * py;
                if (x2 + y2 > R * R) continue;
                const sx = px / R;
                const sy = -py / R;
                const sq = sx * sx + sy * sy;
                if (sq > 1) continue;
                const sz = Math.sqrt(Math.max(0, 1 - sq));
                const phi = Math.asin(sy);
                const lambda = Math.atan2(sx, sz);
                const mercY = 0.5 - (Math.log(Math.tan(Math.PI / 4 + phi / 2)) / (2 * Math.PI));
                const xNorm = (lambda + Math.PI) / (2 * Math.PI);
                let ix0 = Math.floor(xNorm * width);
                const vPos = mercY * effHeight;
                let iyExt = Math.floor(vPos);
                if (ix0 < 0) ix0 = 0;
                if (ix0 >= width) ix0 = width - 1;
                if (iyExt < 0) { iyExt = 0; }
                if (iyExt >= effHeight) { iyExt = effHeight - 1; }
                if (iyExt < topBuf || iyExt >= topBuf + stretchedHeight) {
                    // polar region: keep ix0 for nearest column sampling
                    baseIxArr.push(ix0);
                    iyMapArr.push(0);
                    isPolarArr.push(1);
                    // polarSide: 1 = top, 2 = bottom
                    if (iyExt < topBuf) {
                        polarSideArr.push(1);
                    } else {
                        polarSideArr.push(2);
                    }
                } else {
                    // inside stretched map region: map stretched index back to original row
                    const stretchedIndex = iyExt - topBuf;
                    const origRow = expandedRowMapArr[stretchedIndex];
                    baseIxArr.push(ix0);
                    iyMapArr.push(origRow);
                    // store fractional offset within the stretched slot for smoother vCoord
                    // (we'll create fracArr below)
                    isPolarArr.push(0);
                    polarSideArr.push(0);
                }
                mercYArr.push(mercY);
                pixels.push({ px, py });
            }
        }
        // create fractional array mapping if not existing
        const fracArrFinal = new Float32Array(pixels.length);
        // We need to recompute fractional parts consistently — recompute using mercY and effHeight
        for (let i = 0, pi = 0; i < pixels.length; i++, pi++) {
            const mercYval = mercYArr[i];
            const vPos2 = mercYval * effHeight;
            let iyExt2 = Math.floor(vPos2);
            let frac2 = vPos2 - iyExt2;
            if (iyExt2 < 0) { iyExt2 = 0; frac2 = 0; }
            if (iyExt2 >= effHeight) { iyExt2 = effHeight - 1; frac2 = 0; }
            // if polar, frac not used; leave as 0
            if (iyExt2 >= topBuf && iyExt2 < topBuf + stretchedHeight) {
                // fraction within the repeated block: frac2 remains as is
                fracArrFinal[i] = frac2;
            } else {
                fracArrFinal[i] = 0;
            }
        }
        vm._precompute = {
            W, H, R, cx, cy, width, height, topBuf, bottomBuf, pixels,
            baseIx: Int16Array.from(baseIxArr),
            iyMap: Int16Array.from(iyMapArr),
            isPolar: Uint8Array.from(isPolarArr),
            polarSide: Uint8Array.from(polarSideArr),
            mercY: Float32Array.from(mercYArr),
            frac: fracArrFinal,
            expandedRowMap: Int16Array.from(expandedRowMapArr),
            stretchedHeight,
            palette, displayStride
        };
    }

    // ImageData に描画
    const pc = vm._precompute;
    const imageData = ctx.createImageData(W, H);
    const data = imageData.data;
    const displayStride = pc.displayStride;
    const pal = pc.palette;
    const pCount = pc.pixels.length;
    // determine polar buffer colors from top/bottom map rows (most frequent color)
    let polarTopRgb = [255, 255, 255];
    let polarBottomRgb = [255, 255, 255];
    try {
        // use the already-derived displayColors array (created above) to determine polar colors
        if (displayColors && displayColors.length >= (width + 2) * (height + 2)) {
            const stride = width + 2;
            const topY = 1;
            const bottomY = height;
            const countsTop = new Map();
            const countsBottom = new Map();
            for (let x = 1; x <= width; x++) {
                const topIdx = topY * stride + x;
                const bottomIdx = bottomY * stride + x;
                const tc = displayColors[topIdx] || '';
                const bc = displayColors[bottomIdx] || '';
                countsTop.set(tc, (countsTop.get(tc) || 0) + 1);
                countsBottom.set(bc, (countsBottom.get(bc) || 0) + 1);
            }
            const pickMost = (m) => {
                let best = null, bestCount = -1;
                for (const [k, v] of m.entries()) { if (v > bestCount) { best = k; bestCount = v; } }
                return best;
            };
            const topColor = pickMost(countsTop);
            const bottomColor = pickMost(countsBottom);
            if (topColor) polarTopRgb = vm.parseColorToRgb(topColor);
            if (bottomColor) polarBottomRgb = vm.parseColorToRgb(bottomColor);
        }
    } catch (e) {
        // fall back to white if anything fails
        polarTopRgb = [255, 255, 255];
        polarBottomRgb = [255, 255, 255];
    }

    for (let i = 0; i < pCount; i++) {
        const p = pc.pixels[i];
        const x = pc.cx + p.px;
        const y = pc.cy + p.py;
        const offset = (y * W + x) * 4;
        // 共通: 雲ノイズ座標（極バッファ含む全域）
        const vEff = Math.max(0, Math.min(1, pc.mercY ? pc.mercY[i] : 0.5));
        if (pc.isPolar[i]) {
            const side = pc.polarSide ? pc.polarSide[i] : 1;
            const colPolar = (side === 1) ? polarTopRgb : polarBottomRgb;
            // sample map color at nearest column, border row (display row 1 for top, height for bottom)
            const ix0 = pc.baseIx[i];
            const displayX = (ix0 % width) + 1;
            const displayYMap = (side === 1) ? 1 : height;
            const mapIdx = displayYMap * pc.displayStride + displayX;
            const mapColorStr = displayColors[mapIdx] || 'rgb(0,0,0)';
            let colMap = vm.parseColorToRgb(mapColorStr);
            // 分類重み（海/陸/乾燥）取得用のマップ座標
            const xMap = (displayX - 1 + (vm._rotationColumns || 0)) % width;
            const yMap = (side === 1) ? 0 : (height - 1);
            // 雲クラス重み（UV基準の9タップ平滑・バイリニア補間）
            let classW = 1.0;
            // 極近傍でも陸（氷河除く）なら軽くトーンを足す（近似）
            if (vm.gridData && vm.gridData.length === width * height) {
                // 連続uv（map域）を算出し、uvオフセットに基づく9サンプル平均を取得
                const effHeightLocal = pc.stretchedHeight + topBuf + bottomBuf;
                const uTopFrac = topBuf / effHeightLocal;
                const uHeightFrac = pc.stretchedHeight / effHeightLocal;
                const sx = p.px / R;
                const sy = -p.py / R;
                const sq = sx * sx + sy * sy;
                const sz = Math.sqrt(Math.max(0, 1 - Math.min(1, sq)));
                const lambda = Math.atan2(sx, sz);
                const uCoord = (((lambda + Math.PI) / (2 * Math.PI)) + (vm._rotationColumns || 0) / Math.max(1, width)) % 1;
                // For polar-region pixels we map mercY into stretched space; clamp into [0,1]
                const vCoord = Math.max(0, Math.min(1, (vEff - uTopFrac) / Math.max(1e-6, uHeightFrac)));
                const cloudPeriod = (typeof vm._getCloudPeriodForRender === 'function') ? vm._getCloudPeriodForRender() : vm.cloudPeriod;
                const rUV = 0.75 / Math.max(1, cloudPeriod || 16);
                classW = vm._sampleClassWeightSmooth(uCoord, vCoord, width, height, vm.gridData, rUV);
                const cell = vm.gridData[yMap * width + xMap];
                if (cell && cell.terrain && cell.terrain.type === 'land' && cell.terrain.land !== 'glacier') {
                    const tint = vm.parseColorToRgb(vm.landTintColor || getEraLandTint(vm.era));
                    const k = Math.max(0, Math.min(1, (vm.landTintStrength || 0) * 0.6)); // 極はやや弱め
                    colMap = [
                        Math.round(colMap[0] * (1 - k) + tint[0] * k),
                        Math.round(colMap[1] * (1 - k) + tint[1] * k),
                        Math.round(colMap[2] * (1 - k) + tint[2] * k)
                    ];
                }
            }
            // blending weight based on vertical distance (mercY) and polarBlendRows
            const mercY = (pc.mercY && pc.mercY[i] != null) ? pc.mercY[i] : ((side === 1) ? 0 : 1);
            const effHeightLocal = pc.stretchedHeight + topBuf + bottomBuf;
            const uTopFrac = topBuf / effHeightLocal;
            const uHeightFrac = pc.stretchedHeight / effHeightLocal;
            const blendRows = Math.max(0, Math.min(vm.polarBlendRows || 3, Math.floor(effHeightLocal)));
            const blendFrac = blendRows / effHeightLocal;
            let delta = 0;
            if (side === 1) delta = uTopFrac - mercY;
            else delta = mercY - (uTopFrac + uHeightFrac);
            let polarWeight = 1.0;
            if (blendFrac > 0) {
                polarWeight = Math.max(0, Math.min(1, delta / blendFrac));
            }
            // add fractal noise to break straight seam
            const n = vm._fractalNoise2D((pc.cx + p.px) * (vm.polarNoiseScale || 0.05), (pc.cy + p.py) * (vm.polarNoiseScale || 0.05), 4, 0.5);
            polarWeight = Math.max(0, Math.min(1, polarWeight + (n - 0.5) * (vm.polarNoiseStrength || 0.3)));
            const mapWeight = 1 - polarWeight;
            const r = Math.round(colPolar[0] * polarWeight + colMap[0] * mapWeight);
            const g = Math.round(colPolar[1] * polarWeight + colMap[1] * mapWeight);
            const b = Math.round(colPolar[2] * polarWeight + colMap[2] * mapWeight);
            // --- 雲オーバーレイ（描画後に適用） ---
            // 経度u: 回転を反映したマップ列から推定
            const uEff = ((xMap % width) + width) % width / width;
            // クラウド有効度
            const fCloud = (typeof vm._getFCloudForRender === 'function') ? vm._getFCloudForRender() : vm.f_cloud;
            const effC = Math.max(0, Math.min(1, (fCloud || 0) * classW));
            let rr = r, gg = g, bb = b;
            if (effC > 0) {
                const cloudPeriod = (typeof vm._getCloudPeriodForRender === 'function') ? vm._getCloudPeriodForRender() : vm.cloudPeriod;
                const nCloud = vm._fbmTile(uEff, vEff, cloudPeriod || 16);
                let t = 0.9 + (0.2 - 0.9) * effC; // mix(0.9,0.2,effC)
                // 極ブースト: vEffが0/1に近いほど閾値を下げる（端で1, 赤道で0）
                const pole = Math.max(0, Math.min(1, Math.abs(0.5 - vEff) / 0.5));
                const polarCloudBoost = (typeof vm._getPolarCloudBoostForRender === 'function') ? vm._getPolarCloudBoostForRender() : vm.polarCloudBoost;
                const boost = Math.max(0, Math.min(1, polarCloudBoost || 0));
                const tAdj = 0.25 * boost * pole;
                t = Math.max(0, Math.min(1, t - tAdj));
                const edge = 0.08;
                // smoothstep(t-edge, t+edge, nCloud)
                let coverage = 0;
                if (nCloud <= t - edge) coverage = 0;
                else if (nCloud >= t + edge) coverage = 1;
                else coverage = (nCloud - (t - edge)) / (2 * edge);
                const alpha = 0.35 + 0.45 * Math.sqrt(effC);
                const depth = Math.max(0, Math.min(1, (nCloud - t) / Math.max(1e-3, 1 - t)));
                const detail = vm._fbmTile((uEff + 0.123) % 1, (vEff + 0.456) % 1, (cloudPeriod || 16) * 4);
                const density = 0.3 + (1.0 - 0.3) * (0.5 * detail + 0.5 * depth);
                const k = Math.max(0, Math.min(1, coverage * alpha * density));
                const cloudTint = vm.parseColorToRgb(getEraCloudTint(vm.era));
                rr = Math.round(rr * (1 - k) + cloudTint[0] * k);
                gg = Math.round(gg * (1 - k) + cloudTint[1] * k);
                bb = Math.round(bb * (1 - k) + cloudTint[2] * k);
            }
            // --- 太陽の影（夜側） ---
            const colForSun = ((ix0 + colShift) % width + width) % width;
            const aNight = vm._sunShadowEnabled ? vm._nightAlphaForCol(colForSun, width) : 0;
            if (aNight > 0) {
                // smooth city intensity by 2x2 neighbor average
                let cityCount = 0;
                if (vm.gridData && vm.gridData.length === width * height) {
                    const sx0 = xMap;
                    const sx1 = (xMap + 1) % width;
                    const sy0 = yMap;
                    const sy1 = yMap + 1;
                    // sample (sx0,sy0), (sx1,sy0), (sx0,sy1), (sx1,sy1)
                    const coords = [[sx0, sy0], [sx1, sy0], [sx0, sy1], [sx1, sy1]];
                    for (let si = 0; si < coords.length; si++) {
                        const sx = ((coords[si][0] % width) + width) % width;
                        const sy = coords[si][1];
                        if (sy >= 0 && sy < height) {
                            const c = vm.gridData[sy * width + sx];
                            if (vm._isCityCell(c)) cityCount++;
                        }
                    }
                }
                const cityIntensity = Math.max(0, Math.min(1, cityCount / 4));
                const darkR = Math.round(rr * (1 - aNight));
                const darkG = Math.round(gg * (1 - aNight));
                const darkB = Math.round(bb * (1 - aNight));
                rr = Math.round(darkR * (1 - cityIntensity) + cityRgb[0] * cityIntensity);
                gg = Math.round(darkG * (1 - cityIntensity) + cityRgb[1] * cityIntensity);
                bb = Math.round(darkB * (1 - cityIntensity) + cityRgb[2] * cityIntensity);
            }
            data[offset] = rr;
            data[offset + 1] = gg;
            data[offset + 2] = bb;
            data[offset + 3] = 255;
        } else {
            const ix0 = pc.baseIx[i];
            const iy = pc.iyMap[i];
            const displayX = ((ix0 + colShift) % width + width) % width + 1;
            const displayY = iy + 1;
            const displayIdx = displayY * displayStride + displayX;
            const pi = displayIdx * 3;
            let r = pal[pi] || 255;
            let g = pal[pi + 1] || 255;
            let b = pal[pi + 2] || 255;
            // 陸（氷河除く）に青灰色トーンを適用
            // 分類重み（UV基準の9タップ平滑・バイリニア補間）
            let classW = 1.0;
            if (vm.gridData && vm.gridData.length === width * height) {
                // compute continuous vCoord using precomputed original row and fractional offset
                const iyOrig = pc.iyMap[i];
                const frac = pc.frac ? pc.frac[i] || 0 : 0;
                const vCoord = Math.max(0, Math.min(1, (iyOrig + frac) / Math.max(1, height)));
                const sx = p.px / R;
                const sy = -p.py / R;
                const sq = sx * sx + sy * sy;
                const sz = Math.sqrt(Math.max(0, 1 - Math.min(1, sq)));
                const lambda = Math.atan2(sx, sz);
                const uCoord = (((lambda + Math.PI) / (2 * Math.PI)) + (vm._rotationColumns || 0) / Math.max(1, width)) % 1;
                const cloudPeriod = (typeof vm._getCloudPeriodForRender === 'function') ? vm._getCloudPeriodForRender() : vm.cloudPeriod;
                const rUV = 0.75 / Math.max(1, cloudPeriod || 16);
                classW = vm._sampleClassWeightSmooth(uCoord, vCoord, width, height, vm.gridData, rUV);
                // 陸トーン適用のためのセル参照（グリッド座標）
                const xMap = ((ix0 + colShift) % width + width) % width;
                const yMap = iy;
                const cell = vm.gridData[yMap * width + xMap];
                if (cell && cell.terrain && cell.terrain.type === 'land' && cell.terrain.land !== 'glacier') {
                    const tint = vm.parseColorToRgb(vm.landTintColor || getEraLandTint(vm.era));
                    const k = Math.max(0, Math.min(1, vm.landTintStrength || 0));
                    r = Math.round(r * (1 - k) + tint[0] * k);
                    g = Math.round(g * (1 - k) + tint[1] * k);
                    b = Math.round(b * (1 - k) + tint[2] * k);
                }
            }
            // --- 雲オーバーレイ（描画後に適用） ---
            // 経度u: 回転を反映したマップ列から
            const uEff = ((((ix0 + colShift) % width) + width) % width) / width;
            const fCloud = (typeof vm._getFCloudForRender === 'function') ? vm._getFCloudForRender() : vm.f_cloud;
            const effC = Math.max(0, Math.min(1, (fCloud || 0) * classW));
            let rr = r, gg = g, bb = b;
            if (effC > 0) {
                const cloudPeriod = (typeof vm._getCloudPeriodForRender === 'function') ? vm._getCloudPeriodForRender() : vm.cloudPeriod;
                const nCloud = vm._fbmTile(uEff, vEff, cloudPeriod || 16);
                let t = 0.9 + (0.2 - 0.9) * effC;
                // 極ブースト（端で1, 赤道で0）
                const pole = Math.max(0, Math.min(1, Math.abs(0.5 - vEff) / 0.5));
                const polarCloudBoost = (typeof vm._getPolarCloudBoostForRender === 'function') ? vm._getPolarCloudBoostForRender() : vm.polarCloudBoost;
                const boost = Math.max(0, Math.min(1, polarCloudBoost || 0));
                const tAdj = 0.25 * boost * pole;
                t = Math.max(0, Math.min(1, t - tAdj));
                const edge = 0.08;
                let coverage = 0;
                if (nCloud <= t - edge) coverage = 0;
                else if (nCloud >= t + edge) coverage = 1;
                else coverage = (nCloud - (t - edge)) / (2 * edge);
                const alpha = 0.35 + 0.45 * Math.sqrt(effC);
                const depth = Math.max(0, Math.min(1, (nCloud - t) / Math.max(1e-3, 1 - t)));
                const detail = vm._fbmTile((uEff + 0.123) % 1, (vEff + 0.456) % 1, (cloudPeriod || 16) * 4);
                const density = 0.3 + (1.0 - 0.3) * (0.5 * detail + 0.5 * depth);
                const k = Math.max(0, Math.min(1, coverage * alpha * density));
                const cloudTint = vm.parseColorToRgb(getEraCloudTint(vm.era));
                rr = Math.round(rr * (1 - k) + cloudTint[0] * k);
                gg = Math.round(gg * (1 - k) + cloudTint[1] * k);
                bb = Math.round(bb * (1 - k) + cloudTint[2] * k);
            }
            // --- 太陽の影（夜側） ---
            const colForSun = ((ix0 + colShift) % width + width) % width;
            const aNight = vm._sunShadowEnabled ? vm._nightAlphaForCol(colForSun, width) : 0;
            if (aNight > 0) {
                // smooth city intensity by 2x2 neighbor average
                let cityCount = 0;
                let xCenter = ((ix0 + colShift) % width + width) % width;
                let yCenter = iy;
                if (vm.gridData && vm.gridData.length === width * height) {
                    const sx0 = xCenter;
                    const sx1 = (xCenter + 1) % width;
                    const sy0 = yCenter;
                    const sy1 = yCenter + 1;
                    const coords = [[sx0, sy0], [sx1, sy0], [sx0, sy1], [sx1, sy1]];
                    for (let si = 0; si < coords.length; si++) {
                        const sx = ((coords[si][0] % width) + width) % width;
                        const sy = coords[si][1];
                        if (sy >= 0 && sy < height) {
                            const c = vm.gridData[sy * width + sx];
                            if (vm._isCityCell(c)) cityCount++;
                        }
                    }
                }
                const cityIntensity = Math.max(0, Math.min(1, cityCount / 4));
                const darkR = Math.round(rr * (1 - aNight));
                const darkG = Math.round(gg * (1 - aNight));
                const darkB = Math.round(bb * (1 - aNight));
                rr = Math.round(darkR * (1 - cityIntensity) + cityRgb[0] * cityIntensity);
                gg = Math.round(darkG * (1 - cityIntensity) + cityRgb[1] * cityIntensity);
                bb = Math.round(darkB * (1 - cityIntensity) + cityRgb[2] * cityIntensity);
            }
            data[offset] = rr;
            data[offset + 1] = gg;
            data[offset + 2] = bb;
            data[offset + 3] = 255;
        }
    }
    ctx.putImageData(imageData, 0, 0);
    // 円の枠線（2ドットの灰色縁取り）
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    ctx.stroke();
}


