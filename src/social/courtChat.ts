import type { League } from '../simulation/league';
import type { PlayerSeason } from '../simulation/types';
import type { PlayerStatLine } from '../simulation/boxscore';
import { personalityOf, type PersonalityType } from '../simulation/personality';
import { calculateOverall } from '../simulation/engine/overall';
import { RNG } from '../simulation/engine/rng';
import { templatesFor, expand, fill, type ChatKind } from './chatTemplates';
import { gmPosts, fanApproval, type GmPost } from './gmPosts';

/*
 * CourtChat: the league's social feed. Players post after games, streaks, injuries, trades, signings, the draft,
 * the playoffs, awards and retirements, in their own voice (their personality, personality.ts), and roast each
 * other after bad nights; the roasted sometimes clap back and teammates hype each other. Fans and a league insider
 * post too, and so can you, as the GM (gmPosts.ts), and the league answers. Everything except your own posts is
 * derived from what already happened in the league and seeded by it, so the same league always shows the same feed.
 */

export type AuthorRole = 'player' | 'fan' | 'insider' | 'gm';
export interface ChatAuthor { playerId: string; name: string; handle: string; teamId: string | null; type: PersonalityType; jersey?: number; role: AuthorRole; verified?: boolean }
export interface ChatPost {
  id: string;
  kind: ChatKind;
  author: ChatAuthor;
  text: string;
  /** What it's about: "after the 112-104 win over the Lakers". */
  context: string;
  likes: number;
  reposts: number;
  /** Replies under the post (clapbacks, teammates, fans). */
  replies: ChatPost[];
  /** Newest first: higher is newer. */
  order: number;
  /** A roast: someone gets called out. */
  roast?: boolean;
  /** Who the post is about, if anyone. */
  targetId?: string;
  /** Hashtags, for Trending. */
  tags: string[];
}

function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/** "@jbrown7": first initial, last name, jersey number. */
export function handleOf(name: string, jersey?: number | null): string {
  const parts = name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z .'-]/g, '').trim().split(/\s+/);
  const last = (parts.at(-1) ?? 'hooper').replace(/[^A-Za-z]/g, '').toLowerCase();
  const first = parts.length > 1 ? parts[0][0].toLowerCase() : '';
  return `@${first}${last}${jersey ?? ''}`.slice(0, 18);
}
export const shortName = (teamName: string) => teamName.split(' ').at(-1) ?? teamName;
/** The GM's handle for a team: "@FoundryGM". */
export const gmHandle = (teamName: string) => `@${shortName(teamName).replace(/[^A-Za-z]/g, '')}GM`;
export const INSIDER: ChatAuthor = { playerId: 'insider', name: 'Court Insider', handle: '@CourtInsider', teamId: null, type: 'Professional', role: 'insider', verified: true };

interface Who { p: PlayerSeason; teamId: string | null }
function index(league: League): Map<string, Who> {
  const m = new Map<string, Who>();
  for (const t of league.teams) for (const p of t.seasons) m.set(p.playerId, { p, teamId: t.teamId });
  return m;
}
function authorOf(w: Who): ChatAuthor {
  return { playerId: w.p.playerId, name: w.p.playerId, handle: handleOf(w.p.playerId, w.p.jerseyNumber), teamId: w.teamId, type: personalityOf(w.p).type, jersey: w.p.jerseyNumber, role: 'player', verified: calculateOverall(w.p) >= 75 };
}
const FAN_SUFFIX = ['Faithful', 'Fanatic', 'Nation', 'Daily', 'Hoops', 'Talk', '4Life', 'Fan'];
function fanOf(teamId: string, teamName: string, seed: number): ChatAuthor {
  const t = shortName(teamName).replace(/[^A-Za-z]/g, '');
  const suffix = FAN_SUFFIX[seed % FAN_SUFFIX.length];
  return { playerId: `fan|${teamId}|${suffix}`, name: `${shortName(teamName)} ${suffix === 'Fan' ? 'Fan' : suffix}`, handle: `@${t}${suffix}`, teamId, type: 'Professional', role: 'fan' };
}
const reb = (l: PlayerStatLine) => l.oreb + l.dreb;
const fgLine = (l: PlayerStatLine) => `${l.fgm}-for-${l.fga}`;
const isBad = (l: PlayerStatLine) => l.fga >= 10 && l.fgm / l.fga < 0.36;
const tripleDouble = (l: PlayerStatLine) => [l.points, reb(l), l.ast].filter(n => n >= 10).length >= 3;
const historic = (l: PlayerStatLine) => l.points >= 45 || [l.points, reb(l), l.ast, l.stl, l.blk].filter(n => n >= 10).length >= 4;

