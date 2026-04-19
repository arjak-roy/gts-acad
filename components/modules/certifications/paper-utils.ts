// ── Paper sizes in CSS px (at 96 DPI) ────────────────────────────────────────

export const PAPER_DIMENSIONS = {
  A4: { width: 1123, height: 794 }, // landscape
  LETTER: { width: 1056, height: 816 },
  CUSTOM: { width: 1123, height: 794 },
} as const;

export function getPaperSize(
  paperSize: string,
  orientation: string,
): { width: number; height: number } {
  const base = PAPER_DIMENSIONS[paperSize as keyof typeof PAPER_DIMENSIONS] ?? PAPER_DIMENSIONS.A4;
  if (orientation === "PORTRAIT") {
    return { width: base.height, height: base.width };
  }
  return base;
}
