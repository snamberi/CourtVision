import type { BigMoment } from '../../career/bigMoments';
import { CATEGORY_BY_ID } from '../../career/categories';
import { noteFeaturedXp } from '../../retention/modeOfWeek';
import { useCallback, useEffect, useRef, useState } from 'react';
import { readFavorites } from '../../profile/favorites';
import type { NbaHistory } from '../../history/nbaHistoryData';
import type { SeasonStatTotals } from '../../simulation/types';
import { calculateOverall } from '../../simulation/engine/overall';
import { formatSeasonYear as fy } from '../../simulation/calendar';
import { initializeCoaching } from '../../simulation/staffManagement';
import { DEFAULT_AWARD_SETTINGS } from '../../simulation/awards';
import { CATEGORIES, categoryScore, type CategoryId } from '../../career/categories';
import { startProgress, valuesAt, primeOverall, type Prime } from '../../career/create';
import {
  newCareerMeta, joinDraft, draftResult, landSeason, chooseMoment, careerMoments, careerShelf, type Moment, autopilotOffseason, findPlayer, freeAgentOffers, signOffer, requestTrade, retire, uniqueName, careerResume,
  OFFER_LABEL, type CareerMeta, type CareerMode as Mode, type CareerYear, type TradeWish,
} from '../../career/career';
import { legacyScore, top100, top100Rank } from '../../career/legacy';
import { listCareers, loadWorld, saveCareer, dropWorld, deleteCareer, type CareerWorld } from '../../career/storage';
import { runCareerStep } from '../../career/runner';
import { PixelIcon } from '../PixelIcon';
import { PlayerAvatar } from '../PlayerAvatar';
import { OverallChart } from './CareerChart';
import { CareerCard } from './CareerCard';
import { TrophyShelf } from '../TrophyShelf';
import { ShareCardButton } from '../ShareCardButton';
import { weeklyCareer, loadWeeklyRecords, recordWeekly, weekEndsAt, type WeeklyCareer } from '../../retention/weekly';
import { track, trackOnce } from '../../analytics/track';
import { noteCareers } from '../../profile/profile';
import { PostScore } from '../WeeklyBoard';
import { ClaimRankCard } from '../cloud/ClaimRankCard';
import { noteWeekRun } from '../../retention/weekLog';
import { WheelBuilder, MyPlayerBuilder, IdentityView, type IdentityChoice } from './CareerCreate';
import '../hunt/hunt.css';
import './career.css';

type View = { k: 'hub' } | { k: 'wheel'; seed: number } | { k: 'myplayer'; seed: number } | { k: 'identity'; seed: number; prime: Prime; mode: Mode } | { k: 'career' };
interface Active { meta: CareerMeta; world: CareerWorld | null }
const newSeed = () => Math.floor(Math.random() * 1_000_000_000);

