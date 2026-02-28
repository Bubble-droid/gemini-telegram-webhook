import { logger } from '@shared/core/logger.js';

/**
 * Normalizes text by removing all punctuation, whitespace, emojis, and markdown characters.
 * It strictly retains letters (including CJK ideographs) and numbers from any language.
 *
 * @param text The raw input string.
 * @returns The cleaned, lowercased string containing only core text content.
 */
export const normalizeText = (text: string): string => {
  // \p{L} matches letters from any language (including Chinese characters)
  // \p{N} matches numbers
  // 'u' flag is critical for Unicode property escapes
  return text.replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase();
};

/**
 * Calculates the Levenshtein distance between two strings using an optimized
 * O(min(N, M)) spatial complexity algorithm.
 *
 * @param a The first string.
 * @param b The second string.
 * @returns The absolute edit distance (number of insertions, deletions, or substitutions).
 */
const calculateEditDistance = (a: string, b: string): number => {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Use strictly typed arrays
  // Initialize 'prevRow' with 0..b.length
  let prevRow: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  // 'currRow' will be reused to avoid garbage collection overhead
  let currRow: number[] = new Array<number>(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i++) {
    // Initialize the first column of the current row (deletion distance from empty string)
    currRow[0] = i;

    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      // CRITICAL FIX: Parentheses added to ensure addition happens AFTER null check.
      // Although indices are guaranteed within bounds here, the '?? 0' safeguards against
      // theoretical undefined results in strict mode if bounds were loose.
      const insertionCost = (currRow[j - 1] ?? 0) + 1;
      const deletionCost = (prevRow[j] ?? 0) + 1;
      const substitutionCost = (prevRow[j - 1] ?? 0) + cost;

      currRow[j] = Math.min(insertionCost, deletionCost, substitutionCost);
    }

    // Swap references for the next iteration to avoid creating new arrays
    const temp = prevRow;
    prevRow = currRow;
    currRow = temp;
  }

  // After the swap, 'prevRow' actually holds the results of the last iteration
  return prevRow[b.length] ?? 0;
};

/**
 * Calculates a similarity score between 0.0 and 1.0 for two raw text inputs.
 *
 * @param rawText1 The first raw string (e.g., Markdown text).
 * @param rawText2 The second raw string (e.g., Plain text with suffix).
 * @returns A ratio where 1.0 means identical core content and 0.0 means completely different.
 */
export const calculateTextSimilarity = (rawText1: string, rawText2: string): number => {
  const normalized1 = normalizeText(rawText1);
  const normalized2 = normalizeText(rawText2);

  const maxLength = Math.max(normalized1.length, normalized2.length);

  // Edge case: Both strings are empty or noise-only -> consider them identical (or 0 depending on logic)
  // Usually, if both are empty, they are "similar".
  if (maxLength === 0) return 1.0;

  const distance = calculateEditDistance(normalized1, normalized2);

  // Convert edit distance to a percentage ratio
  return 1 - distance / maxLength;
};

/**
 * Evaluates if two texts share the same core content based on a similarity threshold.
 *
 * @param rawText1 The first raw string.
 * @param rawText2 The second raw string.
 * @param threshold The similarity percentage required (default is 0.95 or 95%).
 * @returns A boolean indicating if the texts are semantically/structurally similar.
 */
export const isCoreContentSimilar = (rawText1: string, rawText2: string, threshold = 0.95): boolean => {
  const score = calculateTextSimilarity(rawText1, rawText2);

  // Trace log for debugging
  logger.trace('Similarity check complete', {
    score,
    text1Length: rawText1.length,
    text2Length: rawText2.length,
  });

  return score >= threshold;
};
