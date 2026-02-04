import {
    deriveDisplayColorsFromGridData,
    getEraTerrainColors,
    getEraLandTint
} from '../../../utils/colors.js';
import { rand2 } from '../cloudNoise.js';
import { getCellClassWeight } from '../classWeight.js';
import { isCityCell as isCityCellShared } from '../nightShadow.js';

export function computePolarBuffers(height, polarBufferRows) {
    const maxTotalBuf = Math.max(0, height - 2);
    const totalBuf = Math.max(0, Math.min(maxTotalBuf, polarBufferRows));
    const topBuf = Math.floor(totalBuf / 2);
    const bottomBuf = totalBuf - topBuf;
    const effHeight = height + topBuf + bottomBuf;
    return { topBuf, bottomBuf, effHeight };
}

export function computePolarAverageRgbFromPixels({ pixels, width, height, polarAvgRows }) {
    let polarTopRgb = [255, 255, 255];
    let polarBottomRgb = [255, 255, 255];
    try {
        const rows = Math.max(1, Math.min(polarAvgRows || 1, Math.floor(height / 2)));
        let sumTop = [0, 0, 0], sumBottom = [0, 0, 0];
        let countTop = 0, countBottom = 0;
        // pixels is width*height*4, row-major, y from 0..height-1 (top to bottom)
        for (let ry = 0; ry < rows; ry++) {
            const yTop = ry;
            const yBottom = height - 1 - ry;
            for (let x = 0; x < width; x++) {
                const pTopIdx = (yTop * width + x) * 4;
                const pBottomIdx = (yBottom * width + x) * 4;
                const rT = pixels[pTopIdx], gT = pixels[pTopIdx + 1], bT = pixels[pTopIdx + 2];
                const rB = pixels[pBottomIdx], gB = pixels[pBottomIdx + 1], bB = pixels[pBottomIdx + 2];
                sumTop[0] += rT; sumTop[1] += gT; sumTop[2] += bT; countTop++;
                sumBottom[0] += rB; sumBottom[1] += gB; sumBottom[2] += bB; countBottom++;
            }
        }
        if (countTop > 0) polarTopRgb = [Math.round(sumTop[0] / countTop), Math.round(sumTop[1] / countTop), Math.round(sumTop[2] / countTop)];
        if (countBottom > 0) polarBottomRgb = [Math.round(sumBottom[0] / countBottom), Math.round(sumBottom[1] / countBottom), Math.round(sumBottom[2] / countBottom)];
    } catch (e) {
        polarTopRgb = [255, 255, 255];
        polarBottomRgb = [255, 255, 255];
    }
    return { polarTopRgb, polarBottomRgb };
}

export function buildMapPixels({ vm, width, height, expandedRowMap = null }) {
    // original map height (from gridData) if available, otherwise fall back to provided height
    const origHeight = (vm.gridData && vm.gridData.length % width === 0) ? (vm.gridData.length / width) : height;
    const expectedDisplayLen = (width + 2) * (origHeight + 2);
    const eraColors = getEraTerrainColors(vm.era);
    const displayColorsFromGridData = (vm.gridData && vm.gridData.length === width * origHeight)
        ? deriveDisplayColorsFromGridData(vm.gridData, width, origHeight, undefined, eraColors, /*preferPalette*/ true)
        : [];

    let displayColors = displayColorsFromGridData;
    if (!displayColorsFromGridData || displayColorsFromGridData.length < expectedDisplayLen) {
        // gridData が無い場合はプレースホルダー色で描画を継続
        displayColors = new Array(expectedDisplayLen);
        for (let i = 0; i < expectedDisplayLen; i++) displayColors[i] = 'rgb(0,0,0)';
    }

    const displayStride = width + 2;
    const pixels = new Uint8Array(width * height * 4);
    for (let sy = 0; sy < height; sy++) {
        const y = expandedRowMap ? expandedRowMap[sy] : sy;
        for (let x = 0; x < width; x++) {
            const displayX = x + 1;
            const displayY = y + 1;
            const idx = displayY * displayStride + displayX;
            const s = displayColors[idx];
            let rgb = vm.parseColorToRgb(s);
            // 陸（氷河除く）にトーン（color.js）を適用（事後的フィルタ）
            if (vm.gridData && vm.gridData.length === width * origHeight) {
                const cell = vm.gridData[y * width + x];
                if (cell && cell.terrain && cell.terrain.type === 'land' && cell.terrain.land !== 'glacier') {
                    const tint = vm.parseColorToRgb(vm.landTintColor || getEraLandTint(vm.era));
                    const k = Math.max(0, Math.min(1, vm.landTintStrength || 0));
                    // ランダム濃淡
                    const nVar = rand2(x, y); // util imported
                    const shade = 1.0 + (nVar - 0.5) * 0.1;
                    rgb = [
                        Math.max(0, Math.min(255, Math.round((rgb[0] * (1 - k) + tint[0] * k) * shade))),
                        Math.max(0, Math.min(255, Math.round((rgb[1] * (1 - k) + tint[1] * k) * shade))),
                        Math.max(0, Math.min(255, Math.round((rgb[2] * (1 - k) + tint[2] * k) * shade)))
                    ];
                }
            }
            const p = (sy * width + x) * 4;
            pixels[p] = rgb[0];
            pixels[p + 1] = rgb[1];
            pixels[p + 2] = rgb[2];
            pixels[p + 3] = 255;
        }
    }
    return pixels;
}

export function buildClassPixels({ vm, width, height, expandedRowMap = null }) {
    const classPixels = new Uint8Array(width * height * 4);
    const origHeight = (vm.gridData && vm.gridData.length % width === 0) ? (vm.gridData.length / width) : height;
    for (let sy = 0; sy < height; sy++) {
        const y = expandedRowMap ? expandedRowMap[sy] : sy;
        for (let x = 0; x < width; x++) {
            let wgt = 1.0; // default 海
            let isCity = 0;
            if (vm.gridData && vm.gridData.length === width * origHeight) {
                const cell = vm.gridData[y * width + x];
                wgt = getCellClassWeight(cell);
                const city =
                    (typeof vm._isCityCell === 'function')
                        ? vm._isCityCell(cell)
                        : isCityCellShared(cell);
                if (city) isCity = 255;
            }
            const vv = Math.max(0, Math.min(255, Math.round(wgt * 255)));
            const p = (sy * width + x) * 4;
            classPixels[p] = vv;          // R: class weight (cloud weighting)
            classPixels[p + 1] = isCity;  // G: city mask (night lights)
            classPixels[p + 2] = 0;       // B: unused
            classPixels[p + 3] = 255;
        }
    }
    return classPixels;
}


