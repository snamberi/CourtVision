import { useMemo, useState } from 'react';
import type { NbaHistory } from '../../history/nbaHistoryData';
import { cardPool, seasonLabel, type HuntCard } from '../../hunt/cards';
import { primeCard, primeRoster, primeYears, primeTeamsOf, rookieCard, franchiseLegends, legendFranchises, whatIfSquad, SQUAD, type WhatIf, type WhatIfKind } from '../../perfect/run';
import { SKILL_PARTS, hybridOverall, cleanHybridName, MAX_NAME, type Hybrid, type SkillPart } from '../../perfect/hybrid';
import { whatIfKey, type PerfectRecords } from '../../perfect/storage';
import { PixelIcon } from '../PixelIcon';
import { WHAT_IF_INFO, whatIfInfo } from '../../perfect/whatIfInfo';

/*
 * The 82-0 Challenge's What If and Fun modes: set up anything you like and play it. None of them count for records,
 * leaderboards or rewards, and the opponents play at the normal level.
 */

const PICK_KEY = 'cv-p820-whatif-pick';
const readPick = (): string => { try { return localStorage.getItem(PICK_KEY) ?? ''; } catch { return ''; } };
const savePick = (id: string) => { try { localStorage.setItem(PICK_KEY, id); } catch { /* storage blocked */ } };

/** Pick a season, then a team that season. */
function TeamPicker({ h, value, onChange, label = 'Team' }: { h: NbaHistory; value: string; onChange: (id: string) => void; label?: string }) {
  const years = useMemo(() => primeYears(h), [h]);
  const year = Number(value.split('@')[1]) || 1996;
  const teams = useMemo(() => primeTeamsOf(h, year), [h, year]);
  const choose = (id: string) => { savePick(id); onChange(id); };
  return <div className="p820-custom-parts p820-prime-pick">
    <label><span>Season</span><select value={year} onChange={e => { const t = primeTeamsOf(h, Number(e.target.value))[0]; if (t) choose(t.id); }}>{years.map(y => <option key={y} value={y}>{seasonLabel(y)}</option>)}</select></label>
    <label><span>{label} ({teams.length} that year)</span><select value={value} onChange={e => choose(e.target.value)}>{teams.map(t => <option key={t.id} value={t.id}>{t.name} ({t.w}-{t.l}{t.champion ? ', champions' : ''})</option>)}</select></label>
  </div>;
}

function YearPicker({ h, value, onChange, label, allowAll }: { h: NbaHistory; value: number | null; onChange: (y: number | null) => void; label: string; allowAll?: boolean }) {
  const years = useMemo(() => primeYears(h), [h]);
  return <label className="p820-whatif-year"><span>{label}</span><select value={value ?? 'all'} onChange={e => onChange(e.target.value === 'all' ? null : Number(e.target.value))}>
    {allowAll && <option value="all">All of history (the usual 82-0 schedule)</option>}
    {years.map(y => <option key={y} value={y}>{seasonLabel(y)} league</option>)}</select></label>;
}

/** Search every player in history; you get him at his best season. */
function PlayerSearch({ h, onPick, placeholder, exclude = [] }: { h: NbaHistory; onPick: (c: HuntCard) => void; placeholder: string; exclude?: string[] }) {
  const [q, setQ] = useState('');
  const players = useMemo(() => {
    const seen = new Map<string, HuntCard>();
    for (const c of cardPool(h).cards) if (!seen.has(c.playerId)) seen.set(c.playerId, primeCard(h, c.playerId) ?? c);
    return [...seen.values()].sort((a, b) => b.ovr - a.ovr);
  }, [h]);
  const term = q.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const hits = term.length < 2 ? [] : players.filter(c => !exclude.includes(c.playerId) && c.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(term)).slice(0, 8);
  return <div className="p820-search">
    <input className="year-input" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    {hits.length > 0 && <ul className="p820-search-hits">{hits.map(c => <li key={c.id}><button onClick={() => { onPick(c); setQ(''); }}><b>{c.name}</b><small>{c.pos} · best: {seasonLabel(c.end)} {c.team} · {c.ppg} ppg</small></button></li>)}</ul>}
    {term.length >= 2 && !hits.length && <small className="hint-text">No one by that name.</small>}
  </div>;
}

function SquadPreview({ h, ids, numbers, hybrid }: { h: NbaHistory; ids: string[]; numbers: boolean; hybrid?: Hybrid }) {
  const pool = cardPool(h);
  return <ol className="p820-prime-list">{ids.map(id => { const c = pool.byId.get(id); if (!c) return null; const me = hybrid && id === hybrid.base;
    return <li key={id} className={`rarity-${c.rarity}`}><b>{me ? hybrid.name : c.name}</b><small>{me ? 'Your created player' : `${c.pos} · ${seasonLabel(c.end)} ${c.team}${numbers ? ` · ${c.ovr}` : ''} · ${c.ppg} ppg`}</small></li>; })}</ol>;
}

