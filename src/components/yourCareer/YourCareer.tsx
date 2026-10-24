import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  ATTRS, ATTR_LABEL, BACKGROUNDS, LEVEL_LABEL, NATIONS, POSITIONS, QUESTIONS, START_AGE, START_YEAR,
  archetypeOf, careerTotals, choose, draftProjection, loadCareer, loadRecords, nationOf, newCareer, ordinal, overall, playSeason, recordCareer, saveCareer, startingRatings,
  type Answers, type Background, type Choice, type Decision, type Pos, type Ratings, type SeasonRow, type YcState,
} from '../../yourCareer/yourCareer';
import { noteWeekRun } from '../../retention/weekLog';
import { PlayerAvatar } from '../PlayerAvatar';
import { PixelIcon } from '../PixelIcon';
import './yourCareer.css';

/*
 * Your Career: build a player at 13, then choose your way through every season (yourCareer/yourCareer.ts).
 * The builder is four numbered steps beside a live prospect card; the career is a banner, the road from youth ball to
 * the Hall of Fame, this season's message with its choices, and every season so far as a card.
 */

const FIRST = ['Jalen', 'Marcus', 'Luka', 'Nikola', 'Darius', 'Tyrese', 'Andre', 'Giorgi', 'Kofi', 'Mateo', 'Theo', 'Zion', 'Malik', 'Dante', 'Ivan'];
const LAST = ['Carter', 'Brooks', 'Vance', 'Okafor', 'Petrov', 'Hayes', 'Silva', 'Mitchell', 'Kovac', 'Reed', 'Ellison', 'Navarro', 'Banks', 'Odom', 'Grant'];
const randomName = () => `${FIRST[Math.floor(Math.random() * FIRST.length)]} ${LAST[Math.floor(Math.random() * LAST.length)]}`;
/** An overall's colour: the first band it reaches. */
const OVR_CLASS: [number, string][] = [[85, 'gold'], [75, 'silver'], [60, 'bronze'], [0, 'raw']];
const ovrClass = (v: number) => OVR_CLASS.find(([min]) => v >= min)![1];
// Trophy name -> icon, first match wins: "Finals MVP" and "Player of the Year" -> crown, "State champion" -> trophy,
// "Medal with Georgia" -> medal; anything unmatched ("All-State") falls back to the medal too.
const TROPHY_ICON: [RegExp, string][] = [[/MVP|Player of the Year/, 'crown'], [/Champion|champion|title/, 'trophy'], [/All-Star/, 'star'], [/Defensive/, 'shield'], [/Rookie/, 'up'], [/Sixth/, 'swords'], [/Medal/, 'medal']];
const trophyIcon = (t: string) => TROPHY_ICON.find(([re]) => re.test(t))?.[1] ?? 'medal';
const inches = (cm: number) => Math.round(cm / 2.54);
const feet = (cm: number) => `${Math.floor(inches(cm) / 12)}'${inches(cm) % 12}"`;
const seasonLabel = (year: number) => `${year}-${String((year + 1) % 100).padStart(2, '0')}`;

export function Flag({ nation, size = 18 }: { nation: string; size?: number }) {
  const n = nationOf(nation);
  return <span className={`yc-flag ${n.vertical ? 'v' : ''}`} style={{ width: size * 1.5, height: size }} title={n.name} aria-hidden="true">
    {n.flag.map((c, i) => <i key={i} style={{ background: c }} />)}
  </span>;
}

/** The five ratings as a pentagon: the outline is 99, the filled shape is you. */
function Radar({ ratings, size = 150 }: { ratings: Ratings; size?: number }) {
  const c = size / 2, r = size / 2 - 30;
  const at = (i: number, v: number) => { const a = -Math.PI / 2 + i * 2 * Math.PI / ATTRS.length; return [c + Math.cos(a) * r * v, c + Math.sin(a) * r * v]; };
  const shape = (v: (i: number) => number) => ATTRS.map((_, i) => at(i, v(i)).map(n => n.toFixed(1)).join(',')).join(' ');
  return <svg className="yc-radar" viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={ATTRS.map(k => `${ATTR_LABEL[k]} ${Math.round(ratings[k])}`).join(', ')}>
    {[1, 0.66, 0.33].map(f => <polygon key={f} points={shape(() => f)} className="yc-radar-ring" />)}
    {ATTRS.map((_, i) => { const [x, y] = at(i, 1); return <line key={i} x1={c} y1={c} x2={x} y2={y} className="yc-radar-ring" />; })}
    <polygon points={shape(i => Math.max(0.05, ratings[ATTRS[i]] / 99))} className="yc-radar-fill" />
    {ATTRS.map((k, i) => { const [x, y] = at(i, 1.22); return <text key={k} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="yc-radar-label">{ATTR_LABEL[k].slice(0, 3).toUpperCase()} {Math.round(ratings[k])}</text>; })}
  </svg>;
}

