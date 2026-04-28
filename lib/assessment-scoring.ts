/**
 * Clamps assessment attempt scores to valid ranges, preventing DB constraint violations.
 * The DB enforces: marks_obtained >= 0, marks_obtained <= total_marks, percentage in [0, 100].
 */
export function clampAttemptScore(marksObtained: number, totalMarks: number) {
  const normalizedTotalMarks = Math.max(0, totalMarks);
  const normalizedMarksObtained = Math.min(Math.max(0, marksObtained), normalizedTotalMarks);
  const rawPercentage =
    normalizedTotalMarks > 0
      ? Math.round((normalizedMarksObtained / normalizedTotalMarks) * 100)
      : 0;
  const normalizedPercentage = Math.min(Math.max(0, rawPercentage), 100);

  return {
    marksObtained: normalizedMarksObtained,
    percentage: normalizedPercentage,
  };
}

/**
 * Deterministic seeded pseudo-random number generator (LCG).
 * Returns a function that produces floats in [0, 1).
 * Used to apply stable per-candidate question randomization without storing the selection.
 */
export function seededRng(seed: string): () => number {
  // Convert the string seed to a 32-bit integer via a djb2 hash.
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) >>> 0;
  }

  // LCG parameters (Numerical Recipes)
  const m = 2 ** 32;
  const a = 1_664_525;
  const c = 1_013_904_223;
  let state = hash;

  return () => {
    state = (a * state + c) >>> 0;
    return state / m;
  };
}

/**
 * Deterministically shuffles an array using the provided random function.
 * Does not mutate the original array.
 */
export function deterministicShuffle<T>(items: T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
