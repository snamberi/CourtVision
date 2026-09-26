/* Small, dependency-free facts about the built-in NBA history dataset (safe to import from the main bundle;
 * the loader in nbaHistoryData.ts pulls in the decompressor and is loaded on demand). */

export const NBA_HISTORY_DATASET = 'nba-history.v2';
/** 'stats' | 'stats-same' | 'draft-slot' | 'default' (+ 'interpolated' in play; 'legacy' for leagues made with the first data version). */
export type RatingSource = string;

/** Human label for a rating's provenance. Every rating is Court Vision's own estimate from statistics. */
export function ratingSourceLabel(source: RatingSource): string {
  switch (source) {
    case 'stats': return 'Court Vision estimate from the previous season\'s statistics';
    case 'stats-same': return 'Court Vision estimate from that season\'s statistics (debut or return)';
    case 'interpolated': return 'Interpolated between two seasons with statistics (he did not play in between)';
    case 'draft-slot': return 'Estimated from his draft position (he never played an NBA game)';
    case 'default': return 'Default estimate (no statistics available)';
    default: return 'Rating from an earlier data version, converted to Court Vision\'s scale';
  }
}
/** Short tag shown next to a rating. */
export const ratingSourceTag = (source: RatingSource) =>
  source === 'interpolated' ? 'Interpolated' : source === 'stats' || source === 'stats-same' ? 'From stats' : source === 'draft-slot' || source === 'default' ? 'Estimated' : 'Legacy';
