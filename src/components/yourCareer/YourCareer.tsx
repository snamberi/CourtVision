import { useEffect, useMemo, useState } from 'react';
import {
  ATTRS, ATTR_LABEL, BACKGROUNDS, LAST_AGE, LEVEL_LABEL, NATIONS, POSITIONS, QUESTIONS, START_AGE, START_YEAR,
  archetypeOf, careerTotals, choose, draftProjection, loadCareer, loadRecords, nationOf, newCareer, ordinal, overall, playSeason, recordCareer, saveCareer, startingRatings,
  type Answers, type Background, type Choice, type Club, type Pos, type Ratings, type SeasonRow, type YcState,
} from '../../yourCareer/yourCareer';
import { noteWeekRun } from '../../retention/weekLog';
import { PlayerAvatar } from '../PlayerAvatar';
import { PixelIcon } from '../PixelIcon';
import './yourCareer.css';

/* Your Career: build a player at 13, then choose your way through every season (yourCareer/yourCareer.ts). */

const FIRST = ['Jalen', 'Marcus', 'Luka', 'Nikola', 'Darius', 'Tyrese', 'Andre', 'Giorgi', 'Kofi', 'Mateo', 'Theo', 'Zion', 'Malik', 'Dante', 'Ivan'];
const LAST = ['Carter', 'Brooks', 'Vance', 'Okafor', 'Petrov', 'Hayes', 'Silva', 'Mitchell', 'Kovac', 'Reed', 'Ellison', 'Navarro', 'Banks', 'Odom', 'Grant'];
const randomName = () => `${FIRST[Math.floor(Math.random() * FIRST.length)]} ${LAST[Math.floor(Math.random() * LAST.length)]}`;
/** A rating in words, and an overall's card colour: the first band it reaches. */
const TIERS: [number, string][] = [[90, 'Legendary'], [80, 'Elite'], [70, 'Very good'], [60, 'Good'], [50, 'Average'], [0, 'Raw']];
const OVR_CLASS: [number, string][] = [[85, 'gold'], [75, 'silver'], [60, 'bronze'], [0, 'raw']];
const band = (list: [number, string][], v: number) => list.find(([min]) => v >= min)![1];
const tier = (v: number) => band(TIERS, v);
const ovrClass = (v: number) => band(OVR_CLASS, v);
// Trophy name -> icon, first match wins: "Finals MVP" and "Player of the Year" -> crown, "State champion" -> trophy,
// "Medal with Georgia" -> medal; anything unmatched ("All-State") falls back to the medal too.
const TROPHY_ICON: [RegExp, string][] = [[/MVP|Player of the Year/, 'crown'], [/Champion|champion|title/, 'trophy'], [/All-Star/, 'star'], [/Defensive/, 'shield'], [/Rookie/, 'up'], [/Sixth/, 'swords'], [/Medal/, 'medal']];
const trophyIcon = (t: string) => TROPHY_ICON.find(([re]) => re.test(t))?.[1] ?? 'medal';
const inches = (cm: number) => Math.round(cm / 2.54);
const feet = (cm: number) => `${Math.floor(inches(cm) / 12)}'${inches(cm) % 12}"`;

export function Flag({ nation, size = 18 }: { nation: string; size?: number }) {
  const n = nationOf(nation);
  return <span className={`yc-flag ${n.vertical ? 'v' : ''}`} style={{ width: size * 1.5, height: size }} title={n.name} aria-hidden="true">
    {n.flag.map((c, i) => <i key={i} style={{ background: c }} />)}
  </span>;
}

export function YourCareer({ onExit }: { onExit: () => void }) {
  const [state, setState] = useState<YcState | null>(loadCareer);
  useEffect(() => { saveCareer(state); }, [state]);
  return <div className="yc">
    <header className="hunt-top yc-top">
      <button className="hunt-exit" onClick={onExit}><PixelIcon name="exit" size={16} /> Main Menu</button>
      <div className="hunt-title"><span className="pixel-eyebrow">AGE 13 TO THE HALL OF FAME</span><h1>Your Career</h1></div>
    </header>
    {state ? <Board s={state} onChange={setState} onNew={() => setState(null)} /> : <Create onStart={setState} />}
  </div>;
}

// ---------------------------------------------------------------- create

