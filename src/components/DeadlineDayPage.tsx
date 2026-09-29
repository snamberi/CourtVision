import { useState } from 'react';
import { ARCHETYPE, rivalAgenda, relationLabel } from '../simulation/gmRivals';
import type { League } from '../simulation/league';
import type { GMLeagueExtras, TradeProposal } from '../simulation/gm';
import { evaluateTradeSides, executeTrade, isTradeDeadlinePassed, validateTrade } from '../simulation/gm';
import { formatSeasonYear } from '../simulation/calendar';
import {
  DEADLINE_HOURS, daysToDeadline, deadlineClock, describeDeadlineTrade, isBlockbuster, pruneOffers, rumorOutcome, tradeDeadlineEnabled,
  type DeadlineDayState, type DeadlineRumor, type DeadlineTrade,
} from '../simulation/deadlineDay';
import { tradeVerdict } from './gmShared';
import { TeamLink, TeamText } from './TeamLink';
import { PixelIcon } from './PixelIcon';

interface Props {
  league: League;
  extras: GMLeagueExtras;
  controlledTeamId: string | null;
  onChange: (league: League, extras: GMLeagueExtras) => void;
  onAdvanceHour: () => void;
  onSkipToDeadline: () => void;
  onGoTo: (tab: string) => void;
}

const HEAT: Record<DeadlineRumor['heat'], { label: string; className: string }> = {
  3: { label: 'HOT', className: 'hot' }, 2: { label: 'WARM', className: 'warm' }, 1: { label: 'MURMUR', className: 'cool' },
};

const today = (league: League): DeadlineDayState | undefined =>
  league.deadlineDay?.season === (league.season ?? '') ? league.deadlineDay : undefined;