export function YourCareer({ onExit }: { onExit: () => void }) {
  const [state, setState] = useState<YcState | null>(loadCareer);
  useEffect(() => { saveCareer(state); }, [state]);
  return <div className="yc">
    <div className="yc-bar">
      <button className="hunt-exit" onClick={onExit}><PixelIcon name="exit" size={16} /> Main Menu</button>
      <span className="yc-bar-title"><PixelIcon name="jersey" size={18} /> YOUR CAREER</span>
      {state && !state.done && <span className="yc-bar-season">{seasonLabel(START_YEAR + state.age - START_AGE)}</span>}
    </div>
    {state ? <Board s={state} onChange={setState} onNew={() => setState(null)} /> : <Create onStart={setState} />}
  </div>;
}

// ---------------------------------------------------------------- the builder

function Create({ onStart }: { onStart: (s: YcState) => void }) {
  const [name, setName] = useState(randomName);
  const [number, setNumber] = useState(7);
  const [nation, setNation] = useState('USA');
  const [pos, setPos] = useState<Pos>('SG');
  const [height, setHeight] = useState(() => Math.round((POSITIONS.SG.height[0] + POSITIONS.SG.height[1]) / 2));
  const [background, setBackground] = useState<Background>('town');
  const [answers, setAnswers] = useState<Answers>({});
  const { ratings, deltas } = useMemo(() => startingRatings({ pos, background, answers }), [pos, background, answers]);
  const arch = archetypeOf(ratings);
  const [lo, hi] = POSITIONS[pos].height;
  const pickPos = (p: Pos) => { setPos(p); setHeight(h => Math.min(POSITIONS[p].height[1], Math.max(POSITIONS[p].height[0], h))); };
  const answered = QUESTIONS.filter(q => answers[q.id]).length;
  return <section className="yc-build">
    <aside className="yc-prospect" aria-label="Your prospect card">
      <div className="yc-prospect-top"><Flag nation={nation} size={14} /><span>{nation}</span><b>#{number}</b></div>
      <div className="yc-prospect-art"><PlayerAvatar playerId={`yc-${name}`} primaryColor="#f47b20" secondaryColor="#0b1018" jerseyNumber={number} heightInches={inches(height)} size={118} title={name} /></div>
      <b className="yc-prospect-name">{name || 'Your name'}</b>
      <small>{POSITIONS[pos].name} · {feet(height)} · age {START_AGE}</small>
      <div className="yc-prospect-arch"><span>{arch.name}</span><em className={`yc-ovr-badge ${ovrClass(overall(ratings, pos))}`}>{overall(ratings, pos)}</em></div>
      <Radar ratings={ratings} />
      <ul className="yc-deltas">{ATTRS.filter(k => deltas[k] !== 0).map(k => <li key={k} className={deltas[k] > 0 ? 'up' : 'down'}>{deltas[k] > 0 ? '+' : ''}{deltas[k]} {ATTR_LABEL[k]}</li>)}</ul>
    </aside>

    <div className="yc-steps">
      <div className="yc-step">
        <h3><i>1</i> Who you are</h3>
        <div className="yc-who">
          <label><small>Name</small><span className="yc-inline"><input className="year-input" value={name} maxLength={18} onChange={e => setName(e.target.value)} /><button type="button" onClick={() => setName(randomName())} title="Random name"><PixelIcon name="shuffle" size={14} /></button></span></label>
          <label><small>Number</small><input className="year-input yc-number" type="number" min={0} max={99} value={number} onChange={e => setNumber(Math.max(0, Math.min(99, Number(e.target.value) || 0)))} /></label>
          <label><small>Country</small><span className="yc-inline"><Flag nation={nation} size={16} /><select className="year-input" value={nation} onChange={e => setNation(e.target.value)}>{[...NATIONS].sort((a, b) => a.name.localeCompare(b.name)).map(n => <option key={n.id} value={n.id}>{n.name}</option>)}</select></span></label>
        </div>
      </div>

      <div className="yc-step">
        <h3><i>2</i> Your frame</h3>
        <div className="yc-lineup" role="radiogroup" aria-label="Position">{(Object.keys(POSITIONS) as Pos[]).map(p => {
          const mid = (POSITIONS[p].height[0] + POSITIONS[p].height[1]) / 2;
          return <button key={p} role="radio" aria-checked={pos === p} className={pos === p ? 'on' : ''} onClick={() => pickPos(p)}>
            <PlayerAvatar playerId={`yc-pos-${p}`} primaryColor={pos === p ? '#f47b20' : '#2a3546'} secondaryColor="#f4f0e6" heightInches={inches(mid)} size={Math.round(48 + (mid - 178) * 0.9)} title="" />
            <b>{p}</b><small>{POSITIONS[p].name}</small>
          </button>;
        })}</div>
        <p className="yc-hint">{POSITIONS[pos].blurb}</p>
        <label className="yc-height"><small>Height</small><input type="range" min={lo} max={hi} value={height} onChange={e => setHeight(Number(e.target.value))} /><b>{height} cm · {feet(height)}</b></label>
      </div>

      <div className="yc-step">
        <h3><i>3</i> Your game <small>{answered}/{QUESTIONS.length} answered</small></h3>
        <ol className="yc-interview">{QUESTIONS.map(q => <li key={q.id}>
          <span>{q.ask}</span>
          <span className="yc-seg" role="radiogroup" aria-label={q.ask}>{(['a', 'b'] as const).map(k => <button key={k} role="radio" aria-checked={answers[q.id] === k} className={answers[q.id] === k ? 'on' : ''} onClick={() => setAnswers(a => ({ ...a, [q.id]: k }))}>{q[k][0]}</button>)}</span>
        </li>)}</ol>
      </div>

      <div className="yc-step">
        <h3><i>4</i> Your roots</h3>
        <div className="yc-roots" role="radiogroup" aria-label="Where you grew up">{(Object.keys(BACKGROUNDS) as Background[]).map(b => <button key={b} role="radio" aria-checked={background === b} className={background === b ? 'on' : ''} onClick={() => setBackground(b)}>
          <PixelIcon name={b === 'city' ? 'court' : b === 'town' ? 'home' : 'heart'} size={18} /><b>{BACKGROUNDS[b].name}</b><small>{BACKGROUNDS[b].blurb}</small>
        </button>)}</div>
      </div>

      <button className="primary yc-go" onClick={() => onStart(newCareer({ name, number, nation, pos, heightCm: height, background, answers }))}><PixelIcon name="play" size={14} /> Tip off at {START_AGE}</button>
    </div>
  </section>;
}