function Create({ onStart }: { onStart: (s: YcState) => void }) {
  const [name, setName] = useState(randomName);
  const [number, setNumber] = useState(30);
  const [nation, setNation] = useState('USA');
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState<Pos>('PG');
  const [height, setHeight] = useState(() => Math.round((POSITIONS.PG.height[0] + POSITIONS.PG.height[1]) / 2));
  const [background, setBackground] = useState<Background>('city');
  const [answers, setAnswers] = useState<Answers>({ score: 'a', offense: 'b', defense: 'a', tempo: 'b', glass: 'b', clutch: 'a', summer: 'a', film: 'a' });
  const { ratings, deltas } = useMemo(() => startingRatings({ pos, background, answers }), [pos, background, answers]);
  const arch = archetypeOf(ratings);
  const [lo, hi] = POSITIONS[pos].height;
  const pickPos = (p: Pos) => { setPos(p); setHeight(h => Math.min(POSITIONS[p].height[1], Math.max(POSITIONS[p].height[0], h))); };
  const nations = NATIONS.filter(n => !query || `${n.name} ${n.id}`.toLowerCase().includes(query.toLowerCase()));
  const spots: [Pos, number, number][] = [['PG', 50, 18], ['SG', 18, 40], ['SF', 82, 40], ['PF', 28, 72], ['C', 70, 80]];
  return <section className="yc-create">
    <div className="yc-create-head"><h2>Define your identity</h2><small>AGE {START_AGE} · STARTS AT 50-60 OVR · EVERY SEASON IS YOUR CALL</small></div>
    <div className="yc-create-grid">
      <div className="locker-bay yc-identity">
        <h3 className="hunt-subhead">Identity</h3>
        <div className="yc-identity-row">
          <div className="yc-jersey"><PlayerAvatar playerId={`yc-${name}`} primaryColor="#1d428a" secondaryColor="#f4f0e6" jerseyNumber={number} heightInches={inches(height)} size={150} title={name} /><b>{name.split(' ').at(-1)?.toUpperCase()}</b></div>
          <div className="yc-identity-fields">
            <label><span>Name</span><span className="yc-name"><button type="button" onClick={() => setName(randomName())} aria-label="Random name"><PixelIcon name="shuffle" size={14} /></button><input className="year-input" value={name} maxLength={18} onChange={e => setName(e.target.value)} /></span></label>
            <label><span>Number</span><span className="yc-stepper"><button type="button" onClick={() => setNumber(n => (n + 99) % 100)} aria-label="Lower number">-</button><b>{number}</b><button type="button" onClick={() => setNumber(n => (n + 1) % 100)} aria-label="Higher number">+</button></span></label>
            <label><span>Height · {height} cm ({feet(height)})</span><input type="range" min={lo} max={hi} value={height} onChange={e => setHeight(Number(e.target.value))} /></label>
          </div>
        </div>
        <h3 className="hunt-subhead">Nationality</h3>
        <input className="year-input yc-search" placeholder="Search a country…" value={query} onChange={e => setQuery(e.target.value)} />
        <div className="yc-nations" role="radiogroup" aria-label="Nationality">{nations.map(n => <button key={n.id} role="radio" aria-checked={nation === n.id} className={nation === n.id ? 'on' : ''} onClick={() => setNation(n.id)}><Flag nation={n.id} /><span>{n.name}</span><small>{n.id}</small></button>)}</div>
        <h3 className="hunt-subhead">Where you grew up</h3>
        <div className="yc-backgrounds" role="radiogroup" aria-label="Background">{(Object.keys(BACKGROUNDS) as Background[]).map(b => <button key={b} role="radio" aria-checked={background === b} className={background === b ? 'on' : ''} onClick={() => setBackground(b)}><b>{BACKGROUNDS[b].name}</b><small>{BACKGROUNDS[b].blurb}</small></button>)}</div>
      </div>
      <div className="locker-bay yc-style">
        <h3 className="hunt-subhead">Position</h3>
        <div className="yc-position">
          <div className="yc-court" role="radiogroup" aria-label="Position">{spots.map(([p, x, y]) => <button key={p} role="radio" aria-checked={pos === p} className={pos === p ? 'on' : ''} style={{ left: `${x}%`, top: `${y}%` }} onClick={() => pickPos(p)}>{p}</button>)}</div>
          <div className="yc-position-info"><b>{POSITIONS[pos].name}</b><small>{POSITIONS[pos].blurb}</small><small>{lo}-{hi} cm</small></div>
        </div>
        <h3 className="hunt-subhead">Playing style</h3>
        <div className="yc-questions">{QUESTIONS.map(q => <div key={q.id} className="yc-q"><small>{q.ask}</small><div>{(['a', 'b'] as const).map(k => <button key={k} className={answers[q.id] === k ? 'on' : ''} aria-pressed={answers[q.id] === k} onClick={() => setAnswers(a => ({ ...a, [q.id]: k }))}>{q[k][0]}</button>)}</div></div>)}</div>
        <div className="yc-archetype">
          <div><small>YOUR ARCHETYPE</small><b>{arch.name}</b><span>{arch.blurb}</span><span className="yc-ovr-preview">Starting overall {overall(ratings, pos)}</span></div>
          <RatingBars ratings={ratings} deltas={deltas} />
        </div>
        <button className="primary yc-start" onClick={() => onStart(newCareer({ name, number, nation, pos, heightCm: height, background, answers }))}><PixelIcon name="play" size={14} /> Start at age {START_AGE}</button>
      </div>
    </div>
  </section>;
}

