<template>
  <div style="display:none"></div>
</template>

<script>
export default {
  name: 'Sphere_Display',
  props: {
    gridWidth: { type: Number, required: true },
    gridHeight: { type: Number, required: true },
    gridData: { type: Array, required: false, default: () => [] },
    polarBufferRows: { type: Number, required: false, default: 50 }
  },
  methods: {
    openSpherePopup() {
      const w = window.open('', 'SphereView', 'width=700,height=900');
      if (!w) return;
      this._sphereWin = w;
      // 既存の回転を停止
      if (this._rotationTimer) {
        clearInterval(this._rotationTimer);
        this._rotationTimer = null;
      }
      this._rotationColumns = 0;
      this._isRotating = false;
      this._rotationMsPerGrid = 100; // 10グリッド/秒
      this._minMsPerGrid = 20; // 最大50 grid/s
      this._maxMsPerGrid = 5000;
      this._rafId = null;
      this._lastTimestamp = null;
      this._accumMs = 0;
      const doc = w.document;
      const html = this.buildHtml();
      doc.open();
      doc.write(html);
      doc.close();
      // 描画
      const canvas = doc.getElementById('sphere-canvas');
      if (!canvas) return;
      this._sphereCanvas = canvas;
      // Try initialize WebGL renderer; fallback to CPU draw
      try {
        this._useWebGL = this.initWebGL(canvas);
      } catch (e) {
        this._useWebGL = false;
      }
      // compute buffer values for debug display
      const widthDbg = this.gridWidth;
      const heightDbg = this.gridHeight;
      const maxTotalBufDbg = Math.max(0, heightDbg - 2);
      const totalBufDbg = Math.max(0, Math.min(maxTotalBufDbg, this.polarBufferRows));
      const topBufDbg = Math.floor(totalBufDbg / 2);
      const bottomBufDbg = totalBufDbg - topBufDbg;
      const effHeightDbg = heightDbg + topBufDbg + bottomBufDbg;
      const uTopFracDbg = topBufDbg / effHeightDbg;
      const uHeightFracDbg = heightDbg / effHeightDbg;
      const dbgEl = doc.getElementById('sphere-debug');
      if (dbgEl) {
        dbgEl.textContent = `useWebGL: ${this._useWebGL}, width:${widthDbg}, height:${heightDbg}, topBuf:${topBufDbg}, bottomBuf:${bottomBufDbg}, effHeight:${effHeightDbg}, uTopFrac:${uTopFracDbg.toFixed(4)}, uHeightFrac:${uHeightFracDbg.toFixed(4)}`;
      }
      if (this._useWebGL) {
        this.drawWebGL();
      } else {
        this.drawSphere(canvas);
      }
      // ボタン配線
      const rotateBtn = doc.getElementById('rotate-btn');
      if (rotateBtn) {
        rotateBtn.addEventListener('click', () => {
          this.toggleRotate(rotateBtn);
        });
      }
      const fasterBtn = doc.getElementById('faster-btn');
      if (fasterBtn) {
        fasterBtn.addEventListener('click', () => {
          this.adjustSpeed(true);
        });
      }
      const slowerBtn = doc.getElementById('slower-btn');
      if (slowerBtn) {
        slowerBtn.addEventListener('click', () => {
          this.adjustSpeed(false);
        });
      }
      this.updateSpeedLabel();
      // ウィンドウクローズ時に停止
      w.addEventListener('beforeunload', () => {
        this.stopRotationLoop();
        this._isRotating = false;
      });
    },
    // gridData -> display color array (+2 border)
    _deriveDisplayColorsFromGridData(gridData, width, height) {
      const displayWidth = width + 2;
      const displayHeight = height + 2;
      const displayColors = new Array(displayWidth * displayHeight);
      const deepSea = 'rgb(30, 80, 140)';
      const shallowSea = 'rgb(60, 120, 180)';
      const lowland = 'rgb(34, 139, 34)';
      const desert = 'rgb(150, 130, 110)';
      const highland = 'rgb(145, 100, 75)';
      const alpine = 'rgb(95, 80, 70)';
      const tundra = 'rgb(180, 150, 80)';
      const glacier = 'rgb(255, 255, 255)';
      for (let gy = 0; gy < displayHeight; gy++) {
        for (let gx = 0; gx < displayWidth; gx++) {
          const displayIdx = gy * displayWidth + gx;
          if (gy === 0 || gy === displayHeight - 1 || gx === 0 || gx === displayWidth - 1) {
            displayColors[displayIdx] = 'rgb(0, 0, 0)';
          } else {
            const originalGy = gy - 1;
            const originalGx = gx - 1;
            const idx = originalGy * width + originalGx;
            const cell = gridData[idx];
            let col = lowland;
            if (cell && cell.terrain) {
              if (cell.terrain.type === 'sea') {
                if (cell.terrain.sea === 'shallow') col = shallowSea;
                else if (cell.terrain.sea === 'glacier') col = glacier;
                else col = deepSea;
              } else if (cell.terrain.type === 'land') {
                const l = cell.terrain.land;
                if (l === 'tundra') col = tundra;
                else if (l === 'glacier') col = glacier;
                else if (l === 'lake') col = shallowSea;
                else if (l === 'highland') col = highland;
                else if (l === 'alpine') col = alpine;
                else if (l === 'desert') col = desert;
                else col = lowland;
              }
            }
            displayColors[displayIdx] = col;
          }
        }
      }
      return displayColors;
    },
    buildHtml() {
      return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Sphere View</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body{margin:0;padding:12px;font-family:system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;background:#000;color:#fff}
      h1{margin:0 0 8px;font-size:16px}
      .row{margin:4px 0}
      canvas{display:block;margin:8px auto;border:1px solid #ccc;border-radius:4px;background:#000}
      .controls{display:flex;gap:8px;justify-content:center;align-items:center;margin-top:6px}
      button{padding:6px 10px;border:1px solid #ccc;border-radius:4px;background:#f7f7f7;cursor:pointer}
      button:hover{background:#eee}
    </style>
  </head>
  <body>
    <h1>Sphere (front view)</h1>
    <div class="row">Projection: Mercator → Sphere (front hemisphere)</div>
      <div id="sphere-debug" style="font-size:12px;color:#444;margin:6px 0;padding:6px;border:1px dashed #ddd;background:#fafafa;max-width:700px;word-break:break-all;"></div>
    <div class="controls">
      <button id="rotate-btn">Rotate</button>
      <button id="faster-btn">Faster</button>
      <button id="slower-btn">Slower</button>
      <span id="speed-label" style="margin-left:6px;color:#666;"></span>
    </div>
    <canvas id="sphere-canvas" width="700" height="700"></canvas>
  </body>
</html>`;
    },
  // 画素色取得（display配列は上下左右+1の黒枠がある想定）
  getMapColor(ix, iy) {
      // If gridData is provided, derive color from terrain/sea per-cell
      const width = this.gridWidth;
      const height = this.gridHeight;
      const originalIdx = iy * width + ix;
      if (this.gridData && this.gridData.length === width * height) {
        const cell = this.gridData[originalIdx];
        if (cell && cell.terrain) {
          const t = cell.terrain;
          if (t.type === 'sea') {
            if (t.sea === 'shallow') return 'rgb(60, 120, 180)';
            if (t.sea === 'glacier') return 'rgb(255, 255, 255)';
            return 'rgb(30, 80, 140)';
          } else if (t.type === 'land') {
            switch (t.land) {
              case 'tundra': return 'rgb(180, 150, 80)';
              case 'glacier': return 'rgb(255, 255, 255)';
              case 'lake': return 'rgb(60, 120, 180)';
              case 'lowland': return 'rgb(34, 139, 34)';
              case 'highland': return 'rgb(145, 100, 75)';
              case 'alpine': return 'rgb(95, 80, 70)';
              case 'desert': return 'rgb(150, 130, 110)';
              default: return 'rgb(34, 139, 34)';
            }
          }
        }
      }
      // gridData が無い場合は空文字（プレースホルダー判定用）を返す
      return '';
    },
    // color string like 'rgb(r,g,b)' -> [r,g,b]
    parseColorToRgb(s) {
      if (!s) return [255,255,255];
      if (Array.isArray(s)) return s;
      if (typeof s === 'string') {
        const m = s.match(/rgba?\s*\(\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)/i);
        if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
      }
      return [255,255,255];
    },
    // Initialize WebGL shader/texture. Returns true on success.
    initWebGL(canvas) {
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) return false;
      this._gl = gl;
      const vsSource = `
        attribute vec2 a_position;
        varying vec2 v_uv;
        void main() {
          v_uv = a_position * 0.5 + 0.5;
          gl_Position = vec4(a_position, 0.0, 1.0);
        }
      `;
      const fsSource = `
        precision mediump float;
        uniform sampler2D u_texture;
        uniform float u_offset; // fraction [0,1)
        uniform float u_topFrac;
        uniform float u_heightFrac;
        uniform float u_cx;
        uniform float u_cy;
        uniform float u_R;
        uniform vec3 u_polarColor;
        varying vec2 v_uv;
        const float PI = 3.141592653589793;
        void main() {
          // convert frag coord using gl_FragCoord
          vec2 fc = gl_FragCoord.xy;
          float sx = (fc.x - u_cx) / u_R;
          float sy = - (fc.y - u_cy) / u_R;
          float sq = sx * sx + sy * sy;
          if (sq > 1.0) {
            discard;
          }
          float sz = sqrt(max(0.0, 1.0 - sq));
          float dist = sqrt(sq);
          // draw 2-pixel gray ring around sphere edge
          float thickness = 2.0 / max(1.0, u_R); // normalized thickness (2 pixels)
          if (abs(dist - 1.0) < thickness) {
            gl_FragColor = vec4(vec3(0.4), 1.0); // gray
            return;
          }
          float phi = asin(sy);
          float lambda = atan(sx, sz);
          float mercY = 0.5 + (log(tan(PI * 0.25 + phi * 0.5)) / (2.0 * PI));
          // 極域判定はmercYの絶対位置で行う（u_topFrac..u_topFrac+u_heightFrac が地図領域）
          if (mercY < u_topFrac || mercY > u_topFrac + u_heightFrac) {
            gl_FragColor = vec4(u_polarColor, 1.0);
            return;
          }
          float u = fract((lambda + PI) / (2.0 * PI) + u_offset);
          float v = (mercY - u_topFrac) / u_heightFrac;
          vec4 col = texture2D(u_texture, vec2(u, v));
          gl_FragColor = col;
        }
      `;
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
      const prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error('Program link error: ' + gl.getProgramInfoLog(prog));
      }
      gl.useProgram(prog);
      this._glProg = prog;
      // quad buffer
      const posLoc = gl.getAttribLocation(prog, 'a_position');
      const posBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      const verts = new Float32Array([-1,-1, 1,-1, -1,1, 1,1]);
      gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
      // create texture from derived colors
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      // Use nearest filtering to avoid linear interpolation blur when the texture is scaled
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      // For non-power-of-two textures, REPEAT is not allowed in WebGL1.
      // Use CLAMP_TO_EDGE and handle wrapping in the shader via fract().
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      // build pixel array (width x height)
      const width = this.gridWidth;
      const height = this.gridHeight;
      // Ensure proper row alignment for texImage2D with arbitrary widths
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      // prepare displayColors from gridData if present, otherwise use a placeholder to keep rendering
      const expectedDisplayLen = (width + 2) * (height + 2);
      const displayColorsFromGridData = (this.gridData && this.gridData.length === width * height)
        ? this._deriveDisplayColorsFromGridData(this.gridData, width, height)
        : [];
      let displayColors = displayColorsFromGridData;
      if (!displayColorsFromGridData || displayColorsFromGridData.length < expectedDisplayLen) {
        // gridData が無い場合はプレースホルダー色で描画を継続
        displayColors = new Array(expectedDisplayLen);
        for (let i = 0; i < expectedDisplayLen; i++) displayColors[i] = 'rgb(0,0,0)';
      }
      // compute top/bottom buffer as used in CPU path
      const maxTotalBuf = Math.max(0, height - 2);
      const totalBuf = Math.max(0, Math.min(maxTotalBuf, this.polarBufferRows));
      const topBuf = Math.floor(totalBuf / 2);
      const bottomBuf = totalBuf - topBuf;
      const displayStride = width + 2;
      const pixels = new Uint8Array(width * height * 4);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const displayX = x + 1;
          const displayY = y + 1;
          const idx = displayY * displayStride + displayX;
          const s = displayColors[idx];
          const rgb = this.parseColorToRgb(s);
          const p = (y * width + x) * 4;
          pixels[p] = rgb[0]; pixels[p+1] = rgb[1]; pixels[p+2] = rgb[2]; pixels[p+3] = 255;
        }
      }
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      // uniforms
      this._glUniforms = {
        u_texture: gl.getUniformLocation(prog, 'u_texture'),
        u_offset: gl.getUniformLocation(prog, 'u_offset'),
        u_topFrac: gl.getUniformLocation(prog, 'u_topFrac'),
        u_heightFrac: gl.getUniformLocation(prog, 'u_heightFrac'),
        u_cx: gl.getUniformLocation(prog, 'u_cx'),
        u_cy: gl.getUniformLocation(prog, 'u_cy'),
        u_R: gl.getUniformLocation(prog, 'u_R'),
        u_polarColor: gl.getUniformLocation(prog, 'u_polarColor')
      };
      // set static uniforms
      gl.uniform1i(this._glUniforms.u_texture, 0);
      const effHeight = height + topBuf + bottomBuf;
      gl.uniform1f(this._glUniforms.u_topFrac, topBuf / effHeight);
      gl.uniform1f(this._glUniforms.u_heightFrac, height / effHeight);
      gl.uniform3fv(this._glUniforms.u_polarColor, new Float32Array([1.0, 1.0, 1.0]));
      // viewport
      gl.viewport(0, 0, canvas.width, canvas.height);
      this._gl = gl;
      this._glTex = tex;
      return true;
    },
    drawWebGL() {
      const gl = this._gl;
      if (!gl) return;
      const canvas = this._sphereCanvas;
      gl.viewport(0, 0, canvas.width, canvas.height);
      const prog = this._glProg;
      gl.useProgram(prog);
      // ensure texture bound to TEXTURE0
      gl.activeTexture(gl.TEXTURE0);
      if (this._glTex) gl.bindTexture(gl.TEXTURE_2D, this._glTex);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const R = Math.floor(Math.min(canvas.width, canvas.height) * 0.30);
      gl.uniform1f(this._glUniforms.u_cx, cx);
      gl.uniform1f(this._glUniforms.u_cy, cy);
      gl.uniform1f(this._glUniforms.u_R, R);
      const offsetFrac = ((this._rotationColumns || 0) / Math.max(1, this.gridWidth));
      gl.uniform1f(this._glUniforms.u_offset, offsetFrac);
      // draw
      gl.clearColor(0,0,0,1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    toggleRotate(btn) {
      if (this._isRotating) {
        this.stopRotationLoop();
        this._isRotating = false;
        if (btn) btn.textContent = 'Rotate';
      } else {
        // rAFベースの回転ループ開始
        this.startRotationLoop();
        this._isRotating = true;
        if (btn) btn.textContent = 'Stop';
      }
    },
    startRotationLoop() {
      // ensure canvas reference
      const canvas = this._sphereCanvas;
      if (!canvas) return;
      // reset timing state
      this._lastTimestamp = performance.now();
      this._accumMs = 0;
      // cancel existing
      if (this._rafId) {
        cancelAnimationFrame(this._rafId);
        this._rafId = null;
      }
      const loop = (ts) => {
        const msPerGrid = Math.max(this._minMsPerGrid || 20, Math.min(this._maxMsPerGrid || 5000, this._rotationMsPerGrid || 1000));
        const delta = ts - (this._lastTimestamp || ts);
        this._lastTimestamp = ts;
        this._accumMs += delta;
        let advanced = false;
        while (this._accumMs >= msPerGrid) {
          this._accumMs -= msPerGrid;
          const width = this.gridWidth || 1;
          this._rotationColumns = ((this._rotationColumns || 0) + 1) % width;
          advanced = true;
        }
        if (advanced) {
          if (this._useWebGL) {
            this.drawWebGL();
          } else {
            this.drawSphere(canvas);
          }
        }
        this._rafId = requestAnimationFrame(loop);
      };
      this._rafId = requestAnimationFrame(loop);
      this.updateSpeedLabel();
    },
    stopRotationLoop() {
      if (this._rafId) {
        cancelAnimationFrame(this._rafId);
        this._rafId = null;
      }
      this._lastTimestamp = null;
      this._accumMs = 0;
      this._isRotating = false;
    },
    adjustSpeed(faster) {
      const cur = this._rotationMsPerGrid || 1000;
      // 倍率調整（高速化: 半分、低速化: 1.5倍）
      const next = faster ? (cur / 1.5) : (cur * 1.5);
      this._rotationMsPerGrid = Math.max(this._minMsPerGrid || 20, Math.min(this._maxMsPerGrid || 5000, Math.round(next)));
      if (this._isRotating) {
        // リセットされるようにタイムスタンプ更新
        this._lastTimestamp = performance.now();
        this.updateSpeedLabel();
      } else {
        this.updateSpeedLabel();
      }
    },
    updateSpeedLabel() {
      const doc = this._sphereWin && this._sphereWin.document;
      if (!doc) return;
      const el = doc.getElementById('speed-label');
      if (!el) return;
      const ms = Math.max(this._minMsPerGrid || 20, Math.min(this._maxMsPerGrid || 5000, this._rotationMsPerGrid || 1000));
      const gridsPerSec = 1000 / ms;
      el.textContent = `${gridsPerSec.toFixed(2)} grid/s`;
    },
    drawSphere(canvas) {
      // 高速化版レンダリング: プリマップ + ImageData + パレット参照
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const W = canvas.width;
      const H = canvas.height;
      const cx = Math.floor(W / 2);
      const cy = Math.floor(H / 2);
      const R = Math.floor(Math.min(W, H) * 0.30);

      const width = this.gridWidth;
      const height = this.gridHeight;
      const maxTotalBuf = Math.max(0, height - 2);
      const totalBuf = Math.max(0, Math.min(maxTotalBuf, this.polarBufferRows));
      const topBuf = Math.floor(totalBuf / 2);
      const bottomBuf = totalBuf - topBuf;
      const polarRGB = [255, 255, 255];
      const colShift = (this._rotationColumns || 0);

      // プリコンピュートのキャッシュ条件: canvasサイズ / mapサイズ / bufs
      console.debug("Sphere_Display.drawSphere start", { W, H, width, height, hasGridData: !!(this.gridData && this.gridData.length === width * height) });
      if (!this._precompute || this._precompute.W !== W || this._precompute.H !== H || this._precompute.width !== width || this._precompute.height !== height || this._precompute.topBuf !== topBuf || this._precompute.bottomBuf !== bottomBuf) {
      const displayStride = width + 2;
      const effHeight = height + topBuf + bottomBuf;
      const displayColorsFromGridData = (this.gridData && this.gridData.length === width * height)
        ? this._deriveDisplayColorsFromGridData(this.gridData, width, height)
        : [];
      let displayColors = displayColorsFromGridData;
      const expectedDisplayLen2 = (width + 2) * (height + 2);
      if (!displayColorsFromGridData || displayColorsFromGridData.length < expectedDisplayLen2) {
        displayColors = new Array(expectedDisplayLen2);
        for (let i = 0; i < expectedDisplayLen2; i++) {
          displayColors[i] = 'rgb(80,80,80)';
        }
      }
        // パレット作成（display配列インデックス -> RGB）
        const palette = new Uint8ClampedArray(displayColors.length * 3);
        const parseRgb = (s, outIdx) => {
          if (typeof s === 'string') {
            const m = s.match(/rgba?\s*\(\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)/i);
            if (m) {
              palette[outIdx] = Number(m[1]);
              palette[outIdx + 1] = Number(m[2]);
              palette[outIdx + 2] = Number(m[3]);
              return;
            }
          }
          palette[outIdx] = 255; palette[outIdx + 1] = 255; palette[outIdx + 2] = 255;
        };
        for (let i = 0; i < displayColors.length; i++) {
          parseRgb(displayColors[i], i * 3);
        }
        // ピクセルごとのマップ参照情報を作成
        const pixels = [];
        const baseIxArr = [];
        const iyMapArr = [];
        const isPolarArr = [];
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
            let iyExt = Math.floor(mercY * effHeight);
            if (ix0 < 0) ix0 = 0;
            if (ix0 >= width) ix0 = width - 1;
            if (iyExt < 0) iyExt = 0;
            if (iyExt >= effHeight) iyExt = effHeight - 1;
            if (iyExt < topBuf || iyExt >= topBuf + height) {
              baseIxArr.push(0);
              iyMapArr.push(0);
              isPolarArr.push(1);
            } else {
              baseIxArr.push(ix0);
              iyMapArr.push(iyExt - topBuf);
              isPolarArr.push(0);
            }
            pixels.push({ px, py });
          }
        }
        this._precompute = {
          W, H, R, cx, cy, width, height, topBuf, bottomBuf, pixels,
          baseIx: Int16Array.from(baseIxArr),
          iyMap: Int16Array.from(iyMapArr),
          isPolar: Uint8Array.from(isPolarArr),
          palette, displayStride
        };
      }

      // ImageData に描画
      const pc = this._precompute;
      const imageData = ctx.createImageData(W, H);
      const data = imageData.data;
      const displayStride = pc.displayStride;
      const pal = pc.palette;
      const pCount = pc.pixels.length;
      for (let i = 0; i < pCount; i++) {
        const p = pc.pixels[i];
        const x = pc.cx + p.px;
        const y = pc.cy + p.py;
        const offset = (y * W + x) * 4;
        if (pc.isPolar[i]) {
          data[offset] = polarRGB[0];
          data[offset + 1] = polarRGB[1];
          data[offset + 2] = polarRGB[2];
          data[offset + 3] = 255;
        } else {
          const ix0 = pc.baseIx[i];
          const iy = pc.iyMap[i];
          const displayX = ((ix0 + colShift) % width + width) % width + 1;
          const displayY = iy + 1;
          const displayIdx = displayY * displayStride + displayX;
          const pi = displayIdx * 3;
          data[offset] = pal[pi] || 255;
          data[offset + 1] = pal[pi + 1] || 255;
          data[offset + 2] = pal[pi + 2] || 255;
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
  }
}
</script>

<style scoped>
</style>


