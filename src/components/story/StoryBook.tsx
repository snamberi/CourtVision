import { useState } from 'react';
import { ordinal, gameScore, PATHS, type JournalEntry, type StoryState } from '../../story/story';
import { SEASON_STOPS, type NbaCtx, type NbaStop, type StoryNba } from '../../story/storyNba';
import { PixelIcon } from '../PixelIcon';
import { formatSeasonYear } from '../../simulation/calendar';
import { TROPHIES, type TrophyKey } from '../../simulation/trophies';

/*
 * Story Mode's other pages, beside the story itself: where you are in the season, the journal of everything that
 * happened, the people on the road with you, and the trophy case.
 */

export type StoryTab = 'story' | 'journal' | 'people' | 'trophies';
const TABS: { id: StoryTab; label: string; icon: string }[] = [
  { id: 'story', label: 'Story', icon: 'book' },
  { id: 'journal', label: 'Journal', icon: 'calendar' },
  { id: 'people', label: 'People', icon: 'heart' },
  { id: 'trophies', label: 'Trophies', icon: 'trophy' },
];

export function StoryTabs({ tab, onTab, pages }: { tab: StoryTab; onTab: (t: StoryTab) => void; pages: number }) {
  return <nav className="story-tabs" role="tablist" aria-label="Story pages">
    {TABS.map(t => <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => onTab(t.id)}>
      <PixelIcon name={t.icon} size={14} /> {t.label}{t.id === 'journal' && pages ? <small>{pages}</small> : null}
    </button>)}
  </nav>;
}

// ---------------------------------------------------------------- the season track

const TRACK: Record<NbaStop, string> = {
  camp: 'Camp', opener: 'Opener', early: 'November', christmas: 'Christmas', deadline: 'Deadline', allStar: 'All-Star',
  stretch: 'Stretch run', finale: 'Last week', playoffs: 'Playoffs', awards: 'Awards', summer: 'Summer',
};

/** The season's stops, done and to come. */
export function SeasonTrack({ n }: { n: StoryNba }) {
  const at = SEASON_STOPS.indexOf(n.stop);
  return <ol className="story-track" aria-label="This season">
    {SEASON_STOPS.map((stop, i) => <li key={stop} className={i < at ? 'done' : i === at ? 'now' : ''} aria-current={i === at ? 'step' : undefined}>{TRACK[stop]}</li>)}
  </ol>;
}

// ---------------------------------------------------------------- the journal

type JournalFilter = 'all' | JournalEntry['kind'];
const FILTERS: { id: JournalFilter; label: string }[] = [{ id: 'all', label: 'Everything' }, { id: 'choice', label: 'Choices' }, { id: 'game', label: 'Games' }, { id: 'season', label: 'Seasons' }];
const PAGE = 40;

export function Journal({ s }: { s: StoryState }) {
  const [filter, setFilter] = useState<JournalFilter>('all');
  const [shown, setShown] = useState(PAGE);
  const all = [...(s.journal ?? [])].reverse();
  const pages = filter === 'all' ? all : all.filter(e => e.kind === filter);
  if (!all.length) return <section className="story-book"><h2>Journal</h2><p className="hint-text">Every choice you make and every big game you play is written down here.</p></section>;
  return <section className="story-book">
    <h2>Journal</h2>
    <div className="story-filters" role="group" aria-label="Show">{FILTERS.map(f => <button key={f.id} className={filter === f.id ? 'active' : ''} aria-pressed={filter === f.id} onClick={() => { setFilter(f.id); setShown(PAGE); }}>{f.label}</button>)}</div>
    <ol className="story-journal">
      {pages.slice(0, shown).map((e, i) => <li key={i} className={`kind-${e.kind}`}>
        <small>{e.when}</small>
        <b>{e.title}</b>
        {e.pick && <span className="story-pick">You chose: {e.pick}</span>}
        <p>{e.text}</p>
      </li>)}
    </ol>
    {pages.length > shown && <button onClick={() => setShown(shown + PAGE)}>Show older pages ({pages.length - shown} more)</button>}
  </section>;
}

// ---------------------------------------------------------------- the people

const BOND_WORD = (n: number) => (n >= 5 ? 'Family' : n >= 3 ? 'Close' : n >= 1 ? 'Friendly' : n >= -1 ? 'Distant' : 'Cold');
const RIVAL_WORD = (n: number) => (n >= 2 ? 'Respect' : n >= 0 ? 'Rivals' : n >= -2 ? 'Bad blood' : 'Enemies');

interface Person { id: string; name: string; role: string; bond: number | null; word: string; now: string }

