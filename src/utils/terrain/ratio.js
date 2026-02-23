import { clamp } from '../math.js';

const X0 = 0.3;
const Y0 = 0.07;
const X1 = 0.9;
const Y1 = 0.7;

export function mapSeaLandRatio(ui) {
  ui = clamp(Number(ui) || 0, 0, 1);
  if (ui <= X0) {
    return (ui / X0) * Y0;
  } else if (ui >= X1) {
    return Y1 + ((ui - X1) / (1 - X1)) * (1 - Y1);
  }
  const t = (ui - X0) / (X1 - X0);
  const s = t * t * (3 - 2 * t);
  return Y0 + s * (Y1 - Y0);
}