function RatingBars({ ratings, deltas }: { ratings: Ratings; deltas?: Ratings }) {
  return <ul className="yc-ratings">{ATTRS.map(k => <li key={k}>
    <span>{ATTR_LABEL[k]}</span><b>{deltas ? Math.round(ratings[k]) : tier(ratings[k])}{deltas && deltas[k] !== 0 && <em className={deltas[k] > 0 ? 'up' : 'down'}> {deltas[k] > 0 ? '+' : ''}{deltas[k]}</em>}</b>
    <i aria-hidden="true"><i style={{ width: `${Math.min(100, ratings[k])}%` }} /></i>
  </li>)}</ul>;
}

// ---------------------------------------------------------------- the career

function Board({ s, onChange, onNew }: { s: YcState; onChange: (s: YcState) => void; onNew: () => void }) {
  const [flash, setFlash] = useState<string | null>(null);
  const ovr = overall(s.ratings, s.pos);
  const totals = careerTotals(s);
  const decision = s.pending[0];
  const pick = (c: Choice) => { const r = choose(s, c.id); setFlash(r.message); onChange(r.state); };
  const play = () => { setFlash(null); onChange(playSeason(s)); };
  const trophies = Object.entries(s.seasons.flatMap(x => x.trophies).reduce<Record<string, number>>((m, t) => ({ ...m, [t]: (m[t] ?? 0) + 1 }), {}));
  const club = s.club;
  // The finished career is recorded once.
  useEffect(() => {
    if (!s.done || s.legacy == null || loadRecords().some(r => r.name === s.name && r.seasons === s.seasons.length && r.legacy === s.legacy)) return;
    recordCareer(s);
    noteWeekRun('career', { score: s.legacy, line: `${s.name}, Legacy ${s.legacy}${s.hallOfFame ? ', Hall of Fame' : ''}` }, `yc-${s.seed}`);
  }, [s]);
  return <section className="yc-board">
    {s.draftShow && s.draft?.team && <DraftNight s={s} onDone={() => onChange({ ...s, draftShow: false })} />}
    <div className="yc-left">
      <div className="yc-card" style={club ? { '--club-a': club.colors[0], '--club-b': club.colors[1] } as React.CSSProperties : undefined}>
        <div className={`yc-ovr ${ovrClass(ovr)}`}><small>OVR</small><b>{ovr}</b></div>
        <div className="yc-id">
          <span className="yc-tags"><Flag nation={s.nation} size={12} /><em>{s.nation}</em><em className="yc-num">#{s.number} {s.pos}</em></span>
          <b className="yc-club">{club ? club.name : 'No team yet'}</b>
          <small>{s.name} · {club ? LEVEL_LABEL[club.level] : 'Free agent'}{s.contract && s.contract.years > 0 ? ` · $${s.contract.salary}M x ${s.contract.years}` : ''}</small>
        </div>
        <div className="yc-age"><small>AGE</small><b>{s.age}</b><small>EARNED</small><b>${Math.round(s.earnings * 10) / 10}M</b></div>
        <PlayerAvatar playerId={`yc-${s.name}`} primaryColor={club?.colors[0] ?? '#1d428a'} secondaryColor={club?.colors[1] ?? '#f4f0e6'} jerseyNumber={s.number} heightInches={inches(s.heightCm)} size={92} className="yc-card-avatar" title={s.name} />
      </div>
      <div className="yc-tiles"><div><b>{totals.gp}</b><small>GP</small></div><div><b>{totals.ppg}</b><small>PPG</small></div><div><b>{totals.apg}</b><small>APG</small></div><div><b>{totals.rpg}</b><small>RPG</small></div></div>
      <RatingBars ratings={s.ratings} />
      <div className="yc-physical"><div><small>HEIGHT</small><b>{s.heightCm} cm</b></div><div><small>WEIGHT</small><b>{s.weightKg} kg</b></div><div><small>WINGSPAN</small><b>{s.wingspanCm} cm</b></div><div><small>REP</small><b>{Math.round(s.rep)}</b></div></div>
      <small className="yc-arch">{s.archetype}{s.draft ? s.draft.team ? ` · ${ordinal(s.draft.pick)} pick, ${s.draft.year}` : ` · undrafted ${s.draft.year}` : ''}</small>
      {trophies.length > 0 && <div className="yc-trophies"><small>TROPHY CASE</small><ul>{trophies.map(([t, n]) => <li key={t} title={t}><PixelIcon name={trophyIcon(t)} size={22} />{n > 1 && <em>{n}</em>}<span>{t}</span></li>)}</ul></div>}

      {flash && <p className="yc-flash" role="status">{flash}</p>}
      {s.done ? <CareerEnd s={s} onNew={onNew} />
        : decision ? <div className="yc-decision">
          <span className="pixel-eyebrow">{s.age} YEARS OLD · {s.pending.length > 1 ? `${s.pending.length} DECISIONS` : 'DECISION'}</span>
          <h3>{decision.title}</h3><p>{decision.text}</p>
          <div className={`yc-options n${decision.options.length}`}>{decision.options.map(o => <button key={o.id} className="yc-option" onClick={() => pick(o)}>
            <b>{o.title}</b><small>{o.blurb}</small>
            {o.chips && <span className="yc-chips">{o.chips.map(c => <em key={c} className={c.startsWith('-') ? 'bad' : c.startsWith('+') ? 'good' : ''}>{c}</em>)}</span>}
            {o.odds && <span className="yc-odds"><em className="good">{o.odds.winText} · {Math.round(o.odds.win * 100)}%</em><em className="bad">{o.odds.loseText} · {100 - Math.round(o.odds.win * 100)}%</em></span>}
          </button>)}</div>
          {(club?.level === 'college' || club?.level === 'academy') && <small className="yc-proj">Draft board: {draftProjection(s).label}</small>}
        </div>
        : <div className="yc-decision yc-next">
          <span className="pixel-eyebrow">{START_YEAR + s.age - START_AGE}-{String((START_YEAR + s.age - START_AGE + 1) % 100).padStart(2, '0')} SEASON</span>
          <h3>{club ? `${club.name} · ${LEVEL_LABEL[club.level]}` : 'Next season'}</h3>
          <p>{s.focus ? `Summer focus: ${ATTR_LABEL[s.focus]}.` : 'Ready when you are.'}</p>
          <button className="primary" onClick={play}><PixelIcon name="play" size={14} /> Play the season</button>
        </div>}
      {!s.done && <button className="link-button yc-abandon" onClick={() => { if (window.confirm('Abandon this career? It cannot be undone.')) onNew(); }}>Abandon this career</button>}
    </div>
    <SeasonTable s={s} />
  </section>;
}

