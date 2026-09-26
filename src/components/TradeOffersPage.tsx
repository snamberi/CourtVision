import { TeamText } from './TeamLink';
import { useState } from 'react';
import type { League } from '../simulation/league';
import type { GMLeagueExtras, TradeProposal, FutureDraftPick } from '../simulation/gm';
import { validateTrade, executeTrade, evaluateTradeSides, computeFutureDraftPickValue, isTradeDeadlinePassed } from '../simulation/gm';
import type { PlayerSeason } from '../simulation/types';
import { tradeVerdict, TradePlayerCompareTable } from './gmShared';

interface Props {
  league: League;
  extras: GMLeagueExtras;
  controlledTeamId: string | null;
  onChange: (league: League, extras: GMLeagueExtras) => void;
}

function pickLabel(pick: FutureDraftPick): string {
  return `${pick.year} Round ${pick.round}${pick.protection ? ` (${pick.protection.label})` : ''}`;
}

function PickList({ title, picks, league, currentYear, showValues }: { showValues: boolean; title: string; picks: FutureDraftPick[]; league: League; currentYear: number }) {
  if (picks.length === 0) return null;
  return (
    <div>
      <h5 className="stats-subheading">{title}</h5>
      <ul className="badge-grid" style={{ listStyle: 'none', padding: 0 }}>
        {picks.map((p) => (
          <li key={p.id} className="badge-chip">{pickLabel(p)} {showValues && <> (value {computeFutureDraftPickValue(p, league, currentYear)})</>}</li>
        ))}
      </ul>
    </div>
  );
}

export function TradeOffersPage({ league, extras, controlledTeamId, onChange }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const offers = extras.pendingTradeOffers.filter(o => !!controlledTeamId && (o.teamAId === controlledTeamId || o.teamBId === controlledTeamId));
  const currentYear = parseInt((league.season ?? '2026').slice(0, 4), 10);

  const decline = (offer: TradeProposal) => {
    if (!offers.includes(offer)) return;
    onChange(league, { ...extras, pendingTradeOffers: extras.pendingTradeOffers.filter((o) => o !== offer) });
    setMessage('Offer declined.');
  };

  const accept = (offer: TradeProposal) => {
    if (!offers.includes(offer) || isTradeDeadlinePassed(league)) return;
    const validation = validateTrade(league, extras, offer);
    if (!validation.valid) {
      setMessage(`Can't accept: ${validation.reasons.join(' ')}`);
      onChange(league, { ...extras, pendingTradeOffers: extras.pendingTradeOffers.filter((o) => o !== offer) });
      return;
    }
    const { league: newLeague, extras: newExtras } = executeTrade(league, extras, offer);
    onChange(newLeague, { ...newExtras, pendingTradeOffers: newExtras.pendingTradeOffers.filter((o) => o !== offer) });
    setMessage('Trade accepted.');
  };

  if (!controlledTeamId) {
    return <p className="empty-state">Incoming trade offers are available when you control a team.</p>;
  }

  const findSeasons = (teamId: string, playerIds: string[]) => {
    const team = league.teams.find((t) => t.teamId === teamId);
    return playerIds.map((id) => team?.seasons.find((s) => s.playerId === id)).filter((s): s is PlayerSeason => !!s);
  };
  const findPicks = (pickIds: string[] | undefined) =>
    (pickIds ?? []).map((id) => extras.futurePicks?.find((p) => p.id === id)).filter((p): p is FutureDraftPick => !!p);

  const deadlinePassed = isTradeDeadlinePassed(league);
  const showValues = extras.tradeSettings.showValues === true;

  return (
    <div>
      {deadlinePassed && <p className="calendar-banner">Trade deadline has passed for this season - offers can no longer be accepted.</p>}
      <p className="hint-text">Other teams occasionally propose trades to you as the season moves forward — sometimes sweetened with a future draft pick to balance the value. Review them here.</p>
      {offers.length === 0 && <p className="empty-state">No incoming trade offers right now.</p>}
      {offers.map((offer, i) => {
        const youGiveUp = offer.teamAId === controlledTeamId ? offer.playersFromA : offer.playersFromB;
        const youReceive = offer.teamAId === controlledTeamId ? offer.playersFromB : offer.playersFromA;
        const picksYouGiveUp = offer.teamAId === controlledTeamId ? offer.picksFromA : offer.picksFromB;
        const picksYouReceive = offer.teamAId === controlledTeamId ? offer.picksFromB : offer.picksFromA;
        const partnerTeamId = offer.teamAId === controlledTeamId ? offer.teamBId : offer.teamAId;
        const partnerName = league.teams.find((t) => t.teamId === partnerTeamId)?.name ?? partnerTeamId;
        const giveSeasons = findSeasons(controlledTeamId, youGiveUp);
        const receiveSeasons = findSeasons(partnerTeamId, youReceive);
        const givePicks = findPicks(picksYouGiveUp);
        const receivePicks = findPicks(picksYouReceive);
        // Judged from your own team's situation, the same way the AI front offices judge it.
        const sides = evaluateTradeSides(league, extras, offer);
        const mine = sides.a.teamId === controlledTeamId ? sides.a : sides.b;
        const verdict = tradeVerdict(mine.give, mine.receive);
        return (
          <div key={i} className="trade-comparison-block">
            <p className="hint-text">Offer from <TeamText text={partnerName} /></p>
            <div className={`trade-verdict ${verdict.className}`}>{verdict.label}</div>
            <div className="trade-compare-columns">
              <div>
                <TradePlayerCompareTable showValues={showValues} title="You give up" players={giveSeasons} />
                <PickList showValues={showValues} title="Picks you give up" picks={givePicks} league={league} currentYear={currentYear} />
              </div>
              <div>
                <TradePlayerCompareTable showValues={showValues} title="You receive" players={receiveSeasons} />
                <PickList showValues={showValues} title="Picks you receive" picks={receivePicks} league={league} currentYear={currentYear} />
              </div>
            </div>
            <div className="trade-actions">
              <button className="primary" disabled={deadlinePassed} onClick={() => accept(offer)}>Accept</button>
              <button onClick={() => decline(offer)}>Decline</button>
            </div>
          </div>
        );
      })}
      {message && <p className="hint-text"><TeamText text={message} /></p>}
    </div>
  );
}