const KIND_TAG: Partial<Record<ChatKind, string>> = {
  roast: '#Roasted', clapback: '#Roasted', bigNight: '#Buckets', milestone: '#History', seriesWin: '#Playoffs', eliminated: '#Playoffs', champion: '#Champions',
  award: '#Awards', rookie: '#Rookies', signed: '#FreeAgency', traded: '#TradeSzn', tradeRequest: '#TradeSzn', insiderRumor: '#TradeSzn', insiderRequest: '#TradeSzn',
  injury: '#InjuryReport', insiderInjury: '#InjuryReport', rivalry: '#Rivalry', pregame: '#Rivalry', winStreak: '#Streak', loseStreak: '#Streak', retired: '#Farewell',
  gmHype: '#GMSays', gmPraise: '#GMSays', gmCallout: '#GMSays', gmRival: '#GMSays', fanWin: '#FanZone', fanLoss: '#FanZone', badNight: '#Bricks', blowoutLoss: '#Bricks',
};

export interface FeedOptions {
  /** Only posts by (or about) this team. */ teamId?: string | null;
  /** How many recent games to read. */ games?: number;
  /** Your team (the GM's posts, the fans who @ you). */ controlledTeamId?: string | null;
  /** Players on the trade block (the insider's rumors). */ tradeBlock?: string[];
}