function peopleOf(s: StoryState, ctx: NbaCtx | null): Person[] {
  const has = (f: string) => s.flags.includes(f);
  const seen = (id: string) => !!s.nba?.seen.includes(id);
  const nba = !!s.nba;
  const ice = ctx?.iceRetired ? 'Retired. Still posts photos from Carver Park.'
    : ctx?.ice ? `${ctx.ice.teamName} · ${ctx.ice.ppg} points a game · OVR ${ctx.ice.ovr}`
      : s.draft?.icePick ? `Drafted ${ordinal(s.draft.icePick)} by ${s.draft.iceTeam}.`
        : has('aauIce') ? 'Your AAU teammate, for one summer.' : 'The city\'s best player. For now.';
  return [
    { id: 'mom', name: 'Mom', role: 'Never misses a game', bond: null, word: '',
      now: has('momHouse') ? 'Lives in the house you bought her.' : has('momPromise') ? 'You promised her a house one day.' : 'Works at the hospital, and at the store on weekends.' },
    { id: 'maya', name: 'Maya', role: 'Your little sister', bond: s.bonds.maya ?? 0, word: BOND_WORD(s.bonds.maya ?? 0),
      now: has('mayaPro') ? 'Plays in the WNBA. She thinks she shoots better than you.' : has('mayaCollege') ? 'Plays college ball. Her games are on TV now.' : nba ? 'Plays for Douglass High, like you did.' : 'Watches every game through the fence at Carver Park.' },
    { id: 'dre', name: 'Dre', role: 'Best friend since Carver Park', bond: s.bonds.dre, word: BOND_WORD(s.bonds.dre),
      now: has('dreManager') ? 'Your manager. He reads every contract twice.' : has('dreCamp') ? 'Runs your youth camps back home.' : s.bonds.dre <= -1 ? 'You haven\'t talked in a while.' : 'Talks enough trash for both of you.' },
    { id: 'ray', name: 'Coach Ray', role: 'Runs the rec center', bond: s.bonds.ray, word: BOND_WORD(s.bonds.ray),
      now: seen('ray-florida') ? 'Moved to Florida. Still calls after big games.' : s.bonds.ray <= -1 ? 'Tells the kids about you. Leaves some parts out.' : 'Opens the rec-center gym at 7 AM, every day.' },
    { id: 'ice', name: 'Marcus "Ice" Vance', role: 'Your rival', bond: s.bonds.ice, word: RIVAL_WORD(s.bonds.ice), now: ice },
  ];
}

export function People({ s, ctx }: { s: StoryState; ctx: NbaCtx | null }) {
  return <section className="story-book">
    <h2>People</h2>
    <ul className="story-people">
      {peopleOf(s, ctx).map(p => <li key={p.id}>
        <div><b>{p.name}</b><small>{p.role}</small></div>
        {p.bond != null && <div className="story-bond" aria-label={`${p.word}, ${p.bond} of 6`}>
          <div className="hunt-cap-bar"><i style={{ width: `${Math.max(4, ((p.bond + 5) / 11) * 100)}%` }} /></div><span>{p.word}</span>
        </div>}
        <p>{p.now}</p>
      </li>)}
    </ul>
  </section>;
}

// ---------------------------------------------------------------- the trophy case

const FINAL_FOUR: Record<string, string> = { blueblood: 'Final Four', midmajor: 'Final Four', overseas: 'EuroLeague Final Four', gleague: 'G League champion', juco: 'National juco champion' };

interface Trophy { key: string; label: string; count: number; when: string[] }

function trophiesOf(s: StoryState): Trophy[] {
  const out = new Map<string, Trophy>();
  for (const y of s.nba?.years ?? []) for (const a of y.awards) {
    const t = out.get(a.key) ?? { key: a.key, label: a.label, count: 0, when: [] };
    t.count++; t.when.push(formatSeasonYear(y.season));
    out.set(a.key, t);
  }
  // The biggest honours first (the same weights the Hall of Fame uses).
  const weight = (k: string) => TROPHIES[k as TrophyKey]?.prestige ?? 0;
  return [...out.values()].sort((a, b) => weight(b.key) - weight(a.key));
}

export function Trophies({ s }: { s: StoryState }) {
  const nba = trophiesOf(s);
  const road: string[] = [
    ...(s.flags.includes('stateChamp') ? ['State champion'] : []),
    ...(s.flags.includes('finalFour') ? [FINAL_FOUR[s.path ?? 'midmajor']] : []),
    ...(s.draft ? [s.draft.pick ? `${ordinal(s.draft.pick)} pick in the draft` : 'Undrafted, and signed anyway'] : []),
  ];
  const wins = s.games.filter(g => g.won).length;
  const best = [...s.games].sort((a, b) => gameScore(b.line) - gameScore(a.line))[0];
  return <section className="story-book">
    <h2>Trophy case</h2>
    {nba.length ? <ul className="story-trophies">{nba.map(t => <li key={t.key} className={t.key === 'champion' || t.key === 'mvp' || t.key === 'fmvp' ? 'gold' : ''}>
      <PixelIcon name={t.key === 'champion' ? 'trophy' : t.key.startsWith('all') ? 'star' : 'medal'} size={22} />
      <b>{t.count > 1 ? `${t.count}× ` : ''}{t.label}</b>
      <small>{t.when.join(', ')}</small>
    </li>)}</ul> : <p className="hint-text">{s.nba ? 'No NBA awards yet. Every season is a new chance.' : 'Your NBA trophies go here.'}</p>}
    <h3 className="hunt-subhead">The road</h3>
    {road.length ? <ul className="story-road">{road.map(r => <li key={r}><PixelIcon name="crown" size={14} /> {r}</li>)}</ul> : <p className="hint-text">State titles, tournament runs and draft night go here.</p>}
    <p className="hint-text">Big games: {wins}-{s.games.length - wins}{s.path ? ` · ${PATHS[s.path].name}` : ''}{best ? ` · Best: ${best.line.pts} PTS, ${best.line.reb} REB, ${best.line.ast} AST vs ${best.opp}` : ''}</p>
  </section>;
}
