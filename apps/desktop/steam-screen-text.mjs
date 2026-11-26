// SPDX-License-Identifier: GPL-3.0-only

/** Text lines recognized in a Steam screenshot. Windows used its built-in OCR;
 * a Linux OCR backend (for example Tesseract) has not been added yet. */
export async function readSteamScreenText() {
  return [];
}

const wordKey = (text) =>
  String(text ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');

function nearGameWord(observed, wanted) {
  if (observed === wanted) return true;
  // In small Steam fonts OCR may misread several strokes in a long word.
  // Keep numerals and short words exact and require a shared word prefix.
  if (wanted.length < 8 || !/^\p{L}+$/u.test(wanted) || observed.slice(0, 4) !== wanted.slice(0, 4))
    return false;
  let distances = Array.from({ length: observed.length + 1 }, (_, i) => i);
  for (const [index, letter] of [...wanted].entries()) {
    const next = [index + 1];
    for (const [offset, seen] of [...observed].entries())
      next.push(
        Math.min(
          next[offset] + 1,
          distances[offset + 1] + 1,
          distances[offset] + Number(letter !== seen),
        ),
      );
    distances = next;
  }
  return distances.at(-1) <= Math.floor(wanted.length / 3);
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
