import { torusDistance, torusWrap } from '../torus.js';

const createMinHeap = () => {
  const heap = [];
  const swap = (i, j) => {
    const tmp = heap[i];
    heap[i] = heap[j];
    heap[j] = tmp;
  };
  const siftUp = (index) => {
    let i = index;
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      if (heap[p].dist <= heap[i].dist) break;
      swap(p, i);
      i = p;
    }
  };
  const siftDown = (index) => {
    let i = index;
    while (i < heap.length) {
      const left = i * 2 + 1;
      const right = i * 2 + 2;
      let smallest = i;
      if (left < heap.length && heap[left].dist < heap[smallest].dist) smallest = left;
      if (right < heap.length && heap[right].dist < heap[smallest].dist) smallest = right;
      if (smallest === i) break;
      swap(i, smallest);
      i = smallest;
    }
  };
  const push = (node) => {
    heap.push(node);
    siftUp(heap.length - 1);
  };
  const pop = () => {
    if (heap.length === 0) return null;
    const top = heap[0];
    const last = heap.pop();
    if (heap.length > 0) {
      heap[0] = last;
      siftDown(0);
    }
    return top;
  };
  return {
    push,
    pop,
    get size() {
      return heap.length;
    }
  };
};

export function computeDistanceMap({
  sources,
  N,
  directions,
  gridWidth,
  gridHeight
}) {
  const dist = new Array(N).fill(Infinity);
  if (!sources || sources.length === 0) return dist;
  const heap = createMinHeap();

  for (const s of sources) {
    const sIdx = s.y * gridWidth + s.x;
    dist[sIdx] = 0;
    heap.push({ x: s.x, y: s.y, idx: sIdx, dist: 0 });
  }

  while (heap.size > 0) {
    const current = heap.pop();
    if (!current) break;
    if (current.dist !== dist[current.idx]) continue;
    for (const dir of directions) {
      const wrapped = torusWrap(gridWidth, gridHeight, current.x + dir.dx, current.y + dir.dy);
      if (!wrapped) continue;
      const nIdx = wrapped.y * gridWidth + wrapped.x;
      const w = torusDistance(gridWidth, gridHeight, current.x, current.y, wrapped.x, wrapped.y);
      const nd = current.dist + w;
      if (nd < dist[nIdx]) {
        dist[nIdx] = nd;
        heap.push({ x: wrapped.x, y: wrapped.y, idx: nIdx, dist: nd });
      }
    }
  }

  return dist;
}


