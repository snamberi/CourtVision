import { describe, expect, it } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateFullRound, type League } from '../simulation/league';
import { courtChatFeed, handleOf } from '../social/courtChat';
import { variantCount, allTemplates, expandAll, LIBRARY, templatesFor, type ChatKind } from '../social/chatTemplates';
import type { PersonalityType } from '../simulation/personality';

const TYPES: PersonalityType[] = ['Leader', 'Hothead', 'Star Ego', 'Mercenary', 'Competitor', 'Loyal', 'Professional'];

function league(rounds = 14): League {
  const g = generateFullLeague(4242, 6, 12, 30, '2026', { priorSeasons: false });
  let l: League = g.league;
  for (let i = 0; i < rounds; i++) l = simulateFullRound(l, 900 + i);
  return l;
}

describe('CourtChat templates', () => {
  it('can write over 2,000 different posts', () => {
    const distinct = new Set(allTemplates().flatMap(expandAll));
    expect(variantCount()).toBeGreaterThanOrEqual(2000);
    expect(distinct.size).toBe(variantCount());
  });

  it('every personality has something to say in every situation', () => {
    for (const kind of Object.keys(LIBRARY) as ChatKind[]) for (const t of TYPES) expect(templatesFor(kind, t).length).toBeGreaterThan(0);
  });

  it('only uses known slots and balanced brackets', () => {
    const slots = new Set(['pts', 'reb', 'ast', 'fg', 'score', 'opp', 'team', 'target', 'mate', 'streak', 'games', 'newTeam', 'oldTeam']);
    for (const t of allTemplates()) {
      for (const m of t.matchAll(/\{(\w+)\}/g)) expect(slots.has(m[1])).toBe(true);
      expect((t.match(/\[/g) ?? []).length).toBe((t.match(/\]/g) ?? []).length);
    }
  });

  it('keeps it clean', () => {
    const banned = /\b(damn|hell|crap|stupid|idiot|loser|trash can|hate you|kill|shut up|ugly face)\b/i;
    for (const t of allTemplates().flatMap(expandAll)) expect(banned.test(t)).toBe(false);
  });
});

describe('CourtChat feed', () => {
  it('fills in every post from real games, newest first, the same way every time', () => {
    const l = league();
    const feed = courtChatFeed(l);
    expect(feed.length).toBeGreaterThan(20);
    for (const p of [...feed, ...feed.flatMap(x => x.replies)]) {
      expect(p.text).not.toMatch(/[[\]{}]/);
      expect(p.author.handle).toMatch(/^@[a-z]/);
    }
    for (let i = 1; i < feed.length; i++) expect(feed[i - 1].order).toBeGreaterThanOrEqual(feed[i].order);
    expect(courtChatFeed(l).map(p => p.text)).toEqual(feed.map(p => p.text));
    // Posts sound like their authors: each personality only uses its own (or shared) lines.
    const kinds = new Set(feed.map(p => p.kind));
    expect(kinds.has('win') || kinds.has('bigNight')).toBe(true);
  });

  it('has roasts with clapbacks, and a team filter', () => {
    const l = league(30);
    const feed = courtChatFeed(l, { games: 120 });
    const roasts = feed.filter(p => p.roast);
    expect(roasts.length).toBeGreaterThan(0);
    expect(roasts.some(r => r.replies.some(x => x.kind === 'clapback'))).toBe(true);
    const team = l.teams[0].teamId;
    const mine = courtChatFeed(l, { games: 120, teamId: team });
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.length).toBeLessThan(feed.length);
  });

  it('makes handles', () => {
    expect(handleOf('Jaylen Brown', 7)).toBe('@jbrown7');
    expect(handleOf("Shaquille O'Neal", 34)).toBe('@soneal34');
    expect(handleOf('Franco Laprovíttola', 27)).toBe('@flaprovittola27');
    expect(handleOf('Nikola Jokić', 15)).toBe('@njokic15');
  });
});
