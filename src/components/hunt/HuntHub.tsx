import { useMemo, useState } from 'react';
import type { NbaHistory } from '../../history/nbaHistoryData';
import { cardPool, seasonLabel, RARITY_LABEL, type HuntCard } from '../../hunt/cards';
import { ERAS, eraOf } from '../../hunt/eras';
import { DECKS, DIFFICULTIES, SQUAD_SIZE, SERIES_COUNT, ENEMY_EDGE, MAX_BOOSTS, type DeckId, type Difficulty, type NewRunOptions } from '../../hunt/run';
import { MAX_ITEMS } from '../../hunt/items';
import { DECK_IDS, DIFFICULTY_IDS, deckUnlocked, difficultyUnlocked, loadAlbum, todayUtc, dailySeed, weeklyHunt, type HuntRecords } from '../../hunt/storage';
import { weekKey } from '../../retention/week';
import { dreamGame, teamsIn, seasonEnds, type DreamGame } from '../../hunt/matchup';
import { BoxScoreTable } from '../BoxScoreTable';
import { WatchGame } from '../WatchGame';
import { LegendChallenges } from './LegendChallenges';

type HubTab = 'hunt' | 'weekly' | 'daily' | 'legend' | 'album' | 'dream';

/** The League Hunt home: start a hunt (deck and difficulty), the Daily Legend, the album and Dream Matchup. */
export function HuntHub({ h, records, onStart }: { h: NbaHistory; records: HuntRecords; onStart: (seed: number, opts: NewRunOptions) => void }) {
  const [tab, setTab] = useState<HubTab>('hunt');
  return <section className="hunt-hub">
    <div className="stats-view-toggle hunt-hub-tabs" role="tablist" aria-label="League Hunt">
      {([['hunt', 'New Hunt'], ['weekly', 'Weekly Hunt'], ['daily', 'Daily Legend'], ['legend', 'Legend Challenges'], ['album', 'Album'], ['dream', 'Dream Matchup']] as const).map(([id, label]) =>
        <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}
    </div>
    {tab === 'hunt' ? <NewHunt records={records} onStart={opts => onStart(Math.floor(Math.random() * 1_000_000_000), opts)} />
      : tab === 'weekly' ? <Weekly records={records} onStart={(seed, opts) => onStart(seed, opts)} />
      : tab === 'daily' ? <Daily records={records} onStart={(seed, opts) => onStart(seed, opts)} />
      : tab === 'legend' ? <LegendChallenges h={h} />
      : tab === 'album' ? <Album h={h} />
      : <DreamMatchup h={h} />}
  </section>;
}

function NewHunt({ records, onStart }: { records: HuntRecords; onStart: (opts: NewRunOptions) => void }) {
  const [deck, setDeck] = useState<DeckId>('classic');
  const [difficulty, setDifficulty] = useState<Difficulty>('pro');
  return <div className="hunt-intro">
    <p className="hunt-lede">Spin a {SQUAD_SIZE}-man squad and a coach from all of NBA history, then win ten best-of-seven series against real teams, each under the rules of its era. Series 5 is a semi-boss; series 10 is the boss, an all-time great. Every team you face plays {ENEMY_EDGE} above its rating: it is meant to be hard.</p>
    <ul className="hunt-rules">
      <li><b>The slot machine.</b> All seven slots (PG, SG, SF, PF, C, sixth man and coach) spin at once. Hit <b>STOP</b>, lock one, and the rest spin again, until everyone is locked. The reels are <b>blind</b>: you see the player, his season and team, but not his rating until you lock him. Every round is a little poorer than the last, and one early round lands a Star, another a Great. Your locks earn a draft grade.</li>
      <li><b>Cards are player-seasons.</b> 1996 Jordan and 2003 Jordan are different cards. Ratings are ranked within each season, so every era is fair.</li>
      <li><b>Team rating, 0-100.</b> 60 is a bad team, 70 about 40 wins, 80 about 45, 90 a 55-62 win team, 100 a 68-win all-time great.</li>
      <li><b>Boosts, two kinds.</b> Pick a boost after a series win ({MAX_BOOSTS} per hunt). Separately, a shop comes before series 1, 3, 5, 7 and 9: players, coaches, training and shop boosts ({MAX_ITEMS} per hunt; lives only on Rookie). The team's focus is chosen once, at training camp, and can't be changed.</li>
      <li><b>Era rules and chemistry.</b> No three-point line before 1979-80, hand-checking in the 90s. Real teammates, franchises and famous rivals play better together.</li>
    </ul>
    <h3 className="hunt-subhead">Starting deck</h3>
    <div className="hunt-choices">{DECK_IDS.map(id => { const d = DECKS[id], open = deckUnlocked(records, id); return <button key={id} className={`hunt-choice ${deck === id ? 'on' : ''}`} disabled={!open} aria-pressed={deck === id} onClick={() => setDeck(id)}>
      <b>{d.name}</b><span>{open ? d.blurb : `Locked: ${d.unlock}`}</span></button>; })}</div>
    <h3 className="hunt-subhead">Difficulty</h3>
    <div className="hunt-choices">{DIFFICULTY_IDS.map(id => { const d = DIFFICULTIES[id], open = difficultyUnlocked(records, id); return <button key={id} className={`hunt-choice ${difficulty === id ? 'on' : ''}`} disabled={!open} aria-pressed={difficulty === id} onClick={() => setDifficulty(id)}>
      <b>{d.name}</b><span>{open ? d.blurb : `Locked: ${d.unlock}`}</span></button>; })}</div>
    <button className="primary hunt-start" onClick={() => onStart({ deck, difficulty })}>Start a new hunt</button>
    {records.runs > 0 && <p className="hint-text">Your hunts: {records.runs} · won {records.wins} · furthest series {records.bestStop + 1} of {SERIES_COUNT}</p>}
  </div>;
}

function Daily({ records, onStart }: { records: HuntRecords; onStart: (seed: number, opts: NewRunOptions) => void }) {
  const today = todayUtc();
  const done = records.daily?.[today];
  const past = Object.entries(records.daily ?? {}).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 10);
  const streak = (() => { let n = 0; const d = new Date(`${today}T00:00:00Z`); for (;;) { const key = d.toISOString().slice(0, 10); if (!records.daily?.[key]) break; n++; d.setUTCDate(d.getUTCDate() - 1); } return n; })();
  return <div className="hunt-intro">
    <p className="hunt-lede">One hunt a day, the same for everyone: the same stops, the same boss and the same cards on the table. Classic deck, Pro difficulty, one try.</p>
    <p><b>{today}</b> (UTC){streak > 1 ? ` · ${streak}-day streak` : ''}</p>
    {done ? <p className="hunt-note">Today's hunt is done: {done.won ? 'you beat the boss' : `you reached series ${done.stop + 1} of ${SERIES_COUNT}`} ({done.wins}-{done.losses}). A new one arrives at midnight UTC.</p>
      : <button className="primary hunt-start" onClick={() => onStart(dailySeed(today), { deck: 'classic', difficulty: 'pro', daily: today })}>Play today's Daily Legend</button>}
    {past.length > 0 && <><h3 className="hunt-subhead">Your recent days</h3>
      <ol className="hunt-log">{past.map(([date, r]) => <li key={date} className={r.won ? 'won' : 'lost'}>{date} · {r.won ? 'Beat the boss' : `Series ${r.stop + 1}`} · {r.wins}-{r.losses}</li>)}</ol></>}
  </div>;
}

function Weekly({ records, onStart }: { records: HuntRecords; onStart: (seed: number, opts: NewRunOptions) => void }) {
  const [now] = useState(() => new Date());
  const week = weekKey(now);
  const w = weeklyHunt(week), best = records.weekly?.[week];
  const end = new Date(now); end.setUTCDate(end.getUTCDate() + ((8 - (end.getUTCDay() || 7)) % 7 || 7)); end.setUTCHours(0, 0, 0, 0);
  const days = Math.max(1, Math.ceil((end.getTime() - now.getTime()) / 86_400_000));
  const past = Object.entries(records.weekly ?? {}).filter(([k]) => k !== week).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 8);
  return <div className="hunt-intro">
    <p className="hunt-lede">One hunt for the whole week, the same for everyone: the same reels, the same ten teams and the same boss. Play it as often as you like; your <b>best</b> attempt counts on the Weekly Hunt board. Finish in the <b>top 10%</b> when the week ends to win the <b>Weekly Hunter</b> title and the hunter's flame aura for your character.</p>
    <div className="hunt-over-stats"><div><small>THIS WEEK</small><b>{week}</b></div><div><small>DECK</small><b>{DECKS[w.deck].name}</b></div><div><small>DIFFICULTY</small><b>{DIFFICULTIES[w.difficulty].name}</b></div><div><small>ENDS IN</small><b>{days} day{days === 1 ? '' : 's'}</b></div></div>
    {best && <p className="hunt-note">Your best this week: {best.won ? 'beat the boss' : `reached series ${best.stop + 1} of ${SERIES_COUNT}`} ({best.wins}-{best.losses}){best.tries ? ` · ${best.tries} attempt${best.tries === 1 ? '' : 's'}` : ''}.</p>}
    <button className="primary hunt-start" onClick={() => onStart(w.seed, { deck: w.deck, difficulty: w.difficulty, weekly: week })}>{best ? 'Try the Weekly Hunt again' : "Play this week's hunt"}</button>
    <p className="hint-text">The board is in Community → Leaderboards → Weekly Hunt. A new hunt arrives every Monday (UTC).</p>
    {past.length > 0 && <><h3 className="hunt-subhead">Your past weeks</h3>
      <ol className="hunt-log">{past.map(([k, r]) => <li key={k} className={r.won ? 'won' : 'lost'}>{k} · {r.won ? 'Beat the boss' : `Series ${r.stop + 1}`} · {r.wins}-{r.losses}</li>)}</ol></>}
  </div>;
}

