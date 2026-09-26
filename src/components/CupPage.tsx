import { useMemo, useState } from 'react';
import type { League } from '../simulation/league';
import { formatSeasonYear } from '../simulation/calendar';
import { CUP_NAME, cupGroupGamesLeft, cupGroupTable, cupLines, type CupGame, type CupState } from '../simulation/cup';
import { BoxScoreTable } from './BoxScoreTable';
import { PlayerNameTag } from './PlayerAvatar';
import { PixelTrophy } from './PixelTrophy';
import { TeamLogo } from './TeamLogo';
import { TeamLink } from './TeamLink';

interface Props { league: League; controlledTeamId: string | null; onSelectPlayer: (id: string) => void }

const STAGE_LABEL: Record<CupGame['stage'], string> = { qf: 'Quarterfinals', sf: 'Semifinals', final: 'Final' };

/** The In-Season Cup: groups, the knockout bracket, honors and past winners. */
export function CupPage({ league, controlledTeamId, onSelectPlayer }: Props) {
  const cup = league.cup?.season === league.season ? league.cup : undefined;
  const past = (league.franchiseHistory ?? []).filter(r => r.cup?.championTeamId).reverse();
  const team = (id: string | null | undefined) => league.teams.find(t => t.teamId === id);
  const name = (id: string | null | undefined) => team(id)?.name ?? id ?? '—';

  return <div className="cup-page">
    <section className="cup-hero">
      <PixelTrophy award="cup" size={64} />
      <div>
        <span className="pixel-eyebrow">{formatSeasonYear(league.season)} · IN-SEASON TOURNAMENT</span>
        <h2>{CUP_NAME}</h2>
        <p>{!cup ? 'The Cup is drawn when a regular season starts. This season is already past the group stage window.'
          : !cup.knockout ? `Group stage: ${cupGroupGamesLeft(league)} Cup games left. Group games are regular-season games that also count for the Cup. Group winners and the best runners-up in each conference reach the knockouts.`
          : cup.championTeamId ? `${name(cup.championTeamId)} are Cup champions.` : 'Knockouts complete.'}</p>
      </div>
      {cup?.championTeamId && <div className="cup-champion">{team(cup.championTeamId) && <TeamLogo team={team(cup.championTeamId)!} size={56} />}
        <div><small>CHAMPIONS</small><b><TeamLink name={name(cup.championTeamId)} /></b>
          {cup.mvpId && <span>Cup MVP: <button className="link-button" onClick={() => onSelectPlayer(cup.mvpId!)}>{cup.mvpId}</button></span>}</div></div>}
    </section>

    {cup?.knockout && <Bracket cup={cup} name={name} onSelectPlayer={onSelectPlayer} controlledTeamId={controlledTeamId} />}
    {cup && <Groups league={league} cup={cup} controlledTeamId={controlledTeamId} name={name} />}
    {cup && <CupLeaders league={league} cup={cup} controlledTeamId={controlledTeamId} name={name} onSelectPlayer={onSelectPlayer} />}

    <section className="dashboard-panel">
      <h5>Past champions</h5>
      {past.length ? <div className="finances-table-wrap"><table className="db-table stat-line-table">
        <thead><tr><th>Season</th><th>Champion</th><th>Runner-up</th><th>Cup MVP</th></tr></thead>
        <tbody>{past.map(r => <tr key={r.season}><td>{formatSeasonYear(r.season)}</td><td><TeamLink name={name(r.cup!.championTeamId)} /></td><td><TeamLink name={name(r.cup!.runnerUpTeamId)} /></td>
          <td>{r.cup!.mvpId ? <button className="link-button" onClick={() => onSelectPlayer(r.cup!.mvpId!)}>{r.cup!.mvpId}</button> : '—'}</td></tr>)}</tbody>
      </table></div> : <p className="hint-text">No Cup has finished yet in this league.</p>}
    </section>
  </div>;
}

