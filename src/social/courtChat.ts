import type { League } from '../simulation/league';
import type { PlayerSeason } from '../simulation/types';
import type { PlayerStatLine } from '../simulation/boxscore';
import { personalityOf, type PersonalityType } from '../simulation/personality';
import { RNG } from '../simulation/engine/rng';
import { templatesFor, expand, fill, type ChatKind } from './chatTemplates';

/*
 * CourtChat: the league's social feed. Players post after games, streaks, injuries and trades, in their own voice
 * (their personality, personality.ts), and roast each other after bad nights; the roasted sometimes clap back and
 * teammates hype each other. Everything is derived from what already happened in the league and seeded by it, so
 * the same league always shows the same feed and nothing new is saved.
 */

export interface ChatAuthor { playerId: string; name: string; handle: string; teamId: string | null; type: PersonalityType; jersey?: number }
export interface ChatPost {
  id: string;
  kind: ChatKind;
  author: ChatAuthor;
  text: string;
  /** What it's about: a game, for the "after the 112-104 win" line. */
  context: string;
  likes: number;
  reposts: number;
  /** Replies under the post (clapbacks and teammates). */
  replies: ChatPost[];
  /** Newest first: higher is newer. */
  order: number;
  /** A roast: someone gets called out. */
  roast?: boolean;
  /** Who the post is about, if anyone. */
  targetId?: string;
}

function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/** "@jbrown7": first initial, last name, jersey number. */
export function handleOf(name: string, jersey?: number): string {
  const parts = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z .'-]/g, '').trim().split(/\s+/);
  const last = (parts.at(-1) ?? 'hooper').replace(/[^A-Za-z]/g, '').toLowerCase();
  const first = parts.length > 1 ? parts[0][0].toLowerCase() : '';
  return `@${first}${last}${jersey ?? ''}`.slice(0, 18);
}
const shortName = (teamName: string) => teamName.split(' ').at(-1) ?? teamName;

interface Who { p: PlayerSeason; teamId: string | null }
function index(league: League): Map<string, Who> {
  const m = new Map<string, Who>();
  for (const t of league.teams) for (const p of t.seasons) m.set(p.playerId, { p, teamId: t.teamId });
  return m;
}
function authorOf(w: Who): ChatAuthor {
  const jersey = w.p.jerseyNumber;
  return { playerId: w.p.playerId, name: w.p.playerId, handle: handleOf(w.p.playerId, jersey), teamId: w.teamId, type: personalityOf(w.p).type, jersey };
}
const reb = (l: PlayerStatLine) => l.oreb + l.dreb;
const fgLine = (l: PlayerStatLine) => `${l.fgm}-for-${l.fga}`;
const isBad = (l: PlayerStatLine) => l.fga >= 10 && l.fgm / l.fga < 0.36;
const tripleDouble = (l: PlayerStatLine) => [l.points, reb(l), l.ast].filter(n => n >= 10).length >= 3;

export interface FeedOptions { /** Only posts by (or about) this team. */ teamId?: string | null; /** How many recent games to read. */ games?: number }

