export const clampIndex = (idx, length) => {
  if (!length || length < 1) return 0;
  const n = Number.isFinite(idx) ? idx : 0;
  return Math.max(0, Math.min(length - 1, n));
};