/** Career Mode: create one player and live his career in today's league, season by season. */
export function CareerMode({ onExit }: { onExit: () => void }) {
  const [h, setH] = useState<NbaHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>({ k: 'hub' });
  const [careers, setCareers] = useState<CareerMeta[]>([]);
  const [active, setActive] = useState<Active | null>(null);
  const [busy, setBusy] = useState<{ label: string; pct: number | null } | null>(null);
  /** The season before his draft, played in the background while he is being created. */
  const pre = useRef<{ done: Promise<CareerWorld>; cancel: () => void; seed: number; draftYear: number | null } | null>(null);
  const [prePct, setPrePct] = useState<number | null>(null);
  const [preReady, setPreReady] = useState(false);
  const cancelRef = useRef<() => void>(() => {});
  const [tradeAsked, setTradeAsked] = useState<string | null>(null);
  const [draftYear, setDraftYear] = useState<number | null>(null);
  const [weekly, setWeekly] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    import('../../history/nbaHistoryData').then(m => m.loadNbaHistory()).then(d => { if (live) setH(d); }, e => { if (live) setError(e instanceof Error ? e.message : String(e)); });
    listCareers().then(c => { noteCareers(c); if (live) setCareers(c); });
    return () => { live = false; pre.current?.cancel(); cancelRef.current(); };
  }, []);

  const refresh = () => listCareers().then(c => { noteCareers(c); setCareers(c); });
  const persist = useCallback((meta: CareerMeta, world: CareerWorld | null) => {
    setActive({ meta, world });
    if (meta.status === 'retired') {
      if (meta.weekly && meta.retired) recordWeekly('career', meta.weekly, { best: meta.retired.legacy, label: meta.playerId });
      if (meta.retired) noteWeekRun('career', { score: meta.retired.legacy, line: `${meta.playerId}, Legacy ${meta.retired.legacy.toFixed(1)}` }, `career-${meta.id}`);
      trackOnce(`career-${meta.id}`, 'mode_finish', { mode: 'career', variant: meta.weekly ? 'weekly' : meta.mode, seasons: meta.years.length, legacy: meta.retired?.legacy ?? 0, hall: meta.retired?.hallOfFame ?? 'no', past_draft: !!meta.draftYear });
      saveCareer(meta).then(() => dropWorld(meta.id)).then(refresh); return;
    }
    saveCareer(meta, world ?? undefined).then(refresh);
  }, []);

  /** Starts a new career: builds today's league and plays the season before his draft in the background. */
  /** `draftYear`: null for today's league, or a past draft (the league starts the season before it, real players on real careers). */
  /** Builds the league and plays the season before the draft in the background. */
  const launchPre = useCallback(async (seed: number, draftYear: number | null) => {
    if (!h) return;
    pre.current?.cancel();
    setPreReady(false); setPrePct(0);
    const { buildHistoricalLeague, topUpHistoricalClasses } = await import('../../history/historicalLeague');
    const start = draftYear ? draftYear - 1 : h.manifest.coverage.seasons[1] - 1;
    const built = buildHistoricalLeague(h, start, { realDevelopment: !!draftYear, difficulty: 'normal', seed });
    let league = initializeCoaching(built.league, null);
    // A past draft: the real classes of the next 25 years join the league as their years come.
    const classes = draftYear ? topUpHistoricalClasses(h, league, built.extras, draftYear + 25) : null;
    if (classes) league = { ...league, historical: classes };
    const step = runCareerStep({ type: 'toDraft', league, extras: built.extras, seed, awardSettings: DEFAULT_AWARD_SETTINGS }, setPrePct);
    const done = step.done.then(r => { setPreReady(true); return { id: '', league: r.league, extras: r.extras, phase: 'atDraft' as const, ...(r.type === 'atDraft' ? { partial: r.partial } : {}) }; });
    done.catch(() => {});
    pre.current = { done, cancel: step.cancel, seed, draftYear };
  }, [h]);

  // A head start: today's league starts playing its pre-draft season as soon as the hub is open (most careers start
  // there), so it is well on its way by the time the player is built. Another era or the weekly career replaces it.
  useEffect(() => {
    if (!h || view.k !== 'hub' || pre.current) return;
    void launchPre(newSeed(), null);
  }, [h, view.k, launchPre]);

  const startNew = async (mode: Mode, draftYear: number | null = null, weekly: WeeklyCareer | null = null) => {
    if (!h) return;
    const warm = pre.current && !weekly && draftYear == null && pre.current.draftYear == null ? pre.current : null;
    const seed = weekly ? weekly.seed : warm ? warm.seed : newSeed();
    setWeekly(weekly?.week ?? null);
    setView(mode === 'wheel' ? { k: 'wheel', seed } : { k: 'myplayer', seed });
    setDraftYear(draftYear);
    if (!warm) await launchPre(seed, draftYear);
  };

  /** Name chosen: into the draft he goes. */
  const enterDraft = async (v: Extract<View, { k: 'identity' }>, c: IdentityChoice) => {
    if (!h || !pre.current) return;
    setBusy({ label: 'The season before your draft is being played…', pct: prePct });
    try {
      const w = await pre.current.done;
      const id = `career-${Date.now()}`;
      const playerId = uniqueName(w.league, w.extras, c.name);
      let meta = { ...newCareerMeta(id, v.seed, v.mode, { name: c.name, pos: c.pos, jersey: c.jersey }, v.prime, c.readiness, playerId, w.league.season ?? '', startProgress()), ...(draftYear ? { draftYear } : {}), ...(weekly ? { weekly } : {}) };
      track('mode_start', { mode: 'career', variant: weekly ? 'weekly' : v.mode, past_draft: !!draftYear });
      const joined = joinDraft(w.league, w.extras, meta);
      setBusy({ label: 'Draft night…', pct: null });
      const step = runCareerStep({ type: 'fromDraft', league: joined.league, extras: joined.extras, seed: v.seed + 7, partial: w.partial, awardSettings: DEFAULT_AWARD_SETTINGS }, () => {});
      cancelRef.current = step.cancel;
      const r = await step.done;
      meta = { ...meta, draft: draftResult(r.league, meta, r.type === 'inSeason' ? r.draftPicks : []) };
      if (meta.draft?.pick == null) meta = { ...meta, notes: ['Undrafted: he signs wherever there is a spot.'] };
      persist(meta, { id, league: r.league, extras: r.extras, phase: 'inSeason' });
      setView({ k: 'career' });
    } catch (e) {
      if ((e as Error).message !== 'cancelled') setError((e as Error).message);
    } finally { setBusy(null); pre.current = null; }
  };

  /** Plays the next season (from wherever the league stands) and lands at the next draft. */
  const playSeason = useCallback(async (a: Active) => {
    if (!h || !a.world || a.meta.status !== 'active') return;
    const { meta, world } = a;
    const seed = meta.seed + (meta.years.length + 1) * 1000;
    setBusy({ label: `Playing the ${fy(world.league.season)} season…`, pct: 0 });
    try {
      const step = runCareerStep(world.phase === 'atDraft'
        ? { type: 'fromDraft', league: world.league, extras: world.extras, seed, partial: world.partial, thenToDraft: true, awardSettings: DEFAULT_AWARD_SETTINGS }
        : { type: 'toDraft', league: world.league, extras: world.extras, seed, awardSettings: DEFAULT_AWARD_SETTINGS }, pct => setBusy(b => (b ? { ...b, pct } : b)));
      cancelRef.current = step.cancel;
      const r = await step.done;
      if (r.type !== 'atDraft') return;
      const landed = landSeason(meta, r.league, r.extras, r.partial.season);
      setTradeAsked(null);
      persist(landed.meta, { ...world, league: landed.league, extras: landed.extras, phase: 'atDraft', partial: r.partial });
    } catch (e) {
      if ((e as Error).message !== 'cancelled') setError((e as Error).message);
    } finally { setBusy(null); }
  }, [h, persist]);

  // Autopilot: offseason choices and the next season, until he retires.
  useEffect(() => {
    if (!h || !active?.world || !active.meta.autopilot || active.meta.status !== 'active' || busy || active.meta.pendingMoment) return;
    const t = setTimeout(() => {
      const { meta, world } = active;
      if (world!.phase === 'atDraft') {
        const next = autopilotOffseason(meta, world!.league, world!.extras, h);
        if (next.meta.status === 'retired') { persist(next.meta, null); return; }
        const a = { meta: next.meta, world: { ...world!, league: next.league, extras: next.extras } };
        persist(a.meta, a.world);
        playSeason(a);
      } else playSeason(active);
    }, 600);
    return () => clearTimeout(t);
  }, [h, active, busy, persist, playSeason]);

  const open = async (m: CareerMeta) => {
    // An existing career needs the CPU for its own seasons: drop the head start.
    pre.current?.cancel(); pre.current = null;
    const world = m.status === 'active' ? await loadWorld(m.id) : null;
    setActive({ meta: { ...m, autopilot: false }, world: world ?? null });
    setView({ k: 'career' });
  };

  const header = <header className="hunt-top">
    <button className="hunt-exit" onClick={() => { if (view.k === 'hub') onExit(); else { cancelRef.current(); setBusy(null); setView({ k: 'hub' }); setActive(null); } }}><PixelIcon name="exit" size={16} /> {view.k === 'hub' ? 'Main Menu' : 'Careers'}</button>
    <div className="hunt-title"><span className="pixel-eyebrow">ONE PLAYER, ONE CAREER</span><h1>Career Mode</h1></div>
  </header>;

  if (error) return <div className="hunt">{header}<p className="empty-state">Something went wrong: {error}</p><button onClick={() => { setError(null); setView({ k: 'hub' }); }}>Back</button></div>;
  if (!h) return <div className="hunt">{header}<p className="empty-state">Loading 80 years of basketball…</p></div>;

  return <div className="hunt cv">
    {header}
    {busy && <div className="cv-busy" role="status"><span>{busy.label}</span>{busy.pct != null && <div className="hunt-cap-bar"><i style={{ width: `${busy.pct}%` }} /></div>}
      {active?.meta.autopilot && <button className="link-button" onClick={() => setActive(a => (a ? { ...a, meta: { ...a.meta, autopilot: false } } : a))}>Stop autopilot after this season</button>}</div>}
    {view.k === 'hub' ? <Hub careers={careers} onNew={startNew} onOpen={open} onDelete={id => deleteCareer(id).then(refresh)} />
      : view.k === 'wheel' ? <WheelBuilder h={h} seed={view.seed} fav={weekly ? undefined : readFavorites().player} onBack={() => setView({ k: 'hub' })} onDone={prime => setView({ k: 'identity', seed: view.seed, prime, mode: 'wheel' })} />
      : view.k === 'myplayer' ? <MyPlayerBuilder seed={view.seed} onBack={() => setView({ k: 'hub' })} onDone={prime => setView({ k: 'identity', seed: view.seed, prime, mode: 'myplayer' })} />
      : view.k === 'identity' ? (busy ? null : <IdentityView prime={view.prime} seed={view.seed} ready={preReady} pct={prePct} onBack={() => setView({ k: view.mode === 'wheel' ? 'wheel' : 'myplayer', seed: view.seed })} onDone={c => enterDraft(view, c)} />)
      : active ? <CareerView h={h} a={active} busy={!!busy} tradeAsked={tradeAsked}
          onPlay={() => playSeason(active)}
          onAutopilot={on => setActive({ ...active, meta: { ...active.meta, autopilot: on } })}
          onTraining={training => persist({ ...active.meta, training }, active.world)}
          onSign={offerIdx => { const w = active.world!; const offers = freeAgentOffers(w.league, w.extras, active.meta); const o = offers[offerIdx]; if (!o) return; const r = signOffer(w.league, w.extras, active.meta, o); persist({ ...active.meta, notes: [...active.meta.notes, r.note] }, { ...w, league: r.league, extras: r.extras }); }}
          onTrade={wish => { const w = active.world!; const r = requestTrade(w.league, w.extras, active.meta, wish); setTradeAsked(r.note); persist({ ...active.meta, notes: [...active.meta.notes, r.note] }, { ...w, league: r.league, extras: r.extras }); }}
          onRetire={() => { const w = active.world!; const f = findPlayer(w.league, w.extras, active.meta.playerId); const done = retire(active.meta, h, w.league.season ?? '', f?.player.age ?? 0); if (done.retired) noteFeaturedXp('career', `career-${done.id}`, 150 + done.retired.legacy + (done.retired.hallOfFame !== 'no' ? 150 : 0)); persist(done, null); }}
          onNew={() => setView({ k: 'hub' })} />
      : null}
    {active?.meta.pendingMoment && active.world && !busy && view.k !== 'hub' && <MomentDialog moment={active.meta.pendingMoment} name={active.meta.identity.name}
      onChoose={i => { const w = active.world!; const r = chooseMoment(active.meta, w.league, w.extras, i); persist(r.meta, { ...w, league: r.league, extras: r.extras }); }} />}
  </div>;
}