/** Trade Deadline Day: the 9-to-3 clock, the rumor mill, calls to your phone and every deal as it breaks. */
export function DeadlineDayPage({ league, extras, controlledTeamId, onChange, onAdvanceHour, onSkipToDeadline, onGoTo }: Props) {
  const day = today(league);
  const name = (id: string) => league.teams.find(t => t.teamId === id)?.name ?? id;
  const days = daysToDeadline(league);

  if (!controlledTeamId) return <p className="empty-state">Trade Deadline Day happens in leagues where you run a team.</p>;
  if (!tradeDeadlineEnabled(league)) return <p className="empty-state">The trade deadline is turned off in this league's rules, so trading stays open all season.</p>;
  if (!day || day.status === 'upcoming') {
    return <div className="deadline-page">
      <section className="deadline-hero">
        <div className="deadline-clock deadline-clock--idle"><PixelIcon name="clock" size={40} /></div>
        <div>
          <span className="pixel-eyebrow">{formatSeasonYear(league.season ?? '')} · TRADE DEADLINE</span>
          <h2>Trade Deadline Day</h2>
          <p>{days == null
            ? (isTradeDeadlinePassed(league) ? 'The trade deadline has passed for this season.' : 'The trade deadline is still to come once the regular season starts.')
            : days === 0 ? 'Deadline Day is today. Play on to open it.'
            : `${days} game day${days === 1 ? '' : 's'} to go. The season stops that morning: from 9 AM to the 3 PM deadline, teams call, rumors fly and deals break.`}</p>
        </div>
      </section>
    </div>;
  }

  const open = day.status === 'open';
  const hoursLeft = DEADLINE_HOURS - day.hour;
  const trades = [...day.trades].reverse();
  const offers = extras.pendingTradeOffers.filter(o => o.teamAId === controlledTeamId || o.teamBId === controlledTeamId);
  const big = day.trades.filter(isBlockbuster).length;

  return <div className="deadline-page">
    <section className={`deadline-hero${open ? '' : ' closed'}`}>
      <div className="deadline-clock" aria-label={`Clock: ${deadlineClock(day.hour)}`}>
        <span className="deadline-clock-time">{deadlineClock(day.hour)}</span>
        <span className="deadline-clock-left">{open ? `${hoursLeft} hour${hoursLeft === 1 ? '' : 's'} left` : 'DEADLINE PASSED'}</span>
      </div>
      <div className="deadline-hero-copy">
        <span className="pixel-eyebrow">{formatSeasonYear(day.season)} · TRADE DEADLINE DAY</span>
        <h2>{open ? 'The phones are ringing' : 'The deadline has passed'}</h2>
        <p>{open
          ? `Trading locks at 3:00 PM. ${day.trades.length} deal${day.trades.length === 1 ? '' : 's'} so far. Take a call, work the Trade page, or let the clock run.`
          : `${day.trades.length} deal${day.trades.length === 1 ? '' : 's'} on Deadline Day${big ? `, ${big} blockbuster${big === 1 ? '' : 's'}` : ''}. Rosters are set for the stretch run.`}</p>
        <ol className="deadline-hours" aria-label="Hours to the deadline">
          {Array.from({ length: DEADLINE_HOURS + 1 }, (_, h) => <li key={h} className={h < day.hour ? 'past' : h === day.hour ? 'now' : ''}>
            {deadlineClock(h).replace(':00', '')}
          </li>)}
        </ol>
        {open && <div className="deadline-actions">
          <button className="primary" onClick={onAdvanceHour}>{day.hour + 1 >= DEADLINE_HOURS ? 'Run to the 3 PM deadline' : `Next hour: ${deadlineClock(day.hour + 1)}`}</button>
          <button onClick={() => onGoTo('trade')}><PixelIcon name="trade" size={16} /> Make a trade</button>
          <button onClick={onSkipToDeadline}>Skip to 3 PM</button>
        </div>}
      </div>
    </section>

    {(league.gmRivals?.rivals.length ?? 0) > 0 && <section className="dashboard-panel deadline-rivals" aria-label="Rival GMs">
      <h5><PixelIcon name="trade" size={16} /> Your GM rivals are working the phones</h5>
      <ul>{league.gmRivals!.rivals.map(r => <li key={r.teamId}><b>{r.name}</b> <small>({ARCHETYPE[r.archetype].label}, {league.teams.find(t => t.teamId === r.teamId)?.name})</small>: {rivalAgenda(league, extras, r).text} <em className={r.relation <= -15 ? 'bad' : r.relation >= 15 ? 'good' : ''}>{relationLabel(r.relation)}</em></li>)}</ul>
    </section>}
    <div className="deadline-grid">
      <section className="dashboard-panel deadline-ticker" aria-label="Breaking deals">
        <h5>Breaking</h5>
        {trades.length ? <ul>{trades.map((t, i) => <TickerItem key={day.trades.length - i} trade={t} name={name} mine={t.teamAId === controlledTeamId || t.teamBId === controlledTeamId} />)}</ul>
          : <p className="hint-text">{open ? 'Nothing has broken yet. The big moves usually come late.' : 'No deals today.'}</p>}
      </section>

      <div className="deadline-side">
        {open && <Phone league={league} extras={extras} controlledTeamId={controlledTeamId} offers={offers} day={day} name={name} onChange={onChange} onGoTo={onGoTo} />}
        <section className="dashboard-panel deadline-rumors" aria-label="Rumor mill">
          <h5>Rumor mill</h5>
          <ul>{day.rumors.map(r => {
            const done = rumorOutcome(r, day.trades, name);
            return <li key={r.id} className={done ? 'came-true' : ''}>
              <span className={`deadline-heat ${HEAT[r.heat].className}`}>{HEAT[r.heat].label}</span>
              <span><TeamText text={r.text} />{done && <b className="deadline-done"> {done}.</b>}</span>
            </li>;
          })}</ul>
        </section>
      </div>
    </div>
  </div>;
}

function TickerItem({ trade, name, mine }: { trade: DeadlineTrade; name: (id: string) => string; mine: boolean }) {
  return <li className={`deadline-deal${isBlockbuster(trade) ? ' big' : ''}${mine ? ' mine' : ''}`}>
    <span className="deadline-deal-time">{deadlineClock(trade.hour)}</span>
    <span className="deadline-deal-tag">{mine ? 'YOUR DEAL' : isBlockbuster(trade) ? 'BLOCKBUSTER' : 'DEAL'}</span>
    <span className="deadline-deal-text"><TeamText text={`${describeDeadlineTrade(trade, name)}.`} /></span>
  </li>;
}

