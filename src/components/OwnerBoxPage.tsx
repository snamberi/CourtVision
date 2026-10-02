import { useMemo, useState } from 'react';
import { plural } from '../lib/humanize';
import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import { ARCHETYPE } from '../simulation/gmRivals';
import {
  GOALS, BUDGETS, GM_STYLE, PROPOSALS, OWNER_HOF, RELOCATION_FEE, SUITE_INCOME, arenaCost, ownerTeam, ownerStanding, ownerLegacy, gmCandidates, gmGrade,
  hireGm, fireGm, extendGm, setGoal, setBudget, headCoachCandidates, hireHeadCoach, fireHeadCoach, buildArena, namingOffers, signNaming, setTeamColors,
  openCities, cityMarket, meetingOpen as isOff, relocate, castVote, voteOnBid, startOwnership, loadOwnerRecords, type OwnerGoal, type OwnerBudget, type ExpansionBid,
} from '../simulation/ownerBox';
import { DEFAULT_LEAGUE_RULES } from '../simulation/leagueRules';
import { homeCities } from '../simulation/travel';
import { resolveTeamIdentity } from '../simulation/teamIdentity';
import { coachLook } from '../visuals/coachLook';
import { OWNER_REWARD } from '../profile/cosmetics';
import { formatSeasonYear } from '../simulation/calendar';
import { TeamLogo } from './TeamLogo';
import { CoachFigure } from './CoachFigure';
import { RelocationMap } from './RoadTripsPage';
import { ProfileIcon } from './ProfileIcon';

type Tab = 'office' | 'arena' | 'league' | 'legacy';
const money = (n: number) => `${n < 0 ? '−' : ''}$${Math.abs(n / 1e6) >= 1000 ? `${(Math.abs(n) / 1e9).toFixed(2)}B` : `${Math.round(Math.abs(n) / 1e6)}M`}`;

interface Props {
  league: League; extras: GMLeagueExtras; controlledTeamId: string | null;
  onChange: (league: League, extras?: GMLeagueExtras) => void;
  onToast: (text: string, kind?: 'success' | 'info' | 'error') => void;
  onExpand: (bid: ExpansionBid, league: League) => void;
}

/** The Owner's Box: your GM and coach, the goal and the budget, the arena, the league office, and your legacy. */
export function OwnerBoxPage(props: Props) {
  const { league } = props;
  const [tab, setTab] = useState<Tab>('office');
  const owner = league.owner, team = ownerTeam(league);
  if (!owner || !team) return <BuyTeam {...props} />;
  const id = resolveTeamIdentity(team);
  const row = ownerStanding(league);
  const legacy = ownerLegacy(owner);
  const tabs: [Tab, string][] = [['office', 'Front office'], ['arena', 'Arena & city'], ['league', 'League office'], ['legacy', 'Legacy']];
  return <div className="owner-box" style={{ ['--ob1' as string]: id.primary, ['--ob2' as string]: id.secondary }}>
    <header className="owner-head">
      <TeamLogo team={team} size={56} />
      <div><span className="pixel-eyebrow">OWNER'S BOX · SINCE {formatSeasonYear(owner.since)}</span><h2>{team.name}</h2>
        <p>{row ? `${row.wins}-${row.losses}` : '0-0'} · {owner.arena.name} · GM: {owner.gm ? owner.gm.name : 'interim'}</p></div>
      <dl className="owner-stats">
        <div><dt>Cash</dt><dd className={owner.cash < 0 ? 'down' : ''}>{money(owner.cash)}</dd></div>
        <div><dt>Fans</dt><dd>{Math.round(owner.fans)}</dd></div>
        <div><dt>Legacy</dt><dd>{legacy.score}</dd></div>
      </dl>
    </header>
    <div className="stats-view-toggle" role="tablist" aria-label="Owner's Box">{tabs.map(([t, l]) => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{l}</button>)}</div>
    {tab === 'office' && <FrontOffice {...props} />}
    {tab === 'arena' && <Arena {...props} />}
    {tab === 'league' && <LeagueOfficeTab {...props} />}
    {tab === 'legacy' && <Legacy {...props} />}
  </div>;
}

