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
    polarBufferRows: { type: Number, required: false, default: 50 },
    polarAvgRows: { type: Number, required: false, default: 3 },
    polarBlendRows: { type: Number, required: false, default: 12 },
    polarNoiseStrength: { type: Number, required: false, default: 0.3 },
    polarNoiseScale: { type: Number, required: false, default: 0.01 },
    // 陸（氷河除く）に事後的に適用する青灰色トーン
    landTintColor: { type: String, required: false, default: 'rgb(150, 165, 185)' },
    landTintStrength: { type: Number, required: false, default: 0.35 },
    // 雲量（0..1）: 被覆度に強く、濃さ（不透明度）に弱く効かせる
    cloudAmount: { type: Number, required: false, default: 0.4 },
    // 雲ノイズのトーラス周期（uv空間上の反復数）
    cloudPeriod: { type: Number, required: false, default: 16 }
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
      // (debug UI removed)
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
      const tc = (this.$store && this.$store.getters && this.$store.getters.terrainColors)
        ? this.$store.getters.terrainColors
        : {
            deepSea: '#1E508C',
            shallowSea: '#3C78B4',
            lowland: '#228B22',
            desert: '#96826E',
            highland: '#91644B',
            alpine: '#5F5046',
            tundra: '#698736',
            glacier: '#FFFFFF',
            border: '#000000'
          };
      const deepSea = tc.deepSea;
      const shallowSea = tc.shallowSea;
      const lowland = tc.lowland;
      const desert = tc.desert;
      const highland = tc.highland;
      const alpine = tc.alpine;
      const tundra = tc.tundra;
      const glacier = tc.glacier;
      for (let gy = 0; gy < displayHeight; gy++) {
        for (let gx = 0; gx < displayWidth; gx++) {
          const displayIdx = gy * displayWidth + gx;
          if (gy === 0 || gy === displayHeight - 1 || gx === 0 || gx === displayWidth - 1) {
            displayColors[displayIdx] = (tc.border || '#000000');
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
    // color string like 'rgb(r,g,b)' or '#RRGGBB' -> [r,g,b]
    parseColorToRgb(s) {
      if (!s) return [255,255,255];
      if (Array.isArray(s)) return s;
      if (typeof s === 'string') {
        const hx = s.trim().match(/^#([0-9a-fA-F]{6})$/);
        if (hx) {
          const v = parseInt(hx[1], 16);
          return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
        }
        const m = s.match(/rgba?\s*\(\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)/i);
        if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
      }
      return [255,255,255];
    },
    _hashNoise2D(x, y) {
      const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      return s - Math.floor(s);
    },
    _fractalNoise2D(x, y, octaves = 4, persistence = 0.5) {
      let value = 0;
      let amplitude = 1;
      let frequency = 1;
      let maxValue = 0;
      for (let i = 0; i < octaves; i++) {
        value += (this._hashNoise2D(x * frequency, y * frequency) * 2 - 1) * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= 2;
      }
      // normalize to 0..1
      return (value / maxValue) * 0.5 + 0.5;
    },
    // --- Cloud (CPU) tileable noise helpers ---
    _rand2(ix, iy) {
      // integer-ish inputs recommended
      const s = Math.sin(ix * 12.9898 + iy * 78.233) * 43758.5453;
      return s - Math.floor(s);
    },
    _valueNoiseTile(u, v, period) {
      const p = Math.max(2, Math.floor(period || 16));
      const x = u * p;
      const y = v * p;
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const fx = x - x0;
      const fy = y - y0;
      const x1 = (x0 + 1) % p;
      const y1 = (y0 + 1) % p;
      const i00 = this._rand2(x0 % p, y0 % p);
      const i10 = this._rand2(x1 % p, y0 % p);
      const i01 = this._rand2(x0 % p, y1 % p);
      const i11 = this._rand2(x1 % p, y1 % p);
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);
      const a = i00 + (i10 - i00) * sx;
      const b = i01 + (i11 - i01) * sx;
      return a + (b - a) * sy; // 0..1-ish
    },
    _fbmTile(u, v, basePeriod) {
      let vsum = 0;
      let amp = 0.55;
      let period = Math.max(2, Math.floor(basePeriod || 16));
      for (let i = 0; i < 4; i++) {
        const n = this._valueNoiseTile(u, v, period);
        vsum += amp * n;
        amp *= 0.5;
        period *= 2;
      }
      // normalize roughly to 0..1
      return Math.max(0, Math.min(1, vsum / 1.5));
    },
    _getCellClassWeight(cell) {
      if (cell && cell.terrain) {
        if (cell.terrain.type === 'sea') return 1.0;
        if (cell.terrain.type === 'land') {
          const l = cell.terrain.land;
          if (l === 'desert') return 0.4;
          if (l === 'lake') return 1.0;
          return 0.8;
        }
      }
      return 1.0;
    },
    _sampleClassWeightBilinear(u, v, width, height, gridData) {
      // u,v in [0,1], bilinear in grid index space (0..width-1, 0..height-1), u wraps, v clamps
      if (!gridData || gridData.length !== width * height) return 1.0;
      const x = Math.max(0, Math.min(width - 1, u * (width - 1)));
      const y = Math.max(0, Math.min(height - 1, v * (height - 1)));
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const x1 = Math.min(width - 1, x0 + 1);
      const y1 = Math.min(height - 1, y0 + 1);
      const tx = x - x0;
      const ty = y - y0;
      const idx00 = y0 * width + x0;
      const idx10 = y0 * width + x1;
      const idx01 = y1 * width + x0;
      const idx11 = y1 * width + x1;
      const w00 = this._getCellClassWeight(gridData[idx00]);
      const w10 = this._getCellClassWeight(gridData[idx10]);
      const w01 = this._getCellClassWeight(gridData[idx01]);
      const w11 = this._getCellClassWeight(gridData[idx11]);
      const wx0 = w00 * (1 - tx) + w10 * tx;
      const wx1 = w01 * (1 - tx) + w11 * tx;
      return wx0 * (1 - ty) + wx1 * ty;
    },
    _sampleClassWeightSmooth(u, v, width, height, gridData, rUV) {
      // 3x3 サンプル（中心+斜め含め9タップ）、uはトーラス、vはクランプ
      const du = Math.max(0, rUV || 0);
      const dv = Math.max(0, rUV || 0);
      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const uu = u + dx * du;
          const vv = v + dy * dv;
          const uuWrapped = ((uu % 1) + 1) % 1;
          const vvClamped = Math.max(0, Math.min(1, vv));
          sum += this._sampleClassWeightBilinear(uuWrapped, vvClamped, width, height, gridData);
          count += 1;
        }
      }
      return sum / Math.max(1, count);
    },
    // Initialize WebGL shader/texture. Returns true on success.
    initWebGL(canvas) {
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) return false;
      this._gl = gl;
      const vsSource = `
        attribute vec2 a_position;
        void main() {
          gl_Position = vec4(a_position, 0.0, 1.0);
        }
      `;
      const fsSource = `
        precision mediump float;
        uniform sampler2D u_texture;
        uniform sampler2D u_classTex;
        uniform float u_offset; // fraction [0,1)
        uniform float u_classSmoothRadius; // in texels (e.g., 0.75)
        uniform float u_topFrac;
        uniform float u_heightFrac;
        uniform float u_cx;
        uniform float u_cy;
        uniform float u_R;
        uniform vec3 u_polarColorTop;
        uniform vec3 u_polarColorBottom;
        uniform float u_blendFrac;
        uniform float u_polarNoiseScale;
        uniform float u_polarNoiseStrength;
        uniform float u_cloudAmount;      // 0..1
        uniform float u_cloudPeriod;      // e.g. 16
        const float PI = 3.141592653589793;
        // hash + FBM (fractal) noise (legacy, polar blend用)
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }
        float noise(vec2 p) {
          return hash(p);
        }
        float fbm(vec2 p) {
          float v = 0.0;
          float amp = 0.5;
          for (int i = 0; i < 5; i++) {
            v += amp * noise(p);
            p *= 2.0;
            amp *= 0.5;
          }
          return v; // ~0..1
        }
        // タイル可能（トーラス）な値ノイズ
        float rand(vec2 n) { return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453); }
        float valueNoiseTile(vec2 uv, float period) {
          vec2 p = uv * period;
          vec2 i0 = floor(p);
          vec2 f = fract(p);
          vec2 i1 = i0 + 1.0;
          // ラップ（トーラス化）
          i0 = mod(i0, period);
          i1 = mod(i1, period);
          float v00 = rand(i0);
          float v10 = rand(vec2(i1.x, i0.y));
          float v01 = rand(vec2(i0.x, i1.y));
          float v11 = rand(i1);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(v00, v10, u.x), mix(v01, v11, u.x), u.y);
        }
        float fbmTile(vec2 uv, float basePeriod) {
          float v = 0.0;
          float amp = 0.55;
          float period = basePeriod;
          for (int i = 0; i < 4; i++) {
            v += amp * valueNoiseTile(uv, period);
            amp *= 0.5;
            period *= 2.0; // 倍周波数でも周期性維持
          }
          return clamp(v, 0.0, 1.0);
        }
        // クラス重みの近傍平滑（3x3=9タップ）。オフセットは雲解像度に追随（u_cloudPeriodに反比例）
        float sampleClassSmooth(vec2 uv) {
          float rUV = max(0.0, u_classSmoothRadius) / max(1.0, u_cloudPeriod);
          vec2 du = vec2(rUV, 0.0);
          vec2 dv = vec2(0.0, rUV);
          vec2 uvC = vec2(fract(uv.x), clamp(uv.y, 0.0, 1.0));
          float s = 0.0;
          for (int j = -1; j <= 1; j++) {
            for (int i = -1; i <= 1; i++) {
              vec2 o = vec2(float(i) * du.x, float(j) * dv.y);
              vec2 p = vec2(fract(uvC.x + o.x), clamp(uvC.y + o.y, 0.0, 1.0));
              s += texture2D(u_classTex, p).r;
            }
          }
          return s / 9.0;
        }
        void main() {
          vec2 fc = gl_FragCoord.xy;
          float sx = (fc.x - u_cx) / u_R;
          float sy = - (fc.y - u_cy) / u_R;
          float sq = sx * sx + sy * sy;
          if (sq > 1.0) {
            discard;
          }
          float sz = sqrt(max(0.0, 1.0 - sq));
          float dist = sqrt(sq);
          float thickness = 2.0 / max(1.0, u_R);
          if (abs(dist - 1.0) < thickness) {
            gl_FragColor = vec4(vec3(0.4), 1.0);
            return;
          }
          float phi = asin(sy);
          float lambda = atan(sx, sz);
          float mercY = 0.5 + (log(tan(PI * 0.25 + phi * 0.5)) / (2.0 * PI));
          // ベース色を算出（極ブレンド or 通常）
          vec3 baseCol;
          float uMap;
          float vMap;
          // 雲ノイズは極バッファを含む全域(mercY:0..1)で評価
          float uEff = fract((lambda + PI) / (2.0 * PI) + u_offset);
          float vEff = mercY;
          if (mercY < u_topFrac || mercY > u_topFrac + u_heightFrac) {
            vec3 pcol = (mercY < u_topFrac) ? u_polarColorTop : u_polarColorBottom;
            float u_coord = fract((lambda + PI) / (2.0 * PI) + u_offset);
            float v_coord = (mercY - u_topFrac) / u_heightFrac;
            float delta = (mercY < u_topFrac) ? (u_topFrac - mercY) : (mercY - (u_topFrac + u_heightFrac));
            float polarWeight = 1.0;
            if (u_blendFrac > 0.0) {
              polarWeight = clamp(delta / u_blendFrac, 0.0, 1.0);
            }
            float n = fbm(vec2(u_coord * u_polarNoiseScale, v_coord * u_polarNoiseScale));
            polarWeight = clamp(polarWeight + (n - 0.5) * u_polarNoiseStrength, 0.0, 1.0);
            float v_clamped = clamp(v_coord, 0.0, 1.0);
            vec3 mapCol = texture2D(u_texture, vec2(u_coord, v_clamped)).rgb;
            baseCol = mix(mapCol, pcol, polarWeight);
            uMap = u_coord;
            vMap = v_clamped; // クラス参照も同クランプでOK
          } else {
            float u = fract((lambda + PI) / (2.0 * PI) + u_offset);
            float v = (mercY - u_topFrac) / u_heightFrac;
            baseCol = texture2D(u_texture, vec2(u, v)).rgb;
            uMap = u;
            vMap = v;
          }
          // 雲レイヤ（白）: 被覆度優先、濃さは弱く
          float classW = sampleClassSmooth(vec2(uMap, vMap)); // 海=1, 陸=0.7/0.8, 乾燥=0.2/0.4 を近傍で平滑化
          float eff = clamp(u_cloudAmount * classW, 0.0, 1.0);
          // トーラスFBMノイズ（極バッファ含む全域で評価）
          float nCloud = fbmTile(vec2(uEff, vEff), max(2.0, u_cloudPeriod));
          // 被覆度の閾値（雲量で強く変化）: 雲量↑で閾値↓ → coverage↑
          float t = mix(0.9, 0.2, eff);
          float edge = 0.08;
          float coverage = smoothstep(t - edge, t + edge, nCloud);
          // 雲の不透明度
          float alpha = 0.70 + 1.0 * sqrt(eff);
          // 覆われた領域内の濃淡（厚み + 高周波ディテール）で変調
          float depth = clamp((nCloud - t) / max(1e-3, 1.0 - t), 0.0, 1.0);
          float detail = fbmTile(vec2(uEff, vEff) + vec2(0.123, 0.456), max(2.0, u_cloudPeriod * 4.0));
          float density = mix(0.3, 1.0, 0.5 * detail + 0.5 * depth);
          vec3 outCol = mix(baseCol, vec3(1.0), coverage * alpha * density);
          gl_FragColor = vec4(outCol, 1.0);
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
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
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
          let rgb = this.parseColorToRgb(s);
          // 陸（氷河除く）に青灰色トーンを適用（事後的フィルタ）
          if (this.gridData && this.gridData.length === width * height) {
            const cell = this.gridData[y * width + x];
            if (cell && cell.terrain && cell.terrain.type === 'land' && cell.terrain.land !== 'glacier') {
              const tint = this.parseColorToRgb(this.landTintColor);
              const k = Math.max(0, Math.min(1, this.landTintStrength || 0));
              rgb = [
                Math.round(rgb[0] * (1 - k) + tint[0] * k),
                Math.round(rgb[1] * (1 - k) + tint[1] * k),
                Math.round(rgb[2] * (1 - k) + tint[2] * k)
              ];
            }
          }
          const p = (y * width + x) * 4;
          pixels[p] = rgb[0]; pixels[p+1] = rgb[1]; pixels[p+2] = rgb[2]; pixels[p+3] = 255;
        }
      }
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      // build class weight texture (海=1.0, 陸=0.7, 乾燥地=0.2, 湖=1.0, 氷河は陸扱い=0.7)
      const classTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, classTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const classPixels = new Uint8Array(width * height * 4);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let wgt = 1.0; // default 海
          if (this.gridData && this.gridData.length === width * height) {
            const cell = this.gridData[y * width + x];
            if (cell && cell.terrain) {
              if (cell.terrain.type === 'sea') {
                // 海・湖は 1.0
                wgt = 1.0;
              } else if (cell.terrain.type === 'land') {
                const l = cell.terrain.land;
                if (l === 'desert') wgt = 0.4;
                else if (l === 'lake') wgt = 1.0;
                else wgt = 0.8; // 陸の既定
              }
            } else {
              wgt = 1.0;
            }
          }
          const v = Math.max(0, Math.min(255, Math.round(wgt * 255)));
          const p = (y * width + x) * 4;
          classPixels[p] = v; classPixels[p + 1] = v; classPixels[p + 2] = v; classPixels[p + 3] = 255;
        }
      }
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, classPixels);
      // uniforms
      this._glUniforms = {
        u_texture: gl.getUniformLocation(prog, 'u_texture'),
        u_classTex: gl.getUniformLocation(prog, 'u_classTex'),
        u_offset: gl.getUniformLocation(prog, 'u_offset'),
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
        u_cloudAmount: gl.getUniformLocation(prog, 'u_cloudAmount'),
        u_cloudPeriod: gl.getUniformLocation(prog, 'u_cloudPeriod')
      };
      // set static uniforms
      gl.uniform1i(this._glUniforms.u_texture, 0);
      gl.uniform1i(this._glUniforms.u_classTex, 1);
      gl.uniform1f(this._glUniforms.u_classSmoothRadius, 0.75);
      const effHeight = height + topBuf + bottomBuf;
      gl.uniform1f(this._glUniforms.u_topFrac, topBuf / effHeight);
      gl.uniform1f(this._glUniforms.u_heightFrac, height / effHeight);
      // determine polar colors from the uploaded texture pixels (robust to timing)
      let polarTopRgb = [255,255,255];
      let polarBottomRgb = [255,255,255];
      try {
        const rows = Math.max(1, Math.min(this.polarAvgRows || 1, Math.floor(height / 2)));
        let sumTop = [0,0,0], sumBottom = [0,0,0];
        let countTop = 0, countBottom = 0;
        // pixels is width*height*4, row-major, y from 0..height-1 (top to bottom)
        for (let ry = 0; ry < rows; ry++) {
          const yTop = ry;
          const yBottom = height - 1 - ry;
          for (let x = 0; x < width; x++) {
            const pTopIdx = (yTop * width + x) * 4;
            const pBottomIdx = (yBottom * width + x) * 4;
            const rT = pixels[pTopIdx], gT = pixels[pTopIdx+1], bT = pixels[pTopIdx+2];
            const rB = pixels[pBottomIdx], gB = pixels[pBottomIdx+1], bB = pixels[pBottomIdx+2];
            sumTop[0] += rT; sumTop[1] += gT; sumTop[2] += bT; countTop++;
            sumBottom[0] += rB; sumBottom[1] += gB; sumBottom[2] += bB; countBottom++;
          }
        }
        if (countTop > 0) polarTopRgb = [Math.round(sumTop[0]/countTop), Math.round(sumTop[1]/countTop), Math.round(sumTop[2]/countTop)];
        if (countBottom > 0) polarBottomRgb = [Math.round(sumBottom[0]/countBottom), Math.round(sumBottom[1]/countBottom), Math.round(sumBottom[2]/countBottom)];
      } catch (e) {
        polarTopRgb = [255,255,255];
        polarBottomRgb = [255,255,255];
      }
      // set polar uniforms (normalized 0..1)
      gl.uniform3fv(this._glUniforms.u_polarColorTop, new Float32Array(polarTopRgb.map(c => c / 255)));
      gl.uniform3fv(this._glUniforms.u_polarColorBottom, new Float32Array(polarBottomRgb.map(c => c / 255)));
      // set blend/noise params
      const blendFrac = (this.polarBlendRows || 3) / effHeight;
      gl.uniform1f(this._glUniforms.u_blendFrac, blendFrac);
      gl.uniform1f(this._glUniforms.u_polarNoiseScale, this.polarNoiseScale || 0.05);
      gl.uniform1f(this._glUniforms.u_polarNoiseStrength, this.polarNoiseStrength || 0.3);
      // cloud params
      gl.uniform1f(this._glUniforms.u_cloudAmount, Math.max(0, Math.min(1, this.cloudAmount || 0)));
      gl.uniform1f(this._glUniforms.u_cloudPeriod, Math.max(2, this.cloudPeriod || 16));
      // viewport
      gl.viewport(0, 0, canvas.width, canvas.height);
      this._gl = gl;
      this._glTex = tex;
      this._glClassTex = classTex;
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
      // bind class texture to TEXTURE1
      gl.activeTexture(gl.TEXTURE1);
      if (this._glClassTex) gl.bindTexture(gl.TEXTURE_2D, this._glClassTex);
      // restore active 0 for consistency (optional)
      gl.activeTexture(gl.TEXTURE0);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const R = Math.floor(Math.min(canvas.width, canvas.height) * 0.30);
      gl.uniform1f(this._glUniforms.u_cx, cx);
      gl.uniform1f(this._glUniforms.u_cy, cy);
      gl.uniform1f(this._glUniforms.u_R, R);
      const offsetFrac = ((this._rotationColumns || 0) / Math.max(1, this.gridWidth));
      gl.uniform1f(this._glUniforms.u_offset, offsetFrac);
      // update cloud params per-frame (UI反映)
      if (this._glUniforms && this._glUniforms.u_cloudAmount) {
        gl.uniform1f(this._glUniforms.u_cloudAmount, Math.max(0, Math.min(1, this.cloudAmount || 0)));
      }
      if (this._glUniforms && this._glUniforms.u_cloudPeriod) {
        gl.uniform1f(this._glUniforms.u_cloudPeriod, Math.max(2, this.cloudPeriod || 16));
      }
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
      const colShift = (this._rotationColumns || 0);

      // プリコンピュートのキャッシュ条件: canvasサイズ / mapサイズ / bufs
      // drawSphere start
      // derive displayColors once (available outside precompute block)
      let displayColors = (this.gridData && this.gridData.length === width * height)
        ? this._deriveDisplayColorsFromGridData(this.gridData, width, height)
        : [];
      if (!this._precompute || this._precompute.W !== W || this._precompute.H !== H || this._precompute.width !== width || this._precompute.height !== height || this._precompute.topBuf !== topBuf || this._precompute.bottomBuf !== bottomBuf) {
      const displayStride = width + 2;
      const effHeight = height + topBuf + bottomBuf;
      const expectedDisplayLen2 = (width + 2) * (height + 2);
      if (!displayColors || displayColors.length < expectedDisplayLen2) {
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
            let iyExt = Math.floor(mercY * effHeight);
            if (ix0 < 0) ix0 = 0;
            if (ix0 >= width) ix0 = width - 1;
            if (iyExt < 0) iyExt = 0;
            if (iyExt >= effHeight) iyExt = effHeight - 1;
            if (iyExt < topBuf || iyExt >= topBuf + height) {
              // keep ix0 so we can sample nearest map column for blending
              baseIxArr.push(ix0);
              iyMapArr.push(0);
              isPolarArr.push(1);
              // polarSide: 1 = top, 2 = bottom
              if (iyExt < topBuf) {
                // top polar
                polarSideArr.push(1);
              } else {
                // bottom polar
                polarSideArr.push(2);
              }
            } else {
              baseIxArr.push(ix0);
              iyMapArr.push(iyExt - topBuf);
              isPolarArr.push(0);
              polarSideArr.push(0);
            }
            mercYArr.push(mercY);
            pixels.push({ px, py });
          }
        }
        this._precompute = {
          W, H, R, cx, cy, width, height, topBuf, bottomBuf, pixels,
          baseIx: Int16Array.from(baseIxArr),
          iyMap: Int16Array.from(iyMapArr),
          isPolar: Uint8Array.from(isPolarArr),
          polarSide: Uint8Array.from(polarSideArr),
          mercY: Float32Array.from(mercYArr),
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
      // determine polar buffer colors from top/bottom map rows (most frequent color)
      let polarTopRgb = [255,255,255];
      let polarBottomRgb = [255,255,255];
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
            for (const [k,v] of m.entries()) { if (v > bestCount) { best = k; bestCount = v; } }
            return best;
          };
          const topColor = pickMost(countsTop);
          const bottomColor = pickMost(countsBottom);
          if (topColor) polarTopRgb = this.parseColorToRgb(topColor);
          if (bottomColor) polarBottomRgb = this.parseColorToRgb(bottomColor);
        }
      } catch (e) {
        // fall back to white if anything fails
        polarTopRgb = [255,255,255];
        polarBottomRgb = [255,255,255];
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
          let colMap = this.parseColorToRgb(mapColorStr);
          // 分類重み（海/陸/乾燥）取得用のマップ座標
          const xMap = (displayX - 1 + (this._rotationColumns || 0)) % width;
          const yMap = (side === 1) ? 0 : (height - 1);
          // 雲クラス重み（UV基準の9タップ平滑・バイリニア補間）
          let classW = 1.0;
          // 極近傍でも陸（氷河除く）なら軽くトーンを足す（近似）
          if (this.gridData && this.gridData.length === width * height) {
            // 連続uv（map域）を算出し、uvオフセットに基づく9サンプル平均を取得
            const effHeight = height + topBuf + bottomBuf;
            const uTopFrac = topBuf / effHeight;
            const uHeightFrac = height / effHeight;
            const sx = p.px / R;
            const sy = -p.py / R;
            const sq = sx * sx + sy * sy;
            const sz = Math.sqrt(Math.max(0, 1 - Math.min(1, sq)));
            const lambda = Math.atan2(sx, sz);
            const uCoord = (((lambda + Math.PI) / (2 * Math.PI)) + (this._rotationColumns || 0) / Math.max(1, width)) % 1;
            const vCoord = Math.max(0, Math.min(1, (vEff - uTopFrac) / Math.max(1e-6, uHeightFrac)));
            const rUV = 0.75 / Math.max(1, this.cloudPeriod || 16);
            classW = this._sampleClassWeightSmooth(uCoord, vCoord, width, height, this.gridData, rUV);
            const cell = this.gridData[yMap * width + xMap];
            if (cell && cell.terrain && cell.terrain.type === 'land' && cell.terrain.land !== 'glacier') {
              const tint = this.parseColorToRgb(this.landTintColor);
              const k = Math.max(0, Math.min(1, (this.landTintStrength || 0) * 0.6)); // 極はやや弱め
              colMap = [
                Math.round(colMap[0] * (1 - k) + tint[0] * k),
                Math.round(colMap[1] * (1 - k) + tint[1] * k),
                Math.round(colMap[2] * (1 - k) + tint[2] * k)
              ];
            }
          }
          // blending weight based on vertical distance (mercY) and polarBlendRows
          const mercY = (pc.mercY && pc.mercY[i] != null) ? pc.mercY[i] : ((side === 1) ? 0 : 1);
          const effHeight = height + topBuf + bottomBuf;
          const uTopFrac = topBuf / effHeight;
          const uHeightFrac = height / effHeight;
          const blendRows = Math.max(0, Math.min(this.polarBlendRows || 3, Math.floor(effHeight)));
          const blendFrac = blendRows / effHeight;
          let delta = 0;
          if (side === 1) delta = uTopFrac - mercY;
          else delta = mercY - (uTopFrac + uHeightFrac);
          let polarWeight = 1.0;
          if (blendFrac > 0) {
            polarWeight = Math.max(0, Math.min(1, delta / blendFrac));
          }
          // add fractal noise to break straight seam
          const n = this._fractalNoise2D((pc.cx + p.px) * (this.polarNoiseScale || 0.05), (pc.cy + p.py) * (this.polarNoiseScale || 0.05), 4, 0.5);
          polarWeight = Math.max(0, Math.min(1, polarWeight + (n - 0.5) * (this.polarNoiseStrength || 0.3)));
          const mapWeight = 1 - polarWeight;
          const r = Math.round(colPolar[0] * polarWeight + colMap[0] * mapWeight);
          const g = Math.round(colPolar[1] * polarWeight + colMap[1] * mapWeight);
          const b = Math.round(colPolar[2] * polarWeight + colMap[2] * mapWeight);
          // --- 雲オーバーレイ（描画後に適用） ---
          // 経度u: 回転を反映したマップ列から推定
          const uEff = ((xMap % width) + width) % width / width;
          // クラウド有効度
          const effC = Math.max(0, Math.min(1, (this.cloudAmount || 0) * classW));
          let rr = r, gg = g, bb = b;
          if (effC > 0) {
            const nCloud = this._fbmTile(uEff, vEff, this.cloudPeriod || 16);
            const t = 0.9 + (0.2 - 0.9) * effC; // mix(0.9,0.2,effC)
            const edge = 0.08;
            // smoothstep(t-edge, t+edge, nCloud)
            let coverage = 0;
            if (nCloud <= t - edge) coverage = 0;
            else if (nCloud >= t + edge) coverage = 1;
            else coverage = (nCloud - (t - edge)) / (2 * edge);
            const alpha = 0.35 + 0.45 * Math.sqrt(effC);
            const depth = Math.max(0, Math.min(1, (nCloud - t) / Math.max(1e-3, 1 - t)));
            const detail = this._fbmTile((uEff + 0.123) % 1, (vEff + 0.456) % 1, (this.cloudPeriod || 16) * 4);
            const density = 0.3 + (1.0 - 0.3) * (0.5 * detail + 0.5 * depth);
            const k = Math.max(0, Math.min(1, coverage * alpha * density));
            rr = Math.round(rr * (1 - k) + 255 * k);
            gg = Math.round(gg * (1 - k) + 255 * k);
            bb = Math.round(bb * (1 - k) + 255 * k);
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
          if (this.gridData && this.gridData.length === width * height) {
            const effHeight = height + topBuf + bottomBuf;
            const uTopFrac = topBuf / effHeight;
            const uHeightFrac = height / effHeight;
            const sx = p.px / R;
            const sy = -p.py / R;
            const sq = sx * sx + sy * sy;
            const sz = Math.sqrt(Math.max(0, 1 - Math.min(1, sq)));
            const lambda = Math.atan2(sx, sz);
            const uCoord = (((lambda + Math.PI) / (2 * Math.PI)) + (this._rotationColumns || 0) / Math.max(1, width)) % 1;
            const vCoord = Math.max(0, Math.min(1, (vEff - uTopFrac) / Math.max(1e-6, uHeightFrac)));
            const rUV = 0.75 / Math.max(1, this.cloudPeriod || 16);
            classW = this._sampleClassWeightSmooth(uCoord, vCoord, width, height, this.gridData, rUV);
            // 陸トーン適用のためのセル参照（グリッド座標）
            const xMap = ((ix0 + colShift) % width + width) % width;
            const yMap = iy;
            const cell = this.gridData[yMap * width + xMap];
            if (cell && cell.terrain && cell.terrain.type === 'land' && cell.terrain.land !== 'glacier') {
              const tint = this.parseColorToRgb(this.landTintColor);
              const k = Math.max(0, Math.min(1, this.landTintStrength || 0));
              r = Math.round(r * (1 - k) + tint[0] * k);
              g = Math.round(g * (1 - k) + tint[1] * k);
              b = Math.round(b * (1 - k) + tint[2] * k);
            }
          }
          // --- 雲オーバーレイ（描画後に適用） ---
          // 経度u: 回転を反映したマップ列から
          const uEff = ((((ix0 + colShift) % width) + width) % width) / width;
          const effC = Math.max(0, Math.min(1, (this.cloudAmount || 0) * classW));
          let rr = r, gg = g, bb = b;
          if (effC > 0) {
            const nCloud = this._fbmTile(uEff, vEff, this.cloudPeriod || 16);
            const t = 0.9 + (0.2 - 0.9) * effC;
            const edge = 0.08;
            let coverage = 0;
            if (nCloud <= t - edge) coverage = 0;
            else if (nCloud >= t + edge) coverage = 1;
            else coverage = (nCloud - (t - edge)) / (2 * edge);
            const alpha = 0.35 + 0.45 * Math.sqrt(effC);
            const depth = Math.max(0, Math.min(1, (nCloud - t) / Math.max(1e-3, 1 - t)));
            const detail = this._fbmTile((uEff + 0.123) % 1, (vEff + 0.456) % 1, (this.cloudPeriod || 16) * 4);
            const density = 0.3 + (1.0 - 0.3) * (0.5 * detail + 0.5 * depth);
            const k = Math.max(0, Math.min(1, coverage * alpha * density));
            rr = Math.round(rr * (1 - k) + 255 * k);
            gg = Math.round(gg * (1 - k) + 255 * k);
            bb = Math.round(bb * (1 - k) + 255 * k);
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
  }
}
</script>

<style scoped>
</style>


