import { getEraCloudTint } from '../../../utils/colors.js';
import { getFragmentShaderSource, getVertexShaderSource } from './shaders.js';
import { createSphereTextures } from './textures.js';

/**
 * Sphere WebGL レンダラ初期化（元 `Sphere_Display.vue` の `initWebGL` を移植）。
 *
 * 互換性重視のため、第一段階では vm（Vueコンポーネントインスタンス）をそのまま受け取る。
 */
export function initSphereWebGL(vm, canvas) {
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return false;
    vm._gl = gl;

    const vsSource = getVertexShaderSource();
    const fsSource = getFragmentShaderSource();

    const compile = (src, type) => {
        const sh = gl.createShader(type);
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
            const msg = gl.getShaderInfoLog(sh);
            gl.deleteShader(sh);
            throw new Error('Shader compile error: ' + msg);
        }
        return sh;
    };

    const vs = compile(vsSource, gl.VERTEX_SHADER);
    const fs = compile(fsSource, gl.FRAGMENT_SHADER);
    vm._glVs = vs;
    vm._glFs = fs;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error('Program link error: ' + gl.getProgramInfoLog(prog));
    }
    gl.useProgram(prog);
    vm._glProg = prog;

    // quad buffer
    const posLoc = gl.getAttribLocation(prog, 'a_position');
    const posBuf = gl.createBuffer();
    vm._glPosBuf = posBuf;
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    const verts = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const {
        width,
        height,
        tex,
        classTex,
        topBuf,
        effHeight,
        polarTopRgb,
        polarBottomRgb
    } = createSphereTextures(gl, vm);
    vm._glTexWidth = width;
    vm._glTexHeight = height;

    // uniforms
    vm._glUniforms = {
        u_texture: gl.getUniformLocation(prog, 'u_texture'),
        u_classTex: gl.getUniformLocation(prog, 'u_classTex'),
        u_offset: gl.getUniformLocation(prog, 'u_offset'),
        u_texWidth: gl.getUniformLocation(prog, 'u_texWidth'),
        u_texHeight: gl.getUniformLocation(prog, 'u_texHeight'),
        u_shadowEnabled: gl.getUniformLocation(prog, 'u_shadowEnabled'),
        u_shadowStartCol: gl.getUniformLocation(prog, 'u_shadowStartCol'),
        u_shadowLenCols: gl.getUniformLocation(prog, 'u_shadowLenCols'),
        u_shadowGradCols: gl.getUniformLocation(prog, 'u_shadowGradCols'),
        u_cityLightColor: gl.getUniformLocation(prog, 'u_cityLightColor'),
        u_classSmoothRadius: gl.getUniformLocation(prog, 'u_classSmoothRadius'),
        u_topFrac: gl.getUniformLocation(prog, 'u_topFrac'),
        u_heightFrac: gl.getUniformLocation(prog, 'u_heightFrac'),
        u_cx: gl.getUniformLocation(prog, 'u_cx'),
        u_cy: gl.getUniformLocation(prog, 'u_cy'),
        u_R: gl.getUniformLocation(prog, 'u_R'),
        u_polarColorTop: gl.getUniformLocation(prog, 'u_polarColorTop'),
        u_polarColorBottom: gl.getUniformLocation(prog, 'u_polarColorBottom'),
        u_blendFrac: gl.getUniformLocation(prog, 'u_blendFrac'),
        u_polarNoiseScale: gl.getUniformLocation(prog, 'u_polarNoiseScale'),
        u_polarNoiseStrength: gl.getUniformLocation(prog, 'u_polarNoiseStrength'),
        u_f_cloud: gl.getUniformLocation(prog, 'u_f_cloud'),
        u_cloudPeriod: gl.getUniformLocation(prog, 'u_cloudPeriod'),
        u_polarCloudBoost: gl.getUniformLocation(prog, 'u_polarCloudBoost'),
        u_cloudColor: gl.getUniformLocation(prog, 'u_cloudColor')
    };

    // set static uniforms
    gl.uniform1i(vm._glUniforms.u_texture, 0);
    gl.uniform1i(vm._glUniforms.u_classTex, 1);
    gl.uniform1f(vm._glUniforms.u_classSmoothRadius, 0.75);
    if (vm._glUniforms.u_texWidth) gl.uniform1f(vm._glUniforms.u_texWidth, Math.max(1, width));
    if (vm._glUniforms.u_texHeight) gl.uniform1f(vm._glUniforms.u_texHeight, Math.max(1, height));
    if (vm._glUniforms.u_shadowStartCol) gl.uniform1f(vm._glUniforms.u_shadowStartCol, 0.0);
    if (vm._glUniforms.u_shadowLenCols) gl.uniform1f(vm._glUniforms.u_shadowLenCols, Math.floor(Math.max(1, width) / 2));
    if (vm._glUniforms.u_shadowGradCols) gl.uniform1f(vm._glUniforms.u_shadowGradCols, 10.0);
    if (vm._glUniforms.u_shadowEnabled) gl.uniform1f(vm._glUniforms.u_shadowEnabled, vm._sunShadowEnabled ? 1.0 : 0.0);
    if (vm._glUniforms.u_cityLightColor) {
        const cl = vm._getCityLightRgb().map(c => (c || 0) / 255);
        gl.uniform3fv(vm._glUniforms.u_cityLightColor, new Float32Array(cl));
    }

    gl.uniform1f(vm._glUniforms.u_topFrac, topBuf / effHeight);
    gl.uniform1f(vm._glUniforms.u_heightFrac, height / effHeight);

    // set polar uniforms (normalized 0..1)
    gl.uniform3fv(vm._glUniforms.u_polarColorTop, new Float32Array(polarTopRgb.map(c => c / 255)));
    gl.uniform3fv(vm._glUniforms.u_polarColorBottom, new Float32Array(polarBottomRgb.map(c => c / 255)));

    // set blend/noise params
    const blendFrac = (vm.polarBlendRows || 3) / effHeight;
    gl.uniform1f(vm._glUniforms.u_blendFrac, blendFrac);
    gl.uniform1f(vm._glUniforms.u_polarNoiseScale, vm.polarNoiseScale || 0.05);
    gl.uniform1f(vm._glUniforms.u_polarNoiseStrength, vm.polarNoiseStrength || 0.3);

    // cloud params
    const fCloud = (typeof vm._getFCloudForRender === 'function') ? vm._getFCloudForRender() : vm.f_cloud;
    gl.uniform1f(vm._glUniforms.u_f_cloud, Math.max(0, Math.min(1, fCloud || 0)));
    const cloudPeriod = (typeof vm._getCloudPeriodForRender === 'function') ? vm._getCloudPeriodForRender() : vm.cloudPeriod;
    gl.uniform1f(vm._glUniforms.u_cloudPeriod, Math.max(2, cloudPeriod || 16));
    if (vm._glUniforms.u_polarCloudBoost) {
        const polarCloudBoost = (typeof vm._getPolarCloudBoostForRender === 'function') ? vm._getPolarCloudBoostForRender() : vm.polarCloudBoost;
        gl.uniform1f(vm._glUniforms.u_polarCloudBoost, Math.max(0, Math.min(1, polarCloudBoost || 0)));
    }

    // era-based cloud color (normalized 0..1)
    try {
        const cloudHex = getEraCloudTint(vm.era);
        const c = vm.parseColorToRgb(cloudHex);
        vm._glCloudColor = new Float32Array([(c[0] || 255) / 255, (c[1] || 255) / 255, (c[2] || 255) / 255]);
        if (vm._glUniforms.u_cloudColor) {
            gl.uniform3fv(vm._glUniforms.u_cloudColor, vm._glCloudColor);
        }
    } catch (e) {
        if (vm._glUniforms.u_cloudColor) {
            gl.uniform3fv(vm._glUniforms.u_cloudColor, new Float32Array([1, 1, 1]));
        }
    }

    // viewport
    gl.viewport(0, 0, canvas.width, canvas.height);
    vm._gl = gl;
    vm._glTex = tex;
    vm._glClassTex = classTex;
    return true;
}


