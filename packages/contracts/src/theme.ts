function rgb(hex: string): number[] {
  if (!/^#[a-fA-F0-9]{6}$/.test(hex))
    throw new Error('Theme colors must use six-digit hex notation');
  return [1, 3, 5].map((index) =>
    Number.parseInt(hex.slice(index, index + 2), 16),
  );
}
function luminance(color: string): number {
  const channels = rgb(color).map((value) => {
    const n = value / 255;
    return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  });
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}
export function contrastRatio(a: string, b: string): number {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
function blend(a: string, b: string, weight: number): string {
  const first = rgb(a),
    second = rgb(b);
  return (
    '#' +
    first
      .map((value, index) =>
        Math.round(value * (1 - weight) + second[index]! * weight)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
/** Derive an accessible text color while retaining the configured brand hue. */
export function readableAccent(accent: string, mode: 'light' | 'dark'): string {
  const surface = mode === 'light' ? '#f8fafb' : '#161b20';
  const background = mode === 'light' ? '#ffffff' : '#101316';
  const tinted = blend(background, accent, 0.08);
  const destination = mode === 'light' ? '#111b27' : '#ffffff';
  for (let step = 0; step <= 100; step++) {
    const candidate = blend(accent, destination, step / 100);
    if (
      [surface, background, tinted].every(
        (value) => contrastRatio(candidate, value) >= 5,
      )
    )
      return candidate;
  }
  return destination;
}
