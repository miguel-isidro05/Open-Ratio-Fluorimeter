export const PLOT_ANIMATION_MS = 220;

export function easeOutCubic(progress) {
  const bounded = Math.max(0, Math.min(1, Number(progress)));
  return 1 - (1 - bounded) ** 3;
}

export function interpolatePlotValues(start, target, progress) {
  if (!Array.isArray(start) || !Array.isArray(target) || start.length !== target.length) {
    throw new TypeError("La transición espectral requiere series compatibles.");
  }
  const eased = easeOutCubic(progress);
  return target.map((value, index) => {
    const previous = start[index];
    if (previous >= 65535 || value >= 65535) return value;
    return previous + (value - previous) * eased;
  });
}