// ---------------------------------------------------------------- the career

const ROAD = ['Youth', 'High school', 'Next level', 'Draft', 'Pros', 'Legacy'] as const;
function roadStep(s: YcState): number {
  if (s.done) return 5;
  const level = s.club?.level;
  if (s.draft && (level === 'nba' || level === 'gleague' || level === 'europe')) return 4;
  if (level === 'college' || level === 'academy' || level === 'europe') return 2;
  if (level === 'highschool') return s.age >= 18 ? 2 : 1;
  return 0;
}
/** Who a decision comes from, so each one reads like a message. */
const SENDER: Record<string, [string, string]> = {
  'youth-club': ['Your parents', 'heart'], 'high-school': ['High school coaches', 'mic'], recruiting: ['Recruiting inbox', 'list'], 'college-end': ['Your coach', 'mic'],
  undrafted: ['Your agent', 'phone'], 'free-agency': ['Your agent', 'phone'], training: ['Your trainer', 'gear'], 'on-the-outs': ['Local radio', 'mic'],
  endorsement: ['A sneaker brand', 'shoe'], 'national-team': ['National federation', 'globe'], injury: ['Team doctor', 'warning'], mixtape: ['Your phone', 'phone'],
  mentor: ['The locker room', 'team'], 'retire-offer': ['Your family', 'heart'],
};

