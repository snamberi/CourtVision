// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { draftRumors, mockDraft } from '../simulation/draftSeason';
import { teamRoles, playerMorale } from '../simulation/personality';
import { generateConferencePlayoffBracket } from '../simulation/playoffs';
import { simulateRemainingSeason } from '../simulation/league';
import { SeriesPreview } from '../components/SeriesPreview';
import { CoachIdentityCard } from '../components/CoachIdentityCard';
import { InjuryDecisionDialog } from '../components/InjuryDecisionDialog';
import { chooseTreatment } from '../simulation/medical';

describe('gameplay extras', () => {
  const { league, extras } = generateFullLeague(91, 30, 13, 10, '2026');

  it('draft rumours: one per first-round pick, the same every time, mostly pointing at the mock pick', () => {
    const r = draftRumors(league, extras);
    expect(r).toHaveLength(30);
    expect(draftRumors(league, extras)).toEqual(r);
    const mock = new Map(mockDraft(league, extras).map(m => [m.pick, m.prospectId]));
    const onMock = r.filter(x => x.prospectId === mock.get(x.pick)).length;
    expect(onMock).toBeGreaterThan(12);
    expect(new Set(r.map(x => x.source)).size).toBeGreaterThan(1);
  });

  it('team roles: at most one of each, all on the roster, and they move morale', () => {
    let leaders = 0;
    for (const t of league.teams) {
      const roles = teamRoles(t);
      for (const id of Object.values(roles)) if (id) expect(t.seasons.some(p => p.playerId === id)).toBe(true);
      if (roles.leader) {
        leaders++;
        const other = t.seasons.find(p => p.playerId !== roles.leader && p.playerId !== roles.badApple)!;
        expect(playerMorale(other, t, league, extras).factors.some(f => f.label.startsWith('Locker-room leader'))).toBe(true);
      }
    }
    expect(leaders).toBeGreaterThan(5);
  });

  it('series preview and coach identity render for a real matchup', () => {
    const finished = simulateRemainingSeason(league, 5);
    const bracket = generateConferencePlayoffBracket(finished);
    const series = bracket.rounds.flat().find(s => s.teamAId && s.teamBId)!;
    expect(series).toBeTruthy();
    const { container } = render(<SeriesPreview league={finished} series={series} round="First Round" />);
    expect(container.textContent).toMatch(/The pick: .+ in [4-7]/);
    const coach = render(<CoachIdentityCard league={finished} teamId={finished.teams[0].teamId} />);
    expect(coach.container.textContent).toMatch(/COACH IDENTITY/);
  });

  it('the injury pop-up offers the doctors\' options and a choice applies', () => {
    const t = league.teams[0], p = t.seasons[0];
    const hurt = { ...league, injuries: { [p.playerId]: { playerId: p.playerId, teamId: t.teamId, severity: 'severe' as const, gamesRemaining: 10, totalGames: 10 } } };
    const { container } = render(<InjuryDecisionDialog league={hurt} teamId={t.teamId} onChoose={() => {}} onLater={() => {}} />);
    expect(container.ownerDocument.body.textContent).toMatch(/Surgery/);
    expect(chooseTreatment(hurt, p.playerId, 'rush').injuries![p.playerId].treatment).toBe('rush');
    const none = render(<InjuryDecisionDialog league={league} teamId={t.teamId} onChoose={() => {}} onLater={() => {}} />);
    expect(none.container.innerHTML).toBe('');
  });
});
