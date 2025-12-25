// 汎用: Dijkstraで距離マップを計算（sources から各セルまで）
// - トーラス形状など、座標のラップは呼び出し側で定義する
// - directions は近傍方向の配列（例: 8近傍）

export function computeDistanceMap({
  sources,
  N,
  directions,
  gridWidth,
  wrap,
  distance
}) {
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
    const sIdx = s.y * gridWidth + s.x;
    dist[sIdx] = 0;
    heapPush({ x: s.x, y: s.y, idx: sIdx, dist: 0 });
  }

  while (heap.length > 0) {
    const current = heapPop();
    if (!current) break;
    if (current.dist !== dist[current.idx]) continue;
    for (const dir of directions) {
      const wrapped = wrap(current.x + dir.dx, current.y + dir.dy);
      if (!wrapped) continue;
      const nIdx = wrapped.y * gridWidth + wrapped.x;
      const w = distance(current.x, current.y, wrapped.x, wrapped.y);
      const nd = current.dist + w;
      if (nd < dist[nIdx]) {
        dist[nIdx] = nd;
        heapPush({ x: wrapped.x, y: wrapped.y, idx: nIdx, dist: nd });
      }
    }
  }

  return dist;
}


