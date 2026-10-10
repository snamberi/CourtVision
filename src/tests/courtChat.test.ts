import { describe, expect, it } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateFullRound, type League } from '../simulation/league';
import { courtChatFeed, handleOf, trending, postOfTheWeek } from '../social/courtChat';
import { postAsGm, postsLeftToday, chatMood, fanApproval, cleanText, POSTS_PER_DAY, MOOD_GAMES } from '../social/gmPosts';
import { playerMorale } from '../simulation/personality';
import { personalityOf } from '../simulation/personality';
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
    const slots = new Set(['pts', 'reb', 'ast', 'fg', 'score', 'opp', 'team', 'target', 'mate', 'streak', 'games', 'newTeam', 'oldTeam', 'award', 'round', 'pick', 'player', 'gm', 'years']);
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
      expect(p.author.handle).toMatch(/^@[A-Za-z]/);
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

describe('posting as the GM', () => {
  it('posts, gets answered in character and limits posts per day', () => {
    const l = league();
    const team = l.teams[0];
    const target = team.seasons[0];
    const out = postAsGm(l, team.teamId, { kind: 'praise', text: 'Huge credit to the big fella', playerId: target.playerId });
    expect('league' in out).toBe(true);
    const l2 = (out as { league: League }).league;
    const feed = courtChatFeed(l2, { controlledTeamId: team.teamId });
    const mine = feed.find(p => p.author.role === 'gm')!;
    expect(mine.text).toBe('Huge credit to the big fella');
    expect(mine.replies[0].author.playerId).toBe(target.playerId);
    expect(mine.replies[0].kind).toBe('gmPraiseReply');
    expect(mine.order).toBeGreaterThanOrEqual(feed[1]?.order ?? 0);
    let l3 = l2;
    for (let i = 1; i < POSTS_PER_DAY; i++) l3 = (postAsGm(l3, team.teamId, { kind: 'hype', text: 'Go team' }) as { league: League }).league;
    expect(postsLeftToday(l3, team.teamId)).toBe(0);
    expect('error' in postAsGm(l3, team.teamId, { kind: 'hype', text: 'One more' })).toBe(true);
    expect('error' in postAsGm(l, team.teamId, { kind: 'praise', text: 'x', playerId: l.teams[1].seasons[0].playerId })).toBe(true);
    expect('error' in postAsGm(l, team.teamId, { kind: 'hype', text: '   ' })).toBe(true);
  });

  it('a call-out stings the proud and fires up competitors, then fades', () => {
    const l = league();
    const team = l.teams.find(t => t.seasons.some(p => personalityOf(p).type === 'Hothead')) ?? l.teams[0];
    const p = team.seasons.find(x => personalityOf(x).type === 'Hothead') ?? team.seasons[0];
    const type = personalityOf(p).type;
    const l2 = (postAsGm(l, team.teamId, { kind: 'callout', text: 'Step up', playerId: p.playerId }) as { league: League }).league;
    const mood = chatMood(l2, p.playerId, type, team.teamId);
    if (type === 'Hothead') expect(mood).toBeLessThan(0);
    const factor = playerMorale(p, l2.teams.find(t => t.teamId === team.teamId)!, l2, { contracts: {}, capSettings: {} } as never).factors.find(f => f.label.includes('CourtChat'));
    if (mood) expect(factor).toBeDefined();
    // After MOOD_GAMES of the team's games it's gone.
    const aged: League = { ...l2, courtChat: { posts: l2.courtChat!.posts.map(x => ({ ...x, gamesAt: x.gamesAt - MOOD_GAMES })) } };
    expect(chatMood(aged, p.playerId, type, team.teamId)).toBe(0);
    const half: League = { ...l2, courtChat: { posts: l2.courtChat!.posts.map(x => ({ ...x, gamesAt: x.gamesAt - Math.floor(MOOD_GAMES / 2) })) } };
    expect(Math.abs(chatMood(half, p.playerId, type, team.teamId))).toBeLessThanOrEqual(Math.abs(mood));
  });

  it('cleans text and reads the fans', () => {
    expect(cleanText('  you are   so stupid  ')).toBe('you are so ******');
    expect(cleanText('x'.repeat(500)).length).toBe(200);
    const l = league();
    const a = fanApproval(l, l.teams[0].teamId);
    expect(a.score).toBeGreaterThanOrEqual(0);
    expect(a.score).toBeLessThanOrEqual(100);
  });

  it('trends and picks a post of the week', () => {
    const l = league();
    const feed = courtChatFeed(l);
    const t = trending(feed);
    expect(t.length).toBeGreaterThan(0);
    expect(t[0].tag.startsWith('#')).toBe(true);
    expect(postOfTheWeek(feed, l)).toBeDefined();
  });

  it('has fans and big moments in a longer season', () => {
    const l = league(30);
    const feed = courtChatFeed(l, { games: 200, controlledTeamId: l.teams[0].teamId });
    expect(feed.some(p => p.author.role === 'fan')).toBe(true);
    expect(feed.every(p => p.tags.length > 0)).toBe(true);
  });
});
