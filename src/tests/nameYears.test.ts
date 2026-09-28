import { describe, it, expect } from 'vitest';
import { yearFreeNames, stripNameYears } from '../history/nameYears';
import { generateFullLeague } from '../simulation/leagueGenerator';

describe('year-free player names', () => {
  it('uses Jr. across a generation and II otherwise, never a year', () => {
    const names = yearFreeNames([
      { displayName: 'Patrick Ewing', birthDate: '1962-08-05', firstSeason: 1985 },
      { displayName: 'Patrick Ewing (2011)', birthDate: '1984-05-20', firstSeason: 2011 },
      { displayName: 'Mark Davis (1988)', birthDate: '1963-04-15', firstSeason: 1988 },
      { displayName: 'Mark Davis (1996)', birthDate: '1973-04-26', firstSeason: 1996 },
      { displayName: 'Tim Hardaway Jr. (2014)', birthDate: '1992-03-16', firstSeason: 2014 },
    ]);
    expect(names).toEqual(['Patrick Ewing', 'Patrick Ewing Jr.', 'Mark Davis', 'Mark Davis II', 'Tim Hardaway Jr.']);
  });

  it('renames an older save everywhere the name appears', () => {
    const { league, extras } = generateFullLeague(3, 4, 10, 4, '2026');
    const old = league.teams[0].seasons[0].playerId;
    const tagged = `${old} (1999)`;
    const l = { ...league, teams: league.teams.map((t, i) => i ? t : { ...t, seasons: t.seasons.map((s, j) => j ? s : { ...s, playerId: tagged }) }) };
    const e = { ...extras, contracts: { ...extras.contracts, [tagged]: { ...extras.contracts[old], playerId: tagged } }, watchList: [tagged] };
    delete e.contracts[old];
    const out = stripNameYears(l, e);
    expect(out.renamed).toBe(1);
    expect(out.league.teams[0].seasons[0].playerId).toBe(old);
    expect(out.extras.contracts[old]?.playerId).toBe(old);
    expect(out.extras.watchList).toEqual([old]);
    expect(stripNameYears(league, extras).league).toBe(league);
  });
});