function Board({ s, onChange, onNew }: { s: YcState; onChange: (s: YcState) => void; onNew: () => void }) {
  const [flash, setFlash] = useState<string | null>(null);
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const ovr = overall(s.ratings, s.pos);
  const totals = careerTotals(s);
  const club = s.club;
  const step = roadStep(s);
  const trophies = Object.entries(s.seasons.flatMap(x => x.trophies).reduce<Record<string, number>>((m, t) => ({ ...m, [t]: (m[t] ?? 0) + 1 }), {}));
  const pick = (c: Choice) => { const r = choose(s, c.id); setFlash(r.message); onChange(r.state); };
  const play = () => { setFlash(null); onChange(playSeason(s)); };
  // The finished career is recorded once.
  useEffect(() => {
    if (!s.done || s.legacy == null || loadRecords().some(r => r.name === s.name && r.seasons === s.seasons.length && r.legacy === s.legacy)) return;
    recordCareer(s);
    noteWeekRun('career', { score: s.legacy, line: `${s.name}, Legacy ${s.legacy}${s.hallOfFame ? ', Hall of Fame' : ''}` }, `yc-${s.seed}`);
  }, [s]);
  return <section className="yc-career">
    {s.draftShow && s.draft?.team && <DraftNight s={s} onDone={() => onChange({ ...s, draftShow: false })} />}
    <header className="yc-banner" style={club ? { '--club-a': club.colors[0], '--club-b': club.colors[1] } as CSSProperties : undefined}>
      <div className="yc-banner-art"><PlayerAvatar playerId={`yc-${s.name}`} primaryColor={club?.colors[0] ?? '#f47b20'} secondaryColor={club?.colors[1] ?? '#0b1018'} jerseyNumber={s.number} heightInches={inches(s.heightCm)} size={120} title={s.name} /></div>
      <div className="yc-banner-id">
        <span className="yc-banner-tags"><Flag nation={s.nation} size={12} />{nationOf(s.nation).name} · #{s.number} · {s.pos} · {s.archetype}</span>
        <h2>{s.name}</h2>
        <span>{club ? `${club.name} · ${LEVEL_LABEL[club.level]}` : 'No team'}{s.contract && s.contract.years > 0 ? ` · $${s.contract.salary}M, ${s.contract.years} yr${s.contract.years === 1 ? '' : 's'} left` : ''}</span>
      </div>
      <dl className="yc-banner-facts">
        <div className={`yc-ring ${ovrClass(ovr)}`} style={{ '--pct': `${ovr}%` } as CSSProperties}><b>{ovr}</b><small>OVR</small></div>
        <div><dt>Age</dt><dd>{s.age}</dd></div>
        <div><dt>Earned</dt><dd>${Math.round(s.earnings * 10) / 10}M</dd></div>
        <div className="yc-rep"><dt>Reputation</dt><dd><i style={{ width: `${Math.round(s.rep)}%` }} /></dd></div>
      </dl>
    </header>

    <ol className="yc-road" aria-label="Career road">{ROAD.map((r, i) => <li key={r} className={i < step ? 'done' : i === step ? 'now' : ''}><i aria-hidden="true" /><span>{r}</span>{i === 3 && s.draft && <small>{s.draft.team ? `#${s.draft.pick}` : 'undrafted'}</small>}</li>)}</ol>

    <div className="yc-columns">
      <div className="yc-main">
        {flash && <p className="yc-flash" role="status"><PixelIcon name="check" size={14} /> {flash}</p>}
        {s.done ? <CareerEnd s={s} onNew={onNew} />
          : s.pending[0] ? <Message d={s.pending[0]} more={s.pending.length - 1} s={s} onPick={pick} />
          : <div className="yc-message yc-tipoff">
            <span className="yc-from"><PixelIcon name="calendar" size={16} /> {seasonLabel(START_YEAR + s.age - START_AGE)} season</span>
            <h3>{club ? club.name : 'The season'} tips off</h3>
            <p>{s.focus ? `You spent the summer on your ${ATTR_LABEL[s.focus].toLowerCase()}.` : 'Everything is set.'} {s.role === 'star' ? 'This is your team.' : s.role === 'bench' ? 'You start on the bench.' : 'You are in the rotation.'}</p>
            <button className="primary" onClick={play}><PixelIcon name="play" size={14} /> Play the season</button>
          </div>}

        <div className="yc-history">
          <div className="yc-history-head"><h3>Your seasons</h3>
            <span className="yc-seg small" role="radiogroup" aria-label="Show seasons as">{(['cards', 'table'] as const).map(v => <button key={v} role="radio" aria-checked={view === v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>{v === 'cards' ? 'Cards' : 'Table'}</button>)}</span>
          </div>
          {s.seasons.length === 0 ? <p className="yc-hint">Your first season is still ahead of you.</p> : view === 'cards' ? <SeasonCards rows={s.seasons} /> : <SeasonList rows={s.seasons} />}
        </div>
        {!s.done && <button className="link-button yc-abandon" onClick={() => { if (window.confirm('Abandon this career? It cannot be undone.')) onNew(); }}>Abandon this career</button>}
      </div>

      <aside className="yc-side">
        <div className="yc-panel"><h4>Ratings</h4><Radar ratings={s.ratings} size={180} /></div>
        <div className="yc-panel"><h4>Career</h4>
          <dl className="yc-totals"><div><dt>Games</dt><dd>{totals.gp}</dd></div><div><dt>Points</dt><dd>{totals.ppg}</dd></div><div><dt>Rebounds</dt><dd>{totals.rpg}</dd></div><div><dt>Assists</dt><dd>{totals.apg}</dd></div></dl>
          <dl className="yc-body"><div><dt>Height</dt><dd>{s.heightCm} cm</dd></div><div><dt>Weight</dt><dd>{s.weightKg} kg</dd></div><div><dt>Wingspan</dt><dd>{s.wingspanCm} cm</dd></div></dl>
        </div>
        <div className="yc-panel"><h4>Trophy shelf</h4>
          {trophies.length ? <ul className="yc-shelf">{trophies.map(([t, n]) => <li key={t}><PixelIcon name={trophyIcon(t)} size={16} /><span>{t}</span>{n > 1 && <b>×{n}</b>}</li>)}</ul> : <p className="yc-hint">Nothing yet. Go win something.</p>}
        </div>
      </aside>
    </div>
  </section>;
}

function Message({ d, more, s, onPick }: { d: Decision; more: number; s: YcState; onPick: (c: Choice) => void }) {
  const [from, icon] = SENDER[d.id] ?? ['Message', 'mic'];
  const showProj = s.club?.level === 'college' || s.club?.level === 'academy';
  return <div className="yc-message">
    <span className="yc-from"><PixelIcon name={icon} size={16} /> {from}{more > 0 && <em>+{more} more after this</em>}</span>
    <h3>{d.title}</h3>
    <p>{d.text}</p>
    <ol className="yc-replies">{d.options.map((o, i) => <li key={o.id}><button onClick={() => onPick(o)}>
      <kbd>{String.fromCharCode(65 + i)}</kbd>
      <span className="yc-reply-text"><b>{o.title}</b><small>{o.blurb}</small></span>
      {o.chips && <span className="yc-tags-list">{o.chips.map(c => <em key={c} className={c.startsWith('-') ? 'bad' : c.startsWith('+') ? 'good' : ''}>{c}</em>)}</span>}
      {o.odds && <span className="yc-odds" title={`${o.odds.winText} / ${o.odds.loseText}`}><i style={{ width: `${Math.round(o.odds.win * 100)}%` }} /><small>{Math.round(o.odds.win * 100)}%: {o.odds.winText}</small></span>}
    </button></li>)}</ol>
    {showProj && <small className="yc-hint">Scouts: {draftProjection(s).label.toLowerCase()} if you go now.</small>}
  </div>;
}

function SeasonCards({ rows }: { rows: SeasonRow[] }) {
  return <ol className="yc-cards">{[...rows].reverse().map(r => <li key={r.age} style={{ '--club-a': r.club.colors[0], '--club-b': r.club.colors[1] } as CSSProperties}>
    <span className="yc-card-band"><b>{r.club.abbr}</b><small>{seasonLabel(r.year)}</small></span>
    <span className="yc-card-age">Age {r.age}</span>
    <b className={`yc-ovr-badge ${ovrClass(r.ovr)}`}>{r.ovr}</b>
    <span className="yc-card-club">{r.club.name}<small>{LEVEL_LABEL[r.club.level]} · {r.record}</small></span>
    <span className="yc-card-line"><b>{r.ppg}</b> pts <b>{r.rpg}</b> reb <b>{r.apg}</b> ast</span>
    <span className="yc-card-trophies">{r.trophies.map(t => <span key={t} title={t}><PixelIcon name={trophyIcon(t)} size={14} /></span>)}</span>
  </li>)}</ol>;
}

function SeasonList({ rows }: { rows: SeasonRow[] }) {
  return <div className="yc-list-scroll"><table className="db-table yc-list">
    <thead><tr><th>Season</th><th className="col-name">Team</th><th>G</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>OVR</th><th className="col-name">Honors</th></tr></thead>
    <tbody>{rows.map(r => <tr key={r.age}><td>{seasonLabel(r.year)} <small>({r.age})</small></td><td className="col-name">{r.club.name} <small>{LEVEL_LABEL[r.club.level]}</small></td><td>{r.gp}</td><td>{r.mpg}</td><td>{r.ppg}</td><td>{r.rpg}</td><td>{r.apg}</td><td>{r.spg}</td><td>{r.bpg}</td><td>{r.ovr}</td><td className="col-name">{r.trophies.join(', ')}</td></tr>)}</tbody>
  </table></div>;
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
  return <div className="yc-draft" role="dialog" aria-modal="true" aria-label="Draft night" style={{ '--club-a': club.colors[0], '--club-b': club.colors[1] } as CSSProperties}>
    <div className="yc-draft-stage">
      <span className="pixel-eyebrow">THE {d.year} DRAFT</span>
      <h2 className={stage >= 1 ? 'in' : ''}>Round {d.round} · Pick {d.pick}</h2>
      <p className={`yc-draft-call ${stage >= 2 ? 'in' : ''}`}>With the {ordinal(d.pick)} pick, {club.name} selects…</p>
      <div className={`yc-draft-player ${stage >= 3 ? 'in' : ''}`}>
        <PlayerAvatar playerId={`yc-${s.name}`} primaryColor={club.colors[0]} secondaryColor={club.colors[1]} jerseyNumber={s.number} heightInches={inches(s.heightCm)} size={170} pose="raise" title={s.name} />
        <b>{s.name}</b><small>{POSITIONS[s.pos].name} · {nationOf(s.nation).name} · {s.seasons.at(-1)?.club.name}</small>
      </div>
      <button className="primary" disabled={stage < 3} onClick={onDone}>Shake the commissioner's hand</button>
    </div>
  </div>;
}

function CareerEnd({ s, onNew }: { s: YcState; onNew: () => void }) {
  const nba = careerTotals(s, 'nba');
  const records = loadRecords();
  return <div className="yc-message yc-end">
    <span className="yc-from"><PixelIcon name="trophy" size={16} /> {s.seasons.length} seasons</span>
    <h3>{s.hallOfFame ? 'Hall of Famer' : 'Retired'}</h3>
    <p>{s.name} · Legacy {s.legacy}{nba.gp ? ` · ${nba.gp} NBA games, ${nba.ppg} / ${nba.rpg} / ${nba.apg}` : ' · never made the NBA'}</p>
    {records.length > 0 && <ol className="yc-records">{records.slice(0, 5).map(r => <li key={`${r.name}-${r.at}`}><Flag nation={r.nation} size={10} /><b>{r.name}</b><small>{r.pos} · {r.seasons} seasons · {r.ppg} ppg</small><em>{r.legacy}{r.hallOfFame ? ' · HOF' : ''}</em></li>)}</ol>}
    <button className="primary" onClick={onNew}><PixelIcon name="play" size={14} /> Start a new career</button>
  </div>;
}
