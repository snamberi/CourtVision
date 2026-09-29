import { useEffect, useState } from 'react';
import { listCareers } from '../../career/storage';
import { careerShelf, careerResume, type CareerMeta } from '../../career/career';
import { loadRecords, loadAlbum, type HuntRecords } from '../../hunt/storage';
import { readLegacy, legacyTotals, LEGACY_EVENT, type GmLegacy } from '../../storage/gmLegacy';
import { ACHIEVEMENTS } from '../../simulation/frontOffice';
import { SCENARIOS, loadRebuildRecords } from '../../simulation/rebuildChallenge';
import { formatSeasonYear } from '../../simulation/calendar';
import { TrophyShelf } from '../TrophyShelf';
import { PixelTrophy } from '../PixelTrophy';
import { PixelIcon } from '../PixelIcon';
import { PlayerAvatar } from '../PlayerAvatar';
import { HallOfFame } from '../career/CareerMode';
import { BackupPanel } from '../BackupPanel';
import { ProfilePanel } from '../ProfilePanel';
import { cloudEnabled } from '../../cloud/account';
import { noteCareers } from '../../profile/profile';
import { modeStats, MODE_ACHIEVEMENTS, isEarned } from '../../profile/modeAchievements';
import { FEATS_EVENT } from '../../profile/feats';
import { DAILY_EVENT } from '../../profile/dailyGoals';
import { ModeAchievements } from './ModeAchievements';
import { LevelRoad } from './LevelRoad';
import { TrophyRoad } from './TrophyRoad';
import { PassesPanel } from './PassesPanel';
import { passesOnSale } from '../../billing/billing';
import '../hunt/hunt.css';
import '../career/career.css';
import './locker.css';

export type ProfileTab = 'profile' | 'road' | 'trophyroad' | 'trophies' | 'achievements' | 'passes' | 'backup';
const TABS: { id: ProfileTab; label: string }[] = ([
  { id: 'profile', label: 'Profile' }, { id: 'road', label: 'Level road' }, { id: 'trophyroad', label: 'Trophy road' }, { id: 'trophies', label: 'Trophy room' },
  { id: 'achievements', label: 'Achievements' }, { id: 'passes', label: 'Passes' }, { id: 'backup', label: 'Backup' },
// The Passes tab appears only once checkout links are configured (docs/BILLING_SETUP.md).
] satisfies { id: ProfileTab; label: string }[]).filter(t => t.id !== 'passes' || passesOnSale());

/**
 * Your player profile: your card and cosmetics, the level road, and everything you have won in this browser (what the
 * GM Locker used to be), across Career Mode, League Hunt, the Rebuild Challenge and your GM leagues.
 */
