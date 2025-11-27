<template>
  <div style="display:none"></div>
</template>

<script>
// このコンポーネントは「計算専用」です（UIや描画は行いません）。
// 概要:
// 1) 陸中心のサンプリングと各中心の影響（スコア）計算
// 2) スコアに基づく海/陸の初期マスク生成（海陸比を保つ閾値）
// 3) 膨張（ディレーション）により連結性を強化（トーラスを考慮）
// 4) BFSで海まで/陸までの距離を算出（後段の分類に使用）
// 5) 陸は「低地/乾燥地」に分類、湖を生成し浅瀬で上書き、湖の周囲を低地で縁取り
// 6) 高地を生成し灰色がかった茶色で上書き（各中心点ごと、サイズは湖の10倍、形状はメイン方向に沿った帯状で横方向にノイズ性の広がりを持つ）
// 7) 低地の一部をツンドラへ上書き
// 8) 最後に氷河で上書き（海・湖を含めて最終段）
// トーラス接続の定義:
// - 左右端は通常のラップ（0↔gridSize-1）
// - 上端は「左半分↔右半分」を同じ上端行(y=0)で接続
// - 下端は「左半分↔右半分」を同じ下端行(y=gridSize-1)で接続
export default {
  name: 'Grids_Calculation',
  props: {
    gridWidth: { type: Number, required: true },
    gridHeight: { type: Number, required: true },
    seaLandRatio: { type: Number, required: true },
    centersY: { type: Number, required: true },
    minCenterDistance: { type: Number, required: true },
    noiseAmp: { type: Number, required: true, default: 0.08 },
    kDecay: { type: Number, required: true, default: 2.0 },
    baseSeaDistanceThreshold: { type: Number, required: true },
    baseLandDistanceThreshold: { type: Number, required: true },
    // 平均気温(°C): 氷河行数の大本パラメータ
    averageTemperature: { type: Number, required: false, default: 15 },
    // per-latitude-band vertical wobble (rows): integer number of rows to shift (+/-)
    landBandVerticalWobbleRows: { type: Number, required: false, default: 2 },
    // X scale for wobble noise sampling
    landBandWobbleXScale: { type: Number, required: false, default: 0.05 },
    // per-latitude-band land distance thresholds (bands 1..10, pole->equator)
    landDistanceThreshold1: { type: Number, required: false, default: 35 },
    landDistanceThreshold2: { type: Number, required: false, default: 35 },
    landDistanceThreshold3: { type: Number, required: false, default: 35 },
    landDistanceThreshold4: { type: Number, required: false, default: 35 },
    landDistanceThreshold5: { type: Number, required: false, default: 25 },
    landDistanceThreshold6: { type: Number, required: false, default: 10 },
    landDistanceThreshold7: { type: Number, required: false, default: 5 },
    landDistanceThreshold8: { type: Number, required: false, default: 10 },
    landDistanceThreshold9: { type: Number, required: false, default: 25 },
    landDistanceThreshold10: { type: Number, required: false, default: 35 },
    topTundraRows: { type: Number, required: true },
    topGlacierRows: { type: Number, required: true },
    landGlacierExtraRows: { type: Number, required: true },
    highlandGlacierExtraRows: { type: Number, required: true },
      alpineGlacierExtraRows: { type: Number, required: true },
    averageLakesPerCenter: { type: Number, required: true },
    averageHighlandsPerCenter: { type: Number, required: true },
    centerParameters: { type: Array, required: true },
    generateSignal: { type: Number, required: true }
  },
  data() {
    return {};
  },
  watch: {
    generateSignal() {
      this.runGenerate();
    }
  },
  mounted() {
    // 何もしない（初期マウント時の処理は不要）
  },
  methods: {
    // トーラス上の距離（xは通常ラップ、yは端で半分ずらして接続）
    torusDistance(x1, y1, x2, y2) {
      const dx = Math.min(Math.abs(x1 - x2), this.gridWidth - Math.abs(x1 - x2));
      let dy = Math.abs(y1 - y2);
      if (y1 === 0 && y2 === 0) {
        const halfSize = this.gridWidth / 2;
        if ((x1 < halfSize && x2 >= halfSize) || (x1 >= halfSize && x2 < halfSize)) {
          const leftX = x1 < halfSize ? x1 : x2;
          const rightX = x1 >= halfSize ? x1 : x2;
          dy = Math.min(dy, Math.abs((leftX + halfSize) - rightX));
        }
      } else if (y1 === this.gridHeight - 1 && y2 === this.gridHeight - 1) {
        const halfSize = this.gridWidth / 2;
        if ((x1 < halfSize && x2 >= halfSize) || (x1 >= halfSize && x2 < halfSize)) {
          const leftX = x1 < halfSize ? x1 : x2;
          const rightX = x1 >= halfSize ? x1 : x2;
          dy = Math.min(dy, Math.abs((leftX + halfSize) - rightX));
        }
      }
      return Math.hypot(dx, dy);
    },
    // トーラス上での最短経路の方向ベクトルを計算（角度計算用）
    // 戻り値: { dx, dy } トーラス上での最短経路の方向
    torusDirection(x1, y1, x2, y2) {
      const halfSize = this.gridWidth / 2;
      let bestDx = 0;
      let bestDy = 0;
      let bestDist = Infinity;
      
      // すべての可能な経路を試して最短のものを選ぶ
      const candidates = [];
      
      // 通常の経路（ラップなし）
      candidates.push({ dx: x2 - x1, dy: y2 - y1 });
      
      // x方向のラップを考慮
      const dx1 = x2 - x1;
      const dx2 = (x2 > x1) ? (x2 - this.gridWidth - x1) : (x2 + this.gridWidth - x1);
      candidates.push({ dx: dx1, dy: y2 - y1 });
      candidates.push({ dx: dx2, dy: y2 - y1 });
      
      // 上端でのトーラス接続を考慮
      if (y1 === 0 && y2 === 0) {
        if ((x1 < halfSize && x2 >= halfSize) || (x1 >= halfSize && x2 < halfSize)) {
          const leftX = x1 < halfSize ? x1 : x2;
          const rightX = x1 >= halfSize ? x1 : x2;
          candidates.push({ dx: (rightX - leftX - halfSize), dy: 0 });
        }
      } else if (y1 === this.gridHeight - 1 && y2 === this.gridHeight - 1) {
        if ((x1 < halfSize && x2 >= halfSize) || (x1 >= halfSize && x2 < halfSize)) {
          const leftX = x1 < halfSize ? x1 : x2;
          const rightX = x1 >= halfSize ? x1 : x2;
          candidates.push({ dx: (rightX - leftX - halfSize), dy: 0 });
        }
      }
      
      // 上端から下端へのトーラス接続を考慮
      if (y1 === 0) {
        const wrappedX = (x1 < halfSize) ? (x1 + halfSize) : (x1 - halfSize);
        candidates.push({ dx: wrappedX - x1, dy: this.gridHeight - 1 - y1 });
      }
      if (y1 === this.gridHeight - 1) {
        const wrappedX = (x1 < halfSize) ? (x1 + halfSize) : (x1 - halfSize);
        candidates.push({ dx: wrappedX - x1, dy: 0 - y1 });
      }
      
      // 最短経路を選ぶ
      for (const cand of candidates) {
        const dist = Math.hypot(cand.dx, cand.dy);
        if (dist < bestDist) {
          bestDist = dist;
          bestDx = cand.dx;
          bestDy = cand.dy;
        }
      }
      
      return { dx: bestDx, dy: bestDy };
    },
    // トーラス上の座標ラップ（近傍探索やBFSで使用）
    // 戻り値: ラップ後の座標（無効ならnull）
    torusWrap(x, y) {
      let wx = x;
      let wy = y;
      // 左右端の通常ラップ
      if (wx < 0) wx += this.gridWidth;
      if (wx >= this.gridWidth) wx -= this.gridWidth;
      const halfSize = this.gridWidth / 2;
      if (wy < 0) {
        // 上端越境: 上端行(0)に固定し、xを半幅シフトして接続
        if (wx < halfSize) {
          wx = wx + halfSize;
        } else {
          wx = wx - halfSize;
        }
        wy = 0;
      } else if (wy >= this.gridHeight) {
        // 下端越境: 下端行(gridHeight-1)に固定し、xを半幅シフトして接続
        if (wx < halfSize) {
          wx = wx + halfSize;
        } else {
          wx = wx - halfSize;
        }
        wy = this.gridHeight - 1;
      }
      if (wy < 0 || wy >= this.gridHeight) {
        return null;
      }
      return { x: wx, y: wy };
    },
    // 緯度帯インデックスを取得（1..10）。両極から5行ごとに帯を区切る。
    _getLatBandIndex(y, x) {
      const wobbleRows = Math.max(0, Math.floor(this.landBandVerticalWobbleRows || 0));
      let yShifted = y;
      if (wobbleRows > 0) {
        // noise2D returns -1..1; scale to wobbleRows and round
        const shift = Math.round(this.noise2D((x || 0) * (this.landBandWobbleXScale || 0.05), 0) * wobbleRows);
        yShifted = Math.max(0, Math.min(this.gridHeight - 1, y + shift));
      }
      const dPole = Math.min(yShifted, this.gridHeight - 1 - yShifted);
      const band = Math.floor(dPole / 5) + 1;
      if (band < 1) return 1;
      if (band > 10) return 10;
      return band;
    },
    // 指定行/列の land distance threshold を返す
    _getLandDistanceThresholdForRow(y, x) {
      const b = this._getLatBandIndex(y, x);
      switch (b) {
        case 1: return this.landDistanceThreshold1;
        case 2: return this.landDistanceThreshold2;
        case 3: return this.landDistanceThreshold3;
        case 4: return this.landDistanceThreshold4;
        case 5: return this.landDistanceThreshold5;
        case 6: return this.landDistanceThreshold6;
        case 7: return this.landDistanceThreshold7;
        case 8: return this.landDistanceThreshold8;
        case 9: return this.landDistanceThreshold9;
        case 10: return this.landDistanceThreshold10;
        default: return this.landDistanceThreshold10;
      }
    },
    // 平均気温から上端・下端氷河グリッド数を算出（10℃低下ごとに+10）
    _computeTopGlacierRowsFromAverageTemperature() {
      const t = (typeof this.averageTemperature === 'number') ? this.averageTemperature : 15;
      const anchors = [
        { t: -25, val: 45 },
        { t: -15, val: 35 },
        { t: -5,  val: 25 },
        { t: 5,   val: 15 },
        { t: 10,  val: 10 },
        { t: 15,  val: 5  },
        { t: 25,  val: -5 }
      ];
      let v;
      if (t <= anchors[0].t) {
        // 直線外挿（傾き -1 行/℃）
        v = anchors[0].val + (t - anchors[0].t) * (-1);
      } else if (t >= anchors[anchors.length - 1].t) {
        const last = anchors[anchors.length - 1];
        v = last.val + (t - last.t) * (-1);
      } else {
        for (let i = 0; i < anchors.length - 1; i++) {
          const a = anchors[i];
          const b = anchors[i + 1];
          if (t >= a.t && t <= b.t) {
            const ratio = (t - a.t) / (b.t - a.t);
            v = a.val + ratio * (b.val - a.val);
            break;
          }
        }
      }
      return Math.round(v);
    },
    noise2D(x, y) {
      const s = Math.sin((x * 12.9898) + (y * 78.233)) * 43758.5453;
      let t = s - Math.floor(s);
      return t * 2 - 1;
    },
    fractalNoise2D(x, y, octaves = 3, persistence = 0.4, scale = 0.1) {
      let value = 0;
      let amplitude = 1;
      let frequency = scale;
      let maxValue = 0;
      for (let i = 0; i < octaves; i++) {
        value += this.noise2D(x * frequency, y * frequency) * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= 2;
      }
      return value / maxValue;
    },
    sampleLandCenters() {
      const centers = [];
      const yCenters = Math.max(1, Math.min(10, Math.min(this.gridHeight, this.centersY)));
      const minDistance = this.minCenterDistance;
      const maxAttempts = 1000;
      const edgeMargin = 10; // 外縁から除外するグリッド数
      for (let i = 0; i < yCenters; i++) {
        let newCenter;
        let attempts = 0;
        let valid = false;
        while (!valid && attempts < maxAttempts) {
          const cx = Math.floor(Math.random() * this.gridWidth);
          const cy = Math.floor(Math.random() * this.gridHeight);
          newCenter = { x: cx, y: cy };
          // 外縁から10グリッド以内の座標を除外
          const isNearEdge = cx < edgeMargin || cx >= this.gridWidth - edgeMargin ||
                             cy < edgeMargin || cy >= this.gridHeight - edgeMargin;
          if (isNearEdge) {
            valid = false;
          } else if (centers.length === 0) {
            valid = true;
          } else {
            valid = true;
            for (const existingCenter of centers) {
              const distance = this.torusDistance(
                newCenter.x, newCenter.y,
                existingCenter.x, existingCenter.y
              );
              if (distance <= minDistance) {
                valid = false;
                break;
              }
            }
          }
          attempts++;
        }
        if (valid && newCenter) {
          centers.push(newCenter);
        }
      }
      return centers;
    },
    computeScoresForCenters(centers, centerParameters) {
      const N = this.gridWidth * this.gridHeight;
      const maxTorusDistance = Math.sqrt(Math.pow(this.gridWidth / 2, 2) + Math.pow(this.gridHeight - 1, 2));
      const rMaxPerCenter = centers.map(() => {
        return maxTorusDistance || 1;
      });
      const scores = new Array(N);
      const distanceWarpAmplitude = 0.03; // 距離ワープの振幅を増やして形状を不規則に
      const fractalNoiseScale = 0.06;
      const centerInfluenceNoise = centers.map((c, ci) => {
        const param = centerParameters && centerParameters[ci];
        return {
          influenceMultiplier: param ? param.influenceMultiplier : 1.0,
          kDecayVariation: param ? param.kDecayVariation : this.kDecay,
          directionAngle: param ? param.directionAngle : 0
        };
      });
      for (let gy = 0; gy < this.gridHeight; gy++) {
        for (let gx = 0; gx < this.gridWidth; gx++) {
          let maxScore = -Infinity;
          for (let ci = 0; ci < centers.length; ci++) {
            const c = centers[ci];
            const centerNoise = centerInfluenceNoise[ci];
            let di = this.torusDistance(gx, gy, c.x, c.y);
            // トーラス上での最短経路の方向を計算して角度を求める
            const dir = this.torusDirection(c.x, c.y, gx, gy);
            const angle = Math.atan2(dir.dy, dir.dx);
            const fractalN = this.fractalNoise2D(gx * fractalNoiseScale, gy * fractalNoiseScale, 3, 0.5);
            const angularN = this.noise2D(Math.cos(angle) * 10, Math.sin(angle) * 10);
            const distanceWarp = (fractalN * 0.30 + angularN * 0.70) * distanceWarpAmplitude * rMaxPerCenter[ci];
            di = di * (1 + distanceWarp * 0.15) + distanceWarp * 0.25; // 距離ワープの影響を増やして形状を不規則に
            const dn = di / rMaxPerCenter[ci];
            const base = Math.exp(- (dn * dn) * centerNoise.kDecayVariation);
            const simpleNoise = this.noise2D(gx, gy);
            const n = fractalN * 0.60 + simpleNoise * 0.40; // フラクタルノイズの比率を上げて形状を不規則に
            let angleDiff = Math.abs(angle - centerNoise.directionAngle);
            if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
            const directionalBoost = 1.0 + Math.max(0, Math.cos(angleDiff)) * 0.8;
            const score = (base + this.noiseAmp * n) * centerNoise.influenceMultiplier * directionalBoost;
            if (score > maxScore) maxScore = score;
          }
          scores[gy * this.gridWidth + gx] = maxScore;
        }
      }
      return { scores };
    },
    runGenerate() {
      const N = this.gridWidth * this.gridHeight;
      const glacierNoiseTable = new Array(N);
      for (let i = 0; i < N; i++) {
        glacierNoiseTable[i] = (Math.random() * 2 - 1);
      }
      let centers = this.sampleLandCenters();
      // ノイズから中心パラメータを生成（propsは直接変更しない）
      let localCenterParameters = centers.map((c) => {
        const n1 = this.noise2D(c.x * 0.1, c.y * 0.1);
        const n2 = this.noise2D(c.x * 0.15, c.y * 0.15);
        return {
          x: c.x,
          y: c.y,
          influenceMultiplier: 1.0 + n1 * 0.75, // 影響係数を小さくして陸グリッドサイズを縮小
          kDecayVariation: this.kDecay * (1.0 + n1 * 0.75),
          directionAngle: n2 * Math.PI * 2 * 1.5
        };
      });
      let scores, threshold;
      let success = false;
      for (let attempt = 0; attempt < 5 && !success; attempt++) {
        const res = this.computeScoresForCenters(centers, localCenterParameters);
        scores = res.scores;
        const sorted = scores.slice().sort((a, b) => a - b);
        const k = Math.floor((1 - this.seaLandRatio) * N);
        threshold = sorted[Math.max(0, Math.min(sorted.length - 1, k))];
        let anyCenterLand = false;
        for (let i = 0; i < centers.length; i++) {
          const c = centers[i];
          const sc = scores[c.y * this.gridWidth + c.x];
          if (sc >= threshold) { anyCenterLand = true; break; }
        }
        if (anyCenterLand) {
          success = true;
        } else {
          centers = this.sampleLandCenters();
        }
      }
      const landMask = new Array(N).fill(false);
      for (let i = 0; i < N; i++) landMask[i] = scores[i] >= threshold;
      // 前計算: 各セルのノイズ（後段の複数ループで再利用）
      const noiseGrid = new Array(N);
      for (let gy = 0; gy < this.gridHeight; gy++) {
        for (let gx = 0; gx < this.gridWidth; gx++) {
          const idx = gy * this.gridWidth + gx;
          noiseGrid[idx] = this.noise2D(gx, gy);
        }
      }
      // 前計算: 各セルの最寄り中心インデックス（湖/高地生成の所属チェック高速化）
      const ownerCenterIdx = new Array(N).fill(-1);
      for (let gy = 0; gy < this.gridHeight; gy++) {
        for (let gx = 0; gx < this.gridWidth; gx++) {
          const idx = gy * this.gridWidth + gx;
          let minDist = Infinity;
          let closestIdx = -1;
          for (let cj = 0; cj < centers.length; cj++) {
            const c = centers[cj];
            const d = this.torusDistance(gx, gy, c.x, c.y);
            if (d < minDist) {
              minDist = d;
              closestIdx = cj;
            }
          }
          ownerCenterIdx[idx] = closestIdx;
        }
      }
      // 膨張のバイアス（閾値近傍の許容範囲）: 大きいほど緩い条件で陸地が拡張されます（大陸の統合を防ぐため小さめに）
      const expansionBias = 0.20;
      // 最大反復回数: トーラス間の連結を確保しつつ、陸グリッドサイズを小さくするため少し減らす
      const maxIterations = 10;
      for (let iter = 0; iter < maxIterations; iter++) {
        const newLandMask = landMask.slice();
        let changed = false;
        for (let gy = 0; gy < this.gridHeight; gy++) {
          for (let gx = 0; gx < this.gridWidth; gx++) {
            const idx = gy * this.gridWidth + gx;
            if (landMask[idx]) continue;
            let landNeighborCount = 0;
            for (let dx = -1; dx <= 1; dx++) {
              for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                const wrapped = this.torusWrap(gx + dx, gy + dy);
                if (wrapped && landMask[wrapped.y * this.gridWidth + wrapped.x]) {
                  landNeighborCount++;
                }
              }
            }
            const scoreClose = scores[idx] >= threshold - expansionBias;
            // 大陸の統合を防ぐため、条件を厳しくする:
            // - スコアが閾値近傍なら「近傍3」で昇格、
            // - 無条件昇格の近傍数も3に上げる（大陸の独立性を保つ）
            if ((landNeighborCount >= 3 && scoreClose) || landNeighborCount >= 4) {
              newLandMask[idx] = true;
              changed = true;
            }
          }
        }
        for (let i = 0; i < N; i++) landMask[i] = newLandMask[i];
        if (!changed) break;
      }
    // 小島（単独1グリッド）の90%を削除（ランダムに残す約10%）
    for (let gy = 0; gy < this.gridHeight; gy++) {
      for (let gx = 0; gx < this.gridWidth; gx++) {
        const idx = gy * this.gridWidth + gx;
        if (!landMask[idx]) continue;
        // 8近傍に陸があれば単独島ではない
        let hasLandNeighbor = false;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const wrapped = this.torusWrap(gx + dx, gy + dy);
            if (!wrapped) continue;
            const nIdx = wrapped.y * this.gridWidth + wrapped.x;
            if (landMask[nIdx]) { hasLandNeighbor = true; break; }
          }
          if (hasLandNeighbor) break;
        }
        if (!hasLandNeighbor) {
          // 90% の確率で海に戻す
          if (Math.random() < 0.9) landMask[idx] = false;
        }
      }
    }
      const seaNoiseAmplitude = 1.5;
      const landNoiseAmplitude = 2.5;
      const deepSeaColor = 'rgb(30, 80, 140)';
      const shallowSeaColor = 'rgb(60, 120, 180)';
      const lowlandColor = 'rgb(34, 139, 34)';
      const desertColor = 'rgb(150, 130, 110)'; // 乾燥地: 茶色がかった灰色
      const highlandColor = 'rgb(145, 100, 75)'; // 高地: 灰色がかった茶色（茶色気味）
      const alpineColor = 'rgb(95, 80, 70)'; // 高山: 灰色がかった焦げ茶色
      const tundraColor = 'rgb(104, 131, 56)';
      const glacierColor = 'rgb(255, 255, 255)';
      const distanceToSea = new Array(N).fill(Infinity);
      const distanceToLand = new Array(N).fill(Infinity);
      // 近傍方向（トーラス考慮はtorusWrap側で処理）
      const directions = [
        { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
        { dx: -1, dy: 0 },                     { dx: 1, dy: 0 },
        { dx: -1, dy: 1 },  { dx: 0, dy: 1 },  { dx: 1, dy: 1 }
      ];
      // Dijkstra用の最短路計算（優先度付きキュー）
      const computeDistanceMap = (sources) => {
        const dist = new Array(N).fill(Infinity);
        const heap = [];
        const heapPush = (node) => {
          heap.push(node);
          let i = heap.length - 1;
          while (i > 0) {
            const p = Math.floor((i - 1) / 2);
            if (heap[p].dist <= heap[i].dist) break;
            const tmp = heap[p]; heap[p] = heap[i]; heap[i] = tmp;
            i = p;
          }
        };
        const heapPop = () => {
          if (heap.length === 0) return null;
          const top = heap[0];
          const last = heap.pop();
          if (heap.length > 0) {
            heap[0] = last;
            let i = 0;
            let moved = true;
            while (moved) {
              moved = false;
              const left = i * 2 + 1;
              const right = i * 2 + 2;
              let smallest = i;
              if (left < heap.length && heap[left].dist < heap[smallest].dist) smallest = left;
              if (right < heap.length && heap[right].dist < heap[smallest].dist) smallest = right;
              if (smallest !== i) {
                const tmp = heap[i]; heap[i] = heap[smallest]; heap[smallest] = tmp;
                i = smallest;
                moved = true;
              }
            }
          }
          return top;
        };
        for (const s of sources) {
          const sIdx = s.y * this.gridWidth + s.x;
          dist[sIdx] = 0;
          heapPush({ x: s.x, y: s.y, idx: sIdx, dist: 0 });
        }
        while (heap.length > 0) {
          const current = heapPop();
          if (!current) break;
          if (current.dist !== dist[current.idx]) continue;
          for (const dir of directions) {
            const wrapped = this.torusWrap(current.x + dir.dx, current.y + dir.dy);
            if (!wrapped) continue;
            const nIdx = wrapped.y * this.gridWidth + wrapped.x;
            const w = this.torusDistance(current.x, current.y, wrapped.x, wrapped.y);
            const nd = current.dist + w;
            if (nd < dist[nIdx]) {
              dist[nIdx] = nd;
              heapPush({ x: wrapped.x, y: wrapped.y, idx: nIdx, dist: nd });
            }
          }
        }
        return dist;
      };
      // 距離マップ計算: 陸まで（ソース=陸セル）
      const landSources = [];
      for (let gy = 0; gy < this.gridHeight; gy++) {
        for (let gx = 0; gx < this.gridWidth; gx++) {
          const idx = gy * this.gridWidth + gx;
          if (landMask[idx]) landSources.push({ x: gx, y: gy });
        }
      }
      for (let i = 0; i < N; i++) distanceToLand[i] = Infinity;
      const distToLand = computeDistanceMap(landSources);
      for (let i = 0; i < N; i++) distanceToLand[i] = distToLand[i];
      // 距離マップ計算: 海まで（ソース=海セル）
      const seaSources = [];
      for (let gy = 0; gy < this.gridHeight; gy++) {
        for (let gx = 0; gx < this.gridWidth; gx++) {
          const idx = gy * this.gridWidth + gx;
          if (!landMask[idx]) seaSources.push({ x: gx, y: gy });
        }
      }
      for (let i = 0; i < N; i++) distanceToSea[i] = Infinity;
      const distToSea = computeDistanceMap(seaSources);
      for (let i = 0; i < N; i++) distanceToSea[i] = distToSea[i];
      const lowlandMask = new Array(N).fill(false);
      for (let gy = 0; gy < this.gridHeight; gy++) {
        for (let gx = 0; gx < this.gridWidth; gx++) {
          const idx = gy * this.gridWidth + gx;
          if (!landMask[idx]) continue;
          const bandThreshold = this._getLandDistanceThresholdForRow(gy, gx);
          const landThreshold = bandThreshold + noiseGrid[idx] * landNoiseAmplitude;
          lowlandMask[idx] = distanceToSea[idx] <= landThreshold;
        }
      }
      const colors = new Array(N);
      for (let gy = 0; gy < this.gridHeight; gy++) {
        for (let gx = 0; gx < this.gridWidth; gx++) {
          const idx = gy * this.gridWidth + gx;
          const n = noiseGrid[idx];
          if (landMask[idx]) {
            const bandThreshold = this._getLandDistanceThresholdForRow(gy, gx);
            const landThreshold = bandThreshold + n * landNoiseAmplitude;
            colors[idx] = distanceToSea[idx] > landThreshold ? desertColor : lowlandColor;
          } else {
            const seaThreshold = this.baseSeaDistanceThreshold + n * seaNoiseAmplitude;
            colors[idx] = distanceToLand[idx] > seaThreshold ? deepSeaColor : shallowSeaColor;
          }
        }
      }

      // 各中心ごとに湖を生成し、浅瀬として上書きする
      const lakeMask = new Array(N).fill(false);
      // 各中心の陸セル一覧を前計算（湖/高地で再利用）
      const centerLandCells = Array.from({ length: centers.length }, () => []);
      for (let gy = 0; gy < this.gridHeight; gy++) {
        for (let gx = 0; gx < this.gridWidth; gx++) {
          const idx = gy * this.gridWidth + gx;
          if (!landMask[idx]) continue;
          const ciOwner = ownerCenterIdx[idx];
          if (ciOwner >= 0) centerLandCells[ciOwner].push({ x: gx, y: gy, idx });
        }
      }
      for (let ci = 0; ci < centers.length; ci++) {
        const lambda = this.averageLakesPerCenter;
        let numLakes = 0;
        let p = Math.exp(-lambda);
        let rand = Math.random();
        let sum = p;
        for (let k = 0; k < 20; k++) {
          if (rand < sum) { numLakes = k; break; }
          p = p * lambda / (k + 1);
          sum += p;
        }
        // 前計算済みのこの中心所属の陸セル
        const centerLandGrids = centerLandCells[ci];
        for (let lakeIdx = 0; lakeIdx < numLakes; lakeIdx++) {
          if (centerLandGrids.length === 0) break;
          // 有効な開始セル（陸で湖/高地でない）を探す
          let start = null;
          for (let attempt = 0; attempt < 10; attempt++) {
            const startIdx = Math.floor(Math.random() * centerLandGrids.length);
            const cand = centerLandGrids[startIdx];
            if (landMask[cand.idx] && !lakeMask[cand.idx]) { start = cand; break; }
          }
          if (!start) continue;
          const targetSize = 3 + Math.floor(Math.random() * 13);
          const lakeQueue = [{ x: start.x, y: start.y, idx: start.idx }];
          const visited = new Set([start.idx]);
          const lakeCells = [start.idx];
          let q = 0;
          const dirs = [
            { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
            { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
            { dx: -1, dy: -1 }, { dx: 1, dy: -1 },
            { dx: -1, dy: 1 }, { dx: 1, dy: 1 }
          ];
          while (q < lakeQueue.length && lakeCells.length < targetSize) {
            const cur = lakeQueue[q++];
            for (const d of dirs) {
              if (Math.random() > 0.4) continue;
              const wrapped = this.torusWrap(cur.x + d.dx, cur.y + d.dy);
              if (!wrapped) continue;
              const nIdx = wrapped.y * this.gridWidth + wrapped.x;
              if (visited.has(nIdx)) continue;
              if (!landMask[nIdx]) continue;
              // 同じ中心に属することを確認（前計算を利用）
              if (ownerCenterIdx[nIdx] !== ci) continue;
              visited.add(nIdx);
              lakeCells.push(nIdx);
              lakeQueue.push({ x: wrapped.x, y: wrapped.y, idx: nIdx });
              if (lakeCells.length >= targetSize) break;
            }
          }
          for (const cellIdx of lakeCells) {
            lakeMask[cellIdx] = true;
          }
        }
      }
      for (let i = 0; i < N; i++) {
        if (lakeMask[i]) {
          colors[i] = shallowSeaColor;
        }
      }
      // 湖の周囲を低地で縁取り（近傍の乾燥地を低地へ上書き）
      const lakeLowlandRadius = Math.max(1, Math.floor(this.baseLandDistanceThreshold / 5));
      if (lakeLowlandRadius > 0) {
        for (let gy = 0; gy < this.gridHeight; gy++) {
          for (let gx = 0; gx < this.gridWidth; gx++) {
            const idx = gy * this.gridWidth + gx;
            if (!lakeMask[idx]) continue;
            for (let dy = -lakeLowlandRadius; dy <= lakeLowlandRadius; dy++) {
              for (let dx = -lakeLowlandRadius; dx <= lakeLowlandRadius; dx++) {
                const wrapped = this.torusWrap(gx + dx, gy + dy);
                if (!wrapped) continue;
                const d = Math.hypot(dx, dy);
                if (d > lakeLowlandRadius) continue;
                const nIdx = wrapped.y * this.gridWidth + wrapped.x;
                if (colors[nIdx] === desertColor) {
                  colors[nIdx] = lowlandColor;
                }
              }
            }
          }
        }
      }
      // 高地の生成（各中心点ごとに、湖と同様の方法で生成）
      // サイズは湖の10倍、形状はメイン方向に沿った帯状で横方向にノイズ性の広がりを持つ
      const highlandMask = new Array(N).fill(false);
      for (let ci = 0; ci < centers.length; ci++) {
        const lambda = this.averageHighlandsPerCenter;
        let numHighlands = 0;
        // ポアソン分布で高地の数を決定
        let p = Math.exp(-lambda);
        let rand = Math.random();
        let sum = p;
        for (let k = 0; k < 20; k++) {
          if (rand < sum) { numHighlands = k; break; }
          p = p * lambda / (k + 1);
          sum += p;
        }
        // この中心に属する陸グリッド（前計算）
        const centerLandGrids = centerLandCells[ci];
        // 各高地を生成
        for (let highlandIdx = 0; highlandIdx < numHighlands; highlandIdx++) {
          if (centerLandGrids.length === 0) break;
          // 有効な開始セル（陸で湖/高地でない）を選ぶ
          let start = null;
          for (let attempt = 0; attempt < 10; attempt++) {
            const startIdx = Math.floor(Math.random() * centerLandGrids.length);
            const cand = centerLandGrids[startIdx];
            if (landMask[cand.idx] && !lakeMask[cand.idx] && !highlandMask[cand.idx]) { start = cand; break; }
          }
          if (!start) continue;
          // サイズは湖の10倍（湖は3-15なので、高地は30-150）
          const targetSize = 30 + Math.floor(Math.random() * 121);
          // ランダムな方向（角度）を選ぶ（連続的な角度、より多くのバリエーション）
          const mainAngle = Math.random() * Math.PI * 2;
          const mainDx = Math.cos(mainAngle);
          const mainDy = Math.sin(mainAngle);
          // 横方向の広がりの強度（ノイズ性の広がり）
          const spreadIntensity = 0.5 + Math.random() * 1.0; // 0.5-1.5
          // メイン方向に垂直な方向（横方向）
          const perpDx = -mainDy;
          const perpDy = mainDx;
          // BFSで拡張しながら、メイン方向に沿って進む
          const highlandCells = [start.idx];
          const visited = new Set([start.idx]);
          const queue = [{ x: start.x, y: start.y, idx: start.idx, dist: 0 }];
          // メイン方向への進行距離を追跡
          const mainProgress = new Map();
          mainProgress.set(start.idx, 0);
          while (queue.length > 0 && highlandCells.length < targetSize) {
            const current = queue.shift();
            // 現在位置からメイン方向への進行距離
            const currentProgress = mainProgress.get(current.idx) || 0;
            // 8近傍を探索
            for (let dx = -1; dx <= 1; dx++) {
              for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                const wrapped = this.torusWrap(current.x + dx, current.y + dy);
                if (!wrapped) continue;
                const nIdx = wrapped.y * this.gridWidth + wrapped.x;
                if (visited.has(nIdx)) continue;
                if (!landMask[nIdx]) continue;
                // 同じ中心に属するか確認（前計算）
                if (ownerCenterIdx[nIdx] !== ci) continue;
                // メイン方向への進行距離を計算
                const relX = wrapped.x - start.x;
                const relY = wrapped.y - start.y;
                const progress = relX * mainDx + relY * mainDy;
                // 横方向へのずれを計算
                const perpOffset = relX * perpDx + relY * perpDy;
                // メイン方向への進行を優先しつつ、横方向の広がりを許容
                // 横方向の広がりはノイズで調整
                const noise = this.noise2D(wrapped.x, wrapped.y) * 2.0;
                const allowedPerpSpread = spreadIntensity * (1 + Math.abs(noise));
                // メイン方向に進んでいる、または横方向の広がりが許容範囲内
                if (progress >= currentProgress - 0.5 && Math.abs(perpOffset) <= allowedPerpSpread) {
                  visited.add(nIdx);
                  highlandCells.push(nIdx);
                  mainProgress.set(nIdx, progress);
                  queue.push({ x: wrapped.x, y: wrapped.y, idx: nIdx, dist: current.dist + 1 });
                }
              }
            }
          }
          // 高地セルをマーク
          for (const cellIdx of highlandCells) {
            highlandMask[cellIdx] = true;
          }
        }
      }
      // 高地を茶色で上書き
      for (let i = 0; i < N; i++) {
        if (highlandMask[i]) {
          colors[i] = highlandColor;
        }
      }
      // 高山の生成（高地生成後、ノイズなし）
      // 条件: 低地(lowland)または乾燥地(desert)に接しない高地セルのみ
      const alpineMask = new Array(N).fill(false);
      for (let gy = 0; gy < this.gridHeight; gy++) {
        for (let gx = 0; gx < this.gridWidth; gx++) {
          const idx = gy * this.gridWidth + gx;
          if (colors[idx] !== highlandColor) continue;
          let touchesLowlandOrDesert = false;
          for (const dir of directions) {
            const wrapped = this.torusWrap(gx + dir.dx, gy + dir.dy);
            if (!wrapped) continue;
            const nIdx = wrapped.y * this.gridWidth + wrapped.x;
            const c = colors[nIdx];
            if (c === lowlandColor || c === desertColor) {
              touchesLowlandOrDesert = true;
              break;
            }
          }
          if (!touchesLowlandOrDesert) {
            alpineMask[idx] = true;
          }
        }
      }
      // 高山を上書き
      for (let i = 0; i < N; i++) {
        if (alpineMask[i]) {
          colors[i] = alpineColor;
        }
      }
      for (let gy = 0; gy < this.gridHeight; gy++) {
        for (let gx = 0; gx < this.gridWidth; gx++) {
          const idx = gy * this.gridWidth + gx;
          if (colors[idx] !== lowlandColor) continue;
          const distanceFromTop = gy;
          const noise = this.noise2D(gx, gy) * landNoiseAmplitude;
          const threshold = this.topTundraRows + noise;
          if (distanceFromTop < threshold) {
            colors[idx] = tundraColor;
          }
        }
      }
      for (let gy = 0; gy < this.gridHeight; gy++) {
        for (let gx = 0; gx < this.gridWidth; gx++) {
          const idx = gy * this.gridWidth + gx;
          if (colors[idx] !== lowlandColor) continue;
          const distanceFromBottom = this.gridHeight - 1 - gy;
          const noise = this.noise2D(gx, gy) * landNoiseAmplitude;
          const threshold = this.topTundraRows + noise;
          if (distanceFromBottom < threshold) {
            colors[idx] = tundraColor;
          }
        }
      }
      // 上端を氷河で上書き（ノイズ付き）
      // 海/湖: +0、低地・乾燥地・ツンドラ: +landGlacierExtraRows、高地: +highlandGlacierExtraRows
      const computedTopGlacierRows = this._computeTopGlacierRowsFromAverageTemperature();
      for (let gy = 0; gy < this.gridHeight; gy++) {
        for (let gx = 0; gx < this.gridWidth; gx++) {
          const idx = gy * this.gridWidth + gx;
          const distanceFromTop = gy;
          const noise = glacierNoiseTable[idx] * landNoiseAmplitude;
          let additionalGrids = 0;
          if (colors[idx] === shallowSeaColor || colors[idx] === deepSeaColor) {
            additionalGrids = 0;
          } else if (colors[idx] === lowlandColor) {
            additionalGrids = this.landGlacierExtraRows;
          } else if (colors[idx] === tundraColor) {
            additionalGrids = this.landGlacierExtraRows;
          } else if (colors[idx] === desertColor) {
            additionalGrids = this.landGlacierExtraRows;
          } else if (colors[idx] === highlandColor) {
            additionalGrids = this.highlandGlacierExtraRows;
          } else if (colors[idx] === alpineColor) {
            additionalGrids = this.alpineGlacierExtraRows;
          }
          const base = computedTopGlacierRows + additionalGrids;
          const threshold = base > 0 ? Math.max(0, base + noise) : 0;
          if (distanceFromTop < threshold) {
            colors[idx] = glacierColor;
          }
        }
      }
      // 下端を氷河で上書き（ノイズ付き）
      // 海/湖: +0、低地・乾燥地・ツンドラ: +landGlacierExtraRows、高地: +highlandGlacierExtraRows
      for (let gy = 0; gy < this.gridHeight; gy++) {
        for (let gx = 0; gx < this.gridWidth; gx++) {
          const idx = gy * this.gridWidth + gx;
          const distanceFromBottom = this.gridHeight - 1 - gy;
          const noise = glacierNoiseTable[idx] * landNoiseAmplitude;
          let additionalGrids = 0;
          if (colors[idx] === shallowSeaColor || colors[idx] === deepSeaColor) {
            additionalGrids = 0;
          } else if (colors[idx] === lowlandColor) {
            additionalGrids = this.landGlacierExtraRows;
          } else if (colors[idx] === tundraColor) {
            additionalGrids = this.landGlacierExtraRows;
          } else if (colors[idx] === desertColor) {
            additionalGrids = this.landGlacierExtraRows;
          } else if (colors[idx] === highlandColor) {
            additionalGrids = this.highlandGlacierExtraRows;
          } else if (colors[idx] === alpineColor) {
            additionalGrids = this.alpineGlacierExtraRows;
          }
          const base = computedTopGlacierRows + additionalGrids;
          const threshold = base > 0 ? Math.max(0, base + noise) : 0;
          if (distanceFromBottom < threshold) {
            colors[idx] = glacierColor;
          }
        }
      }
      const displayGridWidth = this.gridWidth + 2;
      const displayGridHeight = this.gridHeight + 2;
      const borderColor = 'rgb(0, 0, 0)';
      const displayColors = new Array(displayGridWidth * displayGridHeight);
      for (let gy = 0; gy < displayGridHeight; gy++) {
        for (let gx = 0; gx < displayGridWidth; gx++) {
          const displayIdx = gy * displayGridWidth + gx;
          if (gy === 0 || gy === displayGridHeight - 1 || gx === 0 || gx === displayGridWidth - 1) {
            displayColors[displayIdx] = borderColor;
          } else {
            const originalGy = gy - 1;
            const originalGx = gx - 1;
            const originalIdx = originalGy * this.gridWidth + originalGx;
            displayColors[displayIdx] = colors[originalIdx];
          }
        }
      }
      // 追加: 各グリッドのプロパティ構造を作成（互換性のため既存の displayColors は維持）
      const gridData = new Array(this.gridWidth * this.gridHeight);
      for (let gy = 0; gy < this.gridHeight; gy++) {
        for (let gx = 0; gx < this.gridWidth; gx++) {
          const idx = gy * this.gridWidth + gx;
          const temperature = null;
          const precipitation = null;
          let terrain = { type: 'sea', sea: 'deep' };
          const col = colors[idx];
          if (!landMask[idx]) {
            if (col === glacierColor) terrain = { type: 'sea', sea: 'glacier' };
            else if (col === shallowSeaColor) terrain = { type: 'sea', sea: 'shallow' };
            else terrain = { type: 'sea', sea: 'deep' };
          } else {
            if (col === glacierColor) terrain = { type: 'land', land: 'glacier' };
            else if (col === tundraColor) terrain = { type: 'land', land: 'tundra' };
            else if (typeof lakeMask !== 'undefined' && lakeMask[idx]) terrain = { type: 'land', land: 'lake' };
            else if (col === lowlandColor) terrain = { type: 'land', land: 'lowland' };
            else if (col === highlandColor) terrain = { type: 'land', land: 'highland' };
            else if (col === alpineColor) terrain = { type: 'land', land: 'alpine' };
            else if (col === desertColor) terrain = { type: 'land', land: 'desert' };
            else terrain = { type: 'land', land: 'lowland' };
          }
          gridData[idx] = {
            temperature,
            precipitation,
            terrain
          };
        }
      }
      // 結果をemit（描画用の色配列は gridData の派生として扱い、gridDataのみ送出）
      this.$emit('generated', { centerParameters: localCenterParameters, gridData });
    }
  }
}
</script>

<style scoped>
</style>


