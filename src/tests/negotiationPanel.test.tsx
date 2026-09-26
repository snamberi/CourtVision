// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NegotiationPanel } from '../components/NegotiationPanel';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { calculateOverall } from '../simulation/engine/overall';
import type { GMLeagueExtras } from '../simulation/gm';

describe('negotiation panel', () => {
  it('shows the agent and demand, and signs when you match the ask', () => {
    const { league: base, extras: baseExtras } = generateFullLeague(12, 30, 13, 4, '2026');
    const league = { ...base, seasonPhase: 'free_agency' as const };
    const p = { ...league.teams[0].seasons.find(s => calculateOverall(s) < 70)!, teamId: null };
    const extras = { ...baseExtras, freeAgencyOpen: true, freeAgents: [p], capSettings: { ...baseExtras.capSettings, salaryCap: 400_000_000 } };
    let stored: GMLeagueExtras | null = null;
    const onAgree = vi.fn();
    render(<NegotiationPanel league={league} extras={extras} player={p} teamId={league.teams[29].teamId} onUpdate={e => { stored = e; }} onAgree={onAgree} onClose={() => {}} />);
    expect(screen.getByText('AGENT')).toBeTruthy();
    expect(screen.getByText(p.playerId)).toBeTruthy();
    fireEvent.click(screen.getByText('Match their ask'));
    fireEvent.click(screen.getByText('Make offer'));
    expect(onAgree).toHaveBeenCalledTimes(1);
    expect(onAgree.mock.calls[0][0].annualSalary).toBeGreaterThan(0);
    expect(stored).toBeNull();
  });
});