function Album({ h }: { h: NbaHistory }) {
  const pool = cardPool(h);
  const album = useMemo(() => loadAlbum(), []);
  const [eraId, setEraId] = useState(ERAS[0].id);
  const era = ERAS.find(e => e.id === eraId)!;
  const inEra = (c: HuntCard) => eraOf(c.end).id === era.id;
  const stars = pool.cards.filter(c => (c.rarity === 'legendary' || c.rarity === 'epic') && inEra(c));
  const mine = [...album].map(id => pool.byId.get(id)).filter((c): c is HuntCard => !!c);
  const mineHere = mine.filter(inEra).sort((a, b) => b.ovr - a.ovr);
  const starsHave = stars.filter(c => album.has(c.id)).length;
  const legendaryHave = mine.filter(c => c.rarity === 'legendary').length;
  return <div className="hunt-album">
    <p className="hunt-lede">Every card you have had on a squad. Complete an era by collecting its Great and Star cards.</p>
    <div className="hunt-over-stats"><div><small>CARDS</small><b>{mine.length}</b></div><div><small>LEGENDARY</small><b>{legendaryHave}</b></div><div><small>ERAS STARTED</small><b>{ERAS.filter(e => mine.some(c => eraOf(c.end).id === e.id)).length} / {ERAS.length}</b></div></div>
    <div className="stats-view-toggle" role="tablist" aria-label="Eras">{ERAS.map(e => { const n = mine.filter(c => eraOf(c.end).id === e.id).length; return <button key={e.id} role="tab" aria-selected={e.id === eraId} className={e.id === eraId ? 'active' : ''} onClick={() => setEraId(e.id)}>{e.label} ({n})</button>; })}</div>
    <div className="hunt-album-progress"><span>{era.label}: {starsHave} of {stars.length} stars</span><div className="hunt-cap-bar"><i style={{ width: `${stars.length ? starsHave / stars.length * 100 : 0}%` }} /></div></div>
    {mineHere.length === 0 ? <p className="empty-state">No cards from {era.label} yet. Draft some on your next hunt.</p>
      : <ul className="hunt-album-grid">{mineHere.map(c => <li key={c.id} className={`rarity-${c.rarity}`}><b>{c.ovr}</b><span>{c.name}</span><small>{seasonLabel(c.end)} · {c.teamName} · {RARITY_LABEL[c.rarity]}</small></li>)}</ul>}
  </div>;
}

