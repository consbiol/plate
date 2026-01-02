// 大陸中心（center）関連の生成・スコア計算
// - Grids_Calculation.vue から切り出し（機能不変）

export function sampleLandCenters(vm, rng, minDistanceOverride) {
  const centers = [];
  const yCenters = Math.max(1, Math.min(10, Math.min(vm.gridHeight, vm.centersY)));
  const minDistance = (typeof minDistanceOverride === 'number' && Number.isFinite(minDistanceOverride))
    ? minDistanceOverride
    : vm.minCenterDistance;
  const maxAttempts = 1000;
  const edgeMargin = 10; // 外縁から除外するグリッド数

  for (let i = 0; i < yCenters; i++) {
    let newCenter;
    let attempts = 0;
    let valid = false;
    while (!valid && attempts < maxAttempts) {
      const r = rng || Math.random;
      const cx = Math.floor(r() * vm.gridWidth);
      const cy = Math.floor(r() * vm.gridHeight);
      newCenter = { x: cx, y: cy };
      // 外縁から10グリッド以内の座標を除外
      const isNearEdge = cx < edgeMargin || cx >= vm.gridWidth - edgeMargin ||
                         cy < edgeMargin || cy >= vm.gridHeight - edgeMargin;
      if (isNearEdge) {
        valid = false;
      } else if (centers.length === 0) {
        valid = true;
      } else {
        valid = true;
        for (const existingCenter of centers) {
          const distance = vm.torusDistance(
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
}

export function computeScoresForCenters(vm, centers, centerParameters) {
  const N = vm.gridWidth * vm.gridHeight;
  const maxTorusDistance = Math.sqrt(Math.pow(vm.gridWidth / 2, 2) + Math.pow(vm.gridHeight - 1, 2));
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
      kDecayVariation: param ? param.kDecayVariation : vm.kDecay,
    };
  });
  // 各中心ごとの角度プロファイル（尖り/凹み）をシードで決定
  const centerShapeProfiles = centers.map((c, ci) => {
    const rng = vm._getDerivedRng('shape-profile', ci);
    const r = rng || Math.random;
    const numTerms = 2 + Math.floor(r() * 3); // 2..4 項
    const maxK = 7; // 最大 7 ハーモニクス程度
    const used = new Set();
    const terms = [];
    for (let t = 0; t < numTerms; t++) {
      let k = 2 + Math.floor(r() * maxK); // 2..8 の尖り数
      if (used.has(k)) k = ((k + 1 - 2) % maxK) + 2;
      used.add(k);
      const a = 0.15 + r() * 0.25; // 0.15..0.40
      const phi = r() * Math.PI * 2; // 0..2π
      terms.push({ k, a, phi });
    }
    const globalAmp = 0.35 + r() * 0.15; // 0.35..0.50（歪みの強さ）
    return { terms, globalAmp };
  });
  const biasStrength = Math.max(0, Number(vm.centerBias || 0));
  const biasSharpness = 6.0;
  for (let gy = 0; gy < vm.gridHeight; gy++) {
    for (let gx = 0; gx < vm.gridWidth; gx++) {
      let maxScore = -Infinity;
      for (let ci = 0; ci < centers.length; ci++) {
        const c = centers[ci];
        const centerNoise = centerInfluenceNoise[ci];
        let di = vm.torusDistance(gx, gy, c.x, c.y);
        // トーラス上での最短経路の方向を計算して角度を求める
        const dir = vm.torusDirection(c.x, c.y, gx, gy);
        const angle = Math.atan2(dir.dy, dir.dx);
        // 角度プロファイルによる大きないびつさ（尖り/凹み）: 距離を角度で倍率変調
        {
          const prof = centerShapeProfiles[ci];
          if (prof && Array.isArray(prof.terms)) {
            let m = 0;
            for (const term of prof.terms) {
              m += Math.sin(term.k * angle + term.phi) * term.a;
            }
            // 過大な影響を抑えるためソフトクリップ
            const mod = Math.tanh(m); // おおよそ [-1,1]
            // mod > 0 で距離短縮（膨らみ=尖り）、mod < 0 で距離拡大（凹み）
            const shapeScale = 1 - prof.globalAmp * mod;
            di = di * Math.max(0.25, shapeScale); // 安定化のため下限を設置
          }
        }
        const fractalN = vm.fractalNoise2D(gx * fractalNoiseScale, gy * fractalNoiseScale, 3, 0.5);
        const angularN = vm.noise2D(Math.cos(angle) * 10, Math.sin(angle) * 10);
        const distanceWarp = (fractalN * 0.30 + angularN * 0.70) * distanceWarpAmplitude * rMaxPerCenter[ci];
        di = di * (1 + distanceWarp * 0.15) + distanceWarp * 0.25; // 距離ワープの影響を増やして形状を不規則に
        const dn = di / rMaxPerCenter[ci];
        const base = Math.exp(- (dn * dn) * centerNoise.kDecayVariation);
        const simpleNoise = vm.noise2D(gx, gy);
        const n = fractalN * 0.60 + simpleNoise * 0.40; // フラクタルノイズの比率を上げて形状を不規則に
        const biasTerm = biasStrength > 0 ? biasStrength * Math.exp(-(dn * dn) * biasSharpness) : 0;
        // 角度方向のバイアス（directionalBoost）を完全に除去
        const score = (base + vm.noiseAmp * n) * centerNoise.influenceMultiplier + biasTerm;
        if (score > maxScore) maxScore = score;
      }
      scores[gy * vm.gridWidth + gx] = maxScore;
    }
  }
  return { scores };
}

export function computeOwnerCenterIdx(vm, centers) {
  const N = vm.gridWidth * vm.gridHeight;
  const ownerCenterIdx = new Array(N).fill(-1);
  for (let gy = 0; gy < vm.gridHeight; gy++) {
    for (let gx = 0; gx < vm.gridWidth; gx++) {
      const idx = gy * vm.gridWidth + gx;
      let minDist = Infinity;
      let closestIdx = -1;
      for (let cj = 0; cj < centers.length; cj++) {
        const c = centers[cj];
        const d = vm.torusDistance(gx, gy, c.x, c.y);
        if (d < minDist) {
          minDist = d;
          closestIdx = cj;
        }
      }
      ownerCenterIdx[idx] = closestIdx;
    }
  }
  return ownerCenterIdx;
}


