// gridData -> displayColors 導出（+2 border）
// ※ `src/utils/colors.js` から再exportされる前提

import { getDefaultTerrainColors } from './palettes.js';

function cellToColor(cell, tc, preferPalette) {
    // preferPalette が true の場合は、colorHex を無視してパレットに従う
    if (!preferPalette && cell && typeof cell.colorHex === 'string') {
        return cell.colorHex;
    }
    // center(red) は最優先
    if (cell && cell.center) {
        return '#FF0000';
    }
    // 氷河は land/sea で分離して最優先で上書きする
    // - landGlacier: 陸域（低地/乾燥/高地/高山/ツンドラ/都市/農耕/苔/汚染 など）を上書き
    // - seaGlacier : 海域（深海/浅瀬/湖/海棲都市/海棲耕作/海棲汚染 など）を上書き
    if (cell && cell.terrain) {
        const isGlacier =
            (cell.terrain.type === 'sea' && cell.terrain.sea === 'glacier') ||
            (cell.terrain.type === 'land' && cell.terrain.land === 'glacier');
        if (isGlacier) {
            const landGl = (tc && (tc.landGlacier || tc.glacier)) || '#FFFFFF';
            const seaGl = (tc && (tc.seaGlacier || '#AFDFE4')) || '#AFDFE4';
            // gridData に glacierKind があればそれを優先（例: 湖上の氷河は sea 扱いにする）
            const kind = cell.glacierKind;
            if (kind === 'sea') return seaGl;
            if (kind === 'land') return landGl;
            // フォールバック: terrain の sea/land に従う
            return (cell.terrain.type === 'sea') ? seaGl : landGl;
        }
    }
    // 基礎色（地形種）を決定
    let base = tc.lowland;
    if (cell && cell.terrain) {
        if (cell.terrain.type === 'sea') {
            if (cell.terrain.sea === 'shallow') base = tc.shallowSea;
            else base = tc.deepSea;
        } else if (cell.terrain.type === 'land') {
            const l = cell.terrain.land;
            if (l === 'tundra') base = tc.tundra;
            else if (l === 'lake') base = (tc && tc.lake) ? tc.lake : tc.shallowSea;
            else if (l === 'highland') base = tc.highland;
            else if (l === 'alpine') base = tc.alpine;
            else if (l === 'desert') base = tc.desert;
            else base = tc.lowland;
        }
    }
    // 上書き優先度: seaPolluted > seaCity > seaCultivated > polluted > city > cultivated
    // 海棲グリッドの処理（浅瀬の場合）
    if (cell && cell.terrain && cell.terrain.type === 'sea' && cell.terrain.sea === 'shallow') {
        if (cell.seaPolluted) {
            return (tc && tc.seaPolluted) ? tc.seaPolluted : '#800080';
        }
        if (cell.seaCity) {
            return (tc && tc.seaCity) ? tc.seaCity : '#1A1F3A';
        }
        if (cell.seaCultivated) {
            return (tc && tc.seaCultivated) ? tc.seaCultivated : '#2E8B57';
        }
    }
    // 陸地の汚染地・都市・農耕地
    if (cell && cell.polluted) {
        return (tc && tc.polluted) ? tc.polluted : '#800080';
    }
    if (cell && cell.city) {
        return (tc && tc.city) ? tc.city : '#808080';
    }
    if (cell && cell.bryophyte) {
        return (tc && tc.bryophyte) ? tc.bryophyte : '#76A543';
    }
    if (cell && cell.cultivated) {
        return (tc && tc.cultivated) ? tc.cultivated : '#556655';
    }
    return base;
}

export function deriveDisplayColorsFromGridData(gridData, width, height, borderColor, defaultColors, preferPalette) {
    const tc = defaultColors || getDefaultTerrainColors();
    const border = borderColor || (tc.border || '#000000');
    const displayWidth = width + 2;
    const displayHeight = height + 2;
    const displayColors = new Array(displayWidth * displayHeight);
    for (let gy = 0; gy < displayHeight; gy++) {
        for (let gx = 0; gx < displayWidth; gx++) {
            const displayIdx = gy * displayWidth + gx;
            if (gy === 0 || gy === displayHeight - 1 || gx === 0 || gx === displayWidth - 1) {
                displayColors[displayIdx] = border;
            } else {
                const originalGy = gy - 1;
                const originalGx = gx - 1;
                const idx = originalGy * width + originalGx;
                const cell = gridData[idx];
                displayColors[displayIdx] = cellToColor(cell, tc, !!preferPalette);
            }
        }
    }
    return displayColors;
}