function BuyTeam({ league, extras, controlledTeamId, onChange, onToast }: Props) {
  const [pick, setPick] = useState(controlledTeamId ?? league.teams[0]?.teamId ?? '');
  const t = league.teams.find(x => x.teamId === pick);
  return <section className="owner-buy">
    <span className="pixel-eyebrow">OWNER'S BOX</span>
    <h2>Own a team instead of running it</h2>
    <p>An AI general manager you hire runs the team day to day: trades, the draft, free agency. You set the goal and the budget, judge his results, hire and fire him and the head coach, build the arena (or move the team), and vote with the other owners on the league's rules.</p>
    {controlledTeamId && <p className="hunt-note">Buying a team ends your GM job in this league: from then on the AI runs every roster, yours included.</p>}
    <label className="owner-buy-pick">Team <select value={pick} onChange={e => setPick(e.target.value)}>{league.teams.map(x => <option key={x.teamId} value={x.teamId}>{x.name}</option>)}</select></label>
    {t && <div className="owner-buy-card"><TeamLogo team={t} size={48} /><div><b>{t.name}</b><small>Market {t.marketSize ?? 50}/100 · you start with {money((120 + (t.marketSize ?? 50) * 2.5) * 1e6)}</small></div>
      <button className="primary" onClick={() => { const r = startOwnership(league, extras, pick); onChange(r.league, r.extras); onToast(`You own the ${t.name}. Hire a general manager to run them.`, 'success'); }}>Buy the {t.name}</button></div>}
  </section>;
}