/** The feed, newest first. */
export function courtChatFeed(league: League, opts: FeedOptions = {}): ChatPost[] {
  const who = index(league);
  const teamName = new Map(league.teams.map(t => [t.teamId, shortName(t.name)]));
  const posts: ChatPost[] = [];
  const played = league.schedule.map((g, i) => ({ g, i })).filter(x => x.g.played && x.g.result);
  const recent = played.slice(-(opts.games ?? 40));

  const make = (kind: ChatKind, w: Who, vars: Record<string, string | number | undefined>, seedKey: string, context: string, order: number, extra: Partial<ChatPost> = {}): ChatPost => {
    const a = authorOf(w);
    const rng = new RNG(hash(seedKey));
    const list = templatesFor(kind, a.type);
    const tpl = list[Math.floor(rng.next() * list.length)] ?? '';
    const text = fill(expand(tpl, () => rng.next()), { team: teamName.get(w.teamId ?? '') ?? 'the team', ...vars });
    const heat = kind === 'roast' || kind === 'bigNight' ? 3 : kind === 'clapback' ? 2 : 1;
    const likes = Math.round((40 + rng.next() * 900) * heat * (a.type === 'Star Ego' ? 1.6 : 1));
    return { id: seedKey, kind, author: a, text, context, likes, reposts: Math.round(likes * (0.05 + rng.next() * 0.2)), replies: [], order, ...extra };
  };

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

    // The winner's best player.
    const star = winners[0];
    if (star && rng.next() < 0.75) {
      const kind: ChatKind = star.points >= 30 || tripleDouble(star) ? 'bigNight' : 'win';
      const post = make(kind, who.get(star.playerId)!, { pts: star.points, reb: reb(star), ast: star.ast, score, opp: teamName.get(loseId), fg: fgLine(star), mate: mateHandle(winners, star, who) }, `${g.id}|${star.playerId}|${kind}`, ctxW, base + 5);
      // A teammate hypes a big night.
      const mate = winners[1];
      if (kind === 'bigNight' && mate && rng.next() < 0.7) post.replies.push(make('hype', who.get(mate.playerId)!, { target: post.author.handle }, `${g.id}|${mate.playerId}|hype`, ctxW, base + 4));
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
  }

  // Streaks right now: someone on the team says something.
  const lastOrder = (recent.at(-1)?.i ?? 0) * 10 + 8;
  for (const t of league.teams) {
    const results = played.filter(x => x.g.homeTeamId === t.teamId || x.g.awayTeamId === t.teamId).map(x => { const r = x.g.result!; return (x.g.homeTeamId === t.teamId) === (r.homeScore > r.awayScore); });
    let n = 0; const last = results.at(-1);
    for (let k = results.length - 1; k >= 0 && results[k] === last; k--) n++;
    if (n < 5 || last == null) continue;
    const roster = [...t.seasons].sort((a, b) => personalityRank(b, !!last) - personalityRank(a, !!last));
    const p = roster[0];
    if (p) posts.push(make(last ? 'winStreak' : 'loseStreak', { p, teamId: t.teamId }, { streak: n }, `streak|${t.teamId}|${results.length}`, last ? `${n} wins in a row` : `${n} losses in a row`, lastOrder));
  }
  // Injuries: the injured player checks in.
  for (const inj of Object.values(league.injuries ?? {})) {
    const w = who.get(inj.playerId);
    if (!w || inj.gamesRemaining < 3) continue;
    posts.push(make('injury', w, { games: inj.gamesRemaining }, `inj|${inj.playerId}|${inj.totalGames}`, `${inj.severity} injury`, lastOrder - 1));
  }
  // Trades this season: the traded player says goodbye.
  for (const n of (league.newsArchive ?? []).filter(x => x.category === 'Transactions' && x.playerId && x.season === league.season && /trade/i.test(x.headline)).slice(-12)) {
    const w = who.get(n.playerId!);
    if (!w || !w.teamId) continue;
    const old = league.teams.find(t => t.teamId !== w.teamId && n.headline.includes(t.name));
    posts.push(make('traded', w, { newTeam: teamName.get(w.teamId), oldTeam: old ? shortName(old.name) : 'my old team' }, `trade|${n.id}`, 'after the trade', lastOrder - 2 - (n.order ?? 0) / 1e9));
  }

  const team = opts.teamId;
  const mine = team ? posts.filter(p => p.author.teamId === team || p.replies.some(r => r.author.teamId === team) || (p.targetId && who.get(p.targetId)?.teamId === team)) : posts;
  return mine.sort((a, b) => b.order - a.order);
}

function mateHandle(lines: PlayerStatLine[], self: PlayerStatLine, who: Map<string, Who>): string | undefined {
  const m = lines.find(l => l !== self && l.points >= 8) ?? lines.find(l => l !== self);
  return m ? authorOf(who.get(m.playerId)!).handle : undefined;
}
/** Who speaks up on a streak: leaders and competitors when winning, hotheads and leaders when losing. */
function personalityRank(p: PlayerSeason, winning: boolean): number {
  const t = personalityOf(p).type;
  const order: PersonalityType[] = winning ? ['Star Ego', 'Leader', 'Competitor', 'Hothead', 'Loyal', 'Mercenary', 'Professional'] : ['Hothead', 'Leader', 'Competitor', 'Star Ego', 'Loyal', 'Mercenary', 'Professional'];
  return (order.length - order.indexOf(t)) * 100 + (hash(p.playerId) % 50);
}
