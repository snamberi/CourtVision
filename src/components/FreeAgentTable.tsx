import { TeamText } from './TeamLink';
import { shortMoney } from '../lib/humanize';
import { Fragment, useMemo, useState } from 'react';
import type { PlayerSeason } from '../simulation/types';
import type { LeagueTeam } from '../simulation/league';
import type { Contract, SalaryCapSettings } from '../simulation/gm';
import { calculateOverall } from '../simulation/engine/overall';
import { primaryPosition } from '../simulation/teamStatus';
import { perGameAverages } from '../simulation/careerStats';
import { computeAskingSalary } from '../simulation/gm';
import { PlayerNameTag } from './PlayerAvatar';
import type { FreeAgentVerdict } from '../simulation/freeAgentDecision';
import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import { NegotiationPanel } from './NegotiationPanel';
import { openNegotiation } from '../simulation/agents';
import { stat1 } from './statFormat';

interface Props {
  title: string;
  players: PlayerSeason[];
  team: LeagueTeam | null;
  contracts: Record<string, Contract>;
  capSettings: SalaryCapSettings;
  canSign: boolean;
  disabledReason?: string;
  onSign: (playerId: string, contract: Omit<Contract, 'playerId' | 'teamId'>) => void;
  onSelectPlayer: (playerId: string) => void;
  /** Team-specific terms: what each player needs from the signing team, or that he refuses it. */
  quote?: (season: PlayerSeason) => FreeAgentVerdict | null;
  /** Contract talks through the player's agent (see agents.ts); without it, Negotiate is a plain offer form. */
  talks?: { league: League; extras: GMLeagueExtras; teamId: string; onUpdate: (extras: GMLeagueExtras) => void;
    onAgree: (playerId: string, contract: Omit<Contract, 'playerId' | 'teamId'>, extras: GMLeagueExtras) => void };
}

const MOOD_TAGS = ['Eager', 'Open', 'Neutral', 'Guarded', 'Reluctant'];
function moodFor(playerId: string): string {
  let hash = 0;
  for (let i = 0; i < playerId.length; i++) hash = (hash * 31 + playerId.charCodeAt(i)) >>> 0;
  return MOOD_TAGS[hash % MOOD_TAGS.length];
}

const fmtMoney = shortMoney;

