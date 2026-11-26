// SPDX-License-Identifier: GPL-3.0-only

/** Text lines recognized in a Steam screenshot. Windows used its built-in OCR;
 * a Linux OCR backend (for example Tesseract) has not been added yet. */
export async function readSteamScreenText() {
  return [];
}

export function steamTextPoint(lines, target, viewport) {
  const row = target.steamRole === 'game_row';
  const title = target.untrustedLabel ?? target.label;
  const wanted = String(title ?? '')
    .split(/\s+/u)
    .map(wordKey)
    .filter(Boolean);
  if (!wanted.length) return null;
  const points = [];
  for (const line of lines) {
    if (!Array.isArray(line)) continue;
    const words = line.filter((word) => wordKey(word.text));
    for (let i = 0; i <= words.length - wanted.length; i++) {
      const segment = words.slice(i, i + wanted.length);
      if (
        row &&
        (i + wanted.length !== words.length ||
          words.slice(0, i).some((word) => wordKey(word.text).length > 2))
      )
        continue;
      if (
        !segment.every((word, j) =>
          row ? nearGameWord(wordKey(word.text), wanted[j]) : wordKey(word.text) === wanted[j],
        )
      )
        continue;
      const { x, y, width, height } = segment[0];
      const point = { x: Math.floor(x + width / 2), y: Math.floor(y + height / 2) };
      const relativeX = (point.x - viewport.x) / viewport.width;
      const relativeY = (point.y - viewport.y) / viewport.height;
      if (relativeX < 0 || relativeX >= 1 || relativeY < 0 || relativeY >= 1) continue;
      if (row && (relativeX > 0.35 || relativeY < 0.09)) continue;
      if (target.steamRole === 'library' && relativeY > 0.12) continue;
      if (['play', 'install'].includes(target.steamRole) && (relativeX < 0.12 || relativeY < 0.09))
        continue;
      if (
        !points.some((other) => Math.abs(other.x - point.x) < 8 && Math.abs(other.y - point.y) < 5)
      )
        points.push(point);
    }
  }
  return points.length === 1 ? points[0] : null;
}