function Groups({ league, cup, controlledTeamId, name }: { league: League; cup: CupState; controlledTeamId: string | null; name: (id: string) => string }) {
  return <section className="cup-groups" aria-label="Cup groups">
    {cup.groups.map(g => {
      const rows = cupGroupTable(league, g);
      return <div key={g.id} className="dashboard-panel cup-group">
        <h5>{g.name}</h5>
        <table className="db-table stat-line-table">
          <thead><tr><th>Team</th><th>W</th><th>L</th><th>DIFF</th></tr></thead>
          <tbody>{rows.map((r, i) => {
            const through = cup.qualifiers?.includes(r.teamId);
            return <tr key={r.teamId} className={`${r.teamId === controlledTeamId ? 'current-season-row' : ''} ${through ? 'cup-through' : ''}`}>
              <td><span className="cup-pos">{i + 1}</span><TeamLink name={name(r.teamId)} />{through && <span className="cup-q" title="Reached the knockouts">Q</span>}</td>
              <td>{r.w}</td><td>{r.l}</td><td>{r.pf - r.pa > 0 ? '+' : ''}{r.pf - r.pa}</td></tr>;
          })}</tbody>
        </table>
      </div>;
    })}
  </section>;
}

function Bracket({ cup, name, onSelectPlayer, controlledTeamId }: { cup: CupState; name: (id: string) => string; onSelectPlayer: (id: string) => void; controlledTeamId: string | null }) {
  const [open, setOpen] = useState<string | null>(null);
  const stages: CupGame['stage'][] = ['qf', 'sf', 'final'];
  const openGame = cup.knockout!.find(g => g.id === open);
  return <section className="dashboard-panel cup-bracket-panel">
    <h5>Knockout bracket</h5>
    <div className="cup-bracket">{stages.map(stage => <div key={stage} className={`cup-round cup-round--${stage}`}>
      <span className="cup-round-label">{STAGE_LABEL[stage]}</span>
      <div className="cup-round-games">{cup.knockout!.filter(g => g.stage === stage).map(g => <button key={g.id} className={`cup-match${open === g.id ? ' open' : ''}${g.homeTeamId === controlledTeamId || g.awayTeamId === controlledTeamId ? ' mine' : ''}`} onClick={() => setOpen(open === g.id ? null : g.id)} aria-expanded={open === g.id} title="Box score">
        {[g.homeTeamId, g.awayTeamId].map(id => <span key={id} className={`cup-side${g.winnerTeamId === id ? ' won' : ''}`}><span>{name(id)}</span><b>{id === g.homeTeamId ? g.homeScore : g.awayScore}</b></span>)}
      </button>)}</div>
    </div>)}</div>
    {openGame && <div className="summer-box">
      <BoxScoreTable box={openGame.awayBox} title={name(openGame.awayTeamId)} onSelectPlayer={onSelectPlayer} />
      <BoxScoreTable box={openGame.homeBox} title={name(openGame.homeTeamId)} onSelectPlayer={onSelectPlayer} />
    </div>}
    <p className="hint-text">Knockout games are extra games: they don't count in the standings or season stats. Select a game for its box score.</p>
  </section>;
}

