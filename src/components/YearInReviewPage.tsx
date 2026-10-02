import { useEffect, useMemo, useState } from 'react';
import { ordinal } from '../lib/humanize';
import { PixelIcon } from './PixelIcon';
import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import { buildYearInReview } from '../simulation/yearInReview';
import { computeSeasonAwards, type SeasonAwardsOptions } from '../simulation/awards';
import { TeamLogo } from './TeamLogo';
import { TeamText } from './TeamLink';
import { buildReel } from '../recap/reel';
import { SeasonReel } from './SeasonReel';

interface Props {
  league: League;
  extras: GMLeagueExtras;
  controlledTeamId: string | null;
  awardOptions: SeasonAwardsOptions;
  onOpenAwards: () => void;
  onOpenGame: (gameId: string) => void;
  onSelectPlayer: (id: string) => void;
}

const CHAPTERS = ['Tip-off', 'The story', 'Best moments', 'GM report card', 'The draft board', 'Around the league'] as const;

/** The end-of-season show: your year in chapters, with a GM grade and a look at your draft picks. */
export function YearInReviewPage({ league, extras, controlledTeamId, awardOptions, onOpenAwards, onOpenGame, onSelectPlayer }: Props) {
  const [chapter, setChapter] = useState(0);
  const [reelOpen, setReelOpen] = useState(false);
  const seasonOver = league.seasonPhase === 'awards_recap' || (league.seasonPhase === 'playoffs' && !!league.playoffBracket?.championTeamId);
  const optionsKey = JSON.stringify(awardOptions);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by value: the options object is rebuilt every render
  const awards = useMemo(() => seasonOver ? computeSeasonAwards(league, awardOptions) : null, [league, optionsKey, seasonOver]);
  const review = useMemo(() => seasonOver && controlledTeamId ? buildYearInReview(league, extras, controlledTeamId, awards) : null, [league, extras, controlledTeamId, awards, seasonOver]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input, select, textarea')) return;
      if (e.key === 'ArrowRight') setChapter(c => Math.min(CHAPTERS.length - 1, c + 1));
      if (e.key === 'ArrowLeft') setChapter(c => Math.max(0, c - 1));
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  if (!controlledTeamId) return <p className="empty-state">The Year in Review follows the team you run.</p>;
  if (!review) return <p className="empty-state">The Year in Review airs when the season ends, after the Finals.</p>;
  const team = league.teams.find(t => t.teamId === controlledTeamId)!;
  const last = chapter === CHAPTERS.length - 1;

  return <div className="yir-page">
    {reelOpen && <SeasonReel reel={buildReel(league, review, awards)} onClose={() => setReelOpen(false)} />}
    <nav className="yir-chapters" aria-label="Chapters">
      {CHAPTERS.map((c, i) => <button key={c} className={i === chapter ? 'active' : i < chapter ? 'seen' : ''} onClick={() => setChapter(i)} aria-current={i === chapter}>{c}</button>)}
    </nav>
    <section className="yir-stage" key={chapter} aria-live="polite">
      {chapter === 0 && <div className="yir-title">
        <TeamLogo team={team} size={112} />
        <span className="pixel-eyebrow">{review.seasonYear} · YEAR IN REVIEW</span>
        <h1>{review.teamName}</h1>
        <p className="yir-record">{review.wins}-{review.losses}</p>
        <p className="yir-finish">{review.finish === 'Champion' ? 'CHAMPIONS' : review.finish.toUpperCase()}</p>
        <button className="primary yir-reel-btn" onClick={() => setReelOpen(true)}><PixelIcon name="play" size={14} /> Watch the 20-second reel</button>
        <p className="hint-text">Use the arrows (or ← →) to step through the season.</p>
      </div>}
      {chapter === 1 && <div className="yir-story">
        <h2>The story of the season</h2>
        <ol>{review.story.map((b, i) => <li key={i} className={`tone-${b.tone}`} style={{ animationDelay: `${i * 90}ms` }}><b>{b.title}</b><span><TeamText text={b.text} /></span></li>)}</ol>
      </div>}
      {chapter === 2 && <div className="yir-moments">
        <h2>Best moments</h2>
        {review.moments.length ? <div className="yir-moment-grid">{review.moments.map((m, i) => <article key={i} style={{ animationDelay: `${i * 90}ms` }}>
          <b>{m.title}</b><p><TeamText text={m.text} /></p>
          {m.gameId && <button className="link-button" onClick={() => onOpenGame(m.gameId!)}>Box score</button>}
        </article>)}</div> : <p className="hint-text">No games played this season.</p>}
      </div>}
      {chapter === 3 && <div className="yir-grade">
        <h2>GM report card</h2>
        <div className="yir-grade-row">
          <div className={`yir-letter grade-${review.grade.letter[0].toLowerCase()}`} aria-label={`Grade ${review.grade.letter}`}>{review.grade.letter}</div>
          <ul>{review.grade.parts.map(p => <li key={p.label}>
            <span className="yir-part-label">{p.label}</span>
            <span className="yir-bar"><i style={{ width: `${p.score}%` }} /></span>
            <b>{p.score}</b>
            <small>{p.note}</small>
          </li>)}</ul>
        </div>
      </div>}
      {chapter === 4 && <div className="yir-draft">
        <h2>The draft board</h2>
        <p className="hint-text">Your picks from the last few drafts, ranked against everyone else in their class.</p>
        {review.draft.length ? <table className="db-table stat-line-table"><thead><tr><th className="col-name">Player</th><th>Draft</th><th>Pick</th><th>OVR</th><th>Class rank</th><th>Verdict</th></tr></thead>
          <tbody>{review.draft.map(d => <tr key={d.playerId}><td className="col-name"><button className="link-button" onClick={() => onSelectPlayer(d.playerId)}>{d.playerId}</button></td>
            <td>{d.draftYear}</td><td>{d.pick ?? '—'}</td><td>{d.overall}</td><td>{d.classRank} of {d.classSize}</td>
            <td><span className={`yir-verdict verdict-${d.verdict.toLowerCase().replace(/ /g, '-')}`}>{d.verdict}</span></td></tr>)}</tbody></table>
          : <p className="hint-text">None of your recent draft picks are in the league.</p>}
        {review.steals.length > 0 && <><h4>Steals around the league</h4><ul className="yir-steals">{review.steals.map(s => <li key={s.playerId}>
          <button className="link-button" onClick={() => onSelectPlayer(s.playerId)}>{s.playerId}</button> went {s.pick == null ? 'undrafted' : ordinal(s.pick)} in {s.draftYear}; now {s.classRank === 1 ? 'the best' : `#${s.classRank}`} in his class ({s.overall} OVR).</li>)}</ul></>}
      </div>}
      {chapter === 5 && <div className="yir-league">
        <h2>Around the league</h2>
        <dl>{review.league.map(l => <div key={l.label}><dt>{l.label}</dt><dd><TeamText text={l.text} /></dd></div>)}</dl>
      </div>}
    </section>
    <div className="yir-controls">
      <button disabled={chapter === 0} onClick={() => setChapter(c => c - 1)}>◀ Back</button>
      <span className="yir-progress"><i style={{ width: `${((chapter + 1) / CHAPTERS.length) * 100}%` }} /></span>
      {last ? <button className="primary" onClick={onOpenAwards}>On to the awards <PixelIcon name="play" size={14} /></button> : <button className="primary" onClick={() => setChapter(c => c + 1)}>Next <PixelIcon name="play" size={14} /></button>}
    </div>
  </div>;
}
