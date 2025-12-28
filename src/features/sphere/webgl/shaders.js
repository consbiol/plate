export function getVertexShaderSource() {
    return `
        attribute vec2 a_position;
        void main() {
          gl_Position = vec4(a_position, 0.0, 1.0);
        }
      `;
}

export function getFragmentShaderSource() {
    return `
        precision mediump float;
        uniform sampler2D u_texture;
        uniform sampler2D u_classTex;
        uniform float u_offset; // fraction [0,1)
        uniform float u_texWidth; // texture width in texels
        uniform float u_texHeight; // texture height in texels
        uniform float u_shadowEnabled; // 0..1
        uniform float u_shadowStartCol; // start column in [0..u_texWidth)
        uniform float u_shadowLenCols;  // length in columns (half globe)
        uniform float u_shadowGradCols; // gradient width in columns (e.g. 3)
        uniform vec3 u_cityLightColor;  // 0..1
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
        uniform float u_f_cloud;      // 0..1
        uniform float u_cloudPeriod;      // e.g. 16
        uniform float u_polarCloudBoost;  // 0..1
        uniform vec3 u_cloudColor;        // 0..1
        const float PI = 3.141592653589793;
        float modPos(float a, float m) {
          return a - m * floor(a / m);
        }
        float nightAlphaForCol(float col, float w, float startCol, float lenCols, float gradCols) {
          if (w <= 0.0 || lenCols <= 0.0) return 0.0;
          float x = modPos(col, w);
          float s = modPos(startCol, w);
          float distFromStart = modPos(x - s, w);
          if (distFromStart >= lenCols) return 0.0;
          if (gradCols <= 1.0) return 1.0;
          float dEdge = min(distFromStart, (lenCols - 1.0) - distFromStart);
          if (dEdge >= (gradCols - 1.0)) return 1.0;
          return clamp(dEdge / (gradCols - 1.0), 0.0, 1.0);
        }
        float sampleCityMaskSmooth(vec2 uv) {
          // 2x2 box sample in texel space for smoother city lights (less blocky)
          if (u_texWidth <= 0.0 || u_texHeight <= 0.0) return texture2D(u_classTex, uv).g;
          vec2 texel = vec2(1.0 / u_texWidth, 1.0 / u_texHeight);
          // sample offsets: (0,0), (1,0), (0,1), (1,1)
          vec2 p0 = vec2(fract(uv.x), clamp(uv.y, 0.0, 1.0));
          vec2 p1 = vec2(fract(uv.x + texel.x), clamp(uv.y, 0.0, 1.0));
          vec2 p2 = vec2(fract(uv.x), clamp(uv.y + texel.y, 0.0, 1.0));
          vec2 p3 = vec2(fract(uv.x + texel.x), clamp(uv.y + texel.y, 0.0, 1.0));
          float sum = texture2D(u_classTex, p0).g + texture2D(u_classTex, p1).g + texture2D(u_classTex, p2).g + texture2D(u_classTex, p3).g;
          return sum / 4.0;
        }
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
          // "Sun" longitude: include rotation offset so the shadow rotates with the sphere
          float uSun = fract((lambda + PI) / (2.0 * PI) + u_offset);
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
          float eff = clamp(u_f_cloud * classW, 0.0, 1.0);
          // トーラスFBMノイズ（極バッファ含む全域で評価）
          float nCloud = fbmTile(vec2(uEff, vEff), max(2.0, u_cloudPeriod));
          // 被覆度の閾値（雲量で強く変化）: 雲量↑で閾値↓ → coverage↑
          float t = mix(0.9, 0.2, eff);
          // 極ブースト: vEffが0/1に近いほど強い（閾値を下げる）
          float pole = abs(vEff - 0.5) / 0.5; // 端(極)で1, 赤道で0
          pole = clamp(pole, 0.0, 1.0);
          float tAdj = 0.25 * clamp(u_polarCloudBoost, 0.0, 1.0) * pole;
          t = clamp(t - tAdj, 0.0, 1.0);
          float edge = 0.08;
          float coverage = smoothstep(t - edge, t + edge, nCloud);
          // 雲の不透明度
          float alpha = 0.70 + 1.0 * sqrt(eff);
          // 覆われた領域内の濃淡（厚み + 高周波ディテール）で変調
          float depth = clamp((nCloud - t) / max(1e-3, 1.0 - t), 0.0, 1.0);
          float detail = fbmTile(vec2(uEff, vEff) + vec2(0.123, 0.456), max(2.0, u_cloudPeriod * 4.0));
          float density = mix(0.3, 1.0, 0.5 * detail + 0.5 * depth);
          vec3 outCol = mix(baseCol, u_cloudColor, coverage * alpha * density);
          // --- Sun shadow overlay (night side) ---
          if (u_shadowEnabled > 0.5) {
            float colSun = uSun * u_texWidth;
            float aNight = nightAlphaForCol(colSun, u_texWidth, u_shadowStartCol, u_shadowLenCols, u_shadowGradCols);
            if (aNight > 0.0) {
              // In gradient region (partial night) do not show city lights; only darken.
              if (aNight < 0.999) {
                outCol = outCol * (1.0 - aNight);
              } else {
                float cityMask = sampleCityMaskSmooth(vec2(uMap, vMap)); // smooth mask 0..1
                // fully dark background blended with smoothed city lights
                vec3 darkBg = vec3(0.0);
                outCol = mix(darkBg, u_cityLightColor, cityMask);
              }
            }
          }
          gl_FragColor = vec4(outCol, 1.0);
        }
      `;
}


