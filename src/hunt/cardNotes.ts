import type { NbaHistory } from '../history/nbaHistoryData';
import type { HuntCard } from './cards';

/*
 * What a fan would know about a card on a blind spin: that season's big awards, All-NBA team and title, with no
 * numbers. Enough to make the pick a basketball read instead of a coin flip, without giving the rating away.
 */

const AWARD_NOTE: Record<string, string> = { mvp: 'MVP', dpoy: 'Defensive POY', roy: 'Rookie of the Year', smoy: 'Sixth Man', mip: 'Most Improved' };
const RANK = ['', '1st', '2nd', '3rd'];
const cache = new WeakMap<NbaHistory, Map<string, string[]>>();

function notesByPlayerSeason(h: NbaHistory): Map<string, string[]> {
  const hit = cache.get(h);
  if (hit) return hit;
  const m = new Map<string, string[]>();
  const add = (idx: number, season: number, note: string) => { const k = `${idx}@${season}`; m.set(k, [...(m.get(k) ?? []), note]); };
  for (const a of h.awards) if (a.winner && AWARD_NOTE[a.award]) add(a.player, a.season, AWARD_NOTE[a.award]);
  for (const t of h.teamAwards) if (t.award === 'allLeague' && t.rank) add(t.player, t.season, `All-NBA ${RANK[t.rank] ?? ''}`.trim());
  for (const a of h.allStars) if (a.league === 'NBA' && !(m.get(`${a.player}@${a.season}`) ?? []).includes('All-Star')) add(a.player, a.season, 'All-Star');
  cache.set(h, m);
  return m;
}

/** The notes for a card: awards and All-NBA that season, then "Won the title" if his team did. */
export function cardNotes(h: NbaHistory, card: HuntCard): string[] {
  const p = h.byId.get(card.playerId);
  const notes = p ? [...(notesByPlayerSeason(h).get(`${p.idx}@${card.end}`) ?? [])] : [];
  if (h.champions.some(c => c.season === card.end && c.champion === card.team)) notes.push('Won the title');
  return notes;
}
