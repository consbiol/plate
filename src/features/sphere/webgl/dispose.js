/**
 * Sphere WebGL のGPUリソースを明示的に破棄する。
 * - popup を閉じたとき
 * - 再オープン時（再 init する前）
 * などで呼ぶ想定。
 */
import { bestEffort } from '../../../utils/bestEffort.js';
export function disposeSphereWebGL(vm) {
    const gl = vm?._gl;
    if (!gl) return;

    bestEffort(() => { if (vm._glTex) gl.deleteTexture(vm._glTex); });
    bestEffort(() => { if (vm._glClassTex) gl.deleteTexture(vm._glClassTex); });
    bestEffort(() => { if (vm._glPosBuf) gl.deleteBuffer(vm._glPosBuf); });
    bestEffort(() => { if (vm._glProg) gl.deleteProgram(vm._glProg); });
    bestEffort(() => { if (vm._glVs) gl.deleteShader(vm._glVs); });
    bestEffort(() => { if (vm._glFs) gl.deleteShader(vm._glFs); });

    // js側参照も切る
    vm._gl = null;
    vm._glTex = null;
    vm._glClassTex = null;
    vm._glPosBuf = null;
    vm._glProg = null;
    vm._glVs = null;
    vm._glFs = null;
    vm._glUniforms = null;
    vm._glCloudColor = null;
    vm._glTexWidth = null;
    vm._glTexHeight = null;
}


