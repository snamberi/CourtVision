import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { validateTrade } from '../simulation/gm';
import { counterOffer, aiAccepts, recordTalkRound, talksClosed, PATIENCE } from '../simulation/tradeTalks';
import { generateTradeOfferForControlledTeam } from '../simulation/aiGM';
import { calculateOverall } from '../simulation/engine/overall';

const base = generateFullLeague(61, 12, 14, 30, '2026', { priorSeasons: false });
const me = base.league.teams[0].teamId;
const them = base.league.teams[1].teamId;
const extras = { ...base.extras, capSettings: { ...base.extras.capSettings, enforceCapOnTrades: false } };

describe('trade talks', () => {
  it('a lowball gets a counter that the AI team would actually accept', () => {
    const theirBest = [...base.league.teams[1].seasons].sort((a, b) => calculateOverall(b) - calculateOverall(a))[1];
    const myWorst = [...base.league.teams[0].seasons].sort((a, b) => calculateOverall(a) - calculateOverall(b))[0];
    const lowball = { teamAId: me, teamBId: them, playersFromA: [myWorst.playerId], playersFromB: [theirBest.playerId] };
    expect(validateTrade(base.league, extras, lowball).valid).toBe(false);
    const counter = counterOffer(base.league, extras, lowball, me);
    expect(counter).not.toBeNull();
    expect(aiAccepts(base.league, extras, counter!.proposal, me)).toBe(true);
    expect(counter!.text.length).toBeGreaterThan(10);
  });

  it('declining counters runs out a front office\'s patience', () => {
    let x = extras;
    const personality = x.teamPersonalities?.[them] ?? 'balanced';
    for (let i = 0; i < PATIENCE[personality]; i++) x = recordTalkRound(base.league, x, them).extras;
    expect(talksClosed(base.league, x, them)).toBe(true);
    const lowball = { teamAId: me, teamBId: them, playersFromA: [base.league.teams[0].seasons[12].playerId], playersFromB: [base.league.teams[1].seasons[0].playerId] };
    expect(counterOffer(base.league, x, lowball, me)).toBeNull();
  });

  it('players on your trade block draw calls about them first', () => {
    const block = [...base.league.teams[0].seasons].filter(p => p.age >= 24).sort((a, b) => calculateOverall(b) - calculateOverall(a))[2].playerId;
    let offer = null;
    for (let seed = 1; seed < 12 && !offer; seed++) offer = generateTradeOfferForControlledTeam(base.league, { ...extras, tradeBlock: [block] }, me, seed);
    if (offer?.note) {
      expect(offer.note).toContain(block);
      const mineOut = offer.teamAId === me ? offer.playersFromA : offer.playersFromB;
      expect(mineOut).toContain(block);
    }
    expect(offer).not.toBeNull();
  });
});