/** The feed, newest first. */
export function courtChatFeed(league: League, opts: FeedOptions = {}): ChatPost[] {
  const who = index(league);
  const teamName = new Map(league.teams.map(t => [t.teamId, shortName(t.name)]));
  const fullName = new Map(league.teams.map(t => [t.teamId, t.name]));
  const posts: ChatPost[] = [];
  const played = league.schedule.map((g, i) => ({ g, i })).filter(x => x.g.played && x.g.result);
  const recent = played.slice(-(opts.games ?? 40));
  const me = opts.controlledTeamId ?? null;
  const myGm = me ? gmHandle(fullName.get(me) ?? 'Team') : '@TheGM';

  const write = (kind: ChatKind, a: ChatAuthor, vars: Record<string, string | number | undefined>, seedKey: string, context: string, order: number, extra: Partial<ChatPost> = {}): ChatPost => {
    const rng = new RNG(hash(seedKey));
    const list = templatesFor(kind, a.type);
    const tpl = list[Math.floor(rng.next() * list.length)] ?? '';
    const text = fill(expand(tpl, () => rng.next()), { team: teamName.get(a.teamId ?? '') ?? 'the team', gm: myGm, ...vars });
    const heat = kind === 'roast' || kind === 'bigNight' || kind === 'milestone' || kind === 'champion' ? 3 : kind === 'clapback' || kind === 'insiderRequest' ? 2 : a.role === 'fan' ? 0.3 : 1;
    const likes = Math.round((40 + rng.next() * 900) * heat * (a.type === 'Star Ego' && a.role === 'player' ? 1.6 : 1) * (a.verified ? 1.5 : 1));
    const tags = [KIND_TAG[kind], a.teamId ? `#${(teamName.get(a.teamId) ?? '').replace(/[^A-Za-z]/g, '')}` : undefined].filter((t): t is string => !!t);
    return { id: seedKey, kind, author: a, text, context, likes, reposts: Math.round(likes * (0.05 + rng.next() * 0.2)), replies: [], order, tags, ...extra };
  };
  const make = (kind: ChatKind, w: Who, vars: Record<string, string | number | undefined>, seedKey: string, context: string, order: number, extra: Partial<ChatPost> = {}) =>
    write(kind, authorOf(w), vars, seedKey, context, order, extra);

  for (const { g, i } of recent) {
    const r = g.result!;
    const homeWon = r.homeScore > r.awayScore;
    const [winBox, loseBox] = homeWon ? [r.homeBox, r.awayBox] : [r.awayBox, r.homeBox];
    const winId = winBox.teamId, loseId = loseBox.teamId;
    const score = `${Math.max(r.homeScore, r.awayScore)}-${Math.min(r.homeScore, r.awayScore)}`;
    const margin = Math.abs(r.homeScore - r.awayScore);
    const rng = new RNG(hash(`chat|${g.id}`));
    const lines = (box: typeof winBox) => Object.values(box.players).filter(l => l.minutes > 0 && who.has(l.playerId)).sort((a, b) => b.points - a.points);
    const winners = lines(winBox), losers = lines(loseBox);
    const base = i * 10;
    const ctxW = `after the ${score} win over the ${teamName.get(loseId) ?? 'opponent'}`;
    const ctxL = `after the ${score} loss to the ${teamName.get(winId) ?? 'opponent'}`;

    // The winner's best player (a historic night always posts).
    const star = winners[0];
    if (star && (historic(star) || rng.next() < 0.75)) {
      const kind: ChatKind = historic(star) ? 'milestone' : star.points >= 30 || tripleDouble(star) ? 'bigNight' : 'win';
      const post = make(kind, who.get(star.playerId)!, { pts: star.points, reb: reb(star), ast: star.ast, score, opp: teamName.get(loseId), fg: fgLine(star), mate: mateHandle(winners, star, who) }, `${g.id}|${star.playerId}|${kind}`, ctxW, base + 5);
      const mate = winners[1];
      if ((kind === 'bigNight' || kind === 'milestone') && mate && rng.next() < 0.7) post.replies.push(make('hype', who.get(mate.playerId)!, { target: post.author.handle }, `${g.id}|${mate.playerId}|hype`, ctxW, base + 4));
      posts.push(post);
    }
    // The loser's best player, or the one who had a rough night.
    const bad = losers.find(isBad);
    const loser = bad && rng.next() < 0.5 ? bad : losers[0];
    if (loser && rng.next() < 0.55) {
      const kind: ChatKind = loser === bad ? 'badNight' : margin >= 20 ? 'blowoutLoss' : 'loss';
      posts.push(make(kind, who.get(loser.playerId)!, { pts: loser.points, reb: reb(loser), ast: loser.ast, score, opp: teamName.get(winId), fg: fgLine(loser) }, `${g.id}|${loser.playerId}|${kind}`, ctxL, base + 3));
    }
    // A roast: a winner calls out a loser who had a rough night (trash-talkers more than anyone).
    if (bad) {
      const roaster = winners.slice(0, 4).find(l => { const t = personalityOf(who.get(l.playerId)!.p).type; return (t === 'Hothead' || t === 'Star Ego' || t === 'Competitor') && l.points >= 12; })
        ?? (rng.next() < 0.25 ? winners[0] : undefined);
      if (roaster && rng.next() < 0.65) {
        const target = authorOf(who.get(bad.playerId)!);
        const post = make('roast', who.get(roaster.playerId)!, { target: target.handle, fg: fgLine(bad), pts: roaster.points, score, opp: teamName.get(loseId) }, `${g.id}|${roaster.playerId}|roast`, ctxW, base + 6, { roast: true, targetId: bad.playerId });
        if (rng.next() < 0.6) post.replies.push(make('clapback', who.get(bad.playerId)!, { target: post.author.handle, team: teamName.get(loseId) }, `${g.id}|${bad.playerId}|clap`, ctxL, base + 5));
        posts.push(post);
      }
    }
    // Rivalry nights get a post from the winners.
    const rivalKey = [winId, loseId].sort().join('|');
    if (league.rivalries?.[rivalKey] && star && rng.next() < 0.5) {
      const w2 = winners[1] ?? star;
      posts.push(make('rivalry', who.get(w2.playerId)!, { opp: teamName.get(loseId), score, pts: w2.points }, `${g.id}|${w2.playerId}|rivalry`, ctxW, base + 2));
    }
    // The fans weigh in (more often for your team).
    const fanChance = (id: string) => (id === me ? 0.6 : 0.2);
    if (rng.next() < fanChance(winId)) posts.push(write('fanWin', fanOf(winId, fullName.get(winId) ?? 'Team', hash(g.id)), { score, opp: teamName.get(loseId), player: star ? authorOf(who.get(star.playerId)!).handle : '', pts: star?.points }, `${g.id}|fanW`, ctxW, base + 1));
    if (rng.next() < fanChance(loseId) * 0.8) posts.push(write('fanLoss', fanOf(loseId, fullName.get(loseId) ?? 'Team', hash(g.id) + 3), { score, opp: teamName.get(winId), gm: loseId === me ? myGm : gmHandle(fullName.get(loseId) ?? 'Team') }, `${g.id}|fanL`, ctxL, base + 1));
  }

  const lastOrder = (recent.at(-1)?.i ?? 0) * 10 + 8;
  // Streaks right now: someone on the team says something.
  for (const t of league.teams) {
    const results = played.filter(x => x.g.homeTeamId === t.teamId || x.g.awayTeamId === t.teamId).map(x => { const r = x.g.result!; return (x.g.homeTeamId === t.teamId) === (r.homeScore > r.awayScore); });
    let n = 0; const last = results.at(-1);
    for (let k = results.length - 1; k >= 0 && results[k] === last; k--) n++;
    if (n < 5 || last == null) continue;
    const p = [...t.seasons].sort((a, b) => personalityRank(b, !!last) - personalityRank(a, !!last))[0];
    if (p) posts.push(make(last ? 'winStreak' : 'loseStreak', { p, teamId: t.teamId }, { streak: n }, `streak|${t.teamId}|${results.length}`, last ? `${n} wins in a row` : `${n} losses in a row`, lastOrder));
  }
  // Injuries: the injured player checks in, and the insider has the news for the longer ones.
  for (const inj of Object.values(league.injuries ?? {})) {
    const w = who.get(inj.playerId);
    if (!w || inj.gamesRemaining < 3) continue;
    posts.push(make('injury', w, { games: inj.gamesRemaining }, `inj|${inj.playerId}|${inj.totalGames}`, `${inj.severity} injury`, lastOrder - 1));
    if (inj.totalGames >= 5) posts.push(write('insiderInjury', INSIDER, { player: authorOf(w).handle, games: inj.totalGames, award: inj.severity }, `ins|inj|${inj.playerId}|${inj.totalGames}`, 'injury report', lastOrder - 1.5, { targetId: inj.playerId }));
  }
  // Trades and signings this season.
  for (const n of (league.newsArchive ?? []).filter(x => x.category === 'Transactions' && x.playerId && x.season === league.season).slice(-20)) {
    const w = who.get(n.playerId!);
    if (!w || !w.teamId) continue;
    const order = lastOrder - 2 - (n.order ?? 0) / 1e9;
    if (/trade/i.test(n.headline)) {
      const old = league.teams.find(t => t.teamId !== w.teamId && n.headline.includes(t.name));
      posts.push(make('traded', w, { newTeam: teamName.get(w.teamId), oldTeam: old ? shortName(old.name) : 'my old team' }, `trade|${n.id}`, 'after the trade', order));
    } else if (/sign/i.test(n.headline) && !/re-?sign|extension/i.test(n.headline)) {
      posts.push(make('signed', w, { newTeam: teamName.get(w.teamId) }, `sign|${n.id}`, 'after signing', order));
    }
  }
  // Trade requests: a cryptic post, and the insider breaks it.
  for (const t of league.teams) for (const p of t.seasons) {
    if (!p.morale?.tradeRequest || p.morale.tradeRequest !== league.season) continue;
    const w = { p, teamId: t.teamId };
    posts.push(make('tradeRequest', w, {}, `req|${p.playerId}|${league.season}`, 'unhappy', lastOrder - 0.5));
    posts.push(write('insiderRequest', INSIDER, { player: authorOf(w).handle, team: teamName.get(t.teamId) }, `ins|req|${p.playerId}|${league.season}`, 'breaking news', lastOrder - 0.4, { targetId: p.playerId }));
  }
  // The trade block: the insider hears things.
  for (const id of (opts.tradeBlock ?? []).slice(0, 6)) {
    const w = who.get(id);
    if (!w || !w.teamId || w.p.morale?.tradeRequest === league.season) continue;
    posts.push(write('insiderRumor', INSIDER, { player: authorOf(w).handle, team: teamName.get(w.teamId) }, `ins|rumor|${id}|${league.season}|${played.length >> 5}`, 'trade rumors', lastOrder - 3, { targetId: id }));
  }
  // Next up: rivalry games in the next few days get pre-game trash talk.
  const next = league.schedule.findIndex(g => !g.played);
  if (next >= 0) for (const g of league.schedule.slice(next, next + league.teams.length)) {
    if (g.played || !league.rivalries?.[[g.homeTeamId, g.awayTeamId].sort().join('|')]) continue;
    const t = league.teams.find(x => x.teamId === g.homeTeamId);
    const talker = t && [...t.seasons].sort((a, b) => personalityRank(b, true) - personalityRank(a, true))[0];
    if (talker) posts.push(make('pregame', { p: talker, teamId: t!.teamId }, { opp: teamName.get(g.awayTeamId) }, `pre|${g.id}`, `before the ${teamName.get(g.awayTeamId)} game`, lastOrder + 1));
  }
  // The playoffs: series wins, eliminations and the title.
  const bracket = league.playoffBracket;
  if (bracket) {
    const rounds = bracket.rounds.length;
    const roundName = (r: number) => (r === rounds - 1 ? 'the Finals' : r === rounds - 2 ? 'the conference finals' : r === 0 ? 'the first round' : 'the second round');
    const best = (teamId: string) => league.teams.find(t => t.teamId === teamId)?.seasons.slice().sort((a, b) => calculateOverall(b) - calculateOverall(a));
    bracket.rounds.forEach((series, r) => series.forEach(s => {
      if (!s.winnerTeamId || !s.teamAId || !s.teamBId) return;
      const loserId = s.winnerTeamId === s.teamAId ? s.teamBId : s.teamAId;
      const order = league.schedule.length * 10 + r * 100 + s.slot;
      const title = r === rounds - 1 && bracket.championTeamId === s.winnerTeamId;
      const wb = best(s.winnerTeamId), lb = best(loserId);
      if (wb?.[0]) posts.push(make(title ? 'champion' : 'seriesWin', { p: wb[0], teamId: s.winnerTeamId }, { opp: teamName.get(loserId), round: roundName(r) }, `po|${s.id}|w`, title ? 'after winning the title' : `after winning ${roundName(r)}`, order + 2));
      if (title && wb?.[1]) posts.push(make('champion', { p: wb[1], teamId: s.winnerTeamId }, { opp: teamName.get(loserId) }, `po|${s.id}|w2`, 'after winning the title', order + 1.5));
      if (lb?.[0]) posts.push(make('eliminated', { p: lb[0], teamId: loserId }, { opp: teamName.get(s.winnerTeamId), round: roundName(r) }, `po|${s.id}|l`, `after losing in ${roundName(r)}`, order + 1));
    }));
  }
  // Last season's awards, rookies and retirements (they sit below this season's games).
  const lastSeason = league.franchiseHistory?.at(-1);
  if (lastSeason) {
    const awards: [string | null | undefined, string][] = [[lastSeason.mvpPlayerId, 'MVP'], [lastSeason.dpoyPlayerId, 'Defensive Player of the Year'], [lastSeason.royPlayerId, 'Rookie of the Year'], [lastSeason.fmvpPlayerId, 'Finals MVP']];
    awards.forEach(([id, award], k) => { const w = id ? who.get(id) : undefined; if (w) posts.push(make('award', w, { award }, `award|${lastSeason.season}|${award}|${id}`, `${lastSeason.season} ${award}`, -100 - k)); });
    for (const r of (league.retiredPlayers ?? []).filter(x => x.finalSeason === lastSeason.season && x.finalOverall >= 55 && !x.preStart).slice(-8)) {
      const years = (r.finalSeasonData?.careerHistory?.length ?? 0) + 1;
      const a: ChatAuthor = { playerId: r.playerId, name: r.playerId, handle: handleOf(r.playerId, r.finalSeasonData?.jerseyNumber), teamId: r.finalTeamId, type: r.finalSeasonData ? personalityOf(r.finalSeasonData).type : 'Professional', role: 'player', jersey: r.finalSeasonData?.jerseyNumber, verified: r.finalOverall >= 75 };
      posts.push(write('retired', a, { years }, `ret|${r.playerId}|${r.finalSeason}`, 'retirement', -150));
    }
  }
  const draftYears = [...new Set([...who.values()].map(w => w.p.draftYear).filter((y): y is string => !!y))].sort();
  const latestDraft = draftYears.at(-1);
  if (latestDraft && played.length < league.teams.length * 10) {
    const rookies = [...who.values()].filter(w => w.p.draftYear === latestDraft && w.teamId && !(w.p.careerHistory?.length)).sort((a, b) => (a.p.draftPick ?? 99) - (b.p.draftPick ?? 99)).slice(0, 8);
    rookies.forEach((w, k) => posts.push(make('rookie', w, { pick: w.p.draftPick ?? undefined }, `rookie|${w.p.playerId}|${latestDraft}`, w.p.draftPick ? `the #${w.p.draftPick} pick` : 'draft night', -120 - k)));
  }
  // Your posts, and the league's answers.
  for (const gp of gmPosts(league)) if (gp.season === (league.season ?? '')) posts.push(gmPost(league, gp, who, teamName, fullName));

  const team = opts.teamId;
  const mine = team ? posts.filter(p => p.author.teamId === team || p.replies.some(r => r.author.teamId === team) || (p.targetId && who.get(p.targetId)?.teamId === team)) : posts;
  return mine.sort((a, b) => b.order - a.order);
}

