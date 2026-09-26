import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import type { AwardWinner } from '../simulation/awards';
import type { PlayerSeason } from '../simulation/types';
import type { RatingFrame, RealPlayerInfo, RealPlayerSeed } from './realPlayers';
import { NBA_HISTORY_DATASET } from './datasetInfo';
import { cityName } from './teamNames';

/* Leagues created with the first NBA history data (nba-history.v1) stored reference ratings on another scale and
 * official team names. This converts them once, on load: ratings to Court Vision's Overall scale (labelled
 * "legacy"), team names to city names. Idempotent; other leagues are returned untouched. */

const V1_SCALE: [number, number][] = [[40, 20], [60, 28], [65, 34], [69, 40], [71, 45], [74, 51], [77, 58], [81, 65], [86, 72], [90, 78], [93, 86], [96, 90], [99, 94]];
function v1ToOverall(v: number): number {
  if (v <= V1_SCALE[0][0]) return V1_SCALE[0][1];
  for (let i = 1; i < V1_SCALE.length; i++) if (v <= V1_SCALE[i][0]) {
    const [x0, y0] = V1_SCALE[i - 1], [x1, y1] = V1_SCALE[i];
    return Math.round(y0 + (y1 - y0) * (v - x0) / (x1 - x0));
  }
  return V1_SCALE[V1_SCALE.length - 1][1];
}

type V1Rating = { ovr2k?: number; ovr?: number; source: string; startYear: number; kind?: 'reference' | 'interpolated' };
const convertRating = (r: V1Rating) => ({ ovr: r.ovr ?? v1ToOverall(r.ovr2k ?? 60), source: r.ovr != null ? r.source : 'legacy', startYear: r.startYear, ...(r.kind ? { kind: r.kind } : {}) });
const convertFrames = (frames: RatingFrame[] | undefined) => frames?.map(([y, v, src]) => [y, v1ToOverall(v), src === 'interpolated' ? src : 'legacy'] as RatingFrame);

function convertPlayer<T extends PlayerSeason | undefined>(p: T): T {
  if (!p) return p;
  const real = p.real as (RealPlayerInfo & { rating: V1Rating }) | undefined;
  const careerHistory = p.careerHistory?.map(c => {
    const r = c.rating as unknown as { ovr2k?: number; ovr?: number; source: string } | undefined;
    return r && r.ovr == null ? { ...c, rating: { ovr: v1ToOverall(r.ovr2k ?? 60), source: 'legacy' } } : c;
  });
  const historicalAwards = p.historicalAwards?.map(a => (a.detail?.includes(' (credit:') ? { ...a, detail: cityName(a.detail.slice(0, a.detail.indexOf(' (credit:'))) + a.detail.slice(a.detail.indexOf(' (credit:')) } : a));
  return { ...p, careerHistory, historicalAwards, ...(real ? { real: { ...real, rating: convertRating(real.rating), frames: convertFrames(real.frames) } } : {}) };
}
const convertSeed = <S extends RealPlayerSeed>(seed: S): S => ({ ...seed, rating: convertRating(seed.rating as unknown as V1Rating), frames: convertFrames(seed.frames) ?? [] });
const city = <W extends Pick<AwardWinner, 'teamName' | 'teamId'> | null | undefined>(w: W): W => (w ? { ...w, teamName: w.teamName && w.teamName !== '—' ? cityName(w.teamName, w.teamId) : w.teamName } : w);

export function migrateHistoricalLeague(league: League, extras: GMLeagueExtras): { league: League; extras: GMLeagueExtras; migrated: boolean } {
  const meta = league.historical;
  if (!meta || meta.dataset !== 'nba-history.v1') return { league, extras, migrated: false };
  const teams = league.teams.map(t => ({ ...t, name: cityName(t.name, t.teamId), seasons: t.seasons.map(convertPlayer) }));
  const franchiseHistory = league.franchiseHistory?.map(rec => {
    const a = rec.fullAwards;
    const fullAwards = a ? {
      ...a, mvp: city(a.mvp), dpoy: city(a.dpoy), roy: city(a.roy), mip: city(a.mip), smoy: city(a.smoy), cpoy: city(a.cpoy),
      coy: a.coy ? { ...a.coy, teamName: cityName(a.coy.teamName, a.coy.teamId) } : a.coy,
      allNBA: a.allNBA.map(t => t.map(city)), allDefense: a.allDefense.map(t => t.map(city)), allRookie: a.allRookie.map(t => t.map(city)), allStars: a.allStars.map(city),
      ballots: Object.fromEntries(Object.entries(a.ballots ?? {}).map(([k, v]) => [k, (v ?? []).map(city)])),
    } : a;
    return {
      ...rec, fullAwards,
      championTeamName: rec.championTeamName ? cityName(rec.championTeamName, rec.championTeamId) : rec.championTeamName,
      mvpTeamName: rec.mvpTeamName ? cityName(rec.mvpTeamName) : rec.mvpTeamName,
      teamSeasons: rec.teamSeasons?.map(ts => ({ ...ts, teamName: cityName(ts.teamName, ts.teamId) })),
    } as typeof rec;
  });
  const retiredPlayers = league.retiredPlayers?.map(r => ({ ...r, finalTeamName: cityName(r.finalTeamName, r.finalTeamId), finalSeasonData: convertPlayer(r.finalSeasonData) }));
  const historical = {
    ...meta, dataset: NBA_HISTORY_DATASET,
    futureClasses: Object.fromEntries(Object.entries(meta.futureClasses).map(([k, seeds]) => [k, seeds.map(convertSeed)])),
    futureDebuts: Object.fromEntries(Object.entries(meta.futureDebuts).map(([k, seeds]) => [k, seeds.map(convertSeed)])),
    cityNames: Object.fromEntries(teams.map(t => [t.teamId, t.name])),
    notes: [...meta.notes, 'Converted from the first NBA history data version: ratings moved to Court Vision\'s scale (labelled "legacy") and official team names replaced by city names.'],
  };
  return {
    league: { ...league, teams, franchiseHistory, retiredPlayers, historical },
    extras: { ...extras, freeAgents: extras.freeAgents.map(convertPlayer), draftClass: extras.draftClass.map(d => ({ ...d, trueSeason: convertPlayer(d.trueSeason) })) },
    migrated: true,
  };
}
