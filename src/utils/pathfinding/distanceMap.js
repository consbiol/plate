const createMinHeap = () => {
  const idxHeap = [];
  const distHeap = [];
  const swap = (i, j) => {
    const ti = idxHeap[i];
    idxHeap[i] = idxHeap[j];
    idxHeap[j] = ti;
    const td = distHeap[i];
    distHeap[i] = distHeap[j];
    distHeap[j] = td;
  };
  const siftUp = (index) => {
    let i = index;
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      if (distHeap[p] <= distHeap[i]) break;
      swap(p, i);
      i = p;
    }
  };
  const siftDown = (index) => {
    let i = index;
    const len = idxHeap.length;
    while (i < len) {
      const left = i * 2 + 1;
      const right = i * 2 + 2;
      let smallest = i;
      if (left < len && distHeap[left] < distHeap[smallest]) smallest = left;
      if (right < len && distHeap[right] < distHeap[smallest]) smallest = right;
      if (smallest === i) break;
      swap(i, smallest);
      i = smallest;
    }
  };
  const push = (idx, dist) => {
    idxHeap.push(idx);
    distHeap.push(dist);
    siftUp(idxHeap.length - 1);
  };
  const popInto = (out) => {
    if (idxHeap.length === 0) return false;
    out.idx = idxHeap[0];
    out.dist = distHeap[0];
    const lastIdx = idxHeap.pop();
    const lastDist = distHeap.pop();
    if (idxHeap.length > 0) {
      idxHeap[0] = lastIdx;
      distHeap[0] = lastDist;
      siftDown(0);
    }
    return true;
  };
  return {
    push,
    popInto,
    get size() {
      return idxHeap.length;
    }
  };
};

export function computeDistanceMap({
  sources,
  sourceMask,
  sourceValue = true,
  N,
  directions,
  gridWidth,
  torusWrap
}) {
  const dist = new Array(N).fill(Infinity);
  const hasSources = Array.isArray(sources) && sources.length > 0;
  const hasMask = Array.isArray(sourceMask) && sourceMask.length === N;
  if (!hasSources && !hasMask) return dist;
  const heap = createMinHeap();
  const current = { idx: 0, dist: 0 };
  const dirs = Array.isArray(directions)
    ? directions.map((dir) => ({
      dx: dir.dx,
      dy: dir.dy,
      w: Number.isFinite(dir.w) ? dir.w : Math.hypot(dir.dx, dir.dy)
    }))
    : [];

  if (hasSources) {
    for (const s of sources) {
      const sIdx = s.y * gridWidth + s.x;
      dist[sIdx] = 0;
      heap.push(sIdx, 0);
    }
  } else {
    for (let i = 0; i < N; i++) {
      if (sourceMask[i] !== sourceValue) continue;
      dist[i] = 0;
      heap.push(i, 0);
    }
  }

  while (heap.size > 0) {
    if (!heap.popInto(current)) break;
    if (current.dist !== dist[current.idx]) continue;
    const cx = current.idx % gridWidth;
    const cy = (current.idx / gridWidth) | 0;
    for (const dir of dirs) {
      const wrapped = torusWrap(cx + dir.dx, cy + dir.dy);
      if (!wrapped) continue;
      const nIdx = wrapped.y * gridWidth + wrapped.x;
      const nd = current.dist + dir.w;
      if (nd < dist[nIdx]) {
        dist[nIdx] = nd;
        heap.push(nIdx, nd);
      }
    }
  }

  return dist;
}


