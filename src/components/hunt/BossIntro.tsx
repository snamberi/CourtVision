import { useEffect, useRef } from 'react';
import type { NbaHistory } from '../../history/nbaHistoryData';
import { seasonLabel } from '../../hunt/cards';
import { bossRoster } from '../../hunt/bossRoster';
import { teamLabel } from '../../hunt/teams';
import { type HuntRun, opponentRating, buffValue } from '../../hunt/run';
import { BUFFS } from '../../hunt/buffs';
import { teamColors } from '../../simulation/teamColors';
import { resolveTeamIdentity } from '../../simulation/teamIdentity';
import { TitleBanner } from '../Banners';
import { PlayerAvatar } from '../PlayerAvatar';
import { ModeIcon } from '../ModeIcon';
import { LineupBoard } from '../presentation/LineupBoard';
import { ModeScene } from '../presentation/ModeScene';
import '../presentation/nextLevel.css';

export function BossIntro({ h, run, onPlay, onBack }: { h: NbaHistory; run: HuntRun; onPlay: () => void; onBack: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const { team, cards } = bossRoster(h, run);
  const s = run.series[run.seriesIndex];
  if (!team || !s) return <button onClick={onBack}>Back to preparation</button>;
  const kit = teamColors(team.abbr), threat = cards[0];
  const players = cards.map(c => ({ id: c.id, name: c.name, pos: c.pos, colors: [kit.primary, kit.secondary] as [string, string], sub: `${seasonLabel(c.end)}${run.view?.numbers === false ? '' : ` · ${c.ovr} OVR`}` }));
  return <section className={`boss-intro boss-${s.kind}`} aria-label="Boss introduction">
    <div className="boss-intro-stage"><ModeScene mode="legends" />
      <div className="boss-intro-title"><ModeIcon mode={s.secret ? 'hunt-legend' : 'tour'} size={84} /><span className="pixel-eyebrow">{s.secret ? 'SECRET BOSS' : s.kind === 'semi' ? 'THE GATEKEEPER' : 'THE FINAL BOSS'}</span><h2 ref={heading} tabIndex={-1}>{teamLabel(team)}</h2><p>{team.w}–{team.l} · {team.champion ? 'Championship team' : 'Title contender'} · best of seven</p></div>
      {team.champion && <div className="boss-title-banner"><TitleBanner identity={resolveTeamIdentity({ teamId: team.abbr, name: team.name })} year={seasonLabel(team.end)} /></div>}
    </div>
    {threat && <div className="boss-threat"><PlayerAvatar playerId={threat.name} primaryColor={kit.primary} secondaryColor={kit.secondary} size={96} /><div><span className="pixel-eyebrow">BIGGEST THREAT</span><h3>{threat.name}</h3><p>{threat.pos} · {seasonLabel(threat.end)}{run.view?.numbers === false ? '' : ` · ${threat.ovr} OVR`}</p><small>The highest-rated player in the opponent's available rotation.</small></div><strong>{run.view?.numbers === false ? 'BOSS' : opponentRating(h, run, s)}<small>TEAM RATING</small></strong></div>}
    <LineupBoard title="The opposition" players={players.slice(0, 5)} bench={players.slice(5)} paint={kit.primary} />
    <div className="boss-modifiers">{s.lift > 0 && <span><b>Dynasty strength</b> +{s.lift} across the roster</span>}{s.buffs.map(b => <span key={b}><b>{BUFFS[b].name}</b>{BUFFS[b].blurb(buffValue(run, b, s.kind))}</span>)}</div>
    <div className="boss-intro-actions"><button onClick={onBack}>Back to preparation</button><button className="primary" onClick={onPlay}>Start series</button></div>
  </section>;
}
