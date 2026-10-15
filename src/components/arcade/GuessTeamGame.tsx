import { useEffect, useMemo, useState } from 'react';
import type { NbaHistory } from '../../history/nbaHistoryData';
import { PixelIcon } from '../PixelIcon';
import { CourtLineup, type LineupPlayer } from '../CourtLineup';
import { FIVE_SPOTS, assignToSpots } from '../lineupSpots';
import { track } from '../../analytics/track';
import { noteWeekRun } from '../../retention/weekLog';
import { burst } from '../../fx/effects';
import { teamColors } from '../../simulation/teamColors';
import { guessTeamPuzzle, seasonText, GUESS_TEAM_ERAS, GUESS_TEAM_TRIES, type GuessTeamLevel, type GuessTeamPuzzle, type MysteryStarter } from '../../arcade/guessTeam';
import { readArcade, updateArcade, endlessOf, ARCADE_EVENT } from '../../arcade/storage';
import { relicRunOpts } from '../../relics/apply';
import { uncoverSecret, guessTeamSecret } from '../../relics/rewards';
import './categorize.css';

const SITE = 'https://courtvisiongame.com';
const OPTS_KEY = 'cv-guess-team-opts';
const LEVELS: { id: GuessTeamLevel; label: string; blurb: string }[] = [
  { id: 'easy', label: 'Easy', blurb: `Winning teams, box-score clues, ${GUESS_TEAM_TRIES.easy} guesses.` },
  { id: 'normal', label: 'Normal', blurb: `Any decent team, mixed clues, ${GUESS_TEAM_TRIES.normal} guesses.` },
  { id: 'hard', label: 'Hard', blurb: `Any team at all, trivia clues, ${GUESS_TEAM_TRIES.hard} guesses.` },
];
const eraLabel = (d: number) => `${String(d).slice(2)}s`;

interface Opts { level: GuessTeamLevel; eras: number[] }
function readOpts(): Opts {
  try {
    const o = JSON.parse(localStorage.getItem(OPTS_KEY) ?? 'null') as Partial<Opts> | null;
    const eras = Array.isArray(o?.eras) ? o!.eras.filter(e => (GUESS_TEAM_ERAS as readonly number[]).includes(e)) : [];
    return { level: o?.level === 'easy' || o?.level === 'hard' ? o.level : 'normal', eras: eras.length ? eras : [1980, 1990, 2000, 2010, 2020] };
  } catch { return { level: 'normal', eras: [1980, 1990, 2000, 2010, 2020] }; }
}
const writeOpts = (o: Opts) => { try { localStorage.setItem(OPTS_KEY, JSON.stringify(o)); } catch { /* this visit only */ } };

async function share(text: string) {
  try { if (navigator.share) { await navigator.share({ text }); return; } } catch { /* cancelled: copy instead */ }
  try { await navigator.clipboard.writeText(text); } catch { /* nothing to do */ }
}