/** The setup panel for one What If / Fun mode. */
export function WhatIfSetup({ h, kind, records, numbers, onPlay }: { h: NbaHistory; kind: WhatIfKind; records: PerfectRecords; numbers: boolean; onPlay: (w: WhatIf) => void }) {
  const info = whatIfInfo(kind);
  const saved = readPick();
  const [team, setTeam] = useState(() => (primeTeamsOf(h, Number(saved.split('@')[1]) || 0).some(t => t.id === saved) ? saved : primeTeamsOf(h, 1996)[0]?.id ?? ''));
  const [year, setYear] = useState<number | null>(kind === 'super' ? null : 2016);
  const franchises = useMemo(() => legendFranchises(h), [h]);
  const [franchise, setFranchise] = useState(() => franchises.find(f => f.name.includes('Lakers'))?.id ?? franchises[0]?.id ?? '');
  const [star, setStar] = useState<HuntCard | null>(null);
  const [picks, setPicks] = useState<HuntCard[]>([]);
  const [hy, setHy] = useState<{ name: string; base: HuntCard | null; parts: Partial<Record<SkillPart, HuntCard>> }>({ name: '', base: null, parts: {} });
  const teamYear = Number(team.split('@')[1]) || null;

  const choice: WhatIf | null = (() => {
    switch (kind) {
      case 'prime': case 'rookies': return { kind, team, year: teamYear };
      case 'travel': return { kind, team, year };
      case 'legends': return { kind, franchise, year };
      case 'star': return star ? { kind, team, year: teamYear, star: star.id } : null;
      case 'create': return hy.base && cleanHybridName(hy.name) ? { kind, team, year: teamYear, hybrid: { name: cleanHybridName(hy.name), base: hy.base.id, parts: Object.fromEntries(Object.entries(hy.parts).map(([k, c]) => [k, c!.id])) } } : null;
      case 'super': return picks.length >= 8 ? { kind, year, picks: picks.map(c => c.id) } : null;
      case 'chaos': return { kind, year: null };
    }
  })();
  const squad = choice && kind !== 'chaos' ? whatIfSquad(h, choice) : null;
  const key = choice ? whatIfKey(choice) : null;
  const best = key ? records.whatIf?.[key] : undefined;
  const hybridOvr = choice?.hybrid ? hybridOverall(h, choice.hybrid) : null;

  return <section className="p820-custom p820-prime" aria-label={`${info.name}: set it up`}>
    <p className="p820-custom-status"><b>{info.name}</b>: {info.blurb} <em className="p820-unranked">Just for fun: no records, leaderboards or rewards.</em></p>
    {['prime', 'travel', 'rookies', 'star', 'create'].includes(kind) && <TeamPicker h={h} value={team} onChange={setTeam} label={kind === 'travel' ? 'Team to send' : 'Team'} />}
    {(kind === 'travel' || kind === 'legends' || kind === 'super') && <YearPicker h={h} value={year} onChange={setYear} label={kind === 'super' ? 'Who you play' : 'The league they play in'} allowAll={kind === 'super' || kind === 'legends'} />}
    {kind === 'legends' && <label className="p820-whatif-year"><span>Franchise</span><select value={franchise} onChange={e => setFranchise(e.target.value)}>{franchises.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>}

    {kind === 'prime' && <ol className="p820-prime-list">{primeRoster(h, team).map(({ then, prime }) => <li key={then.playerId} className={`rarity-${prime.rarity}`}>
      <b>{prime.name}</b><small>{prime.pos} · this year {numbers ? `${then.ovr} · ` : ''}{then.ppg} ppg</small>
      <span className={prime.id === then.id ? 'p820-prime-same' : 'p820-prime-up'}>{prime.id === then.id ? 'Already his prime' : `Prime: ${seasonLabel(prime.end)} ${prime.team}${numbers ? ` · ${prime.ovr}` : ''} · ${prime.ppg} ppg`}</span></li>)}</ol>}
    {kind === 'rookies' && squad && <ol className="p820-prime-list">{squad.map(id => { const c = cardPool(h).byId.get(id)!; const first = rookieCard(h, c.playerId)?.id === id;
      return <li key={id} className={`rarity-${c.rarity}`}><b>{c.name}</b><small>{c.pos} · {first ? 'rookie year' : 'first full season'}: {seasonLabel(c.end)} {c.team}{numbers ? ` · ${c.ovr}` : ''}</small></li>; })}</ol>}
    {kind === 'legends' && <SquadPreview h={h} ids={franchiseLegends(h, franchise).map(c => c.id)} numbers={numbers} />}
    {kind === 'travel' && squad && <SquadPreview h={h} ids={squad} numbers={numbers} />}

    {kind === 'star' && <>
      <PlayerSearch h={h} onPick={setStar} placeholder="Search any player: Jordan, Curry, Wilt…" />
      {star && <p className="hint-text">Adding <b>{star.name}</b> at his best ({seasonLabel(star.end)} {star.team}). He starts; the team's least-used player makes room.</p>}
      {squad && <SquadPreview h={h} ids={squad} numbers={numbers} />}
    </>}

    {kind === 'create' && <div className="p820-create">
      <label className="p820-whatif-year"><span>His name</span><input className="year-input" value={hy.name} maxLength={MAX_NAME} onChange={e => setHy({ ...hy, name: e.target.value })} placeholder="The name on his jersey" /></label>
      <div className="p820-create-row"><b>Base player</b><small>His body and every skill nobody else gives.</small>
        {hy.base ? <span className="p820-chip">{hy.base.name} <button className="link-button" onClick={() => setHy({ ...hy, base: null })} aria-label="Change the base player">change</button></span>
          : <PlayerSearch h={h} onPick={c => setHy({ ...hy, base: c, name: hy.name || `${c.name.split(' ')[0]} X` })} placeholder="Search the base player" />}</div>
      {SKILL_PARTS.map(part => { const c = hy.parts[part.id]; return <div key={part.id} className="p820-create-row"><b>{part.label}</b><small>{part.blurb}</small>
        {c ? <span className="p820-chip">{c.name}'s {part.label.toLowerCase()} <button className="link-button" onClick={() => { const parts = { ...hy.parts }; delete parts[part.id]; setHy({ ...hy, parts }); }} aria-label={`Remove ${part.label}`}>remove</button></span>
          : <PlayerSearch h={h} onPick={p => setHy({ ...hy, parts: { ...hy.parts, [part.id]: p } })} placeholder={`Whose ${part.id === 'clutch' ? 'clutch & IQ' : part.label.toLowerCase()}? (or the base player's)`} />}</div>; })}
      {hybridOvr != null && <p className="p820-create-ovr">{choice!.hybrid!.name}: <b>{hybridOvr}</b> overall{numbers ? '' : ' (as the game rates him)'}</p>}
      {squad && <SquadPreview h={h} ids={squad} numbers={numbers} hybrid={choice!.hybrid} />}
    </div>}

    {kind === 'super' && <>
      <PlayerSearch h={h} onPick={c => setPicks(p => (p.length >= SQUAD || p.some(x => x.playerId === c.playerId) ? p : [...p, c]))} placeholder={`Add a player (${picks.length}/${SQUAD})`} exclude={picks.map(c => c.playerId)} />
      {picks.length > 0 && <ol className="p820-prime-list">{picks.map(c => <li key={c.id} className={`rarity-${c.rarity}`}><b>{c.name}</b><small>{c.pos} · {seasonLabel(c.end)} {c.team}{numbers ? ` · ${c.ovr}` : ''}</small>
        <button className="link-button" onClick={() => setPicks(p => p.filter(x => x.id !== c.id))}>remove</button></li>)}</ol>}
      {picks.length < 8 && <p className="hint-text">Pick at least 8 (up to {SQUAD}). Everyone comes at his best season.</p>}
    </>}

    {kind === 'chaos' && <p className="hint-text">The spin picks ten players and the season when you press play. You'll see them at the coach pick.</p>}
    {best && <p className="hint-text">Your best with this: {best.w}-{best.l}{best.champion ? ' and the title' : ''}.</p>}
    {kind !== 'chaos' && choice && !squad && <p className="hint-text">That team doesn't have enough players with a full season to play this.</p>}
    <button className="primary p820-big" disabled={!choice || (kind !== 'chaos' && !squad)} onClick={() => choice && onPlay(choice)}>
      <PixelIcon name="play" size={14} /> {kind === 'chaos' ? 'Spin the chaos' : 'Play it'}</button>
  </section>;
}

/** The What If and Fun rows on the 82-0 hub. */
export function WhatIfRows({ open, onOpen }: { open: WhatIfKind | null; onOpen: (k: WhatIfKind | null) => void }) {
  return <>{(['whatif', 'fun'] as const).map(g => <div key={g} className="p820-group">
    <h3 className="hunt-subhead">{g === 'whatif' ? 'What If' : 'Fun'} <small>{g === 'whatif' ? 'Rewrite basketball history.' : 'Do whatever you want.'} Unranked, normal difficulty.</small></h3>
    <div className="p820-modes">{WHAT_IF_INFO.filter(x => x.group === g).map(x => <button key={x.kind} className={`p820-mode p820-mode-new ${open === x.kind ? 'on' : ''}`} aria-expanded={open === x.kind} onClick={() => onOpen(open === x.kind ? null : x.kind)}>
      <span className="p820-new-tag">{g === 'whatif' ? 'WHAT IF' : 'FUN'}</span>
      <span className="hunt-mode-icon"><PixelIcon name={x.icon} size={24} /></span><b>{x.name}</b><small>{x.blurb}</small>
      <em>{open === x.kind ? 'Close' : 'Set it up'}</em></button>)}</div>
  </div>)}</>;
}