function ClubBadge({ club }: { club: Club }) {
  return <span className="yc-club-cell"><i style={{ background: club.colors[0], borderColor: club.colors[1] }}>{club.abbr.slice(0, 3)}</i><b>{club.name}</b><small>{LEVEL_LABEL[club.level]}</small></span>;
}

function SeasonTable({ s }: { s: YcState }) {
  const rows: (SeasonRow | number)[] = [...s.seasons, ...Array.from({ length: Math.max(0, LAST_AGE - START_AGE - s.seasons.length) }, (_, i) => START_AGE + s.seasons.length + i)];
  return <div className="locker-bay yc-table-wrap">
    <h3 className="hunt-subhead">Season by season</h3>
    <div className="yc-table-scroll"><table className="db-table yc-table">
      <thead><tr><th>Age</th><th className="col-name">Club</th><th>Trophies</th><th>OVR</th><th>GP</th><th>PPG</th><th>APG</th><th>RPG</th><th>SPG</th><th>BPG</th></tr></thead>
      <tbody>{rows.map(r => typeof r === 'number'
        ? <tr key={r} className={r === s.age && !s.done ? 'yc-now' : 'yc-future'}><td>{r}</td><td className="col-name">{r === s.age && !s.done ? (s.pending.length ? 'Making a decision…' : 'Next season') : s.done ? '' : '—'}</td><td /><td>{r === s.age && !s.done ? overall(s.ratings, s.pos) : ''}</td><td /><td /><td /><td /><td /><td /></tr>
        : <tr key={r.age}><td>{r.age}</td><td className="col-name"><ClubBadge club={r.club} /></td>
          <td className="yc-trophy-cell">{r.trophies.map(t => <span key={t} title={t}><PixelIcon name={trophyIcon(t)} size={14} /></span>)}</td>
          <td><span className={`yc-ovr-chip ${ovrClass(r.ovr)}`}>{r.ovr}</span></td><td>{r.gp}</td><td>{r.ppg}</td><td>{r.apg}</td><td>{r.rpg}</td><td>{r.spg}</td><td>{r.bpg}</td></tr>)}</tbody>
    </table></div>
  </div>;
}