/** Guess the Team: pick a difficulty and the eras you know, then name the team from its starting five's clues. */
export function GuessTeamGame({ h }: { h: NbaHistory }) {
  const [opts, setOpts] = useState<Opts>(readOpts);
  const [seed, setSeed] = useState<number | null>(null);
  const [rec, setRec] = useState(readArcade);
  useEffect(() => { const sync = () => setRec(readArcade()); window.addEventListener(ARCADE_EVENT, sync); return () => window.removeEventListener(ARCADE_EVENT, sync); }, []);
  const stats = endlessOf(rec).guessTeam;
  const puzzle = useMemo(() => seed == null ? null : guessTeamPuzzle(h, seed, opts.level, opts.eras), [h, seed, opts]);
  const change = (o: Opts) => { setOpts(o); writeOpts(o); };
  const start = () => { setSeed(Math.floor(Math.random() * 2 ** 31)); track('mode_start', { mode: 'guessTeam', level: opts.level }); };

  if (!puzzle) return <section className="arcade-guess-team">
    <p className="hunt-lede">A real NBA starting five stands on the court with their names hidden. Under each player is one clue: that season's averages, his totals, an award, his jersey, his age, his career. The season is shown. Name the team. A wrong guess turns over a second clue for every starter.</p>
    <h3 className="hunt-subhead">Difficulty</h3>
    <div className="cat-levels" role="radiogroup" aria-label="Difficulty">
      {LEVELS.map(l => <button key={l.id} role="radio" aria-checked={opts.level === l.id} className={opts.level === l.id ? 'selected' : ''} onClick={() => change({ ...opts, level: l.id })}><b>{l.label}</b><small>{l.blurb}</small></button>)}
    </div>
    <h3 className="hunt-subhead">Eras</h3>
    <p className="hint-text">Switch off the decades you don't know. At least one stays on.</p>
    <div className="gt-eras" role="group" aria-label="Eras">
      {GUESS_TEAM_ERAS.map(d => { const on = opts.eras.includes(d); return <button key={d} aria-pressed={on} className={on ? 'selected' : ''} disabled={on && opts.eras.length === 1} onClick={() => change({ ...opts, eras: on ? opts.eras.filter(x => x !== d) : [...opts.eras, d].sort() })}>{on ? <PixelIcon name="check" size={12} /> : null}{eraLabel(d)}</button>; })}
    </div>
    <div className="arcade-stats"><span><b>{stats.won}</b><small>Teams named</small></span><span><b>{stats.streak}</b><small>Streak</small></span><span><b>{stats.best}</b><small>Best streak</small></span></div>
    <button className="primary arcade-big" onClick={start}><PixelIcon name="play" size={16} /> Start</button>
  </section>;

  return <section className="arcade-guess-team">
    <Round key={puzzle.seed} puzzle={puzzle} streak={stats.streak} onNext={start} onSetup={() => setSeed(null)} />
  </section>;
}

