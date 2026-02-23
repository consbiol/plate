export function toIndex(x, y, gridWidth) {
  return y * gridWidth + x;
}

export function toCoords(idx, gridWidth) {
  return { x: idx % gridWidth, y: Math.floor(idx / gridWidth) };
}