function Phone({ league, extras, controlledTeamId, offers, day, name, onChange, onGoTo }: {
  league: League; extras: GMLeagueExtras; controlledTeamId: string; offers: TradeProposal[]; day: DeadlineDayState;
  name: (id: string) => string; onChange: Props['onChange']; onGoTo: Props['onGoTo'];
}) {
  const [message, setMessage] = useState<string | null>(null);
  const drop = (offer: TradeProposal) => extras.pendingTradeOffers.filter(o => o !== offer);
  const accept = (offer: TradeProposal) => {
    const check = validateTrade(league, extras, offer);
    if (!check.valid) {
      setMessage(`That deal fell through: ${check.reasons.join(' ')}`);
      onChange(league, { ...extras, pendingTradeOffers: drop(offer) });
      return;
    }
    const done = executeTrade(league, extras, offer);
    // Other calls built around the players you just moved no longer work.
    onChange(done.league, pruneOffers(done.league, { ...done.extras, pendingTradeOffers: done.extras.pendingTradeOffers.filter(o => o !== offer) }));
    setMessage('Deal done. It will break across the league in seconds.');
  };
  const decline = (offer: TradeProposal) => { onChange(league, { ...extras, pendingTradeOffers: drop(offer) }); setMessage('You passed.'); };

  return <section className="dashboard-panel deadline-phone" aria-label="Your phone">
    <h5>Your phone</h5>
    {offers.length === 0 && <p className="hint-text">No offers on the table. Teams call as the day goes on; you can also shop your players on the Trade page.</p>}
    {offers.map((offer, i) => {
      const mineIsA = offer.teamAId === controlledTeamId;
      const partner = mineIsA ? offer.teamBId : offer.teamAId;
      const give = mineIsA ? offer.playersFromA : offer.playersFromB;
      const get = mineIsA ? offer.playersFromB : offer.playersFromA;
      const givePicks = (mineIsA ? offer.picksFromA : offer.picksFromB)?.length ?? 0;
      const getPicks = (mineIsA ? offer.picksFromB : offer.picksFromA)?.length ?? 0;
      const sides = evaluateTradeSides(league, extras, offer);
      const mine = sides.a.teamId === controlledTeamId ? sides.a : sides.b;
      const verdict = tradeVerdict(mine.give, mine.receive);
      return <div key={i} className="deadline-offer">
        <p className="deadline-offer-from"><TeamLink name={name(partner)} /> on the line <span className={`trade-verdict ${verdict.className}`}>{verdict.label}</span></p>
        <p><span className="hint-text">You give</span> {give.join(', ') || 'nobody'}{givePicks ? ` + ${givePicks} pick${givePicks === 1 ? '' : 's'}` : ''}</p>
        <p><span className="hint-text">You get</span> {get.join(', ') || 'nobody'}{getPicks ? ` + ${getPicks} pick${getPicks === 1 ? '' : 's'}` : ''}</p>
        <div className="trade-actions">
          <button className="primary" onClick={() => accept(offer)}>Accept</button>
          <button onClick={() => decline(offer)}>Pass</button>
          <button className="link-button" onClick={() => onGoTo('tradeOffers')}>Full details</button>
        </div>
      </div>;
    })}
    {message && <p className="hint-text">{message}</p>}
    {day.calls.length > 0 && <p className="hint-text deadline-call-log">Calls today: {day.calls.map(c => `${deadlineClock(c.hour)} ${name(c.teamId)}`).join(' · ')}</p>}
  </section>;
}

/** Home panel: the countdown before the deadline, a live link on the day, the tally afterwards. */
export function DeadlineCard({ league, controlledTeamId, onOpen }: { league: League; controlledTeamId: string | null; onOpen: () => void }) {
  if (!controlledTeamId || !tradeDeadlineEnabled(league)) return null;
  const day = today(league);
  const days = daysToDeadline(league);
  const name = (id: string) => league.teams.find(t => t.teamId === id)?.name ?? id;
  if (day?.status === 'closed') {
    const biggest = [...day.trades].sort((a, b) => b.topOverall - a.topOverall)[0];
    return <section className="dashboard-panel deadline-card">
      <h5><PixelIcon name="clock" size={16} /> Trade deadline</h5>
      <p><b>Passed.</b> {day.trades.length} deal{day.trades.length === 1 ? '' : 's'} on Deadline Day.</p>
      {biggest && <p className="hint-text">Biggest: <TeamText text={`${describeDeadlineTrade(biggest, name)}.`} /></p>}
      <button className="dashboard-link" onClick={onOpen}>» Deadline Day recap</button>
    </section>;
  }
  if (day?.status === 'open') {
    return <section className="dashboard-panel deadline-card live">
      <h5><PixelIcon name="clock" size={16} /> Deadline Day · {deadlineClock(day.hour)}</h5>
      <p><b>It's Deadline Day.</b> {DEADLINE_HOURS - day.hour} hours until trading locks · {day.trades.length} deal{day.trades.length === 1 ? '' : 's'} so far.</p>
      <button className="primary" onClick={onOpen}>Open Deadline Day</button>
    </section>;
  }
  if (days == null) return null;
  return <section className="dashboard-panel deadline-card">
    <h5><PixelIcon name="clock" size={16} /> Trade deadline</h5>
    <p className="deadline-card-count"><b>{days}</b> game day{days === 1 ? '' : 's'} to go</p>
    <p className="hint-text">The season stops on Deadline Day: from 9 AM to 3 PM, teams call, rumors fly and deals break.</p>
    <button className="dashboard-link" onClick={onOpen}>» Deadline Day</button>
  </section>;
}
