import { updateSphereTextures } from './textures.js';
import { getEraCloudTint } from '../../../utils/colors.js';

/**
 * gridData/era/極設定などの変更後に、WebGLのテクスチャと関連uniformを更新する。
 * - map texture (u_texture)
 * - class texture (u_classTex)
 * - polar colors / buffer fractions
 */
export function updateSphereTexturesWebGL(vm) {
    const gl = vm?._gl;
    if (!gl) return false;
    const u = vm?._glUniforms;
    if (!u) return false;

    const res = updateSphereTextures(gl, vm, {
        tex: vm._glTex || null,
        classTex: vm._glClassTex || null,
        prevWidth: vm._glTexWidth || null,
        prevHeight: vm._glTexHeight || null
    });
    if (!res) return false;

    // swap textures if recreated
    if (res.tex) vm._glTex = res.tex;
    if (res.classTex) vm._glClassTex = res.classTex;
    vm._glTexWidth = res.width;
    vm._glTexHeight = res.height;

    // update texture-size uniforms
    if (u.u_texWidth) gl.uniform1f(u.u_texWidth, Math.max(1, res.width || 1));
    if (u.u_texHeight) gl.uniform1f(u.u_texHeight, Math.max(1, res.height || 1));

    // update polar/buffer uniforms
    if (u.u_topFrac) gl.uniform1f(u.u_topFrac, (res.effHeight > 0) ? (res.topBuf / res.effHeight) : 0);
    if (u.u_heightFrac) gl.uniform1f(u.u_heightFrac, (res.effHeight > 0) ? (res.height / res.effHeight) : 1);
    if (u.u_polarColorTop) gl.uniform3fv(u.u_polarColorTop, new Float32Array(res.polarTopRgb.map(c => c / 255)));
    if (u.u_polarColorBottom) gl.uniform3fv(u.u_polarColorBottom, new Float32Array(res.polarBottomRgb.map(c => c / 255)));

    // update blend/noise uniforms (these affect seam appearance)
    if (u.u_blendFrac) gl.uniform1f(u.u_blendFrac, (res.effHeight > 0) ? ((vm.polarBlendRows || 3) / res.effHeight) : 0);
    if (u.u_polarNoiseScale) gl.uniform1f(u.u_polarNoiseScale, vm.polarNoiseScale || 0.05);
    if (u.u_polarNoiseStrength) gl.uniform1f(u.u_polarNoiseStrength, vm.polarNoiseStrength || 0.3);

    // keep cloud color in sync too (era change hook)
    if (u.u_cloudColor) {
        const cloudHex = getEraCloudTint(vm.era);
        const c = vm.parseColorToRgb(cloudHex);
        const v = new Float32Array([(c[0] || 255) / 255, (c[1] || 255) / 255, (c[2] || 255) / 255]);
        gl.uniform3fv(u.u_cloudColor, v);
    }

    return true;
}