/** Any two real team-seasons, under any era's rules. Also the "Dream Matchup" page in the main game. */
export function DreamMatchup({ h }: { h: NbaHistory }) {
  const ends = useMemo(() => seasonEnds(h), [h]);
  const [endA, setEndA] = useState(1996), [endB, setEndB] = useState(2017);
  const teamsA = useMemo(() => teamsIn(h, endA), [h, endA]), teamsB = useMemo(() => teamsIn(h, endB), [h, endB]);
  const [a, setA] = useState<string>(''), [b, setB] = useState<string>('');
  const idA = teamsA.some(t => t.id === a) ? a : teamsA[0]?.id ?? '', idB = teamsB.some(t => t.id === b) ? b : teamsB[0]?.id ?? '';
  const [eraId, setEraId] = useState<string>('home');
  const [game, setGame] = useState<DreamGame | null>(null);
  const [watching, setWatching] = useState(false);
  const eraFor = () => (eraId === 'home' ? eraOf(endA) : ERAS.find(e => e.id === eraId)!);
  const play = (watch: boolean) => { const g = dreamGame(h, idA, idB, eraFor(), Math.floor(Math.random() * 1_000_000)); setGame(g); setWatching(!!g && watch); };
  if (watching && game) return <div className={`hunt-watch era-${game.era.id}`}><WatchGame game={game.result} home={game.home} away={game.away} homeRoster={game.home.seasons} awayRoster={game.away.seasons} onBoxScore={() => setWatching(false)} /></div>;
  const picker = (label: string, end: number, setEnd: (n: number) => void, teams: ReturnType<typeof teamsIn>, id: string, setId: (s: string) => void) => <fieldset className="hunt-dream-side"><legend>{label}</legend>
    <label>Season <select value={end} onChange={e => { setEnd(Number(e.target.value)); setGame(null); }}>{ends.map(y => <option key={y} value={y}>{seasonLabel(y)}</option>)}</select></label>
    <label>Team <select value={id} onChange={e => { setId(e.target.value); setGame(null); }}>{teams.map(t => <option key={t.id} value={t.id}>{t.name} ({t.w}-{t.l}{t.champion ? ', champions' : ''})</option>)}</select></label>
  </fieldset>;
  return <div className="hunt-dream">
    <p className="hunt-lede">Any two real team-seasons, under the rules of any era.</p>
    <div className="hunt-dream-pickers">{picker('Home', endA, setEndA, teamsA, idA, setA)}{picker('Away', endB, setEndB, teamsB, idB, setB)}</div>
    <label className="hunt-dream-era">Rules <select value={eraId} onChange={e => { setEraId(e.target.value); setGame(null); }}>
      <option value="home">The home team's era</option>{ERAS.map(e => <option key={e.id} value={e.id}>{e.label}: {e.blurb}</option>)}</select></label>
    <div className="contest-actions"><button className="primary" disabled={!idA || !idB || idA === idB} onClick={() => play(true)}>Watch it</button><button disabled={!idA || !idB || idA === idB} onClick={() => play(false)}>Sim it</button></div>
    {game && <>
      <div className="hunt-result"><span className="pixel-eyebrow">{game.era.label.toUpperCase()} RULES</span><strong className="hunt-score">{game.result.homeScore} — {game.result.awayScore}</strong><p>{game.home.name} vs {game.away.name}</p>
        <div className="contest-actions"><button onClick={() => setWatching(true)}>Watch the replay</button><button onClick={() => play(false)}>Run it back</button></div></div>
      <div className="feature-table-scroll"><BoxScoreTable box={game.result.homeBox} title={game.home.name} /><BoxScoreTable box={game.result.awayBox} title={game.away.name} /></div>
    </>}
  </div>;
}