function CupLeaders({ league, cup, controlledTeamId, name, onSelectPlayer }: { league: League; cup: CupState; controlledTeamId: string | null; name: (id: string) => string; onSelectPlayer: (id: string) => void }) {
  const lines = useMemo(() => cupLines(league, cup), [league, cup]);
  const top = lines.filter(l => l.gp >= 2).sort((a, b) => b.pts / b.gp - a.pts / a.gp).slice(0, 12);
  if (!top.length) return null;
  const pg = (v: number, gp: number) => (v / Math.max(1, gp)).toFixed(1);
  return <div className="gm-office-grid">
    {cup.allCup.length > 0 && <section className="dashboard-panel">
      <h5>All-Cup team</h5>
      <ul className="summer-list">{cup.allCup.map(id => { const l = lines.find(x => x.playerId === id); return <li key={id}>
        <button className="prospect-name" onClick={() => onSelectPlayer(id)}><PlayerNameTag playerId={id} size={22} /></button>
        <span className="hint-text">{l ? `${name(l.teamId)} · ${pg(l.pts, l.gp)} PTS · ${pg(l.reb, l.gp)} REB · ${pg(l.ast, l.gp)} AST` : ''}{id === cup.mvpId ? ' · Cup MVP' : ''}</span></li>; })}</ul>
    </section>}
    <section className="dashboard-panel">
      <h5>Cup scoring leaders</h5>
      <div className="finances-table-wrap"><table className="db-table stat-line-table">
        <thead><tr><th>Player</th><th>Team</th><th>GP</th><th>PTS</th><th>REB</th><th>AST</th></tr></thead>
        <tbody>{top.map(l => <tr key={l.playerId} className={l.teamId === controlledTeamId ? 'current-season-row' : undefined}>
          <td><button className="prospect-name" onClick={() => onSelectPlayer(l.playerId)}><PlayerNameTag playerId={l.playerId} size={20} /></button></td>
          <td><TeamLink name={name(l.teamId)} /></td><td>{l.gp}</td><td>{pg(l.pts, l.gp)}</td><td>{pg(l.reb, l.gp)}</td><td>{pg(l.ast, l.gp)}</td></tr>)}</tbody>
      </table></div>
    </section>
  </div>;
}

/** Home panel: your group during the group stage, the champion afterwards. */
export function CupCard({ league, controlledTeamId, onOpen }: { league: League; controlledTeamId: string | null; onOpen: () => void }) {
  const cup = league.cup?.season === league.season ? league.cup : undefined;
  if (!cup) return null;
  const name = (id: string | null) => league.teams.find(t => t.teamId === id)?.name ?? '—';
  const group = cup.groups.find(g => g.teamIds.includes(controlledTeamId ?? '')) ?? cup.groups[0];
  const rows = cupGroupTable(league, group);
  return <section className="dashboard-panel cup-card" aria-label={CUP_NAME}>
    <h5><PixelTrophy award="cup" size={18} /> {CUP_NAME}</h5>
    {cup.championTeamId ? <p className="cup-card-champ"><b>{name(cup.championTeamId)}</b> won the Cup{cup.mvpId ? ` · MVP ${cup.mvpId}` : ''}.{controlledTeamId && cup.qualifiers?.includes(controlledTeamId) ? ` You reached the ${cup.championTeamId === controlledTeamId ? 'top' : 'knockouts'}.` : ''}</p>
      : <>
        <p className="hint-text">{group.name} · {cupGroupGamesLeft(league)} Cup games left league-wide</p>
        <table className="db-table stat-line-table"><tbody>{rows.map((r, i) => <tr key={r.teamId} className={r.teamId === controlledTeamId ? 'current-season-row' : undefined}>
          <td>{i + 1}</td><td className="col-name">{name(r.teamId)}</td><td>{r.w}–{r.l}</td><td>{r.pf - r.pa > 0 ? '+' : ''}{r.pf - r.pa}</td></tr>)}</tbody></table>
      </>}
    <button className="dashboard-link" onClick={onOpen}>» Cup</button>
  </section>;
}

/** One line for a season page (Almanac): who won that season's Cup. */
export function CupSeasonLine({ league, season }: { league: League; season: string }) {
  const live = league.cup?.season === season ? league.cup : undefined;
  const r = live?.knockout ? live : (league.franchiseHistory ?? []).find(x => x.season === season)?.cup;
  if (!r?.championTeamId) return null;
  const name = (id: string | null) => league.teams.find(t => t.teamId === id)?.name ?? id ?? '—';
  return <p className="fo-season-line cup-season-line"><span className="pixel-eyebrow">{CUP_NAME.toUpperCase()}</span>
    <PixelTrophy award="cup" size={18} /> <b>{name(r.championTeamId)}</b> beat {name(r.runnerUpTeamId)} in the final{r.mvpId ? ` · Cup MVP ${r.mvpId}` : ''}</p>;
}
