/*
 * AI front-office audit: plays several seasons with every team run by the AI (the in-season AI pass after each week,
 * as the game does, then the draft and free agency) and reports what the front offices did: roster sizes, payrolls,
 * trades, who was left unsigned, how the draft went and how balanced the league stays.
 *   npm run bench:ai [-- seasons seed]
 */
import { generateFullLeague } from '../../src/simulation/leagueGenerator';
import { simulateDays, isAllStarBreakPending, computeStandings, type League } from '../../src/simulation/league';
import { initializeCoaching } from '../../src/simulation/staffManagement';
import { ensureFrontOffice } from '../../src/simulation/frontOffice';
import { setupCup } from '../../src/simulation/cup';
import { manageCoachRosters } from '../../src/simulation/coachRosters';
import { runLeagueAIPass, type ExecutedAITrade } from '../../src/simulation/aiGM';
import { autoPlayToDraft, autoPlayFromDraft, autoRunAllStarWeekend } from '../../src/simulation/autoPlay';
import { calculateOverall } from '../../src/simulation/engine/overall';
import { primaryPosition } from '../../src/simulation/teamStatus';
import type { GMLeagueExtras } from '../../src/simulation/gm';
import { DEFAULT_AWARD_SETTINGS } from '../../src/simulation/awards';
import { signingDecision } from '../../src/simulation/freeAgentDecision';
import { capSpaceRemaining, computeTradeValue } from '../../src/simulation/gm';

const SEASONS = Number(process.argv[2] ?? 4), SEED = Number(process.argv[3] ?? 21);
// New random leagues in the game are dealt out balanced; UNBALANCED=1 audits the original random rosters.
const gen = generateFullLeague(SEED, 30, 14, 82, '2026', { balanced: !process.env.UNBALANCED });
const firstTeam = gen.league.teams[0].teamId;
let league: League = ensureFrontOffice(setupCup(initializeCoaching(gen.league, firstTeam)), firstTeam);
let extras: GMLeagueExtras = gen.extras;
({ league, extras } = manageCoachRosters(league, extras));

const ovr = calculateOverall;
const pct = (n: number) => `${(n * 100).toFixed(0)}%`;
const m = (n: number) => `$${(n / 1e6).toFixed(0)}M`;
const top8 = (l: League, teamId: string) => { const r = l.teams.find(t => t.teamId === teamId)!.seasons.map(ovr).sort((a, b) => b - a).slice(0, 8); return r.reduce((a, b) => a + b, 0) / Math.max(1, r.length); };
const sd = (xs: number[]) => { const mu = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, b) => a + (b - mu) ** 2, 0) / xs.length); };

