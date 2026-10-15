import type { League } from './league';
import type { GMLeagueExtras, TradeProposal } from './gm';
import { validateTrade, computeFutureDraftPickValue, tradeableFuturePicks, tradeTolerance } from './gm';
import { tradeAssetValue, pickAssetValue, packageValue } from './tradeValue';
import { isStuck } from './sticky';
import type { PlayerSeason } from './types';

/*
 * Seek trade: you put players and picks on the block, press the button, and every AI front office answers at once.
 * Each team builds the best package it can from its roster and picks that both sides would sign off on (the same
 * value and salary rules as any trade), so every offer shown can be accepted on the spot.
 */
export interface SoughtOffer { proposal: TradeProposal; yourValue: number; theirValue: number }

interface Asset { kind: 'player' | 'pick'; id: string; you: number; them: number }

/** Every way a team can answer, up to three players plus a pick. */
function combos(assets: Asset[], maxPlayers = 3): Asset[][] {
  const players = assets.filter(a => a.kind === 'player'), picks = assets.filter(a => a.kind === 'pick');
  const out: Asset[][] = [];
  const add = (set: Asset[]) => { out.push(set); for (const pk of picks.slice(0, 4)) out.push([...set, pk]); };
  for (const pk of picks.slice(0, 4)) out.push([pk]);
  for (let i = 0; i < players.length; i++) {
    add([players[i]]);
    for (let j = i + 1; j < players.length; j++) {
      add([players[i], players[j]]);
      if (maxPlayers >= 3) for (let k = j + 1; k < Math.min(players.length, j + 5); k++) add([players[i], players[j], players[k]]);
    }
  }
  return out;
}

export function seekTradeOffers(league: League, extras: GMLeagueExtras, userTeamId: string, wanted = 12): SoughtOffer[] {
  const me = league.teams.find(t => t.teamId === userTeamId);
  if (!me) return [];
  const year = parseInt((league.season ?? '2026').slice(0, 4), 10);
  const outPlayers = me.seasons.filter(p => extras.tradeBlock.includes(p.playerId) && !isStuck(p));
  const outPicks = tradeableFuturePicks(extras, userTeamId).filter(p => (extras.picksOnBlock ?? []).includes(p.id));
  if (!outPlayers.length && !outPicks.length) return [];
  const tol = tradeTolerance(extras);
  const pickValue = (id: string, viewer: string) => { const pk = extras.futurePicks?.find(x => x.id === id); return pk ? pickAssetValue(computeFutureDraftPickValue(pk, league, year), league, viewer) : 0; };
  const giveMine = outPlayers.reduce((n, p) => n + tradeAssetValue(p, league, extras, userTeamId), 0) + outPicks.reduce((n, p) => n + pickValue(p.id, userTeamId), 0);

  const perTeam: SoughtOffer[][] = [];
  for (const team of league.teams) {
    if (team.teamId === userTeamId) continue;
    // What our package is worth to them, and what each of their assets is worth to each side.
    const theirReceive = packageValue(outPlayers.map(p => tradeAssetValue(p, league, extras, team.teamId)), 1) + outPicks.reduce((n, p) => n + pickValue(p.id, team.teamId), 0);
    const roster: PlayerSeason[] = team.seasons.filter(p => !isStuck(p));
    const assets: Asset[] = [
      ...roster.map(p => ({ kind: 'player' as const, id: p.playerId, you: tradeAssetValue(p, league, extras, userTeamId), them: tradeAssetValue(p, league, extras, team.teamId) })),
      ...tradeableFuturePicks(extras, team.teamId).map(pk => ({ kind: 'pick' as const, id: pk.id, you: pickValue(pk.id, userTeamId), them: pickValue(pk.id, team.teamId) })),
    ].sort((a, b) => b.you - a.you).slice(0, 14);
    const candidates = combos(assets)
      .map(set => {
        const players = set.filter(a => a.kind === 'player');
        const youGet = packageValue(players.map(a => a.you), outPlayers.length || 1) + set.filter(a => a.kind === 'pick').reduce((n, a) => n + a.you, 0);
        const theyGive = set.reduce((n, a) => n + a.them, 0);
        return { set, youGet, theyGive };
      })
      // Both sides must be within the league's trade tolerance; the team prefers to give up as little as it can.
      .filter(c => c.youGet >= giveMine * (1 - tol) && theirReceive >= c.theyGive * (1 - tol))
      .sort((a, b) => a.theyGive - b.theyGive || b.youGet - a.youGet);
    const valid: SoughtOffer[] = [];
    for (const c of candidates.slice(0, 40)) {
      const proposal: TradeProposal = {
        teamAId: userTeamId, teamBId: team.teamId,
        playersFromA: outPlayers.map(p => p.playerId), picksFromA: outPicks.map(p => p.id),
        playersFromB: c.set.filter(a => a.kind === 'player').map(a => a.id), picksFromB: c.set.filter(a => a.kind === 'pick').map(a => a.id),
        note: `${team.name} answered your trade block.`,
      };
      if (!validateTrade(league, extras, proposal).valid) continue;
      valid.push({ proposal, yourValue: c.youGet, theirValue: c.theyGive });
      if (valid.length >= 4) break;
    }
    perTeam.push(valid);
  }
  // Every team's best package first, then second choices, until there are enough offers.
  const offers: SoughtOffer[] = [];
  for (let round = 0; round < 4 && offers.length < wanted; round++) {
    const layer = perTeam.map(v => v[round]).filter((o): o is SoughtOffer => !!o).sort((a, b) => b.yourValue - a.yourValue);
    offers.push(...(round === 0 ? layer : layer.slice(0, wanted - offers.length)));
  }
  return offers;
}