// ---------------------------------------------------------------- draft night and the end

function DraftNight({ s, onDone }: { s: YcState; onDone: () => void }) {
  const d = s.draft!, club = s.club!;
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const quick = document.documentElement.classList.contains('reduce-motion') || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (quick) { setStage(3); return; }
    const timers = [900, 2200, 3400].map((ms, i) => window.setTimeout(() => setStage(i + 1), ms));
    return () => timers.forEach(t => window.clearTimeout(t));
  }, []);
  return <div className="yc-draft" role="dialog" aria-modal="true" aria-label="Draft night" style={{ '--club-a': club.colors[0], '--club-b': club.colors[1] } as React.CSSProperties}>
    <div className="yc-draft-stage">
      <span className="pixel-eyebrow">THE {d.year} DRAFT</span>
      <h2 className={stage >= 1 ? 'in' : ''}>Round {d.round} · Pick {d.pick}</h2>
      <p className={`yc-draft-call ${stage >= 2 ? 'in' : ''}`}>With the {ordinal(d.pick)} pick, {club.name} selects…</p>
      <div className={`yc-draft-player ${stage >= 3 ? 'in' : ''}`}>
        <PlayerAvatar playerId={`yc-${s.name}`} primaryColor={club.colors[0]} secondaryColor={club.colors[1]} jerseyNumber={s.number} heightInches={inches(s.heightCm)} size={170} pose="raise" title={s.name} />
        <b>{s.name}</b><small>{POSITIONS[s.pos].name} · {nationOf(s.nation).name} · {s.club && s.seasons.at(-1)?.club.name}</small>
      </div>
      <button className="primary" disabled={stage < 3} onClick={onDone}>Shake the commissioner's hand</button>
    </div>
  </div>;
}

function CareerEnd({ s, onNew }: { s: YcState; onNew: () => void }) {
  const nba = careerTotals(s, 'nba');
  const records = loadRecords();
  return <div className="yc-decision yc-end">
    <span className="pixel-eyebrow">CAREER OVER · {s.seasons.length} SEASONS</span>
    <h3>{s.hallOfFame ? 'Hall of Famer' : 'Retired'}</h3>
    <p>{s.name} · Legacy {s.legacy}{nba.gp ? ` · ${nba.gp} NBA games, ${nba.ppg} / ${nba.rpg} / ${nba.apg}` : ' · never made the NBA'}</p>
    {records.length > 0 && <ol className="yc-records">{records.slice(0, 5).map(r => <li key={`${r.name}-${r.at}`}><Flag nation={r.nation} size={10} /><b>{r.name}</b><small>{r.pos} · {r.seasons} seasons · {r.ppg} ppg</small><em>{r.legacy}{r.hallOfFame ? ' · HOF' : ''}</em></li>)}</ol>}
    <button className="primary" onClick={onNew}><PixelIcon name="play" size={14} /> Start a new career</button>
  </div>;
}