/** One of your posts, with the replies it gets. */
function gmPost(league: League, gp: GmPost, who: Map<string, Who>, teamName: Map<string, string>, fullName: Map<string, string>): ChatPost {
  const name = fullName.get(gp.teamId) ?? 'Team';
  const author: ChatAuthor = { playerId: `gm|${gp.teamId}`, name: `${name} GM`, handle: gmHandle(name), teamId: gp.teamId, type: 'Professional', role: 'gm', verified: true };
  const rng = new RNG(hash(gp.id));
  const approval = fanApproval(league, gp.teamId).score;
  const likes = Math.round((200 + rng.next() * 600) * (0.5 + approval / 100) * (gp.kind === 'rival' ? 2 : 1));
  const kind: ChatKind = gp.kind === 'praise' ? 'gmPraise' : gp.kind === 'callout' ? 'gmCallout' : gp.kind === 'rival' ? 'gmRival' : 'gmHype';
  const post: ChatPost = { id: gp.id, kind, author, text: gp.text, context: gp.kind === 'praise' ? 'shoutout' : gp.kind === 'callout' ? 'call-out' : gp.kind === 'rival' ? `to the ${teamName.get(gp.rivalTeamId ?? '') ?? 'rivals'}` : 'from the front office',
    likes, reposts: Math.round(likes * 0.15), replies: [], order: gp.at * 10 + 9, tags: ['#GMSays', `#${shortName(name).replace(/[^A-Za-z]/g, '')}`], targetId: gp.playerId, roast: gp.kind === 'callout' || gp.kind === 'rival' };
  const vars = { gm: author.handle, team: teamName.get(gp.teamId) };
  const reply = (kind: ChatKind, w: Who | undefined, key: string) => { if (w) post.replies.push(replyOf(kind, w, vars, `${gp.id}|${key}`)); };
  const roster = league.teams.find(t => t.teamId === gp.teamId)?.seasons ?? [];
  if (gp.kind === 'praise' || gp.kind === 'callout') reply(gp.kind === 'praise' ? 'gmPraiseReply' : 'gmCalloutReply', gp.playerId ? who.get(gp.playerId) : undefined, 'target');
  if (gp.kind === 'hype' || gp.kind === 'free') {
    const voices = [...roster].sort((a, b) => calculateOverall(b) - calculateOverall(a)).slice(0, 5);
    const pick = voices[Math.floor(rng.next() * voices.length)];
    if (pick) reply('gmHypeReply', who.get(pick.playerId), 'mate');
  }
  if (gp.kind === 'rival' && gp.rivalTeamId) {
    const theirs = league.teams.find(t => t.teamId === gp.rivalTeamId)?.seasons ?? [];
    const voice = [...theirs].sort((a, b) => personalityRank(b, true) - personalityRank(a, true))[0];
    if (voice) reply('gmRivalReply', who.get(voice.playerId), 'rival');
  }
  // A fan or two.
  const fans = 1 + Math.floor(rng.next() * 2);
  for (let k = 0; k < fans; k++) {
    const fan = fanOf(gp.teamId, name, hash(`${gp.id}|${k}`));
    const r = new RNG(hash(`${gp.id}|fan|${k}`));
    const list = templatesFor('fanGmReply', 'Professional');
    // Happier fans pick the first (positive) line more often.
    const i = r.next() * 100 < approval ? 0 : 1 + Math.floor(r.next() * (list.length - 1));
    const text = fill(expand(list[Math.min(i, list.length - 1)], () => r.next()), vars);
    post.replies.push({ id: `${gp.id}|fan|${k}`, kind: 'fanGmReply', author: fan, text, context: '', likes: Math.round(r.next() * 300), reposts: Math.round(r.next() * 20), replies: [], order: post.order, tags: [] });
  }
  return post;
}
function replyOf(kind: ChatKind, w: Who, vars: Record<string, string | undefined>, key: string): ChatPost {
  const a = authorOf(w);
  const rng = new RNG(hash(key));
  const list = templatesFor(kind, a.type);
  const text = fill(expand(list[Math.floor(rng.next() * list.length)] ?? '', () => rng.next()), vars);
  const likes = Math.round(100 + rng.next() * 1500);
  return { id: key, kind, author: a, text, context: '', likes, reposts: Math.round(likes * 0.1), replies: [], order: 0, tags: [] };
}

