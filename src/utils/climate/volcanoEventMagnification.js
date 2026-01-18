export const VOLCANO_EVENT_MAG_LABELS = Object.freeze([
  '0.05',
  '0.1',
  '0.3',
  '0.6',
  '0.8',
  '0.9',
  '1',
  '1.1',
  '1.2',
  '1.5',
  '2',
  '5',
  '10'
]);

export const VOLCANO_EVENT_MAG_STAGES = Object.freeze(
  VOLCANO_EVENT_MAG_LABELS.map((s) => Number(s))
);

export const VOLCANO_EVENT_MAG_DEFAULT_INDEX = 6; // x1

export function clampVolcanoEventMagIndex(idx) {
  const n = VOLCANO_EVENT_MAG_STAGES.length;
  const i = Math.floor(Number(idx));
  if (!Number.isFinite(i)) return VOLCANO_EVENT_MAG_DEFAULT_INDEX;
  if (i < 0) return 0;
  if (i > n - 1) return n - 1;
  return i;
}

export function volcanoEventMagFromIndex(idx) {
  const i = clampVolcanoEventMagIndex(idx);
  const v = VOLCANO_EVENT_MAG_STAGES[i];
  return (Number.isFinite(v) && v > 0) ? v : 1;
}