function snapshot(tag: string, l: League, e: GMLeagueExtras) {
  const cap = e.capSettings;
  const sizes = l.teams.map(t => t.seasons.length);
  const pay = l.teams.map(t => t.seasons.reduce((n, p) => n + (e.contracts[p.playerId]?.annualSalary ?? 0), 0));
  const noContract = l.teams.flatMap(t => t.seasons.filter(p => !e.contracts[p.playerId] || e.contracts[p.playerId].teamId !== t.teamId).map(p => `${p.playerId}@${t.teamId}`));
  const expired = l.teams.flatMap(t => t.seasons.filter(p => (e.contracts[p.playerId]?.yearsRemaining ?? 1) <= 0).map(p => p.playerId));
  const overMax = Object.values(e.contracts).filter(c => c.annualSalary > cap.salaryCap * cap.maxSalaryPctOfCap * 1.001).length;
  const strengths = l.teams.map(t => top8(l, t.teamId));
  const allOvr = l.teams.flatMap(t => t.seasons.map(ovr)).sort((a, b) => b - a);
  const starLine = allOvr[Math.floor(allOvr.length * 0.1)];
  const faTop = [...e.freeAgents].sort((a, b) => ovr(b) - ovr(a)).slice(0, 5).map(p => `${p.playerId} ${ovr(p)} (${p.age})`);
  const faStars = e.freeAgents.filter(p => ovr(p) >= starLine).length;
  const posHoles = l.teams.filter(t => { const best = [...t.seasons].sort((a, b) => ovr(b) - ovr(a)).slice(0, 9).map(primaryPosition); return !best.some(p => p === 'C' || p === 'PF') || !best.some(p => p === 'PG' || p === 'SG'); }).map(t => t.teamId);
  const ages = l.teams.flatMap(t => t.seasons.map(p => p.age));
  const faAges = e.freeAgents.map(p => p.age), faOvr = e.freeAgents.map(ovr);
  const band = (lo: number, hi: number) => faAges.filter(a => a >= lo && a <= hi).length;
  console.log(`\n[${tag}] ${l.season} rosters ${Math.min(...sizes)}-${Math.max(...sizes)} (below min ${sizes.filter(s => s < cap.minRosterSize).length}) · avg age ${(ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1)}`);
  console.log(`  FA pool by age: ≤22 ${band(0, 22)}, 23-29 ${band(23, 29)}, 30-33 ${band(30, 33)}, 34+ ${band(34, 99)} · rated 50+ ${faOvr.filter(o => o >= 50).length}, under 40 ${faOvr.filter(o => o < 40).length}`);
  console.log(`  payroll ${m(Math.min(...pay))}-${m(Math.max(...pay))} · over cap ${pay.filter(p => p > cap.salaryCap).length} · over tax ${pay.filter(p => p > cap.luxuryTaxLine).length} · over max contract ${overMax} · no/foreign contract ${noContract.length}${noContract.length ? ' ' + noContract.slice(0, 3).join(', ') : ''} · expired on roster ${expired.length}`);
  console.log(`  strength (top-8 ovr) ${Math.min(...strengths).toFixed(1)}-${Math.max(...strengths).toFixed(1)} sd ${sd(strengths).toFixed(2)} · top-10% line ${starLine} · FA pool ${e.freeAgents.length}, stars unsigned ${faStars}: ${faTop.join('; ')}`);
  if (process.env.DIAG) for (const fa of [...e.freeAgents].sort((a, b) => ovr(b) - ovr(a)).slice(0, 3)) {
    const why: Record<string, number> = {};
    for (const t of l.teams) {
      const room = capSpaceRemaining(e.contracts, t, cap);
      const eighth = t.seasons.map(computeTradeValue).sort((a, b) => b - a)[7] ?? 0;
      const q = signingDecision(l, e, fa, t.teamId);
      const k = q.refuses ? 'refuses: ' + q.reason.slice(0, 50) : q.required > Math.max(room, cap.minSalary) ? 'no room' : computeTradeValue(fa) < eighth + 6 ? 'not upgrade' : 'possible';
      why[k] = (why[k] ?? 0) + 1;
    }
    console.log(`   ${fa.playerId} ${ovr(fa)} val ${computeTradeValue(fa).toFixed(1)} asks ${m(signingDecision(l, e, fa, l.teams[0].teamId).required)}:`, JSON.stringify(why));
  }
  if (posHoles.length) console.log(`  teams with no guard or no big in their top 9: ${posHoles.length}`);
  return { strengths };
}