/** The season's big moment: two calls, each worth Legacy or a summer of work. */
function MomentDialog({ moment, name, onChoose }: { moment: BigMoment; name: string; onChoose: (index: number) => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const c = picked != null ? moment.choices[picked] : null;
  return <div className="share-modal cv-moment" role="dialog" aria-modal="true" aria-labelledby="cv-moment-title">
    <div className="share-box">
      <span className="pixel-eyebrow">BIG MOMENT · {moment.season}</span>
      <h2 id="cv-moment-title">{moment.title}</h2>
      <p>{moment.text}</p>
      {!c ? <div className="cv-moment-choices">{moment.choices.map((ch, i) => <button key={i} onClick={() => setPicked(i)}>
        <b>{ch.label}</b><small>{[ch.legacy ? `+${ch.legacy} Legacy` : '', ch.train ? `Training: ${CATEGORY_BY_ID.get(ch.train.cat)?.name ?? ch.train.cat}` : ''].filter(Boolean).join(' · ')}</small></button>)}</div>
        : <><p className="cv-moment-result"><b>{name}:</b> {c.result}</p><button className="primary" onClick={() => onChoose(picked!)}>Continue</button></>}
    </div>
  </div>;
}

// ---------------------------------------------------------------- the hub

const PAST_DRAFTS = Array.from({ length: 2025 - 1947 + 1 }, (_, i) => 2025 - i);
const FAMOUS: Record<number, string> = { 1984: 'Jordan, Hakeem, Barkley', 1996: 'Kobe, Iverson, Nash, Allen', 2003: 'LeBron, Wade, Melo, Bosh', 1979: 'Magic', 1978: 'Bird', 1969: 'Kareem', 1992: 'Shaq', 1997: 'Duncan', 2009: 'Curry, Harden', 2007: 'Durant', 2014: 'Jokić, Embiid', 2018: 'Luka, Trae, SGA', 1985: 'Ewing, Karl Malone', 1987: 'Pippen, Robinson', 1998: 'Dirk, Pierce, Carter' };

function Hub({ careers, onNew, onOpen, onDelete }: { careers: CareerMeta[]; onNew: (m: Mode, draftYear: number | null, weekly?: WeeklyCareer | null) => void; onOpen: (m: CareerMeta) => void; onDelete: (id: string) => void }) {
  const [confirm, setConfirm] = useState<string | null>(null);
  const [era, setEra] = useState<number | null>(null);
  const [tab, setTab] = useState<'careers' | 'hof'>('careers');
  const inducted = careers.filter(m => m.retired && m.retired.hallOfFame !== 'no');
  const tabs = <div className="stats-view-toggle" role="tablist" aria-label="Career Mode">
    <button role="tab" aria-selected={tab === 'careers'} className={tab === 'careers' ? 'active' : ''} onClick={() => setTab('careers')}>Careers</button>
    <button role="tab" aria-selected={tab === 'hof'} className={tab === 'hof' ? 'active' : ''} onClick={() => setTab('hof')}>Hall of Fame ({inducted.length})</button>
  </div>;
  if (tab === 'hof') return <section className="hunt-stage cv-page">{tabs}<HallOfFame careers={careers} onOpen={onOpen} /></section>;
  const active = careers.filter(m => m.status !== 'retired'), retired = careers.filter(m => m.status === 'retired');
  const row = (m: CareerMeta) => { const last = m.years.at(-1); return <li key={m.id}>
    <PlayerAvatar playerId={m.playerId} primaryColor="#f47b20" secondaryColor="#f4f0e6" size={40} />
    <div><b>{m.playerId}</b><small>{m.status === 'retired' ? `Retired · Legacy ${m.retired?.legacy} · ${m.retired?.rank ? `#${m.retired.rank} all time` : 'outside the Top 100'}` : `${m.years.length} season${m.years.length === 1 ? '' : 's'}${last ? ` · ${last.teamName} · ${last.overall} OVR` : m.draft ? ` · drafted ${m.draft.pick ? `#${m.draft.pick}` : 'undrafted'}` : ''}`}</small></div>
    <button className={m.status === 'retired' ? '' : 'primary'} onClick={() => onOpen(m)}>{m.status === 'retired' ? 'Legacy' : 'Continue'}</button>
    {confirm === m.id ? <button className="danger" onClick={() => { onDelete(m.id); setConfirm(null); }}>Delete for good</button> : <button className="link-button" onClick={() => setConfirm(m.id)}>Delete</button>}
  </li>; };
  return <section className="hunt-stage cv-page">
    {tabs}
    {active.length > 0 && <div className="cv-panel"><h3 className="hunt-subhead">Continue</h3><ul className="cv-saved">{active.map(row)}</ul></div>}
    <div className="cv-panel">
      <h3 className="hunt-subhead">Start a new career</h3>
      <p className="hint-text">One player, his whole career in a real league: draft night, a training focus every summer, free agency, trades, awards, and at the end the Hall of Fame and his place in the all-time Top 100.</p>
      <div className="cv-era-row">
        <span>Enters the league:</span>
        <div className="hunt-replace"><button className={era == null ? 'active' : ''} aria-pressed={era == null} onClick={() => setEra(null)}>Today (2026 draft)</button>
          <label className="cv-era-pick"><span className="sr-only">A past draft</span><select value={era ?? ''} onChange={e => setEra(e.target.value ? Number(e.target.value) : null)}><option value="">A past draft…</option>{PAST_DRAFTS.map(y => <option key={y} value={y}>{y}{FAMOUS[y] ? ` · ${FAMOUS[y]}` : ''}</option>)}</select></label></div>
      </div>
      <p className="hint-text">{era ? `The ${era - 1}-${String(era).slice(2)} season is played first, then the ${era} draft, with the real class${FAMOUS[era] ? ` (${FAMOUS[era]})` : ''}. Real players follow their real careers around him.` : 'Today\'s league with real rosters: the 2025-26 season plays out first, then your draft.'}</p>
      <div className="hunt-roads cv-modes">
        <button className="hunt-road" onClick={() => onNew('wheel', era)}><span className="hunt-road-icon">⟳</span><b>Random mode</b><span>Spin the wheel of NBA history. Take Curry's three-point shot, Shaq's size, LeBron's playmaking… if the wheel lets you. Two lucky spins, each a sure Star or Great.</span></button>
        <button className="hunt-road" onClick={() => onNew('myplayer', era)}><span className="hunt-road-icon">✎</span><b>MyPlayer</b><span>Build him yourself, part by part. Your draft stock is rolled: a Starter, an All-Star, or once in a while a Generational talent.</span></button>
      </div>
    </div>
    <WeeklyCareerCard careers={careers} onPlay={w => onNew('wheel', w.draftYear, w)} />
    {retired.length > 0 && <div className="cv-panel"><h3 className="hunt-subhead">Retired</h3><ul className="cv-saved">{retired.map(row)}</ul></div>}
  </section>;
}

/** Career of the Week: the same wheel and the same league for everyone until Monday. */
function WeeklyCareerCard({ careers, onPlay }: { careers: CareerMeta[]; onPlay: (w: WeeklyCareer) => void }) {
  const w = weeklyCareer();
  const best = loadWeeklyRecords()[w.week]?.career;
  const mine = careers.filter(m => m.weekly === w.week);
  const [now] = useState(() => new Date());
  const days = Math.max(1, Math.ceil((weekEndsAt(now) - now.getTime()) / 86_400_000));
  return <div className="weekly-card">
    <div><span className="pixel-eyebrow">CAREER OF THE WEEK · {w.week}</span>
      <b>{w.draftYear ? `The ${w.draftYear} draft${FAMOUS[w.draftYear] ? ` (${FAMOUS[w.draftYear]})` : ''}` : 'Today\'s league, the 2026 draft'}</b>
      <p>Everyone spins the same wheel in the same league this week. Build the best career you can and compare Legacy Scores on Discord. New one in {days} day{days === 1 ? '' : 's'}.</p>
      <small>{best ? `Your best this week: Legacy ${best.best} (${best.label})` : mine.length ? `${mine.length} in progress` : 'Not played yet this week'}</small></div>
    <button className="primary" onClick={() => onPlay(w)}>Spin this week's wheel</button>
  </div>;
}

// ---------------------------------------------------------------- the Hall of Fame

/** Your players who made it: one plaque each, best legacy first. */
export function HallOfFame({ careers, onOpen }: { careers: CareerMeta[]; onOpen?: (m: CareerMeta) => void }) {
  const inducted = careers.filter(m => m.retired && m.retired.hallOfFame !== 'no').sort((a, b) => b.retired!.legacy - a.retired!.legacy);
  const retired = careers.filter(m => m.retired).length;
  if (!inducted.length) return <p className="empty-state">No one inducted yet{retired ? ` (${retired} retired career${retired === 1 ? '' : 's'} fell short)` : ''}. It takes a Legacy Score of 45; 90 makes it on the first ballot.</p>;
  return <div className="cv-hof">
    <p className="hint-text">{inducted.length} of your {retired} retired player{retired === 1 ? '' : 's'} made the Hall of Fame.</p>
    <ul>{inducted.map(m => {
      const r = careerResume(m), g = r.games, ret = m.retired!;
      const teams = [...new Set(m.years.map(y => y.teamName).filter(t => t !== 'Free agent'))];
      return <li key={m.id} className={ret.hallOfFame === 'first-ballot' ? 'first' : ''}>
        <div className="cv-plaque-top"><PlayerAvatar playerId={m.playerId} primaryColor="#ffd166" secondaryColor="#f4f0e6" size={56} />
          <div><span className="pixel-eyebrow">CLASS OF {Number(fy(ret.season)) + 3}{ret.hallOfFame === 'first-ballot' ? ' · FIRST BALLOT' : ''}</span><strong>{m.playerId}</strong>
            <small>{fy(m.years[0]?.season)}-{fy(m.years.at(-1)?.season)} · {teams.join(', ')}</small></div></div>
        <p>{per(r.pts, g)} PTS · {per(r.reb, g)} REB · {per(r.ast, g)} AST · {r.pts.toLocaleString()} points{ret.rank ? ` · #${ret.rank} all time` : ''}</p>
        <TrophyShelf entries={careerShelf(m)} size={28} />
        {ret.jerseys?.length ? <small>#{m.identity.jersey} retired by {ret.jerseys.join(' and ')}</small> : null}
        {onOpen && <button className="link-button" onClick={() => onOpen(m)}>His legacy</button>}
      </li>;
    })}</ul>
  </div>;
}

// ---------------------------------------------------------------- the career

const per = (v: number, g: number) => (g ? (v / g).toFixed(1) : '0.0');
const pct = (m: number, a: number) => (a ? `${(m / a * 100).toFixed(1)}` : '—');

function StatLine({ s }: { s: SeasonStatTotals }) {
  const g = s.gamesPlayed;
  return <div className="hunt-over-stats cv-line">
    <div><small>GP</small><b>{g}</b></div><div><small>PTS</small><b>{per(s.points, g)}</b></div><div><small>REB</small><b>{per(s.oreb + s.dreb, g)}</b></div>
    <div><small>AST</small><b>{per(s.ast, g)}</b></div><div><small>STL</small><b>{per(s.stl, g)}</b></div><div><small>BLK</small><b>{per(s.blk, g)}</b></div>
    <div><small>FG%</small><b>{pct(s.fgm, s.fga)}</b></div><div><small>3P%</small><b>{pct(s.tpm, s.tpa)}</b></div>
  </div>;
}

function YearsTable({ years }: { years: CareerYear[] }) {
  if (!years.length) return null;
  const tot = years.reduce((t, y) => ({ g: t.g + y.stats.gamesPlayed, pts: t.pts + y.stats.points, reb: t.reb + y.stats.oreb + y.stats.dreb, ast: t.ast + y.stats.ast, stl: t.stl + y.stats.stl, blk: t.blk + y.stats.blk }), { g: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0 });
  return <div className="feature-table-scroll"><table className="db-table cv-years">
    <thead><tr><th className="col-name">Season</th><th>Age</th><th className="col-name">Team</th><th>OVR</th><th>GP</th><th>PTS</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>FG%</th><th>3P%</th><th className="col-name">Team result</th><th className="col-name">Awards</th></tr></thead>
    <tbody>{years.map(y => { const s = y.stats, g = s.gamesPlayed; return <tr key={y.season}>
      <td className="col-name">{fy(y.season)}</td><td>{y.age}</td><td className="col-name">{y.teamName}</td><td>{y.overall}</td><td>{g}</td>
      <td>{per(s.points, g)}</td><td>{per(s.oreb + s.dreb, g)}</td><td>{per(s.ast, g)}</td><td>{per(s.stl, g)}</td><td>{per(s.blk, g)}</td><td>{pct(s.fgm, s.fga)}</td><td>{pct(s.tpm, s.tpa)}</td>
      <td className="col-name">{y.record ? `${y.record.w}-${y.record.l}` : ''} {y.finish ?? ''}</td>
      <td className="col-name cv-award-cell">{y.awards.map(a => a.label).join(' · ')}</td>
    </tr>; })}
      <tr className="cv-total"><td className="col-name">Career</td><td /><td className="col-name">{years.length} seasons</td><td /><td>{tot.g}</td><td>{per(tot.pts, tot.g)}</td><td>{per(tot.reb, tot.g)}</td><td>{per(tot.ast, tot.g)}</td><td>{per(tot.stl, tot.g)}</td><td>{per(tot.blk, tot.g)}</td><td /><td /><td className="col-name">{tot.pts.toLocaleString()} pts · {tot.reb.toLocaleString()} reb · {tot.ast.toLocaleString()} ast</td><td /></tr>
    </tbody></table></div>;
}

function Ratings({ meta }: { meta: CareerMeta }) {
  const now = valuesAt(meta.prime, meta.progress, meta.readiness);
  return <ul className="cv-ratings">{CATEGORIES.filter(c => c.id !== 'size').map(c => { const v = categoryScore(now[c.id]), top = categoryScore(meta.prime[c.id]); return <li key={c.id} className={meta.training.includes(c.id) ? 'training' : ''}>
    <span>{c.name}</span><div className="hunt-cap-bar"><i className={v > 99 ? 'elite' : ''} style={{ width: `${Math.min(100, v)}%` }} /></div><b className={v > 99 ? 'cv-elite' : ''}>{v}</b><small>/ {top}</small></li>; })}</ul>;
}

function CareerView({ h, a, busy, tradeAsked, onPlay, onAutopilot, onTraining, onSign, onTrade, onRetire, onNew }: {
  h: NbaHistory; a: Active; busy: boolean; tradeAsked: string | null;
  onPlay: () => void; onAutopilot: (on: boolean) => void; onTraining: (t: CategoryId[]) => void; onSign: (i: number) => void; onTrade: (w: TradeWish) => void; onRetire: () => void; onNew: () => void;
}) {
  const { meta, world } = a;
  const [sure, setSure] = useState(false);
  const [tab, setTab] = useState<CareerTab>('season');
  if (meta.status === 'retired') return <Legacy h={h} meta={meta} onNew={onNew} />;
  if (!world) return <p className="empty-state">This career's league could not be loaded from this browser.</p>;
  const found = findPlayer(world.league, world.extras, meta.playerId);
  const p = found?.player;
  const team = found?.teamId ? world.league.teams.find(t => t.teamId === found.teamId) : null;
  const last = meta.years.at(-1);
  const offers = world.phase === 'atDraft' ? freeAgentOffers(world.league, world.extras, meta) : [];
  const toggle = (id: CategoryId) => onTraining(meta.training.includes(id) ? meta.training.filter(x => x !== id) : [...meta.training, id].slice(-2));
  const rookieYear = meta.years.length === 0;
  const offseason = world.phase === 'atDraft';
  const tabList: { id: CareerTab; label: string }[] = [
    { id: 'plan', label: offseason ? 'Offseason' : 'Before the season' },
    ...(last && offseason ? [{ id: 'season' as const, label: `Last season (${fy(last.season)})` }] : []),
    { id: 'ratings', label: 'Ratings' },
    { id: 'history', label: 'Career stats' },
  ];
  const current = tabList.some(t => t.id === tab) ? tab : tabList[0].id;
  return <section className="hunt-stage cv-page">
    <div className="cv-hero cv-hero-card">
      <CareerCard meta={meta} overall={p ? calculateOverall(p) : null} age={p?.age} teamName={team ? team.name : 'Free agent'} prime={primeOverall(meta.prime, meta.readiness, meta.identity.pos)} />
      <div className="cv-hero-info"><span className="pixel-eyebrow">#{meta.identity.jersey} · {meta.identity.pos} · AGE {p?.age ?? ''}{meta.draftYear ? ` · ${meta.draftYear} DRAFT CLASS` : ''}</span><h2>{meta.playerId}</h2>
        <p>{team ? team.name : 'Free agent'} · <b className="hunt-rating">{p ? calculateOverall(p) : '—'}</b> OVR · prime {primeOverall(meta.prime, meta.readiness, meta.identity.pos)}</p>
        {meta.draft && <p className="hint-text">{meta.draft.pick ? `Drafted #${meta.draft.pick} overall by ${meta.draft.teamName} (${meta.draft.season} draft)` : `Undrafted (${meta.draft.season} draft)`}</p>}
        <div className="contest-actions cv-actions">
          <button className="primary hunt-play" disabled={busy} onClick={onPlay}>{offseason ? 'Play next season' : rookieYear ? 'Play rookie season' : 'Play the season'}</button>
          <button disabled={busy} onClick={() => onAutopilot(!meta.autopilot)}>{meta.autopilot ? 'Autopilot: on' : 'Autopilot the rest'}</button>
          {offseason && (sure ? <button className="danger" disabled={busy} onClick={onRetire}>Yes, retire now</button> : <button className="link-button" disabled={busy} onClick={() => setSure(true)}>Retire…</button>)}
        </div></div>
    </div>
    {rookieYear && meta.draft && <div className="hunt-result won"><span className="pixel-eyebrow">DRAFT NIGHT</span><h2>{meta.draft.pick ? `#${meta.draft.pick} overall: ${meta.draft.teamName}` : 'Undrafted'}</h2>
      <p>{meta.draft.pick && meta.draft.pick <= 3 ? 'A franchise pick. Everyone is watching.' : meta.draft.pick && meta.draft.pick <= 14 ? 'A lottery pick. Time to prove it.' : meta.draft.pick ? 'Plenty of teams passed. Make them regret it.' : 'Nobody called your name. Go earn it.'}</p></div>}
    {meta.notes.length > 0 && <p className="hunt-note" role="status">{meta.notes.join(' ')}</p>}
    <div className="stats-view-toggle cv-tabs" role="tablist" aria-label="Your career">{tabList.map(t => <button key={t.id} role="tab" aria-selected={current === t.id} className={current === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>{t.label}</button>)}</div>
    {current === 'season' && last && <div className="cv-recap">
      <span className="pixel-eyebrow">{fy(last.season)} · {last.teamName}{last.record ? ` · ${last.record.w}-${last.record.l}` : ''}{last.finish ? ` · ${last.finish}` : ''}</span>
      <StatLine s={last.stats} />
      {last.awards.length > 0 ? <ul className="cv-awards">{last.awards.map(x => <li key={x.label} className={['champion', 'mvp', 'fmvp'].includes(x.key) ? 'gold' : ''}>{x.label}</li>)}</ul> : <p className="hint-text">No awards this season.</p>}
      {last.playoffs && <p className="hint-text">Playoffs: {last.playoffs.gamesPlayed} games, {per(last.playoffs.points, last.playoffs.gamesPlayed)} PTS · {per(last.playoffs.oreb + last.playoffs.dreb, last.playoffs.gamesPlayed)} REB · {per(last.playoffs.ast, last.playoffs.gamesPlayed)} AST</p>}
      <Moments moments={careerMoments(meta).filter(m => m.season === last.season)} />
    </div>}
    {current === 'plan' && <div className="cv-panel">
      <h3 className="hunt-subhead">Training focus <small>(pick two; they grow faster and can pass his prime)</small></h3>
      <div className="hunt-replace">{CATEGORIES.filter(c => c.id !== 'size').map(c => <button key={c.id} aria-pressed={meta.training.includes(c.id)} className={meta.training.includes(c.id) ? 'active' : ''} disabled={busy} onClick={() => toggle(c.id)}>{c.name}</button>)}</div>
      {offers.length > 0 && <><h3 className="hunt-subhead">Free agency: pick your team</h3>
        <div className="hunt-roads">{offers.map((o, i) => <button key={o.teamId} className="hunt-road" disabled={busy} onClick={() => onSign(i)}><b>{o.teamName}</b><span>{OFFER_LABEL[o.kind]} · {o.years} yrs · ${(o.salary / 1_000_000).toFixed(1)}M/yr · won {o.wins} last season</span></button>)}</div>
        <p className="hint-text">Or play on and let the market decide.</p></>}
      {offseason && found?.teamId && !tradeAsked && <><h3 className="hunt-subhead">Ask for a trade?</h3>
        <div className="hunt-replace"><button disabled={busy} onClick={() => onTrade('contender')}>To a contender</button><button disabled={busy} onClick={() => onTrade('role')}>For a bigger role</button><button disabled={busy} onClick={() => onTrade('anywhere')}>Anywhere but here</button></div></>}
    </div>}
    {current === 'ratings' && <div className="cv-panel"><h3 className="hunt-subhead">Ratings <small>(now / prime; green = training focus)</small></h3><Ratings meta={meta} /></div>}
    {current === 'history' && <><OverallChart years={meta.years} />{meta.years.length ? <YearsTable years={meta.years} /> : <p className="empty-state">No seasons played yet.</p>}</>}
  </section>;
}

type CareerTab = 'plan' | 'season' | 'ratings' | 'history';

function Moments({ moments, title = 'Moments' }: { moments: Moment[]; title?: string }) {
  if (!moments.length) return null;
  return <div className="cv-moments"><span className="pixel-eyebrow">{title.toUpperCase()}</span>
    <ul>{moments.map((m, i) => <li key={i} className={m.big ? 'big' : ''}><small>{fy(m.season)} · age {m.age}</small><span>{m.text}</span></li>)}</ul></div>;
}

// ---------------------------------------------------------------- legacy

function Legacy({ h, meta, onNew }: { h: NbaHistory; meta: CareerMeta; onNew: () => void }) {
  const [copied, setCopied] = useState(false);
  const [all, setAll] = useState(false);
  const r = careerResume(meta), score = legacyScore(r), list = top100(h), rank = top100Rank(list, score);
  const ret = meta.retired!;
  const g = r.games;
  const shelf = [['titles', 'Championships'], ['fmvp', 'Finals MVP'], ['mvp', 'MVP'], ['allNba1', 'All-NBA 1st'], ['allNba2', 'All-NBA 2nd'], ['allNba3', 'All-NBA 3rd'], ['allStar', 'All-Star'], ['dpoy', 'DPOY'], ['allDef1', 'All-Defense 1st'], ['allDef2', 'All-Defense 2nd'], ['roy', 'Rookie of the Year']] as const;
  const rows = list.map(e => ({ rank: e.rank, name: e.name, score: e.score, me: false }));
  if (rank) rows.splice(rank - 1, 0, { rank, name: meta.playerId, score, me: true });
  const shown = all ? rows : rank ? rows.slice(Math.max(0, rank - 6), rank + 5) : rows.slice(-5);
  const share = [`${meta.playerId}: ${meta.years.length} seasons, ${per(r.pts, g)} PPG / ${per(r.reb, g)} RPG / ${per(r.ast, g)} APG`,
    shelf.filter(([k]) => r[k] > 0).map(([k, l]) => `${r[k]}x ${l}`).join(', '),
    `Hall of Fame: ${ret.hallOfFame === 'first-ballot' ? 'first ballot' : ret.hallOfFame === 'yes' ? 'yes' : 'no'} · ${rank ? `#${rank} all time` : 'outside the all-time Top 100'} (Court Vision Career Mode)`].filter(Boolean).join('\n');
  return <section className="hunt-stage hunt-over won cv-page">
    <div className="cv-legacy-card"><CareerCard meta={meta} overall={meta.years.reduce((m, y) => Math.max(m, y.overall), 0)} teamName={meta.years.at(-1)?.teamName ?? ''} /></div>
    <div className="hunt-over-banner"><span className="pixel-eyebrow">RETIRED AT {ret.age} · {fy(ret.season)}</span><h2>The legacy of {meta.playerId}</h2>
      <div className="hunt-over-stats">
        <div><small>ALL-TIME RANK</small><b>{rank ? `#${rank}` : '—'}</b></div>
        <div><small>HALL OF FAME</small><b>{ret.hallOfFame === 'first-ballot' ? 'First ballot' : ret.hallOfFame === 'yes' ? 'Inducted' : 'No'}</b></div>
        <div><small>LEGACY SCORE</small><b>{score}</b></div>
        <div><small>SEASONS</small><b>{meta.years.length}</b></div>
      </div></div>
    <ClaimRankCard id={`career:${meta.id}`} board={{ kind: 'players' }} score={Math.round(ret.legacy)} scored={`Your career scored ${ret.legacy.toFixed(1)}`} where="globally" />
    <h3 className="hunt-subhead">Career</h3>
    <div className="hunt-over-stats cv-line">
      <div><small>GAMES</small><b>{g}</b></div><div><small>POINTS</small><b>{r.pts.toLocaleString()}</b></div><div><small>REBOUNDS</small><b>{r.reb.toLocaleString()}</b></div><div><small>ASSISTS</small><b>{r.ast.toLocaleString()}</b></div>
      <div><small>PPG</small><b>{per(r.pts, g)}</b></div><div><small>RPG</small><b>{per(r.reb, g)}</b></div><div><small>APG</small><b>{per(r.ast, g)}</b></div><div><small>STL+BLK</small><b>{(r.stl + r.blk).toLocaleString()}</b></div>
    </div>
    {ret.jerseys && ret.jerseys.length > 0 && <div className="hunt-result won cv-jersey"><span className="pixel-eyebrow">JERSEY RETIREMENT</span><h2>#{meta.identity.jersey} hangs in the rafters</h2><p>Retired by {ret.jerseys.join(' and ')}.</p></div>}
    <h3 className="hunt-subhead">Trophy shelf</h3>
    <TrophyShelf entries={careerShelf(meta)} empty="No major awards." />
    <h3 className="hunt-subhead">All-time Top 100 {rank ? '' : <small>(he is outside it: it takes a Legacy Score above {Math.min(...list.map(e => e.score))})</small>}</h3>
    <ol className="cv-top">{shown.map(e => <li key={`${e.rank}-${e.name}`} className={e.me ? 'me' : ''}><span>#{e.me ? e.rank : e.rank + (rank && e.rank >= rank ? 1 : 0)}</span><b>{e.name}</b><small>{e.score}</small></li>)}</ol>
    <button className="link-button" onClick={() => setAll(!all)}>{all ? (rank ? 'Show the players around him' : 'Show the bottom of the list') : 'Show the whole Top 100'}</button>
    <OverallChart years={meta.years} />
    <Moments moments={careerMoments(meta)} title="Career moments" />
    <YearsTable years={meta.years} />
    <div className="contest-actions"><button className="primary" onClick={onNew}>New career</button><ShareCardButton fileName={`${meta.playerId.replace(/\W+/g, '-')}-legacy.png`} text={share} spec={{
      kicker: `${meta.weekly ? `Career of the Week ${meta.weekly}` : 'Career Mode'} · ${meta.years.length} season${meta.years.length === 1 ? '' : 's'}${meta.draftYear ? ` · ${meta.draftYear} draft class` : ''}`, title: meta.playerId,
      subtitle: `${per(r.pts, g)} PTS · ${per(r.reb, g)} REB · ${per(r.ast, g)} AST · ${r.pts.toLocaleString()} career points`,
      badge: ret.hallOfFame === 'first-ballot' ? 'HALL OF FAME · FIRST BALLOT' : ret.hallOfFame === 'yes' ? 'HALL OF FAME' : undefined,
      stats: [{ label: 'All-time', value: rank ? `#${rank}` : '—' }, { label: 'Titles', value: String(r.titles) }, { label: 'MVPs', value: String(r.mvp) }, { label: 'All-Star', value: String(r.allStar) }],
      lines: [...shelf.filter(([k]) => r[k] > 0 && !['titles', 'mvp', 'allStar'].includes(k)).map(([k, l]) => `${r[k]}× ${l}`), ...(ret.jerseys?.length ? [`#${meta.identity.jersey} retired by ${ret.jerseys.join(' and ')}`] : [])],
      avatar: { playerId: meta.playerId, jersey: meta.identity.jersey }, accent: ret.hallOfFame !== 'no' ? 'gold' : 'orange',
    }} /><button onClick={() => navigator.clipboard?.writeText(share).then(() => setCopied(true), () => {})}>{copied ? 'Copied!' : 'Copy as text'}</button></div>
    {meta.weekly && <PostScore board="career" week={meta.weekly} guestPitch={false} />}
  </section>;
}
