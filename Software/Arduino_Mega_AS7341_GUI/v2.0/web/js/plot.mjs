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

export function smoothSvgPath(points) {
  const commands = [];
  let segment = [];

  const flush = () => {
    if (segment.length < 2) {
      segment = [];
      return;
    }
    commands.push(`M${segment[0][0]} ${segment[0][1]}`);
    for (let index = 1; index < segment.length; index += 1) {
      const previous = segment[index - 1];
      const current = segment[index];
      const middleX = (previous[0] + current[0]) / 2;
      commands.push(`C${middleX} ${previous[1]} ${middleX} ${current[1]} ${current[0]} ${current[1]}`);
    }
    segment = [];
  };

  [...points, null].forEach((point) => {
    if (point) segment.push(point);
    else flush();
  });
  return commands.join(" ");
}
