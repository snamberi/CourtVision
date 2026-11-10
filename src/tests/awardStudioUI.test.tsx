// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { AwardStudio, CustomAwardBoard, LeagueAwardProvider } from '../components/AwardStudio';
import { AwardsByOrigin } from '../components/RealPlayerFacts';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { defaultAward, editAwardHistory, saveAwardDefinition } from '../simulation/awardStudio';
import { getPlayerAwardsHistory, teamTrophyEntries } from '../simulation/leagueAnalytics';
import { createSave, deleteSave, getSave } from '../storage/saves';
import type { League } from '../simulation/league';

afterEach(cleanup);
function fixture() {
  const f = generateFullLeague(5051, 4, 8, 4, '2026', { priorSeasons: false });
  f.league.settings.sandboxMode = true;
  return f;
}
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

describe('Award Studio workflows', () => {
  it('creates an award, edits an old winner, and keeps both after saving and reopening the league', async () => {
    const { league, extras } = fixture();
    let latest = league;
    function Harness() {
      const [value, setValue] = useState(league); latest = value;
      return <AwardStudio league={value} extras={extras} onChange={setValue} />;
    }
    const view = render(<Harness />);
    click('Create new award');
    fireEvent.change(screen.getByLabelText('Name', { exact: true }), { target: { value: 'Passing Crown' } });
    click('Add stat');
    fireEvent.change(screen.getByLabelText('Win Shares weight'), { target: { value: '4' } });
    click('Save award');
    const id = latest.awardStudio!.definitions[0].id;
    expect(latest.awardStudio!.definitions[0].weights.ws).toBe(4);
    click('Edit award history');
    fireEvent.change(screen.getByLabelText('Award season'), { target: { value: '1970' } });
    click('Add winner');
    const player = league.teams[0].seasons[0].playerId;
    fireEvent.change(screen.getByLabelText('Winner 1'), { target: { value: player } });
    click('Save winners');
    expect(latest.awardStudio!.history['1970'][id][0].teamId).toBe(league.teams[0].teamId);
    const save = await createSave('Award Studio test', latest, extras, league.teams[0].teamId);
    try {
      const loaded = (await getSave(save))!;
      view.unmount();
      render(<LeagueAwardProvider league={loaded.league}><CustomAwardBoard league={loaded.league} season="1970" onSelectPlayer={() => {}} /></LeagueAwardProvider>);
      expect(screen.getByRole('heading', { name: 'Passing Crown' })).toBeTruthy();
      expect(screen.getByRole('button', { name: player })).toBeTruthy();
      expect(getPlayerAwardsHistory(loaded.league, player)).toContainEqual({ season: '1970', key: id, label: 'Passing Crown' });
    } finally { await deleteSave(save); }
  });

  it('imports awards and artwork directly from a local league without replacing destination winners', async () => {
    const { league, extras } = fixture();
    const source = saveAwardDefinition(league, { ...defaultAward('custom_passing'), name: 'Imported Crown', image: 'data:image/png;base64,iVBORw0KGgo=', weights: { ws: 4 } });
    const id = await createSave('Other league with artwork', source, extras, null);
    const winner = { playerId: league.teams[0].seasons[0].playerId, teamId: league.teams[0].teamId, teamName: league.teams[0].name, score: 0 };
    let latest = editAwardHistory(league, '2020', 'mvp', [winner]);
    function Harness() {
      const [value, setValue] = useState(latest); latest = value;
      return <AwardStudio league={value} extras={extras} onChange={setValue} />;
    }
    try {
      render(<Harness />);
      click('Import / export'); click('Import award from other leagues');
      await screen.findByLabelText('Source league');
      fireEvent.change(screen.getByLabelText('Source league'), { target: { value: id } });
      click('Choose awards');
      await screen.findByRole('button', { name: 'Import 40 awards' });
      click('Import 40 awards');
      await waitFor(() => expect(latest.awardStudio!.definitions.find(d => d.id === 'custom_passing')?.image).toBe(source.awardStudio!.definitions[0].image));
      expect(latest.awardStudio!.history['2020'].mvp).toEqual([winner]);
    } finally { await deleteSave(id); }
  });

  it('updates imported player honors and all joint team winners, including clearing them', () => {
    const { league } = fixture(), [a, b] = league.teams;
    const player = { ...a.seasons[0], historicalAwards: [{ season: '1970', label: 'MVP' }] };
    let l: League = { ...league, franchiseHistory: [{ season: '1970', imported: true, championTeamId: null, championTeamName: null, mvpPlayerId: player.playerId, mvpTeamName: a.name, dpoyPlayerId: null, royPlayerId: null, fmvpPlayerId: null }] };
    l = editAwardHistory(l, '1970', 'mvp', []);
    render(<AwardsByOrigin player={player} league={l} awardsHistory={getPlayerAwardsHistory(l, player.playerId)} />);
    expect(screen.queryByText('MVP')).toBeNull();
    l = editAwardHistory(l, '1970', 'champion', [a, b].map(t => ({ playerId: t.teamId, teamId: t.teamId, teamName: t.name, score: 0 })));
    for (const t of [a, b]) expect(teamTrophyEntries(l, t.teamId).filter(e => e.key === 'champion')).toHaveLength(1);
    l = editAwardHistory(l, '1970', 'champion', []);
    for (const t of [a, b]) expect(teamTrophyEntries(l, t.teamId).filter(e => e.key === 'champion')).toHaveLength(0);
  });
});
