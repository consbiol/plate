<template>
  <div style="display:none"></div>
</template>

<script>
import { getEraTerrainColors, deriveDisplayColorsFromGridData } from '../utils/colors.js';
// Default terrain colors (store-independent)
const DEFAULT_TERRAIN_COLORS = {
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
    generateSignal: { type: Number, required: true },
    // 大陸の歪みの強さを方向角度に対して適用する係数（デフォルト 2.0）
    directionDistortionScale: { type: Number, required: false, default: 2.0 },
    // 都市グリッド生成の確率（低地のみ、海隣接で10倍）
    cityGenerationProbability: { type: Number, required: false, default: 0.002 },
    // 耕作地グリッド生成の確率（低地のみ、海隣接で10倍）
    cultivatedGenerationProbability: { type: Number, required: false, default: 0.05 },
    // 汚染地クラスター数（マップ全体、開始セルはシードで決定）
    pollutedAreasCount: { type: Number, required: false, default: 1 },
    // 大陸中心点を赤で表示（平面地図オーバーレイ）
    showCentersRed: { type: Boolean, required: false, default: true },
    // 中心点近傍の陸生成バイアス（0で無効、値を上げると中心付近が陸になりやすい）
    centerBias: { type: Number, required: false, default: 0.8 },
    // 指定要素のみ決定化するためのシード（未指定時は従来通り）
    deterministicSeed: { type: [Number, String], required: false, default: null },
    // 時代（パレット切替用、未指定ならデフォルト色）
    era: { type: String, required: false, default: null }
  },
  data() {
    return {};
  },
  watch: {
    generateSignal() {
      this.runGenerate();
    }
  },
  methods: {
    // サブRNG（サブストリーム）生成: ベースの deterministicSeed にラベルを連結して独立RNGを作る
    _getDerivedRng(...labels) {
      if (this.deterministicSeed === null || this.deterministicSeed === undefined || this.deterministicSeed === '') return null;
      const seedStr = [String(this.deterministicSeed), ...labels.map(v => String(v))].join('|');
      const h = this._xmur3(seedStr)();
      return this._mulberry32(h);
    },
    // --- シード対応RNG（mulberry32 + xmur3） ---
    _xmur3(str) {
      const s = String(str);
      let h = 1779033703 ^ s.length;
      for (let i = 0; i < s.length; i++) {
        h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
      }
      return function() {
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        h ^= h >>> 16;
        return h >>> 0;
      };
    },
    _mulberry32(a) {
      return function() {
        let t = (a += 0x6D2B79F5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    _getSeededRng() {
      if (this.deterministicSeed === null || this.deterministicSeed === undefined || this.deterministicSeed === '') return null;
      const seedFn = this._xmur3(this.deterministicSeed);
      const s = seedFn();
      return this._mulberry32(s);
    },
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
        // 実行ごと完全ランダム（シード非依存）。runGenerateで列ごと事前計算があればそれを使用。
        const pre = this._wobbleShiftByX && Number.isFinite(this._wobbleShiftByX[x]) ? this._wobbleShiftByX[x] : null;
        const shift = (pre != null)
          ? pre
          : Math.round((Math.random() * 2 - 1) * wobbleRows);
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
    // 基本色の集約定義（機能不変）
    _getBaseColors() {
      // 時代指定があれば時代パレットを優先、なければデフォルト
      const tc = this.era ? getEraTerrainColors(this.era) : DEFAULT_TERRAIN_COLORS;
      return {
        deepSeaColor: tc.deepSea,
        shallowSeaColor: tc.shallowSea,
        lowlandColor: tc.lowland,
        desertColor: tc.desert,     // 乾燥地
        highlandColor: tc.highland, // 高地
        alpineColor: tc.alpine,     // 高山
        tundraColor: tc.tundra,     // ツンドラ
        glacierColor: tc.glacier
      };
    },
    // Poissonサンプリング（湖/高地の個数決定用）- 既存ロジックの関数化（乱数消費順不変）
    _poissonSample(lambda, maxK = 20, rng) {
      let count = 0;
      let p = Math.exp(-lambda);
      let rand = (rng || Math.random)();
      let sum = p;
      for (let k = 0; k < maxK; k++) {
        if (rand < sum) { count = k; break; }
        p = p * lambda / (k + 1);
        sum += p;
      }
      return count;
    },
    // 汎用: Dijkstraで距離マップを計算（sources から各セルまで）
    _computeDistanceMap(sources, N, directions) {
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
    },
    // ツンドラの適用（上端/下端）
    _applyTundra(colors, landNoiseAmplitude, lowlandColor, tundraColor) {
      for (let gy = 0; gy < this.gridHeight; gy++) {
        for (let gx = 0; gx < this.gridWidth; gx++) {
          const idx = gy * this.gridWidth + gx;
          if (colors[idx] !== lowlandColor) continue;
          const distanceFromTop = gy;
          // 文明時代のみシード固定のノイズを使用
          const rTop = (this.era === '文明時代') ? (this._getDerivedRng('tundra-top', gx, gy) || Math.random) : Math.random;
          const noise = (rTop() * 2 - 1) * landNoiseAmplitude;
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
          const rBot = (this.era === '文明時代') ? (this._getDerivedRng('tundra-bottom', gx, gy) || Math.random) : Math.random;
          const noise = (rBot() * 2 - 1) * landNoiseAmplitude;
          const threshold = this.topTundraRows + noise;
          if (distanceFromBottom < threshold) {
            colors[idx] = tundraColor;
          }
        }
      }
    },
    // 湖の生成（各中心ごと）＋周囲低地化（縁取り）
    _generateLakes(centers, centerLandCells, landMask, colors, shallowSeaColor, lowlandColor, desertColor, seededRng, seededLog) {
      const N = this.gridWidth * this.gridHeight;
      const lakeMask = new Array(N).fill(false);
      const seedStrict = (this.era === '文明時代') && !!seededRng;
      for (let ci = 0; ci < centers.length; ci++) {
        const lambda = this.averageLakesPerCenter;
        // 文明時代のみ湖の個数もシードで決定（他時代は従来通り）
        const countRng = seedStrict ? (this._getDerivedRng('lake-count', ci) || seededRng) : null;
        const numLakes = this._poissonSample(lambda, 20, countRng || seededRng || Math.random);
        const centerLandGrids = centerLandCells[ci] || [];
        for (let lakeIdx = 0; lakeIdx < numLakes; lakeIdx++) {
          if (centerLandGrids.length === 0) break;
          let start = null;
          for (let attempt = 0; attempt < 10; attempt++) {
            const r = seededRng || Math.random; // 開始セルはシード優先（従来仕様維持）
            const startIdx = Math.floor(r() * centerLandGrids.length);
            const cand = centerLandGrids[startIdx];
            if (landMask[cand.idx] && !lakeMask[cand.idx]) { start = cand; break; }
          }
          if (!start) continue;
          // シードで決定された湖の開始セルを記録
          if (seededLog && seededLog[ci]) {
            if (!Array.isArray(seededLog[ci].lakeStarts)) seededLog[ci].lakeStarts = [];
            seededLog[ci].lakeStarts.push({ x: start.x, y: start.y });
          }
          const sizeRng = seedStrict ? (this._getDerivedRng('lake-size', ci, lakeIdx) || seededRng) : null;
          const targetSize = 3 + Math.floor((sizeRng || Math.random)() * 13);
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
          const stepRng = seedStrict ? (this._getDerivedRng('lake-expand', ci, lakeIdx) || seededRng) : null;
          while (q < lakeQueue.length && lakeCells.length < targetSize) {
            const cur = lakeQueue[q++];
            for (const d of dirs) {
              const rr = (stepRng || Math.random)();
              if (rr > 0.4) continue;
              const wrapped = this.torusWrap(cur.x + d.dx, cur.y + d.dy);
              if (!wrapped) continue;
              const nIdx = wrapped.y * this.gridWidth + wrapped.x;
              if (visited.has(nIdx)) continue;
              if (!landMask[nIdx]) continue;
              // 同じ中心に属することを確認
              // 所属確認は中心IDに依存するが、中心ごとに前計算された centerLandCells を使っているため十分
              // 厳密なチェックは既存ロジックと同等性を保つため省略
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
      for (let i = 0; i < lakeMask.length; i++) {
        if (lakeMask[i]) colors[i] = shallowSeaColor;
      }
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
      return lakeMask;
    },
    // 高地生成（各中心ごと）
    _generateHighlands(centers, centerLandCellsPre, preLandMask, lakeMask, colors, highlandColor, seededRng, seededLog) {
      const N = this.gridWidth * this.gridHeight;
      const highlandMask = new Array(N).fill(false);
      const seedStrict = (this.era === '文明時代') && !!seededRng;
      for (let ci = 0; ci < centers.length; ci++) {
        // 高地（中心単位）のサブRNG
        const centerRng = this._getDerivedRng('highland-center', ci);
        const lambda = this.averageHighlandsPerCenter;
        const numHighlands = this._poissonSample(lambda, 20, centerRng || seededRng); // 個数はシードで決定
        if (seededLog && seededLog[ci]) {
          seededLog[ci].highlandsCount = numHighlands;
          if (!Array.isArray(seededLog[ci].highlandClusters)) seededLog[ci].highlandClusters = [];
        }
        const centerLandGrids = centerLandCellsPre[ci] || [];
        for (let highlandIdx = 0; highlandIdx < numHighlands; highlandIdx++) {
          // 高地（クラスター単位）のサブRNG
          const clusterRng = this._getDerivedRng('highland-cluster', ci, highlandIdx);
          if (centerLandGrids.length === 0) break;
          let start = null;
          for (let attempt = 0; attempt < 10; attempt++) {
            // 文明時代かつシード有りのときは Math.random を使わず決定
            const r = seedStrict ? (clusterRng || seededRng) : (clusterRng || seededRng || Math.random);
            const startIdx = Math.floor(r() * centerLandGrids.length);
            const cand = centerLandGrids[startIdx];
            if (preLandMask[cand.idx] && !lakeMask[cand.idx] && !highlandMask[cand.idx]) { start = cand; break; }
          }
          if (!start) continue;
          const rForSize = seedStrict ? (clusterRng || seededRng) : (clusterRng || seededRng || Math.random); // サイズはサブRNG優先
          const targetSize = 30 + Math.floor(rForSize() * 121);
          // シードで決定された高地クラスターの開始セル・サイズを記録
          if (seededLog && seededLog[ci]) {
            seededLog[ci].highlandClusters.push({ x: start.x, y: start.y, size: targetSize });
          }
          const rDir = seedStrict ? (clusterRng || seededRng) : (clusterRng || seededRng || Math.random); // 主方向はサブRNG優先
          const mainAngle = rDir() * Math.PI * 2;
          const mainDx = Math.cos(mainAngle);
          const mainDy = Math.sin(mainAngle);
          const rSpread = seedStrict ? (clusterRng || seededRng) : (clusterRng || seededRng || Math.random); // 横方向強度もサブRNG優先
          const spreadIntensity = 0.5 + rSpread() * 1.0;
          const perpDx = -mainDy;
          const perpDy = mainDx;
          const highlandCells = [start.idx];
          const visited = new Set([start.idx]);
          const queue = [{ x: start.x, y: start.y, idx: start.idx, dist: 0 }];
          const mainProgress = new Map();
          mainProgress.set(start.idx, 0);
          while (queue.length > 0 && highlandCells.length < targetSize) {
            const current = queue.shift();
            const currentProgress = mainProgress.get(current.idx) || 0;
            for (let dx = -1; dx <= 1; dx++) {
              for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                const wrapped = this.torusWrap(current.x + dx, current.y + dy);
                if (!wrapped) continue;
                const nIdx = wrapped.y * this.gridWidth + wrapped.x;
                if (visited.has(nIdx)) continue;
                if (!preLandMask[nIdx]) continue;
                if (lakeMask[nIdx]) continue;
                const relX = wrapped.x - start.x;
                const relY = wrapped.y - start.y;
                const progress = relX * mainDx + relY * mainDy;
                const perpOffset = relX * perpDx + relY * perpDy;
                // 高地生成時のノイズもサブRNGに基づく（無ければフォールバック）
                const rNoise = seedStrict ? (clusterRng || seededRng) : (clusterRng || seededRng || Math.random);
                const noise = (rNoise() * 2 - 1) * 2.0;
                const allowedPerpSpread = spreadIntensity * (1 + Math.abs(noise));
                if (progress >= currentProgress - 0.5 && Math.abs(perpOffset) <= allowedPerpSpread) {
                  visited.add(nIdx);
                  highlandCells.push(nIdx);
                  mainProgress.set(nIdx, progress);
                  queue.push({ x: wrapped.x, y: wrapped.y, idx: nIdx, dist: current.dist + 1 });
                }
              }
            }
          }
          for (const cellIdx of highlandCells) {
            highlandMask[cellIdx] = true;
          }
        }
      }
      for (let i = 0; i < N; i++) {
        if (highlandMask[i]) {
          colors[i] = highlandColor;
        }
      }
      return highlandMask;
    },
    // 高山生成（高地に隣接しない高地セル）
    _generateAlpines(colors, highlandColor, lowlandColor, desertColor, alpineColor, directions) {
      const N = this.gridWidth * this.gridHeight;
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
      for (let i = 0; i < N; i++) {
        if (alpineMask[i]) {
          colors[i] = alpineColor;
        }
      }
    },
    sampleLandCenters(rng) {
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
          const r = rng || Math.random;
          const cx = Math.floor(r() * this.gridWidth);
          const cy = Math.floor(r() * this.gridHeight);
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
      const biasStrength = Math.max(0, Number(this.centerBias || 0));
      const biasSharpness = 6.0;
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
            const distortionScale = (this.directionDistortionScale != null) ? this.directionDistortionScale : 2.0;
            const directionalBoost = 1.0 + Math.max(0, Math.cos(angleDiff)) * (0.8 * distortionScale);
            const biasTerm = biasStrength > 0 ? biasStrength * Math.exp(-(dn * dn) * biasSharpness) : 0;
            const score = (base + this.noiseAmp * n) * centerNoise.influenceMultiplier * directionalBoost + biasTerm;
            if (score > maxScore) maxScore = score;
          }
          scores[gy * this.gridWidth + gx] = maxScore;
        }
      }
      return { scores };
    },
    runGenerate() {
      const N = this.gridWidth * this.gridHeight;
      const seededRng = this._getSeededRng();
      const seededLog = Array.from({ length: (this.centersY || 0) * 1 || 1 }, () => ({
        highlandsCount: 0,
        highlandClusters: [],
        lakeStarts: []
      }));
      // 帯の縦揺らぎ（列ごと）の事前生成（完全ランダム、シード非依存）
      const wobbleRows = Math.max(0, Math.floor(this.landBandVerticalWobbleRows || 0));
      if (wobbleRows > 0) {
        this._wobbleShiftByX = new Array(this.gridWidth);
        const seedStrictGeom = (this.era === '文明時代') && !!seededRng;
        for (let x = 0; x < this.gridWidth; x++) {
          const r = seedStrictGeom ? (this._getDerivedRng('wobble-x', x) || seededRng) : Math.random;
          this._wobbleShiftByX[x] = Math.round((r() * 2 - 1) * wobbleRows);
        }
      } else {
        this._wobbleShiftByX = null;
      }
      const glacierNoiseTable = new Array(N);
      {
        const seedStrictGl = (this.era === '文明時代') && !!seededRng;
        const gRng = seedStrictGl ? (this._getDerivedRng('glacier-noise') || seededRng) : Math.random;
        for (let i = 0; i < N; i++) {
          glacierNoiseTable[i] = (gRng() * 2 - 1);
        }
      }
      let centers = this.sampleLandCenters(seededRng); // 中心座標をシードで決定
      // ノイズから中心パラメータを生成（propsは直接変更しない）
      let localCenterParameters = centers.map((c) => {
        if (seededRng) {
          const u1 = seededRng() * 2 - 1; // [-1,1)
          const u2 = seededRng();         // [0,1)
          return {
            x: c.x,
            y: c.y,
            influenceMultiplier: 1.0 + u1 * 0.75,
            kDecayVariation: this.kDecay * (1.0 + u1 * 0.75),
            directionAngle: (u2 * 2 * Math.PI * 1.5)
          };
        } else {
          const n1 = this.noise2D(c.x * 0.1, c.y * 0.1);
          const n2 = this.noise2D(c.x * 0.15, c.y * 0.15);
          return {
            x: c.x,
            y: c.y,
            influenceMultiplier: 1.0 + n1 * 0.75,
            kDecayVariation: this.kDecay * (1.0 + n1 * 0.75),
            directionAngle: n2 * Math.PI * 2 * 1.5
          };
        }
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
          centers = this.sampleLandCenters(seededRng);
        }
      }
      const landMask = new Array(N).fill(false);
      for (let i = 0; i < N; i++) landMask[i] = scores[i] >= threshold;
      // 前計算: 各セルのノイズ（後段の複数ループで再利用）
      const noiseGrid = new Array(N);
      for (let gy = 0; gy < this.gridHeight; gy++) {
        for (let gx = 0; gx < this.gridWidth; gx++) {
          const idx = gy * this.gridWidth + gx;
          // 乾燥地・海エッジなど「見た目ノイズ」
          // 文明時代のみシードで固定（浅瀬/深海境界・砂漠/低地境界を決定論化）
          const strict = (this.era === '文明時代') && !!seededRng;
          const vrng = strict ? (this._getDerivedRng('vis-noise', gx, gy) || seededRng) : Math.random;
          noiseGrid[idx] = (vrng() * 2 - 1);
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
          // 90% の確率で海に戻す（文明時代はシードで決定）
          const strict = (this.era === '文明時代') && !!seededRng;
          const r = strict ? (this._getDerivedRng('coast-island', gx, gy) || seededRng) : Math.random;
          if (r() < 0.9) landMask[idx] = false;
        }
      }
    }
    // 高地用に「海岸線ジッター前」の landMask をスナップショット
    const preJitterLandMask = landMask.slice();
    // --- 海岸線のランダム微摂動（同じシードでも海岸線だけ見た目に変化を出す） ---
    // 近傍に異なる陸海があるセル（=海岸線セル）のうち、スコアが閾値近傍のものだけ微小確率で反転
    // 他の要素（座標/影響/減衰/方向）はシード固定のまま
    let minScore = Infinity, maxScore = -Infinity;
    for (let i = 0; i < N; i++) {
      const s = scores[i];
      if (s < minScore) minScore = s;
      if (s > maxScore) maxScore = s;
    }
    const scoreBand = Math.max(1e-6, (maxScore - minScore) * 0.05); // 閾値±2%帯
    const flipProb = 0.30; // 反転確率（控えめ）
    const hasOppNeighbor = (x, y) => {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const w = this.torusWrap(x + dx, y + dy);
          if (!w) continue;
          const a = y * this.gridWidth + x;
          const b = w.y * this.gridWidth + w.x;
          if (landMask[a] !== landMask[b]) return true;
        }
      }
      return false;
    };
    for (let gy = 0; gy < this.gridHeight; gy++) {
      for (let gx = 0; gx < this.gridWidth; gx++) {
        const idx = gy * this.gridWidth + gx;
        const s = scores[idx];
        if (Math.abs(s - threshold) <= scoreBand && hasOppNeighbor(gx, gy)) {
          const strict = (this.era === '文明時代') && !!seededRng;
          const r = strict ? (this._getDerivedRng('coast-flip', gx, gy) || seededRng) : Math.random;
          if (r() < flipProb) {
            landMask[idx] = !landMask[idx];
          }
        }
      }
    }
      const seaNoiseAmplitude = 1.5;
      const landNoiseAmplitude = 2.5;
      const {
        deepSeaColor, shallowSeaColor, lowlandColor, desertColor,
        highlandColor, alpineColor, tundraColor, glacierColor
      } = this._getBaseColors();
      const distanceToSea = new Array(N).fill(Infinity);
      const distanceToLand = new Array(N).fill(Infinity);
      // 近傍方向（トーラス考慮はtorusWrap側で処理）
      const directions = [
        { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
        { dx: -1, dy: 0 },                     { dx: 1, dy: 0 },
        { dx: -1, dy: 1 },  { dx: 0, dy: 1 },  { dx: 1, dy: 1 }
      ];
      // Dijkstraはヘルパー関数で計算
      // 距離マップ計算: 陸まで（ソース=陸セル）
      const landSources = [];
      for (let gy = 0; gy < this.gridHeight; gy++) {
        for (let gx = 0; gx < this.gridWidth; gx++) {
          const idx = gy * this.gridWidth + gx;
          if (landMask[idx]) landSources.push({ x: gx, y: gy });
        }
      }
      for (let i = 0; i < N; i++) distanceToLand[i] = Infinity;
      const distToLand = this._computeDistanceMap(landSources, N, directions);
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
      const distToSea = this._computeDistanceMap(seaSources, N, directions);
      for (let i = 0; i < N; i++) distanceToSea[i] = distToSea[i];
      
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

      // 各中心の陸セル一覧を前計算（湖/高地で再利用）
      const centerLandCells = Array.from({ length: centers.length }, () => []);
      const centerLandCellsPre = Array.from({ length: centers.length }, () => []);
      for (let gy = 0; gy < this.gridHeight; gy++) {
        for (let gx = 0; gx < this.gridWidth; gx++) {
          const idx = gy * this.gridWidth + gx;
          if (landMask[idx]) {
            const ciOwner = ownerCenterIdx[idx];
            if (ciOwner >= 0) centerLandCells[ciOwner].push({ x: gx, y: gy, idx });
          }
          if (preJitterLandMask[idx]) {
            const ciOwner2 = ownerCenterIdx[idx];
            if (ciOwner2 >= 0) centerLandCellsPre[ciOwner2].push({ x: gx, y: gy, idx });
          }
        }
      }
      // 湖生成と適用（ジッター後のマスクに基づく）
      const lakeMask = this._generateLakes(centers, centerLandCells, landMask, colors, shallowSeaColor, lowlandColor, desertColor, seededRng, seededLog);
      // 高地生成と適用（文明時代の決定性向上のため、海岸線ジッター前のマスクを使用）
      this._generateHighlands(centers, centerLandCellsPre, preJitterLandMask, lakeMask, colors, highlandColor, seededRng, seededLog);
      // 高山生成と適用
      this._generateAlpines(colors, highlandColor, lowlandColor, desertColor, alpineColor, directions);
      // --- ツンドラの適用（上端・下端） ---
      this._applyTundra(colors, landNoiseAmplitude, lowlandColor, tundraColor);
      // --- 氷河の適用（上端） ---
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
      // --- 氷河の適用（下端） ---
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
      // 追加: city/cultivated の生成（低地のみ、海隣接で確率10倍）
      const cityMask = new Array(N).fill(false);
      const cultivatedMask = new Array(N).fill(false);
      const pollutedMask = new Array(N).fill(false);
      const rCity = this._getDerivedRng('city') || Math.random;
      const rCult = this._getDerivedRng('cultivated') || Math.random;
      // 地域差ノイズ（都市の発生率に地域バイアスを付与）
      // fractalNoise2D は [-1,1] を返す。これを [cityBiasMin, cityBiasMax] に線形マップして倍率とする
      const cityBiasScale = 0.01; // 小さいほど広域パッチ
      const cityBiasMin = 0.05;   // 発生しにくい地域
      const cityBiasMax = 8.0;    // 発生しやすい地域
      const isAdjacentToSea = (gx, gy) => {
        const dirs4 = [{dx:-1,dy:0},{dx:1,dy:0},{dx:0,dy:-1},{dx:0,dy:1}];
        for (const d of dirs4) {
          const w = this.torusWrap(gx + d.dx, gy + d.dy);
          if (!w) continue;
          const nIdx = w.y * this.gridWidth + w.x;
          if (!landMask[nIdx]) return true; // 海
        }
        return false;
      };
      // 1グリッド島（周囲8近傍に陸が存在しない）なら city 開始セルにしない
      const isOneCellIsland = (gx, gy) => {
        const idx0 = gy * this.gridWidth + gx;
        if (!landMask[idx0]) return false; // 陸でなければ対象外
        const dirs8 = [
          { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
          { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
          { dx: -1, dy: -1 }, { dx: 1, dy: -1 },
          { dx: -1, dy: 1 }, { dx: 1, dy: 1 }
        ];
        for (const d of dirs8) {
          const w = this.torusWrap(gx + d.dx, gy + d.dy);
          if (!w) continue;
          const nIdx = w.y * this.gridWidth + w.x;
          if (landMask[nIdx]) return false; // 近傍に陸があれば1セル島ではない
        }
        return true;
      };
      // 文明時代のみ city/cultivated を生成
      const isCivilizationEra = (this.era === '文明時代');
      if (isCivilizationEra) {
        for (let gy = 0; gy < this.gridHeight; gy++) {
          for (let gx = 0; gx < this.gridWidth; gx++) {
            const idx = gy * this.gridWidth + gx;
            // 最終色が低地のみ対象（ツンドラ/砂漠/高地/高山/氷河/海などは除外）
            if (colors[idx] !== lowlandColor) continue;
            // cultivated（先に生成）
            const baseCult = Math.max(0, this.cultivatedGenerationProbability || 0);
            const pcCult = isAdjacentToSea(gx, gy) ? Math.min(1, baseCult * 10) : baseCult;
            // 開始セルの採択は座標由来のシードで決定（安定化）
            const startCultRng = this._getDerivedRng('cultivated-start', gx, gy) || rCult;
            if (pcCult > 0 && (startCultRng() < pcCult) && !cultivatedMask[idx]) {
              // クラスタ生成: 平均 ~5 グリッドの面積（Poissonサンプル）
              const clusterRng = this._getDerivedRng('cultivated-cluster', gx, gy) || Math.random;
              const targetSize = Math.max(1, this._poissonSample(5, 50, clusterRng));
              const dirs = [
                { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
                { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
                { dx: -1, dy: -1 }, { dx: 1, dy: -1 },
                { dx: -1, dy: 1 }, { dx: 1, dy: 1 }
              ];
              const queue = [{ x: gx, y: gy, idx }];
              const visited = new Set([idx]);
              cultivatedMask[idx] = true;
              let count = 1;
              while (queue.length > 0 && count < targetSize) {
                const cur = queue.shift();
                for (const d of dirs) {
              // 隣接セルを確率的に拡張（密になり過ぎないよう 0.6 で採択）
              {
                const rand = (clusterRng || seededRng || Math.random);
                if (rand() > 0.6) continue;
              }
                  const w = this.torusWrap(cur.x + d.dx, cur.y + d.dy);
                  if (!w) continue;
                  const nIdx = w.y * this.gridWidth + w.x;
                  if (visited.has(nIdx)) continue;
                  visited.add(nIdx);
                  // 拡張条件: 低地・未city・未cultivated
                  if (colors[nIdx] !== lowlandColor) continue;
                  if (cityMask[nIdx]) continue;
                  if (cultivatedMask[nIdx]) continue;
                  cultivatedMask[nIdx] = true;
                  count++;
                  if (count >= targetSize) break;
                  queue.push({ x: w.x, y: w.y, idx: nIdx });
                }
              }
            }
            // city（cultivated の後で上書き）
            if (cityMask[idx]) continue;
            const baseCity = Math.max(0, this.cityGenerationProbability || 0);
            // 地域差ノイズによる倍率
            // 座標はそのまま渡し、スケールは引数で指定（ダブルスケーリングを避ける）
            const nCity = this.fractalNoise2D(gx, gy, 4, 0.5, cityBiasScale);
            const uCity = (nCity + 1) * 0.5; // [0,1]
            const cityBias = Math.max(cityBiasMin, Math.min(cityBiasMax, cityBiasMin + uCity * (cityBiasMax - cityBiasMin)));
            const biasedBaseCity = baseCity * cityBias;
            const pcCity = isAdjacentToSea(gx, gy) ? Math.min(1, biasedBaseCity * 10) : Math.min(1, biasedBaseCity);
            // 開始セルの採択は座標由来のシードで決定（安定化）
            const startCityRng = this._getDerivedRng('city-start', gx, gy) || rCity;
            if (pcCity > 0 && !isOneCellIsland(gx, gy) && (startCityRng() < pcCity) && !cityMask[idx]) {
              // クラスタ生成: 平均 ~3 グリッドの面積（Poissonサンプル）
              const clusterRng = this._getDerivedRng('city-cluster', gx, gy) || Math.random;
              const targetSize = Math.max(1, this._poissonSample(3, 50, clusterRng));
              const dirs = [
                { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
                { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
                { dx: -1, dy: -1 }, { dx: 1, dy: -1 },
                { dx: -1, dy: 1 }, { dx: 1, dy: 1 }
              ];
              const queue = [{ x: gx, y: gy, idx }];
              const visited = new Set([idx]);
              cityMask[idx] = true;
              let count = 1;
              while (queue.length > 0 && count < targetSize) {
                const cur = queue.shift();
                for (const d of dirs) {
              // 隣接セルを確率的に拡張（密になり過ぎないよう 0.6 で採択）
              {
                const rand = (clusterRng || seededRng || Math.random);
                if (rand() > 0.6) continue;
              }
                  const w = this.torusWrap(cur.x + d.dx, cur.y + d.dy);
                  if (!w) continue;
                  const nIdx = w.y * this.gridWidth + w.x;
                  if (visited.has(nIdx)) continue;
                  visited.add(nIdx);
                  // 拡張条件: 低地・未city
                  if (colors[nIdx] !== lowlandColor) continue;
                  if (cityMask[nIdx]) continue;
                  cityMask[nIdx] = true;
                  count++;
                  if (count >= targetSize) break;
                  queue.push({ x: w.x, y: w.y, idx: nIdx });
                }
              }
            }
          }
        }
        // 追加: 汚染地の生成（文明時代のみ、低地/都市/耕作地セル上に生成、クラスター平均サイズ ~20）
        const countPolluted = Math.max(0, Math.floor(Number(this.pollutedAreasCount || 0)));
        if (countPolluted > 0) {
          const eligible = [];
          for (let i = 0; i < N; i++) {
            if (colors[i] === lowlandColor || cityMask[i] || cultivatedMask[i]) eligible.push(i);
          }
          // 海岸セルに重み10、内陸に重み1（cityと同様の海岸優遇）
          const weights = new Array(eligible.length);
          let totalWeight = 0;
          for (let ei = 0; ei < eligible.length; ei++) {
            const idx0 = eligible[ei];
            const sx = idx0 % this.gridWidth;
            const sy = Math.floor(idx0 / this.gridWidth);
            const w = isAdjacentToSea(sx, sy) ? 10 : 1;
            weights[ei] = w;
            totalWeight += w;
          }
          const pickRng = this._getDerivedRng('polluted-pick') || Math.random;
          const chosen = new Set();
          const dirs = [
            { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
            { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
            { dx: -1, dy: -1 }, { dx: 1, dy: -1 },
            { dx: -1, dy: 1 }, { dx: 1, dy: 1 }
          ];
          for (let k = 0; k < countPolluted && eligible.length > 0; k++) {
            // 重み付き抽選（選択済みは重み0にして再抽選）
            let startIdx = -1;
            let pickedEi = -1;
            for (let tries = 0; tries < Math.max(20, eligible.length); tries++) {
              if (totalWeight <= 0) break;
              let r = (pickRng() || Math.random) * totalWeight;
              let acc = 0;
              for (let ei = 0; ei < eligible.length; ei++) {
                const w = weights[ei] || 0;
                if (w <= 0) continue;
                acc += w;
                if (acc >= r) {
                  const idx0 = eligible[ei];
                  if (chosen.has(idx0)) {
                    // すでに選択済みならスキップしてやり直し
                    continue;
                  }
                  startIdx = idx0;
                  pickedEi = ei;
                  break;
                }
              }
              if (startIdx >= 0) break;
            }
            if (startIdx < 0) break;
            chosen.add(startIdx);
            if (pickedEi >= 0) {
              totalWeight -= (weights[pickedEi] || 0);
              weights[pickedEi] = 0;
            }
            const sx = startIdx % this.gridWidth;
            const sy = Math.floor(startIdx / this.gridWidth);
            const clusterRng = this._getDerivedRng('polluted-cluster', sx, sy) || Math.random;
            const targetSize = Math.max(1, this._poissonSample(20, 200, clusterRng));
            const queue = [{ x: sx, y: sy, idx: startIdx }];
            const visited = new Set([startIdx]);
            pollutedMask[startIdx] = true;
            let count = 1;
            while (queue.length > 0 && count < targetSize) {
              const cur = queue.shift();
              for (const d of dirs) {
                const acceptP = 0.6 + ((clusterRng() || Math.random) - 0.5) * 0.2; // 0.5..0.7
                if ((clusterRng() || Math.random) > acceptP) continue;
                const w = this.torusWrap(cur.x + d.dx, cur.y + d.dy);
                if (!w) continue;
                const nIdx = w.y * this.gridWidth + w.x;
                if (visited.has(nIdx)) continue;
                visited.add(nIdx);
                // 低地 or 都市 or 耕作地に拡張（city/cultivated は上書き）
                if (!(colors[nIdx] === lowlandColor || cityMask[nIdx] || cultivatedMask[nIdx])) continue;
                pollutedMask[nIdx] = true;
                count++;
                if (count >= targetSize) break;
                queue.push({ x: w.x, y: w.y, idx: nIdx });
              }
            }
          }
        }
      }
      // 追加: 各グリッドのプロパティ構造を作成
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
    terrain,
    colorHex: col,
    // 都市/耕作地/汚染地フラグ（色は colors.js でパレットから解決）
    city: !!cityMask[idx],
    cultivated: !!cultivatedMask[idx],
    polluted: !!pollutedMask[idx]
  };
        }
      }
      // displayColors は gridData から導出（city/cultivated を反映）
      const eraColors = getEraTerrainColors(this.era);
      const borderColor = (eraColors && eraColors.border) ? eraColors.border : '#000000';
      const displayColors = deriveDisplayColorsFromGridData(
        gridData,
        this.gridWidth,
        this.gridHeight,
        borderColor,
        eraColors,
        /*preferPalette*/ true
      );
      // 収集したシード決定情報を centerParameters に埋め込む
      for (let ci = 0; ci < centers.length; ci++) {
        const log = seededLog[ci] || {};
        localCenterParameters[ci] = {
          ...(localCenterParameters[ci] || {}),
          seededHighlandsCount: log.highlandsCount || 0,
          seededHighlandClusters: Array.isArray(log.highlandClusters) ? log.highlandClusters : [],
          seededLakeStarts: Array.isArray(log.lakeStarts) ? log.lakeStarts : []
        };
      }
      // 中心点セルを赤で表示（フラグ埋め込み）
      if (this.showCentersRed && Array.isArray(centers)) {
        for (let ci = 0; ci < centers.length; ci++) {
          const c = centers[ci];
          if (!c) continue;
          const cx = Math.max(0, Math.min(this.gridWidth - 1, Math.floor(c.x)));
          const cy = Math.max(0, Math.min(this.gridHeight - 1, Math.floor(c.y)));
          const idx = cy * this.gridWidth + cx;
          if (gridData[idx]) {
            gridData[idx].center = true;
          }
        }
      }
      // 結果をemit（平面グリッド用に displayColors も明示的に渡す）
      this.$emit('generated', {
        centerParameters: localCenterParameters,
        gridData,
        displayColors,
        deterministicSeed: this.deterministicSeed
      });
    }
  }
}
</script>

<style scoped>
</style>