export function FreeAgentTable({ title, players, team, contracts, capSettings, canSign, disabledReason, onSign, onSelectPlayer, quote, talks }: Props) {
  const [query, setQuery] = useState('');
  const [affordableOnly, setAffordableOnly] = useState(false);
  const [perPage, setPerPage] = useState(50);
  const [negotiatingId, setNegotiatingId] = useState<string | null>(null);
  const [offerSalary, setOfferSalary] = useState(capSettings.minSalary);
  const [offerYears, setOfferYears] = useState(1);

  const payroll = team ? Object.values(contracts).filter((c) => c.teamId === team.teamId).reduce((s, c) => s + c.annualSalary, 0) : 0;
  const capSpace = capSettings.salaryCap - payroll;
  const openRosterSpots = team ? Math.max(0, capSettings.maxRosterSize - team.seasons.length) : 0;
  const maxSalary = capSettings.salaryCap * capSettings.maxSalaryPctOfCap;

  const rows = useMemo(() => {
    const asks = new Map<string, { salary: number; years: number; playerOption: boolean } | null>();
    const ask = (s: PlayerSeason) => {
      if (!talks) return null;
      if (!asks.has(s.playerId)) asks.set(s.playerId, openNegotiation(talks.league, talks.extras, s, talks.teamId)?.demand ?? null);
      return asks.get(s.playerId)!;
    };
    return players
    .map((s) => {
      const currentAvg = perGameAverages(s.seasonStats);
      const lastSeason = s.careerHistory && s.careerHistory.length > 0 ? s.careerHistory[s.careerHistory.length - 1] : undefined;
      // A free agent hasn't played any games while unrostered, so "this season" is empty by
      // definition until they sign somewhere — fall back to last season's actual production so the
      // table isn't just a wall of zeroes for anyone who isn't a brand-new draftee.
      const usingLastSeason = currentAvg.gamesPlayed === 0 && !!lastSeason;
      const avg = usingLastSeason ? perGameAverages(lastSeason!.stats) : currentAvg;
      return {
        season: s,
        overall: calculateOverall(s),
        potential: s.development?.potential ?? calculateOverall(s),
        avg,
        usingLastSeason,
        verdict: quote?.(s) ?? null,
        // With an agent involved, the asking price is the camp's current demand (salary, years, option).
        ask: ask(s),
        asking: ask(s)?.salary || quote?.(s)?.required || computeAskingSalary(calculateOverall(s), capSettings),
        mood: (() => { const v = quote?.(s); if (!v) return moodFor(s.playerId); if (v.refuses) return "Won't sign"; return v.interest >= 75 ? 'Eager' : v.interest >= 60 ? 'Open' : v.interest >= 45 ? 'Neutral' : v.interest >= 30 ? 'Guarded' : 'Reluctant'; })(),
      };
    })
    .filter((r) => !query || r.season.playerId.toLowerCase().includes(query.toLowerCase()))
    .filter((r) => !affordableOnly || r.asking <= capSpace)
    .sort((a, b) => b.overall - a.overall)
    .slice(0, perPage);
  }, [players, query, affordableOnly, perPage, capSpace, capSettings, quote, talks]);
  // When every row is last season's (the usual case before tip-off), one line says so instead of a tag on each row.
  const allLastSeason = rows.length > 0 && rows.every(r => r.usingLastSeason);

  const startNegotiation = (playerId: string, asking: number) => {
    setNegotiatingId(playerId);
    setOfferSalary(asking);
    setOfferYears(2);
  };

  const confirmNegotiation = (playerId: string) => {
    onSign(playerId, { annualSalary: offerSalary, yearsRemaining: offerYears, playerOption: false, teamOption: false });
    setNegotiatingId(null);
  };

  return (
    <div className="free-agent-page">
      <div className="fa-header">
        <h4><TeamText text={title} /></h4>
        {team && (
          <p className="hint-text">
            You currently have {openRosterSpots} open roster spot{openRosterSpots === 1 ? '' : 's'} and{' '}
            <span className={capSpace >= 0 ? 'fa-cap-ok' : 'fa-cap-over'}>{fmtMoney(Math.abs(capSpace))}</span>{' '}
            {capSpace >= 0 ? 'in cap space' : 'over the cap'}.
          </p>
        )}
        <p className="hint-text">Min contract: {fmtMoney(capSettings.minSalary)} &nbsp;·&nbsp; Max contract: {fmtMoney(maxSalary)}</p>
        {allLastSeason
          ? <p className="hint-text">Every stat below is from last season: free agents haven't played any games yet while unsigned.</p>
          : <p className="hint-text">Stats tagged <span className="fa-last-season-tag">Last season</span> are from last season — free agents haven't played any games yet while unsigned.</p>}
        {disabledReason && <p className="calendar-banner">{disabledReason}</p>}
      </div>

      <div className="fa-controls">
        <button className={affordableOnly ? 'active' : ''} onClick={() => setAffordableOnly((v) => !v)}>Show players you can afford now</button>
        <select value={perPage} onChange={(e) => setPerPage(Number(e.target.value))}>
          {[25, 50, 100].map((n) => <option key={n} value={n}>{n} per page</option>)}
        </select>
        <input className="db-search" type="text" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {rows.length === 0 ? (
        <p className="empty-state">No free agents match right now.</p>
      ) : (
        <table className="db-table stat-line-table fa-table">
          <thead>
            <tr>
              <th className="col-name">Name</th><th>Pos</th><th>Age</th><th>Ovr</th><th>Pot</th>
              <th>MP</th><th>PTS</th><th>TRB</th><th>AST</th><th>PER</th><th>Mood</th>
              <th title="What he needs from your team">Asking For</th><th>Exp</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Fragment key={r.season.playerId}>
                <tr>
                  <td className="col-name" onClick={() => onSelectPlayer(r.season.playerId)} style={{ cursor: 'pointer' }}>
                    <PlayerNameTag playerId={r.season.playerId} teamId={r.season.teamId} jerseyNumber={r.season.jerseyNumber} size={24} />
                  </td>
                  <td>{primaryPosition(r.season)}</td>
                  <td>{r.season.age}</td>
                  <td>{r.overall}</td>
                  <td>{r.potential}</td>
                  <td>{stat1(r.avg.mpg)}{r.usingLastSeason && !allLastSeason && <span className="fa-last-season-tag" title="These stats are from last season — this player hasn't played any games while unsigned">Last season</span>}</td>
                  <td>{stat1(r.avg.ppg)}</td>
                  <td>{stat1(r.avg.rpg)}</td>
                  <td>{stat1(r.avg.apg)}</td>
                  <td>{stat1(r.avg.efficiency)}</td>
                  <td className={r.verdict?.refuses ? 'fa-refuses' : ''} title={r.verdict?.reason}>{r.mood}</td>
                  <td title={r.ask ? `${r.ask.years} years${r.ask.playerOption ? ', player option' : ''}` : undefined}>{fmtMoney(r.asking)}{r.ask && <small className="fa-ask-years"> · {r.ask.years}y{r.ask.playerOption ? ' PO' : ''}</small>}</td>
                  <td>{Math.max(0, r.season.age - 19)}</td>
                  <td className="fa-actions">
                    <button disabled={!canSign || !!r.verdict?.refuses} title={r.verdict?.refuses ? r.verdict.reason : undefined} onClick={() => startNegotiation(r.season.playerId, r.asking)}>Negotiate</button>
                    <button
                      className="primary"
                      disabled={!canSign || !!r.verdict?.refuses}
                      title={r.verdict?.refuses ? r.verdict.reason : r.verdict ? `${r.verdict.reason} Signs for ${fmtMoney(r.asking)} a year.` : undefined}
                      onClick={() => onSign(r.season.playerId, { annualSalary: r.asking, yearsRemaining: r.ask?.years ?? 2, playerOption: r.ask?.playerOption ?? false, teamOption: false })}
                    >
                      Sign
                    </button>
                  </td>
                </tr>
                {negotiatingId === r.season.playerId && talks && (
                  <tr className="fa-negotiate-row">
                    <td colSpan={14}>
                      <NegotiationPanel league={talks.league} extras={talks.extras} player={r.season} teamId={talks.teamId} onUpdate={talks.onUpdate}
                        onAgree={(contract, next) => { talks.onAgree(r.season.playerId, contract, next); setNegotiatingId(null); }} onClose={() => setNegotiatingId(null)} />
                    </td>
                  </tr>
                )}
                {negotiatingId === r.season.playerId && !talks && (
                  <tr className="fa-negotiate-row">
                    <td colSpan={14}>
                      <div className="identity-grid">
                        <label>
                          Annual Salary
                          <input type="number" step={100000} min={capSettings.minSalary} max={maxSalary} value={offerSalary} onChange={(e) => setOfferSalary(Number(e.target.value))} />
                        </label>
                        <label>
                          Years
                          <input type="number" min={1} max={5} value={offerYears} onChange={(e) => setOfferYears(Number(e.target.value))} />
                        </label>
                        <span className="hint-text">Asking: {fmtMoney(r.asking)}</span>
                        <button className="primary" onClick={() => confirmNegotiation(r.season.playerId)}>Confirm Offer</button>
                        <button onClick={() => setNegotiatingId(null)}>Cancel</button>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
