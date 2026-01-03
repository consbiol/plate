import { getEraCloudTint } from '../../../utils/colors.js';

export function drawSphereWebGL(vm) {
    const gl = vm._gl;
    if (!gl) return;
    const canvas = vm._sphereCanvas;
    gl.viewport(0, 0, canvas.width, canvas.height);
    const prog = vm._glProg;
    gl.useProgram(prog);

    // ensure texture bound to TEXTURE0
    gl.activeTexture(gl.TEXTURE0);
    if (vm._glTex) gl.bindTexture(gl.TEXTURE_2D, vm._glTex);
    // bind class texture to TEXTURE1
    gl.activeTexture(gl.TEXTURE1);
    if (vm._glClassTex) gl.bindTexture(gl.TEXTURE_2D, vm._glClassTex);
    // restore active 0 for consistency (optional)
    gl.activeTexture(gl.TEXTURE0);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const datasetR = (canvas && canvas.dataset && canvas.dataset.fixedSphereR) ? parseInt(canvas.dataset.fixedSphereR, 10) : null;
    const R = (datasetR && isFinite(datasetR)) ? datasetR : Math.floor(Math.min(canvas.width, canvas.height) * 0.30);
    gl.uniform1f(vm._glUniforms.u_cx, cx);
    gl.uniform1f(vm._glUniforms.u_cy, cy);
    gl.uniform1f(vm._glUniforms.u_R, R);
    const offsetFrac = ((vm._rotationColumns || 0) / Math.max(1, vm.gridWidth));
    gl.uniform1f(vm._glUniforms.u_offset, offsetFrac);

    // update sun shadow params per-frame (button反映)
    if (vm._glUniforms && vm._glUniforms.u_shadowEnabled) {
        gl.uniform1f(vm._glUniforms.u_shadowEnabled, vm._sunShadowEnabled ? 1.0 : 0.0);
    }
    if (vm._glUniforms && vm._glUniforms.u_texWidth) {
        gl.uniform1f(vm._glUniforms.u_texWidth, Math.max(1, vm.gridWidth || 1));
    }

    // update cloud params per-frame
    if (vm._glUniforms && vm._glUniforms.u_f_cloud) {
        const fCloud = (typeof vm._getFCloudForRender === 'function') ? vm._getFCloudForRender() : vm.f_cloud;
        gl.uniform1f(vm._glUniforms.u_f_cloud, Math.max(0, Math.min(1, fCloud || 0)));
    }
    if (vm._glUniforms && vm._glUniforms.u_cloudPeriod) {
        const cloudPeriod = (typeof vm._getCloudPeriodForRender === 'function') ? vm._getCloudPeriodForRender() : vm.cloudPeriod;
        gl.uniform1f(vm._glUniforms.u_cloudPeriod, Math.max(2, cloudPeriod || 16));
    }
    if (vm._glUniforms && vm._glUniforms.u_polarCloudBoost) {
        const polarCloudBoost = (typeof vm._getPolarCloudBoostForRender === 'function') ? vm._getPolarCloudBoostForRender() : vm.polarCloudBoost;
        gl.uniform1f(vm._glUniforms.u_polarCloudBoost, Math.max(0, Math.min(1, polarCloudBoost || 0)));
    }

    // keep cloud color in sync (in case era changes dynamically)
    if (vm._glUniforms && vm._glUniforms.u_cloudColor) {
        const cloudHex = getEraCloudTint(vm.era);
        const c = vm.parseColorToRgb(cloudHex);
        const v = new Float32Array([(c[0] || 255) / 255, (c[1] || 255) / 255, (c[2] || 255) / 255]);
        gl.uniform3fv(vm._glUniforms.u_cloudColor, v);
    }

    // draw
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}


