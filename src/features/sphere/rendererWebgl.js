// 互換性維持のため、公開APIは `src/features/sphere/rendererWebgl.js` に残しつつ、実体は役割別に分割。
export { initSphereWebGL } from './webgl/init.js';
export { drawSphereWebGL } from './webgl/draw.js';
export { updateSphereTexturesWebGL } from './webgl/updateTextures.js';
export { disposeSphereWebGL } from './webgl/dispose.js';