export function ProfileHub({ onExit, initialTab = 'profile' }: { onExit: () => void; initialTab?: ProfileTab }) {
  const [tab, setTab] = useState<ProfileTab>(initialTab);
  const [careers, setCareers] = useState<CareerMeta[] | null>(null);
  const [hunt] = useState<HuntRecords>(() => loadRecords());
  const [album] = useState(() => loadAlbum().size);
  const [legacy, setLegacy] = useState<GmLegacy>(() => readLegacy());
  const [rebuild] = useState(() => loadRebuildRecords());
  const [rarity, setRarity] = useState<Record<string, number>>({});
  const [modes, setModes] = useState(() => modeStats());
  useEffect(() => {
    let live = true;
    listCareers().then(c => { noteCareers(c); if (live) { setCareers(c); setModes(modeStats()); } });
    if (cloudEnabled) void import('../../cloud/boards').then(m => m.achievementRarity()).then(r => { if (live) setRarity(r); }, () => {});
    const onLegacy = () => { setLegacy(readLegacy()); setModes(modeStats()); };
    const events = [LEGACY_EVENT, FEATS_EVENT, DAILY_EVENT];
    for (const e of events) window.addEventListener(e, onLegacy);
    return () => { live = false; for (const e of events) window.removeEventListener(e, onLegacy); };
  }, []);

  const all = careers ?? [];
  const shelf = all.flatMap(careerShelf);
  const count = (k: string) => shelf.filter(e => e.key === k).length;
  const best = [...all].filter(m => m.retired).sort((a, b) => b.retired!.legacy - a.retired!.legacy)[0];
  const inducted = all.filter(m => m.retired && m.retired.hallOfFame !== 'no').length;
  const gm = legacyTotals(legacy);
  const daily = Object.values(hunt.daily ?? {});
  const earned = ACHIEVEMENTS.filter(a => legacy.achievements[a.id]);
  const rebuildStars = Object.values(rebuild).reduce((n, r) => n + r.stars, 0);
  const rebuildTitles = Object.values(rebuild).filter(r => r.titleIn != null).length;
  const modeEarned = MODE_ACHIEVEMENTS.filter(a => isEarned(a, modes)).length;
  const trophies = shelf.length + hunt.wins + gm.titles + earned.length + rebuildTitles;

  return <div className="hunt locker">
    <header className="hunt-top">
      <button className="hunt-exit" onClick={onExit}><PixelIcon name="exit" size={16} /> Main Menu</button>
      <div className="hunt-title"><span className="pixel-eyebrow">YOUR CARD, YOUR ROAD, YOUR TROPHIES</span><h1>Player Profile</h1></div>
    </header>
    <div className="profile-tabs code-mode-actions" role="tablist" aria-label="Profile sections">{TABS.map(t => <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>{t.label}</button>)}</div>

    {tab === 'profile' && <ProfilePanel />}
    {tab === 'road' && <LevelRoad />}
    {tab === 'trophyroad' && <TrophyRoad />}
    {tab === 'passes' && <PassesPanel />}
    {tab === 'backup' && <div className="locker-bay"><BackupPanel compact /></div>}
    {tab === 'achievements' && <ModeAchievements stats={modes} rarity={rarity} />}

    {tab === 'trophies' && <>
    <div className="hunt-over-stats locker-totals">
      <div><small>ON THE SHELF</small><b>{trophies}</b></div>
      <div><small>HALL OF FAMERS</small><b>{inducted}</b></div>
      <div><small>HUNTS WON</small><b>{hunt.wins}</b></div>
      <div><small>GM TITLES</small><b>{gm.titles}</b></div>
      <div><small>REBUILD STARS</small><b>{rebuildStars}/{SCENARIOS.length * 3}</b></div>
      <div><small>ACHIEVEMENTS</small><b>{earned.length + modeEarned}/{ACHIEVEMENTS.length + MODE_ACHIEVEMENTS.length}</b></div>
    </div>

    <section className="locker-bay">
      <h2><PixelIcon name="star" size={18} /> Career Mode</h2>
      {careers == null ? <p className="hint-text">Opening the locker…</p> : !all.length ? <p className="empty-state">No careers yet. Create a player in Career Mode and his trophies land here.</p> : <>
        <div className="locker-row">
          <Stat label="Careers" v={all.length} /><Stat label="MVPs" v={count('mvp')} /><Stat label="Titles" v={count('champion')} /><Stat label="Finals MVPs" v={count('fmvp')} />
          <Stat label="All-Star games" v={count('allStar')} /><Stat label="All-NBA 1st" v={count('allLeague1')} /><Stat label="DPOYs" v={count('dpoy')} />
        </div>
        <TrophyShelf entries={shelf} empty="No trophies yet." />
        {best && <div className="locker-best"><PlayerAvatar playerId={best.playerId} primaryColor="#f47b20" secondaryColor="#f4f0e6" size={48} />
          <div><span className="pixel-eyebrow">YOUR GREATEST</span><strong>{best.playerId}</strong>
            <small>Legacy {best.retired!.legacy} · {best.retired!.rank ? `#${best.retired!.rank} all time` : 'outside the Top 100'} · {careerResume(best).pts.toLocaleString()} points</small></div></div>}
        <h3 className="hunt-subhead">Hall of Fame</h3>
        <HallOfFame careers={all} />
      </>}
    </section>

    <section className="locker-bay">
      <h2><PixelIcon name="trophy" size={18} /> League Hunt</h2>
      <div className="locker-row">
        <Stat label="Hunts played" v={hunt.runs} /><Stat label="Hunts won" v={hunt.wins} gold={hunt.wins > 0} /><Stat label="Furthest series" v={hunt.runs ? `${hunt.bestStop + 1} of 10` : '—'} />
        <Stat label="Daily Legends" v={daily.length} /><Stat label="Daily wins" v={daily.filter(d => d.won).length} /><Stat label="Album cards" v={album} />
      </div>
      {hunt.wins > 0 ? <div className="locker-hunt-cups">{Array.from({ length: Math.min(hunt.wins, 20) }, (_, i) => <PixelTrophy key={i} award="champion" size={34} title="League Hunt won" />)}{hunt.wins > 20 && <span>+{hunt.wins - 20}</span>}</div>
        : <p className="hint-text">Beat the boss in League Hunt to put a cup here.</p>}
    </section>

    <section className="locker-bay">
      <h2><PixelIcon name="chart" size={18} /> Rebuild Challenge</h2>
      <ul className="locker-achievements">{SCENARIOS.map(sc => { const r = rebuild[sc.id]; return <li key={sc.id} className={r?.titleIn ? 'got' : ''}>
        <PixelTrophy award="champion" size={30} dim={!r?.titleIn} />
        <div><b>{sc.title}</b><small>{sc.team} {sc.startYear}-{String(sc.startYear + 1).slice(2)} · {r ? `${'★'.repeat(r.stars)}${'☆'.repeat(3 - r.stars)} · best ${r.best.toLocaleString()}${r.titleIn ? ` · title in year ${r.titleIn}` : ''}` : 'Not played yet'}</small></div>
      </li>; })}</ul>
    </section>

    <section className="locker-bay">
      <h2><PixelIcon name="team" size={18} /> Front office</h2>
      <div className="locker-row">
        <Stat label="Leagues" v={gm.leagues} /><Stat label="Seasons" v={gm.seasons} /><Stat label="Record" v={gm.seasons ? `${gm.wins}-${gm.losses}` : '—'} /><Stat label="Titles" v={gm.titles} gold={gm.titles > 0} />
      </div>
      <ul className="locker-achievements">{ACHIEVEMENTS.filter(a => !a.secret || legacy.achievements[a.id]).map(a => { const got = legacy.achievements[a.id]; return <li key={a.id} className={got ? 'got' : ''}>
        <PixelTrophy award={a.icon} size={30} dim={!got} />
        <div><b>{a.name}</b><small>{a.description}</small>{got && <small className="locker-when">{formatSeasonYear(got.season)} · {got.leagueName}</small>}{rarity[a.id] != null && <small className="locker-rarity">{rarity[a.id]}% of GMs have this</small>}</div>
      </li>; })}</ul>
      <p className="hint-text">Front-office achievements count in official leagues (Sandbox and God Mode leagues don't).</p>
    </section>
    </>}
  </div>;
}

function Stat({ label, v, gold }: { label: string; v: number | string; gold?: boolean }) {
  return <div className={gold ? 'gold' : ''}><small>{label.toUpperCase()}</small><b>{v}</b></div>;
}
