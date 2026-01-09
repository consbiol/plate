import {
    buildClassPixels,
    buildMapPixels,
    computePolarAverageRgbFromPixels,
    computePolarBuffers
} from './pixelBuilders.js';

export function createSphereTextures(gl, vm) {
    const width = vm.gridWidth;
    const height = vm.gridHeight;

    // Ensure proper row alignment for texImage2D with arbitrary widths
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    // --- map texture ---
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    // Use linear filtering for smoother appearance when the texture is scaled
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // For non-power-of-two textures, REPEAT is not allowed in WebGL1.
    // Use CLAMP_TO_EDGE and handle wrapping in the shader via fract().
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Build stretched row mapping (same rules as CPU renderer)
    const expandedRowMapArr = [];
    for (let y = 0; y < height; y++) {
        const distTop = y;
        const distBottom = height - 1 - y;
        const minDist = Math.min(distTop, distBottom);
        let factor = 1;
        if (minDist <= 4) factor = 3;
        else if (minDist <= 14) factor = 2;
        for (let k = 0; k < factor; k++) expandedRowMapArr.push(y);
    }
    const stretchedHeight = expandedRowMapArr.length;
    // create original (non-stretched) pixels for polar average calculation
    const origPixels = buildMapPixels({ vm, width, height });
    // create stretched pixels for texture upload
    const pixels = buildMapPixels({ vm, width, height: stretchedHeight, expandedRowMap: expandedRowMapArr });
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, stretchedHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    // --- class texture ---
    const classTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, classTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const classPixels = buildClassPixels({ vm, width, height: stretchedHeight, expandedRowMap: expandedRowMapArr });
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, stretchedHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, classPixels);

    // --- polar/buffer meta ---
    // compute polar buffers based on stretched height
    const { topBuf, bottomBuf, effHeight } = computePolarBuffers(stretchedHeight, vm.polarBufferRows);
    // compute polar average from original (non-stretched) pixels so colours reflect original map rows
    const { polarTopRgb, polarBottomRgb } = computePolarAverageRgbFromPixels({
        pixels: origPixels,
        width,
        height,
        polarAvgRows: vm.polarAvgRows
    });

    return {
        width,
        height: stretchedHeight,
        tex,
        classTex,
        topBuf,
        bottomBuf,
        effHeight,
        polarTopRgb,
        polarBottomRgb
    };
}

/**
 * 既存の tex/classTex に対して内容を再アップロードする（可能なら再利用、サイズが変わるなら作り直し）。
 *
 * 戻り値は createSphereTextures と同様のメタ情報を返す（tex/classTexは再利用 or 新規）。
 */
export function updateSphereTextures(gl, vm, { tex = null, classTex = null, prevWidth = null, prevHeight = null } = {}) {
    const width = vm.gridWidth;
    const height = vm.gridHeight;

    const sizeChanged = (prevWidth != null && prevHeight != null)
        ? (prevWidth !== width || prevHeight !== height)
        : false;

    // サイズ変更 or テクスチャ未初期化なら作り直す
    if (!tex || !classTex || sizeChanged) {
        try {
            if (tex) gl.deleteTexture(tex);
            if (classTex) gl.deleteTexture(classTex);
        } catch (e) {
            // ignore
        }
        return createSphereTextures(gl, vm);
    }

    // Ensure proper row alignment for texImage2D with arbitrary widths
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    // --- map texture upload ---
    gl.bindTexture(gl.TEXTURE_2D, tex);
    // Build stretched row mapping (same rules as CPU renderer)
    const expandedRowMapArr = [];
    for (let y = 0; y < height; y++) {
        const distTop = y;
        const distBottom = height - 1 - y;
        const minDist = Math.min(distTop, distBottom);
        let factor = 1;
        if (minDist <= 4) factor = 3;
        else if (minDist <= 14) factor = 2;
        for (let k = 0; k < factor; k++) expandedRowMapArr.push(y);
    }
    const stretchedHeight = expandedRowMapArr.length;
    const pixels = buildMapPixels({ vm, width, height: stretchedHeight, expandedRowMap: expandedRowMapArr });
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, stretchedHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    // --- class texture upload ---
    gl.bindTexture(gl.TEXTURE_2D, classTex);
    const classPixels = buildClassPixels({ vm, width, height: stretchedHeight, expandedRowMap: expandedRowMapArr });
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, stretchedHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, classPixels);

    // --- polar/buffer meta ---
    const { topBuf, bottomBuf, effHeight } = computePolarBuffers(stretchedHeight, vm.polarBufferRows);
    const { polarTopRgb, polarBottomRgb } = computePolarAverageRgbFromPixels({
        pixels: buildMapPixels({ vm, width, height }), // original pixels for polar averaging
        width,
        height,
        polarAvgRows: vm.polarAvgRows
    });

    return {
        width,
        height: stretchedHeight,
        tex,
        classTex,
        topBuf,
        bottomBuf,
        effHeight,
        polarTopRgb,
        polarBottomRgb
    };
}


