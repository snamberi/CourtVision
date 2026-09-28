// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TradePage } from '../components/TradePage';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { calculateOverall } from '../simulation/engine/overall';
import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';

const base = generateFullLeague(61, 12, 14, 30, '2026', { priorSeasons: false });
const me = base.league.teams[0];
const them = base.league.teams[1];

function Harness() {
  const [state, setState] = useState<{ league: League; extras: GMLeagueExtras }>({ league: base.league, extras: { ...base.extras, capSettings: { ...base.extras.capSettings, enforceCapOnTrades: false } } });
  return <TradePage league={state.league} extras={state.extras} controlledTeamId={me.teamId} onChange={(league, extras) => setState({ league, extras })} />;
}

describe('trade counter-offers in the Trade page', () => {
  it('a lowball brings a counter you can accept', () => {
    render(<Harness />);
    const theirs = [...them.seasons].sort((a, b) => calculateOverall(b) - calculateOverall(a))[1];
    const mine = [...me.seasons].sort((a, b) => calculateOverall(a) - calculateOverall(b))[0];
    const boxes = screen.getAllByRole('checkbox');
    const labelFor = (id: string) => boxes.find(b => b.closest('label')?.textContent?.includes(id))!;
    fireEvent.click(labelFor(mine.playerId));
    fireEvent.click(labelFor(theirs.playerId));
    fireEvent.click(screen.getByRole('button', { name: /Propose Trade/ }));
    expect(screen.getByRole('group', { name: 'Counter-offer' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Accept counter' }));
    expect(screen.getByText(/Deal done on their terms/)).toBeTruthy();
  });
});
