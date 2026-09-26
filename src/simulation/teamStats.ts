import type { League } from './league';
import { emptySeasonStatTotals, type SeasonStatTotals } from './types';
import { perGameAverages } from './careerStats';
import { regularSeasonContext } from './advancedStats';

export interface TeamStatsRow {
  teamId: string;
  teamName: string;
  gamesPlayed: number;
  ppg: number;
  oppPpg: number;
  netRating: number; // point differential per game (kept for existing callers)
  wins: number; losses: number;
  ortg: number; drtg: number; netRtg: number; pace: number; // per 100 possessions, from the season's box scores
  spg: number; bpg: number; tpmPg: number;
  oppFgPct: number; oppTpPct: number; oppRpg: number; oppTovPg: number;
  fgPct: number;
  tpPct: number;
  ftPct: number;
  rpg: number;
  apg: number;
  tovPg: number;
}

/** Team-level leaderboard: scoring (from the schedule's actual results) plus shooting/rebounding/assist/
 * turnover splits (summed from every rostered player's own season totals). */
export function computeTeamStats(league: League): TeamStatsRow[] {
  const ctx = regularSeasonContext(league);
  return league.teams.map((t) => {
    const c = ctx.teams.get(t.teamId);
    let pointsFor = 0, pointsAgainst = 0, gamesPlayed = 0;
    for (const g of league.schedule) {
      if (!g.played || !g.result) continue;
      if (g.homeTeamId === t.teamId) { pointsFor += g.result.homeScore; pointsAgainst += g.result.awayScore; gamesPlayed++; }
      else if (g.awayTeamId === t.teamId) { pointsFor += g.result.awayScore; pointsAgainst += g.result.homeScore; gamesPlayed++; }
    }

    let totals: SeasonStatTotals = emptySeasonStatTotals();
    for (const s of t.seasons) {
      const st = s.seasonStats;
      if (!st) continue;
      totals = {
        gamesPlayed: totals.gamesPlayed + st.gamesPlayed, minutes: totals.minutes + st.minutes, points: totals.points + st.points,
        fgm: totals.fgm + st.fgm, fga: totals.fga + st.fga, tpm: totals.tpm + st.tpm, tpa: totals.tpa + st.tpa,
        ftm: totals.ftm + st.ftm, fta: totals.fta + st.fta, oreb: totals.oreb + st.oreb, dreb: totals.dreb + st.dreb,
        ast: totals.ast + st.ast, stl: totals.stl + st.stl, blk: totals.blk + st.blk, tov: totals.tov + st.tov,
        pf: totals.pf + st.pf, ba: totals.ba + st.ba, blkAtt: totals.blkAtt + st.blkAtt, clutchPoints: totals.clutchPoints + st.clutchPoints,
      };
    }
    const avg = perGameAverages(totals); // fgPct/tpPct/ftPct are plain ratios (makes/attempts), safe regardless of denominator
    const gp = Math.max(1, gamesPlayed); // the TEAM's actual games played — totals.gamesPlayed is the sum of every player's individual games, not the same number

    return {
      teamId: t.teamId,
      teamName: t.name,
      gamesPlayed,
      ppg: pointsFor / gp,
      oppPpg: pointsAgainst / gp,
      netRating: (pointsFor - pointsAgainst) / gp,
      fgPct: avg.fgPct,
      tpPct: avg.tpPct,
      ftPct: avg.ftPct,
      rpg: (totals.oreb + totals.dreb) / gp,
      apg: totals.ast / gp,
      tovPg: totals.tov / gp,
      wins: c?.wins ?? 0, losses: c?.losses ?? 0,
      ortg: c?.ortg ?? 0, drtg: c?.drtg ?? 0, netRtg: c?.net ?? 0, pace: c?.pace ?? 0,
      spg: totals.stl / gp, bpg: totals.blk / gp, tpmPg: totals.tpm / gp,
      oppFgPct: c && c.opp.fga > 0 ? c.opp.fgm / c.opp.fga : 0, oppTpPct: c && c.opp.tpa > 0 ? c.opp.tpm / c.opp.tpa : 0,
      oppRpg: c ? (c.opp.oreb + c.opp.dreb) / gp : 0, oppTovPg: c ? c.opp.tov / gp : 0,
    };
  });
}