function FrontOffice({ league, extras, onChange, onToast }: Props) {
  const o = league.owner!, team = ownerTeam(league)!;
  const id = resolveTeamIdentity(team);
  const candidates = useMemo(() => gmCandidates(league), [league]);
  const coaches = useMemo(() => headCoachCandidates(league), [league]);
  const [confirmFire, setConfirmFire] = useState<'gm' | 'coach' | null>(null);
  const coach = team.coachIdentity;
  const apply = (r: { league: League; extras: GMLeagueExtras }) => onChange(r.league, r.extras);
  return <div className="owner-grid">
    <section className="owner-panel">
      <h3>The goal</h3>
      <div className="owner-choices">{(Object.keys(GOALS) as OwnerGoal[]).map(g => <button key={g} className={o.goal === g ? 'on' : ''} aria-pressed={o.goal === g} onClick={() => apply(setGoal(league, extras, g))}><b>{GOALS[g].label}</b><span>{GOALS[g].blurb}</span></button>)}</div>
      <h3>The budget</h3>
      <div className="owner-choices three">{(Object.keys(BUDGETS) as OwnerBudget[]).map(b => <button key={b} className={o.budget === b ? 'on' : ''} aria-pressed={o.budget === b} onClick={() => apply(setBudget(league, extras, b))}><b>{BUDGETS[b].label}</b><span>{BUDGETS[b].blurb}</span></button>)}</div>
    </section>
    <section className="owner-panel">
      <h3>General manager</h3>
      {o.gm ? <>
        <div className="owner-person"><Person look={{ ...coachLook(o.gm.name, o.gm.age), outfit: 'suit' }} primary={id.primary} secondary={id.secondary} px={88} />
          <div><b>{o.gm.name}</b><small>{ARCHETYPE[o.gm.archetype].label} · age {o.gm.age}</small><span>{GM_STYLE[o.gm.archetype].note}</span>
            <small>{o.gm.years > 0 ? `${o.gm.years} year${o.gm.years === 1 ? '' : 's'} left` : 'Contract ran out'} · {money(o.gm.salary)} a year</small></div></div>
        {o.gm.record.length > 0 && <table className="db-table owner-report"><thead><tr><th>Season</th><th>Record</th><th>Expected</th><th>Finish</th><th>Goal</th><th>Grade</th></tr></thead>
          <tbody>{o.gm.record.map(r => { const g = gmGrade(r); return <tr key={r.season}><td>{formatSeasonYear(r.season)}</td><td>{r.wins}-{r.losses}</td><td>#{r.expectedRank} → #{r.actualRank}</td><td>{r.finish}</td><td>{r.goalMet ? 'Met' : 'Missed'}</td><td title={g.note}><b className={`grade-${g.grade}`}>{g.grade}</b></td></tr>; })}</tbody></table>}
        <div className="contest-actions">
          {o.gm.years <= 1 && <button onClick={() => { onChange(extendGm(league)); onToast('Extended three more years.', 'success'); }}>Extend (3 years, +10%)</button>}
          {confirmFire === 'gm' ? <button className="danger" onClick={() => { apply(fireGm(league, extras)); setConfirmFire(null); onToast('General manager fired.', 'info'); }}>Fire him ({money(o.gm.salary * Math.max(0, o.gm.years))} payout)</button>
            : <button className="link-button" onClick={() => setConfirmFire('gm')}>Fire…</button>}
        </div>
      </> : <>
        <p className="hint-text">An interim GM is running the team. Interview three candidates:</p>
        <div className="owner-candidates">{candidates.map(c => <div key={c.id} className="owner-candidate">
          <Person look={{ ...coachLook(c.name, c.age), outfit: 'suit' }} primary={id.primary} secondary={id.secondary} px={64} />
          <b>{c.name}</b><small>{ARCHETYPE[c.archetype].label} · {c.age}</small><span>{GM_STYLE[c.archetype].note}</span><small>{plural(c.years, 'year')} · {money(c.salary)} a year</small>
          <button className="primary" onClick={() => { apply(hireGm(league, extras, c)); onToast(`${c.name} is your general manager.`, 'success'); }}>Hire</button></div>)}</div>
      </>}
    </section>
    <section className="owner-panel">
      <h3>Head coach</h3>
      {coach ? <div className="owner-person"><Person look={coachLook(coach.coachId, coach.age)} primary={id.primary} secondary={id.secondary} px={88} />
        <div><b>{coach.coachId}</b><small>Rating {Math.round(coach.rating)} · age {coach.age}{coach.championships ? ` · ${coach.championships} title${coach.championships === 1 ? '' : 's'}` : ''}</small>
          <small>{coach.contract.yearsRemaining} year{coach.contract.yearsRemaining === 1 ? '' : 's'} left · {money(coach.contract.annualSalary)} a year</small>
          {confirmFire === 'coach' ? <button className="danger" onClick={() => { const r = fireHeadCoach(league); onChange(r.league); setConfirmFire(null); onToast(r.message, 'info'); }}>Fire him (contract paid out)</button>
            : <button className="link-button" onClick={() => setConfirmFire('coach')}>Fire…</button>}</div></div>
        : <p className="hint-text">No head coach: an assistant will take over as interim unless you hire one.</p>}
      <h4>Coaches on the market</h4>
      <ul className="owner-coaches">{coaches.map(({ coach: c, offer }) => <li key={c.coachId}><b>{c.coachId}</b><small>Rating {Math.round(c.rating)} · asks {money(offer.demand)}</small>
        <button disabled={!offer.accepted} title={offer.reason ?? ''} onClick={() => { const r = hireHeadCoach(league, c.coachId); onChange(r.league); onToast(r.message, r.league === league ? 'error' : 'success'); }}>{offer.accepted ? 'Hire' : 'Not interested'}</button></li>)}</ul>
    </section>
  </div>;
}

function Arena({ league, onChange, onToast }: Props) {
  const o = league.owner!, team = ownerTeam(league)!;
  const id = resolveTeamIdentity(team);
  const [name, setName] = useState(o.arena.name);
  const [suites, setSuites] = useState(2);
  const [primary, setPrimary] = useState(id.primary), [secondary, setSecondary] = useState(id.secondary);
  const [city, setCity] = useState<string | null>(null), [nick, setNick] = useState('');
  const offers = namingOffers(league);
  const cities = homeCities(league.teams);
  const open = openCities(league);
  const cost = arenaCost(suites);
  return <div className="owner-grid">
    <section className="owner-panel">
      <h3>{o.arena.name}</h3>
      <ArenaArt name={o.arena.name} suites={o.arena.suites} primary={id.primary} secondary={id.secondary} built={!!o.arena.builtSeason} />
      <p className="hint-text">{o.arena.builtSeason ? `Opened ${formatSeasonYear(o.arena.builtSeason)}` : 'The old building'} · {o.arena.suites} level{o.arena.suites === 1 ? '' : 's'} of luxury suites ({money(o.arena.suites * SUITE_INCOME)} a year){o.arena.sponsor ? ` · naming rights ${money(o.arena.sponsor.annual)} a year, ${o.arena.sponsor.years} left` : ''}</p>
      <h4>Build a new arena</h4>
      <div className="owner-form"><label>Name <input className="year-input" value={name} maxLength={40} onChange={e => setName(e.target.value)} /></label>
        <label>Luxury suites <input type="range" min={0} max={4} value={suites} onChange={e => setSuites(Number(e.target.value))} /> <b>{suites}</b></label>
        <button className="primary" disabled={o.cash < cost} onClick={() => { const r = buildArena(league, name, suites); onChange(r.league); onToast(r.message, r.league === league ? 'error' : 'success'); }}>Build it · {money(cost)}</button></div>
      <p className="hint-text">Every arena upgrade at the top level (seats, video board, practice court, lights, a loud crowd, a mascot), your name on the building and the court, and suites that pay {money(SUITE_INCOME)} a level every season.</p>
      {!o.arena.sponsor && <><h4>Naming rights</h4><ul className="owner-coaches">{offers.map(of => <li key={of.name}><b>{of.name}</b><small>{money(of.annual)} a year · {plural(of.years, 'year')}</small><button onClick={() => { onChange(signNaming(league, of)); onToast(`Welcome to the ${of.name} arena.`, 'success'); }}>Sign</button></li>)}</ul></>}
      <h4>Team colours</h4>
      <div className="owner-form"><label>Primary <input type="color" value={primary} onChange={e => setPrimary(e.target.value)} /></label><label>Secondary <input type="color" value={secondary} onChange={e => setSecondary(e.target.value)} /></label>
        <button onClick={() => { onChange(setTeamColors(league, primary, secondary)); onToast('New colours: on the court, the jerseys and the logo.', 'success'); }}>Save colours</button></div>
    </section>
    <section className="owner-panel">
      <h3>Move the team</h3>
      <RelocationMap taken={[...cities.values()]} open={open} home={cities.get(team.teamId)} pick={city} primary={id.primary} onPick={setCity} />
      {city ? <div className="owner-form"><b>{city}</b><small>Market {cityMarket(city)}/100 (now {team.marketSize ?? 50})</small>
        <label>New nickname <input className="year-input" value={nick} maxLength={20} placeholder="keep it" onChange={e => setNick(e.target.value)} /></label>
        <button className={isOff(league) && o.cash >= RELOCATION_FEE ? 'danger' : ''} disabled={!isOff(league) || o.cash < RELOCATION_FEE} onClick={() => { const r = relocate(league, city, nick); onChange(r.league); onToast(r.message, r.passed ? 'success' : 'error'); if (r.passed) setCity(null); }}>Ask the owners · {money(RELOCATION_FEE)} fee</button></div>
        : <p className="hint-text">Pick a city without a team on the map. Two thirds of the owners must approve, the fee is {money(RELOCATION_FEE)}, and the fans you leave behind will not forget it (fans −25).</p>}
      {!isOff(league) && <p className="hint-text">Teams can only move between seasons (until the first game of the next one).</p>}
    </section>
  </div>;
}

/** A person (GM or coach) standing, in the team colours. */
function Person({ look, primary, secondary, px }: { look: ReturnType<typeof coachLook>; primary: string; secondary: string; px: number }) {
  return <svg className="owner-figure" viewBox="-24 -54 48 58" width={px} height={Math.round(px * 58 / 48)} aria-hidden="true">
    <rect x="-24" y="-54" width="48" height="58" fill={primary} opacity=".2" /><CoachFigure look={look} primary={primary} secondary={secondary} pose="cross" />
  </svg>;
}

/** A little pixel arena: the building in team colours, suites along the top, the name on the front. */
function ArenaArt({ name, suites, primary, secondary, built }: { name: string; suites: number; primary: string; secondary: string; built: boolean }) {
  return <svg className="owner-arena" viewBox="0 0 240 110" role="img" aria-label={name} shapeRendering="crispEdges">
    <rect width="240" height="110" fill="#0b1018" />
    <rect x="0" y="92" width="240" height="18" fill="#1c2a3d" />
    <path d={built ? 'M20 92 L20 44 Q120 8 220 44 L220 92 Z' : 'M40 92 L40 50 L200 50 L200 92 Z'} fill={primary} stroke="#0b1018" strokeWidth="2" />
    <rect x={built ? 30 : 48} y="62" width={built ? 180 : 144} height="8" fill={secondary} />
    {Array.from({ length: suites * 6 }, (_, i) => <rect key={i} x={40 + (i % 12) * 14} y={48 + Math.floor(i / 12) * 7} width="9" height="4" fill="#ffd166" />)}
    <rect x="100" y="76" width="40" height="16" fill="#0b1018" />
    <text x="120" y="88" textAnchor="middle" fontFamily="monospace" fontSize="8" fontWeight="bold" fill="#f4f0e6">{name.slice(0, 26).toUpperCase()}</text>
  </svg>;
}

function LeagueOfficeTab({ league, onChange, onToast, onExpand }: Props) {
  const office = league.leagueOffice;
  const r = { ...DEFAULT_LEAGUE_RULES, ...league.rulesSettings };
  const off = isOff(league);
  const name = (tid?: string) => league.teams.find(t => t.teamId === tid)?.name ?? '';
  return <div className="owner-grid">
    <section className="owner-panel">
      <h3>On the agenda</h3>
      {!off && <p className="hint-text">The owners meet between seasons; the agenda is below. Votes open when this season ends and stay open until the next season's first game.</p>}
      {office?.proposals.length ? <ul className="owner-votes">{office.proposals.map(pid => { const p = PROPOSALS[pid]; return <li key={pid}><b>{p.title}</b><span>{p.blurb}</span>
        <div className="contest-actions"><button disabled={!off} onClick={() => { const v = castVote(league, pid, true); onChange(v.league); onToast(`${p.title}: ${v.result.passed ? 'passed' : 'failed'} ${v.result.yes}-${v.result.no}.`, v.result.passed ? 'success' : 'info'); }}>Vote yes</button>
          <button disabled={!off} onClick={() => { const v = castVote(league, pid, false); onChange(v.league); onToast(`${p.title}: ${v.result.passed ? 'passed anyway' : 'failed'} ${v.result.yes}-${v.result.no}.`, 'info'); }}>Vote no</button></div></li>; })}</ul>
        : <p className="hint-text">Nothing left to vote on this offseason.</p>}
      {(office?.bids ?? []).map(b => <div key={b.id} className="owner-bid"><b>Expansion bid: the {b.city} {b.nickname}</b><span>{b.city} offers {money(b.fee)}, split among the owners. The new team drafts from everyone's unprotected players.</span>
        <div className="contest-actions"><button disabled={!off} onClick={() => { const v = voteOnBid(league, b.id, true); onChange(v.league); onToast(v.result.passed ? `${b.city} is in (${v.result.yes}-${v.result.no}). The expansion draft runs now.` : `The owners turned ${b.city} down, ${v.result.yes}-${v.result.no}.`, v.result.passed ? 'success' : 'info'); if (v.bid) onExpand(v.bid, v.league); }}>Vote yes</button>
          <button disabled={!off} onClick={() => { const v = voteOnBid(league, b.id, false); onChange(v.league); onToast(v.result.passed ? `${b.city} gets its team anyway (${v.result.yes}-${v.result.no}).` : `${b.city} is turned down.`, 'info'); if (v.bid) onExpand(v.bid, v.league); }}>Vote no</button></div></div>)}
      <h4>The rules today</h4>
      <ul className="owner-rules">
        <li>Four-point line: <b>{r.fourPointLine ? 'yes' : 'no'}</b></li>
        <li>Shot clock: <b>{league.settings.era.shotClockSeconds} seconds</b> ({r.possessionsPerGame} possessions per 100)</li>
        <li>Play-in: <b>{r.playInEnabled === false ? 'scrapped' : 'yes'}</b></li>
        <li>Season: <b>{league.settings.gamesPerSeason ?? r.gamesPerSeason} games</b> · teams: <b>{league.teams.length}</b></li>
      </ul>
    </section>
    <section className="owner-panel">
      <h3>Around the league</h3>
      {office?.events.length ? <ul className="owner-feed">{[...office.events].reverse().map((e, i) => <li key={i} className={`k-${e.kind}`}><small>{formatSeasonYear(e.season)}{e.teamId ? ` · ${name(e.teamId)}` : ''}</small>{e.text}</li>)}</ul> : <p className="hint-text">Moves, protests, expansion and new rules show up here.</p>}
      <h4>Votes</h4>
      {office?.votes.length ? <table className="db-table"><thead><tr><th className="col-name">Question</th><th>Yes</th><th>No</th><th>Result</th><th>You</th></tr></thead>
        <tbody>{[...office.votes].reverse().map((v, i) => <tr key={i}><td className="col-name">{v.title}</td><td>{v.yes}</td><td>{v.no}</td><td>{v.passed ? 'Passed' : 'Failed'}</td><td>{v.yours == null ? '—' : v.yours ? 'Yes' : 'No'}</td></tr>)}</tbody></table>
        : <p className="hint-text">No votes yet.</p>}
    </section>
  </div>;
}

function Legacy({ league }: Props) {
  const o = league.owner!;
  const l = ownerLegacy(o);
  const records = loadOwnerRecords();
  const best = records.reduce((m, r) => Math.max(m, r.legacy), l.score);
  const rewards: [string, number, string][] = [['Title: Team Owner', OWNER_REWARD.title, ''], ['Skybox profile icon', OWNER_REWARD.skybox, 'skybox'], ['Gold suit for your coach', OWNER_REWARD.goldSuit, ''], ['Title: Tycoon, in animated Tycoon gold', OWNER_REWARD.tycoon, '']];
  return <div className="owner-grid">
    <section className="owner-panel">
      <h3>Owner legacy: {l.score}</h3>
      <dl className="owner-legacy"><div><dt>Titles</dt><dd>{l.titles}</dd></div><div><dt>Finals</dt><dd>{l.finals}</dd></div><div><dt>Playoffs</dt><dd>{l.playoffs}</dd></div><div><dt>Winning seasons</dt><dd>{l.winning}</dd></div><div><dt>Profit</dt><dd>{money(l.profit)}</dd></div><div><dt>Seasons</dt><dd>{l.seasons}</dd></div></dl>
      <p className="hint-text">Titles count 30, a Finals 12, a playoff trip 4, a winning season 2, every $25M of profit 1 and building an arena 10. {OWNER_HOF}+ puts you in the Owners' Hall of Fame.</p>
      <h4>Owner rewards <small>(best legacy anywhere: {best})</small></h4>
      <ul className="owner-rewards">{rewards.map(([label, need, icon]) => <li key={label} className={best >= need ? 'open' : ''}>{icon && <ProfileIcon id={icon} size={28} />}<b>{label}</b><small>{best >= need ? 'Unlocked' : `Legacy ${need}`}</small></li>)}</ul>
      <h4>Seasons</h4>
      {o.seasons.length ? <table className="db-table"><thead><tr><th>Season</th><th>Record</th><th>Finish</th><th>Profit</th><th>Goal</th></tr></thead>
        <tbody>{[...o.seasons].reverse().map(s => <tr key={s.season}><td>{formatSeasonYear(s.season)}</td><td>{s.wins}-{s.losses}</td><td>{s.finish}</td><td>{money(s.profit)}</td><td>{GOALS[s.goal].label}: {s.goalMet ? 'met' : 'missed'}</td></tr>)}</tbody></table>
        : <p className="hint-text">Your first season is under way.</p>}
    </section>
    <section className="owner-panel">
      <h3>Owners' Hall of Fame</h3>
      {records.length ? <ol className="owner-hof">{records.map(r => <li key={r.key} className={r.legacy >= OWNER_HOF ? 'in' : ''}><b>{r.teamName}</b><small>since {formatSeasonYear(r.since)} · {r.seasons} season{r.seasons === 1 ? '' : 's'} · {r.titles} title{r.titles === 1 ? '' : 's'}</small><span>{r.legacy}{r.legacy >= OWNER_HOF ? ' · INDUCTED' : ''}</span></li>)}</ol>
        : <p className="hint-text">Your ownerships appear here after their first season.</p>}
      <h4>Your decisions</h4>
      <ul className="owner-feed">{[...o.log].reverse().slice(0, 30).map((e, i) => <li key={i}><small>{formatSeasonYear(e.season)}</small>{e.text}</li>)}</ul>
    </section>
  </div>;
}