function Round({ puzzle, streak, onNext, onSetup }: { puzzle: GuessTeamPuzzle; streak: number; onNext: () => void; onSetup: () => void }) {
  const [guesses, setGuesses] = useState<string[]>([]);
  const [filter, setFilter] = useState('');
  // The Film Room (a secret relic): one more guess on every team. The Owl (a pet): both clues from the start.
  const [perks] = useState(() => { const o = relicRunOpts(); return { filmRoom: o.filmRoom, owl: o.pet === 'owl' }; });
  const tries = GUESS_TEAM_TRIES[puzzle.level] + (perks.filmRoom ? 1 : 0);
  const won = guesses.includes(puzzle.abbr), over = won || guesses.length >= tries;
  // A wrong guess turns over the second clue for every starter.
  const shownClues = guesses.length > 0 || over || perks.owl ? 2 : 1;
  const col = teamColors(puzzle.franchise);
  const spots = useMemo(() => assignToSpots(puzzle.starters, FIVE_SPOTS), [puzzle]);
  const players: (LineupPlayer | undefined)[] = spots.map((s, i) => s && (over
    ? { id: s.playerId, name: s.name, pos: s.pos, colors: [col.primary, col.secondary] as [string, string] }
    : { id: s.playerId, name: '?', pos: s.pos, avatarId: `mystery-${puzzle.seed}-${i}`, colors: ['#4a5160', '#c9ccd1'] as [string, string] }));
  const guess = (abbr: string) => {
    if (over || guesses.includes(abbr)) return;
    const next = [...guesses, abbr], nowWon = abbr === puzzle.abbr;
    setGuesses(next); setFilter('');
    if (nowWon) burst(document.querySelector('.gt-court'), { colors: [col.primary, col.secondary, '#ffd166'], count: 40, power: 6 });
    if (nowWon || next.length >= tries) {
      const after = updateArcade(r => { const x = endlessOf(r).guessTeam, s = nowWon ? x.streak + 1 : 0; return { ...r, endless: { ...endlessOf(r), guessTeam: { played: x.played + 1, won: x.won + (nowWon ? 1 : 0), streak: s, best: Math.max(x.best, s) } } }; });
      uncoverSecret(`guess-team-streak:${puzzle.seed}`, guessTeamSecret(endlessOf(after).guessTeam.streak));
      track('mode_finish', { mode: 'guessTeam', won: nowWon, level: puzzle.level, guesses: next.length });
      noteWeekRun('guessTeam', { score: nowWon ? (tries - next.length + 1) * 100 : 0, line: nowWon ? `${puzzle.teamName} in ${next.length}` : `Missed the ${seasonText(puzzle.season)} ${puzzle.teamName}` }, `guess-team-${puzzle.seed}`);
    }
  };
  const nameOf = (abbr: string) => puzzle.choices.find(c => c.abbr === abbr)?.name ?? abbr;
  const shownChoices = puzzle.choices.filter(c => !filter || c.name.toLowerCase().includes(filter.toLowerCase()));
  const ordered: (MysteryStarter | undefined)[] = spots;

  return <>
    <div className="arcade-hilo-top">
      <span>Season <b>{seasonText(puzzle.season)}</b></span>
      <span>Guesses left <b>{tries - guesses.length}</b></span>
      <span>Streak <b>{streak}</b></span>
    </div>
    <div className="gt-court"><CourtLineup players={players} label={over ? `${puzzle.teamName} starters` : 'Mystery starting five'} paint={over ? col.primary : '#5a6170'} /></div>
    <ol className="gt-clues" aria-label="Clues">
      {ordered.map((s, i) => s && <li key={s.playerId}>
        <span className="gt-spot">{FIVE_SPOTS[i]}</span>
        <div>
          {over && <b className="gt-name">{s.name}</b>}
          {s.clues.slice(0, shownClues).map((c, k) => <p key={c.kind} className={k ? 'gt-extra' : ''}><small>{c.label}</small> {c.text}</p>)}
        </div>
      </li>)}
    </ol>
    {guesses.length > 0 && <ul className="gt-tried" aria-label="Your guesses">{guesses.map(g => <li key={g} className={g === puzzle.abbr ? 'hit' : 'miss'}>{g === puzzle.abbr ? <PixelIcon name="check" size={12} /> : <PixelIcon name="cross" size={12} />} {nameOf(g)}</li>)}</ul>}
    {!over && <>
      <input className="year-input gt-filter" value={filter} onChange={e => setFilter(e.target.value)} placeholder={`Filter ${puzzle.choices.length} teams from ${seasonText(puzzle.season)}`} aria-label="Filter the teams" />
      <div className="gt-choices" role="group" aria-label={`Teams in ${seasonText(puzzle.season)}`}>
        {shownChoices.map(c => <button key={c.abbr} disabled={guesses.includes(c.abbr)} onClick={() => guess(c.abbr)}>{c.name}</button>)}
        {!shownChoices.length && <p className="hint-text">No team matches that.</p>}
      </div>
    </>}
    {over && <div className={`arcade-reveal ${won ? 'won' : 'lost'}`}>
      <span className="pixel-eyebrow">{won ? 'YOU GOT IT' : 'THE ANSWER'}</span>
      <h2>{seasonText(puzzle.season)} {puzzle.teamName}</h2>
      <p>Went {puzzle.record} that season.{won ? ` Named in ${guesses.length} guess${guesses.length === 1 ? '' : 'es'}.` : ''}</p>
      <div className="contest-actions">
        <button className="primary arcade-big" onClick={onNext}><PixelIcon name="play" size={16} /> Next team</button>
        <button onClick={onSetup}>Change difficulty or eras</button>
        <button onClick={() => void share(`${won ? `I named the ${seasonText(puzzle.season)} ${puzzle.teamName} from their starting five in ${guesses.length}` : `The ${seasonText(puzzle.season)} ${puzzle.teamName} got me`} on Court Vision's Guess the Team 🏀\n${SITE}`)}>Share</button>
      </div>
    </div>}
  </>;
}