function mateHandle(lines: PlayerStatLine[], self: PlayerStatLine, who: Map<string, Who>): string | undefined {
  const m = lines.find(l => l !== self && l.points >= 8) ?? lines.find(l => l !== self);
  return m ? authorOf(who.get(m.playerId)!).handle : undefined;
}
/** Who speaks up: leaders and stars when winning, hotheads and leaders when losing. */
function personalityRank(p: PlayerSeason, winning: boolean): number {
  const t = personalityOf(p).type;
  const order: PersonalityType[] = winning ? ['Star Ego', 'Leader', 'Competitor', 'Hothead', 'Loyal', 'Mercenary', 'Professional'] : ['Hothead', 'Leader', 'Competitor', 'Star Ego', 'Loyal', 'Mercenary', 'Professional'];
  return (order.length - order.indexOf(t)) * 100 + (hash(p.playerId) % 50);
}

/* ---- for the page and the dashboard ---- */

/** The top hashtags in a feed. */
export function trending(feed: ChatPost[], n = 6): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of feed) for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1 + p.likes / 5000);
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, n).map(([tag, c]) => ({ tag, count: Math.round(c) }));
}
/** The most-liked post of the last week of games (about 3.5 games a team). */
export function postOfTheWeek(feed: ChatPost[], league: League): ChatPost | undefined {
  const last = league.schedule.reduce((m, g, i) => (g.played ? i : m), -1);
  const cut = (last - Math.round(league.teams.length * 1.75)) * 10;
  return feed.filter(p => p.order >= cut && p.author.role !== 'gm').sort((a, b) => b.likes - a.likes)[0];
}
