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
  // The 'g' flag is for global replacement, and 'u' is required for unicode properties.
  return text.replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase();
};

/**
 * Calculates the Levenshtein distance between two strings using an optimized
 * O(min(N, M)) spatial complexity algorithm (using only two rows).
 *
 * @param a The first string.
 * @param b The second string.
 * @returns The absolute edit distance (number of insertions, deletions, or substitutions).
 */
const calculateEditDistance = (a: string, b: string): number => {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Use only two rows to minimize memory consumption for large texts
  let prevRow: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  let currRow: number[] = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    currRow[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        currRow[j - 1] ?? 0 + 1, // Insertion
        prevRow[j] ?? 0 + 1, // Deletion
        prevRow[j - 1] ?? 0 + cost, // Substitution
      );
    }

    // Swap rows for the next iteration
    const temp = prevRow;
    prevRow = currRow;
    currRow = temp;
  }

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
  if (maxLength === 0) return 1.0; // Both strings are empty or only contained noise

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
  return score >= threshold;
};
