import type { MenuDesign } from '../../menu/design';
import { useEffect, useState } from 'react';
import { modesIn, type ArcadeTabId, type ModeEntry } from '../../menu/modeCatalog';
import { readLegendsRun, readStreetBest, readTour } from '../../arcade/streetRecords';
import { ARCADE_EVENT, endlessOf, guessStreak, gridStreak, isGuessDone, readArcade } from '../../arcade/storage';
import { readDailyDraft } from '../../arcade/dailyDraft';
import { loadOne } from '../../arcade/oneOnOne';
import { weekKey } from '../../retention/week';
import { ModePicker } from './ModePicker';

const groups = {
  'Arcade': ['legends', 'street', 'oneOnOne'],
  'Puzzle': ['grid', 'guess', 'categorize', 'guessTeam', 'hilo', 'quiz'],
  'Challenge': ['dailyDraft', 'bracket', 'tour'],
} satisfies Record<string, ArcadeTabId[]>;
type Filter = 'All' | keyof typeof groups;
const filters: Filter[] = ['All', 'Arcade', 'Puzzle', 'Challenge'];
const games = modesIn('quick', 'compete').filter((e): e is ModeEntry & { action: { kind: 'arcade'; tab: ArcadeTabId } } => e.action.kind === 'arcade');
const inFilter = (e: typeof games[number], f: Filter) => f === 'All' || (groups[f] as ArcadeTabId[]).includes(e.action.tab);

function gameStats(): Record<ArcadeTabId, [string, string]> {
  const day = new Date().toISOString().slice(0, 10);
  const records = readArcade(), endless = endlessOf(records);
  const week = weekKey(), legends = readLegendsRun(week), tour = readTour(week);
  const gridRun = gridStreak(records, day).current, guessRun = guessStreak(records, day).current;
  const grid = records.grid?.[day], guess = records.guess[day], bracket = records.bracket[week];
  const draft = readDailyDraft()[day], one = loadOne();
  return {
    grid: ['Today’s grid', grid ? `${grid.cells.filter(Boolean).length} / 9` : gridRun ? `${gridRun}-day streak` : 'New grid'],
    guess: ['Daily puzzle', isGuessDone(guess) ? (guess.won ? `Solved in ${guess.guesses.length}` : 'Completed') : guessRun ? `${guessRun}-day streak` : 'New puzzle'],
    categorize: ['Best streak', String(endless.categorize.best)],
    guessTeam: ['Best streak', String(endless.guessTeam.best)],
    dailyDraft: ['Today’s draft', draft?.grade ?? 'Open'],
    hilo: ['Best streak', String(records.hilo.best)],
    bracket: ['This week', bracket?.played ? `${bracket.score} pts` : bracket?.locked ? 'Picks locked' : 'Picks open'],
    quiz: ['Best round', String(endless.quiz.best)],
    legends: legends ? ['This week', `${legends.round} / 6 wins`] : ['Tournament field', '64 legends'],
    street: ['Best win streak', String(readStreetBest())],
    oneOnOne: ['Your record', `${one.w} W · ${one.l} L`],
    tour: tour ? ['Rounds revealed', `${tour.revealed} / 4`] : ['Weekly field', '16 GMs'],
  };
}

export function MinigamesHub({ design = 'fieldhouse', onOpen }: { design?: MenuDesign; onOpen: (entry: ModeEntry) => void }) {
  const [filter, setFilter] = useState<Filter>('All');
  const [id, setId] = useState(games[0].id);
  const [stats, setStats] = useState(gameStats);
  useEffect(() => {
    const refresh = () => setStats(gameStats());
    window.addEventListener(ARCADE_EVENT, refresh);
    return () => window.removeEventListener(ARCADE_EVENT, refresh);
  }, []);
  const visible = games.filter(e => inFilter(e, filter));
  const selected = visible.find(e => e.id === id) ?? visible[0];
  return <div className="arena-minis">
    <div className="arena-heading"><h1>Minigames</h1></div>
    <div className="arena-filters" role="group" aria-label="Filter minigames">{filters.map(f =>
      <button type="button" key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>
        {f} <span>({games.filter(e => inFilter(e, f)).length})</span>
      </button>)}</div>
    <ModePicker design={design} label="Game list" entries={visible} selected={selected} onSelect={e => setId(e.id)}
      onPlay={() => onOpen(selected)} record={e => stats[e.action.tab]} />
  </div>;
}
