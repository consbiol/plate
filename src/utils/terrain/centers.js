import { pickRng } from '../rng.js';

export function sampleLandCenters(ctx, rng, minDistanceOverride) {
  const { gridWidth, gridHeight, centersY, minCenterDistance, torusDistance } = ctx;
  const centers = [];
  const yCenters = Math.max(1, Math.min(10, Math.min(gridHeight, centersY)));
  const minDistance = (typeof minDistanceOverride === 'number' && Number.isFinite(minDistanceOverride))
    ? minDistanceOverride
    : minCenterDistance;
  const maxAttempts = 1000;
  const edgeMargin = 10;
  const random = pickRng(rng);

  for (let i = 0; i < yCenters; i++) {
    let newCenter;
    let attempts = 0;
    let valid = false;
    while (!valid && attempts < maxAttempts) {
      const cx = Math.floor(random() * gridWidth);
      const cy = Math.floor(random() * gridHeight);
      newCenter = { x: cx, y: cy };
      const isNearEdge = cx < edgeMargin || cx >= gridWidth - edgeMargin ||
                         cy < edgeMargin || cy >= gridHeight - edgeMargin;
      if (isNearEdge) {
        valid = false;
      } else if (centers.length === 0) {
        valid = true;
      } else {
        valid = true;
        for (const existingCenter of centers) {
          const distance = torusDistance(
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

export function computeScoresForCenters(ctx, centers, centerParameters) {
  const {
    gridWidth,
    gridHeight,
    kDecay,
    centerBias,
    fractalNoise2D,
    noise2D,
    noiseAmp,
    torusDistance,
    torusDirection,
    _getDerivedRng
  } = ctx;
  const N = gridWidth * gridHeight;
  const maxTorusDistance = Math.sqrt(Math.pow(gridWidth / 2, 2) + Math.pow(gridHeight - 1, 2));
  const maxDistance = maxTorusDistance || 1;
  const rMaxPerCenter = new Array(centers.length).fill(maxDistance);
  const scores = new Array(N);
  const distanceWarpAmplitude = 0.03;
  const fractalNoiseScale = 0.06;
  const centerInfluenceNoise = centers.map((c, ci) => {
    const param = centerParameters && centerParameters[ci];
    return {
      influenceMultiplier: param ? param.influenceMultiplier : 1.0,
      kDecayVariation: param ? param.kDecayVariation : kDecay,
    };
  });
  const centerShapeProfiles = centers.map((c, ci) => {
    const rng = _getDerivedRng('shape-profile', ci);
    const r = pickRng(rng);
    const numTerms = 2 + Math.floor(r() * 3);
    const maxK = 7;
    const used = new Set();
    const terms = [];
    for (let t = 0; t < numTerms; t++) {
      let k = 2 + Math.floor(r() * maxK);
      if (used.has(k)) k = ((k + 1 - 2) % maxK) + 2;
      used.add(k);
      const a = 0.15 + r() * 0.25;
      const phi = r() * Math.PI * 2;
      terms.push({ k, a, phi });
    }
    const globalAmp = 0.35 + r() * 0.15;
    return { terms, globalAmp };
  });
  const biasStrength = Math.max(0, Number(centerBias) || 0);
  const biasSharpness = 6.0;
  for (let gy = 0; gy < gridHeight; gy++) {
    for (let gx = 0; gx < gridWidth; gx++) {
      let maxScore = -Infinity;
      for (let ci = 0; ci < centers.length; ci++) {
        const c = centers[ci];
        const centerNoise = centerInfluenceNoise[ci];
        let di = torusDistance(gx, gy, c.x, c.y);
        const dir = torusDirection(c.x, c.y, gx, gy);
        const angle = Math.atan2(dir.dy, dir.dx);
        {
          const prof = centerShapeProfiles[ci];
          if (prof && Array.isArray(prof.terms)) {
            let m = 0;
            for (const term of prof.terms) {
              m += Math.sin(term.k * angle + term.phi) * term.a;
            }
            const mod = Math.tanh(m);
            const shapeScale = 1 - prof.globalAmp * mod;
            di = di * Math.max(0.25, shapeScale);
          }
        }
        const fractalN = fractalNoise2D(gx * fractalNoiseScale, gy * fractalNoiseScale, 3, 0.5);
        const angularN = noise2D(Math.cos(angle) * 10, Math.sin(angle) * 10);
        const distanceWarp = (fractalN * 0.30 + angularN * 0.70) * distanceWarpAmplitude * rMaxPerCenter[ci];
        di = di * (1 + distanceWarp * 0.15) + distanceWarp * 0.25;
        const dn = di / rMaxPerCenter[ci];
        const base = Math.exp(- (dn * dn) * centerNoise.kDecayVariation);
        const simpleNoise = noise2D(gx, gy);
        const n = fractalN * 0.60 + simpleNoise * 0.40;
        const biasTerm = biasStrength > 0 ? biasStrength * Math.exp(-(dn * dn) * biasSharpness) : 0;
        const score = (base + noiseAmp * n) * centerNoise.influenceMultiplier + biasTerm;
        if (score > maxScore) maxScore = score;
      }
      scores[gy * gridWidth + gx] = maxScore;
    }
  }
  return { scores };
}

export function computeOwnerCenterIdx(ctx, centers) {
  const { gridWidth, gridHeight, torusDistance } = ctx;
  const N = gridWidth * gridHeight;
  const ownerCenterIdx = new Array(N).fill(-1);
  for (let gy = 0; gy < gridHeight; gy++) {
    for (let gx = 0; gx < gridWidth; gx++) {
      const idx = gy * gridWidth + gx;
      let minDist = Infinity;
      let closestIdx = -1;
      for (let cj = 0; cj < centers.length; cj++) {
        const c = centers[cj];
        const d = torusDistance(gx, gy, c.x, c.y);
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

export function computeEffectiveMinCenterDistance(seaLandRatio, fallbackSeaLandRatio) {
  const raw = Number.isFinite(Number(seaLandRatio))
    ? Number(seaLandRatio)
    : Number(fallbackSeaLandRatio);
  const x = Math.max(0.2, Math.min(1.0, raw));
  const minDistance = 20 + (x - 0.2) * 25; // 20..40
  return Math.round(minDistance);
}