const allTrades: { season: string; t: ExecutedAITrade; ovrA: number; ovrB: number; ageA: number; ageB: number }[] = [];
const champions: string[] = [];
let signingsInSeason = 0;
const buyerDelta: number[] = [], sellerDelta: number[] = [];
snapshot('start', league, extras);
for (let s = 0; s < SEASONS; s++) {
  const seed = SEED * 1000 + s * 97;
  const season = league.season!;
  let passes = 0;
  const before = new Map(league.teams.map(t => [t.teamId, top8(league, t.teamId)]));
  while (league.schedule.some(g => !g.played) && passes < 60) {
    league = simulateDays(league, 7, seed + passes);
    if (isAllStarBreakPending(league)) league = autoRunAllStarWeekend(league, DEFAULT_AWARD_SETTINGS, seed + 5).league;
    if (league.deadlineDay) { const { deadlineDay: _d, ...rest } = league; league = rest; }
    const own = new Map(league.teams.flatMap(t => t.seasons.map(p => [p.playerId, p] as const)));
    const ai = runLeagueAIPass(league, extras, null, seed + 500 + passes);
    for (const t of ai.trades) {
      const oldest = (ids: string[]) => Math.max(0, ...ids.map(id => own.get(id)?.age ?? 0));
      const buyer = oldest(t.playersFromB) >= oldest(t.playersFromA) ? t.teamAId : t.teamBId, seller = buyer === t.teamAId ? t.teamBId : t.teamAId;
      buyerDelta.push(top8(ai.league, buyer) - top8(league, buyer)); sellerDelta.push(top8(ai.league, seller) - top8(league, seller));
    }
    for (const t of ai.trades) {
      const val = (ids: string[]) => ids.map(id => own.get(id)).filter(Boolean).map(p => ovr(p!));
      const a = val(t.playersFromA), b = val(t.playersFromB);
      const age = (ids: string[]) => Math.max(0, ...ids.map(id => own.get(id)?.age ?? 0));
      allTrades.push({ season, t, ovrA: Math.max(0, ...a), ovrB: Math.max(0, ...b), ageA: age(t.playersFromA), ageB: age(t.playersFromB) });
    }
    signingsInSeason += ai.signings.length;
    league = ai.league; extras = ai.extras; passes++;
  }
  const standings = computeStandings(league);
  const wp = standings.map(r => r.winPct);
  const tradesThis = allTrades.filter(x => x.season === season);
  // Did trades make the traders better? Buyers' top-8 before vs after.
  const movers = [...new Set(tradesThis.flatMap(x => [x.t.teamAId, x.t.teamBId]))];
  const delta = movers.map(id => top8(league, id) - (before.get(id) ?? 0));
  console.log(`\n=== ${season}: ${passes} AI passes · trades ${tradesThis.length} (${tradesThis.filter(x => x.t.picksFromA?.length || x.t.picksFromB?.length).length} with picks) · in-season signings ${signingsInSeason} · win% ${pct(Math.min(...wp))}-${pct(Math.max(...wp))} sd ${sd(wp).toFixed(3)}`);
  for (const x of tradesThis.slice(0, 6)) console.log(`   ${x.t.teamAName} give ${x.t.playersFromA.join('+')}${x.t.picksFromA?.length ? ` +${x.t.picksFromA.length} pick` : ''} (${x.ovrA}/${x.ageA}y) ⇄ ${x.t.teamBName} give ${x.t.playersFromB.join('+')}${x.t.picksFromB?.length ? ` +${x.t.picksFromB.length} pick` : ''} (${x.ovrB}/${x.ageB}y)`);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0).toFixed(2);
  if (movers.length) console.log(`   top-8 change per trade: buyers ${avg(buyerDelta)}, sellers ${avg(sellerDelta)} · movers over the season ${avg(delta)}`);
  buyerDelta.length = 0; sellerDelta.length = 0;
  signingsInSeason = 0;

  const half = autoPlayToDraft(league, extras, null, DEFAULT_AWARD_SETTINGS, seed);
  champions.push(half.partial.championTeamName ?? '?');
  const prospects = [...half.extras.draftClass].sort((a, b) => (b.trueSeason.development?.potential ?? 0) - (a.trueSeason.development?.potential ?? 0));
  const bestIds = prospects.slice(0, 5).map(p => p.playerId);
  const done = autoPlayFromDraft(half.league, half.extras, half.controlledTeamId, seed, half.partial);
  const slots = bestIds.map(id => { const i = done.draftPicks.findIndex(p => p.playerId === id); return i < 0 ? 'UD' : String(i + 1); });
  console.log(`   champion ${champions.at(-1)} · draft: the 5 highest true potentials went at picks ${slots.join(', ')} of ${done.draftPicks.length}`);
  league = done.league; extras = done.extras;
  snapshot('after FA', league, extras);
}
const counts = champions.reduce<Record<string, number>>((a, c) => ({ ...a, [c]: (a[c] ?? 0) + 1 }), {});
console.log(`\nchampions: ${Object.entries(counts).map(([c, n]) => `${c} ×${n}`).join(', ')} · total AI trades ${allTrades.length}`);
