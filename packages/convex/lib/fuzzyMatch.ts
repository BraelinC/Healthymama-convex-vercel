/**
 * Fuzzy Matching Utilities
 * Implements Levenshtein distance and fuzzy string matching for search enhancement
 */

/**
 * Calculate Levenshtein distance between two strings
 * Returns the minimum number of single-character edits (insertions, deletions, substitutions)
 * needed to change one string into another
 *
 * Example:
 * - levenshteinDistance("healthy", "helthy") = 1 (1 deletion)
 * - levenshteinDistance("muffins", "mufins") = 1 (1 insertion)
 * - levenshteinDistance("carrot", "carrot") = 0 (exact match)
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;

  // Create 2D array for dynamic programming
  const dp: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= len1; i++) {
    dp[i][0] = i;
  }
  for (let j = 0; j <= len2; j++) {
    dp[0][j] = j;
  }

  // Fill the DP table
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]; // No operation needed
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,     // Deletion
          dp[i][j - 1] + 1,     // Insertion
          dp[i - 1][j - 1] + 1  // Substitution
        );
      }
    }
  }

  return dp[len1][len2];
}

/**
 * Calculate fuzzy similarity score between two words (0.0 to 1.0)
 * 1.0 = exact match, 0.0 = completely different
 *
 * Uses normalized Levenshtein distance:
 * similarity = 1 - (edit_distance / max_length)
 *
 * Example:
 * - fuzzyMatchScore("healthy", "helthy") = 0.857 (6 chars, 1 edit)
 * - fuzzyMatchScore("muffins", "mufins") = 0.857 (7 chars, 1 edit)
 * - fuzzyMatchScore("carrot", "carrot") = 1.0 (exact match)
 */
export function fuzzyMatchScore(word1: string, word2: string): number {
  if (word1 === word2) return 1.0; // Fast path for exact match

  const distance = levenshteinDistance(word1, word2);
  const maxLen = Math.max(word1.length, word2.length);

  if (maxLen === 0) return 1.0; // Both empty strings

  return 1 - (distance / maxLen);
}

/**
 * Calculate the best fuzzy match score for a query word against multiple target words
 * Returns the highest similarity score found
 *
 * Example:
 * bestFuzzyMatch("helthy", ["crispy", "healthy", "quick"]) = 0.857 (matches "healthy")
 */
export function bestFuzzyMatch(queryWord: string, targetWords: string[]): number {
  if (targetWords.length === 0) return 0;

  let bestScore = 0;
  for (const targetWord of targetWords) {
    const score = fuzzyMatchScore(queryWord, targetWord);
    bestScore = Math.max(bestScore, score);
  }

  return bestScore;
}

/**
 * Calculate average fuzzy similarity between query words and target text
 * For each query word, finds the best match in the target text
 * Returns average of all best matches (0.0 to 1.0)
 *
 * Example:
 * query: "helthy carrot mufins"
 * target: "Healthy Carrot Muffins"
 *
 * "helthy" best matches "healthy" = 0.857
 * "carrot" best matches "carrot" = 1.0
 * "mufins" best matches "muffins" = 0.857
 * Average = (0.857 + 1.0 + 0.857) / 3 = 0.905
 */
export function calculateAverageFuzzySimilarity(query: string, targetText: string): number {
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  const targetWords = targetText.toLowerCase().split(/\s+/).filter(w => w.length > 0);

  if (queryWords.length === 0 || targetWords.length === 0) return 0;

  let totalSimilarity = 0;
  for (const queryWord of queryWords) {
    const bestMatch = bestFuzzyMatch(queryWord, targetWords);
    totalSimilarity += bestMatch;
  }

  return totalSimilarity / queryWords.length;
}

/**
 * Check if a word is a substring match (for partial lexical matching)
 * Returns true if the word appears anywhere in the target (case-insensitive)
 *
 * Example:
 * containsWord("healthy carrot muffins", "healthy") = true
 * containsWord("healthy carrot muffins", "carrot") = true
 * containsWord("pineapple chicken", "apple") = true (substring match)
 */
export function containsWord(text: string, word: string): boolean {
  return text.toLowerCase().includes(word.toLowerCase());
}

/**
 * Count exact word matches between query and target text
 * Returns { matches, total } where:
 * - matches: number of query words found in target
 * - total: total query words
 *
 * Example:
 * countExactMatches("healthy carrot muffins", "Healthy Carrot Muffins Recipe")
 * → { matches: 3, total: 3 }
 */
export function countExactMatches(query: string, targetText: string): { matches: number; total: number } {
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  const targetLower = targetText.toLowerCase();

  let matches = 0;
  for (const word of queryWords) {
    if (containsWord(targetLower, word)) {
      matches++;
    }
  }

  return { matches, total: queryWords.length };
}
