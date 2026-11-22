import { lazy, Suspense, useEffect, useState } from 'react';
import { IS_DESKTOP_BUILD } from '../appMode';
import { useAccount } from '../cloud/account';
import { CookieSettingsLink, ConsentBanner } from '../consent/ConsentBanner';
import { burst } from '../fx/effects';
import { isMenuArtPreview, MENU_DESIGNS, readMenuDesign, saveMenuDesign } from '../menu/design';
import { MENU_SECTIONS, type MenuSection } from '../menu/sections';
import { modeById, type ModeEntry } from '../menu/modeCatalog';
import { totalXp, levelFor, takeLevelUp, unlocksBetween, PROFILE_EVENT } from '../profile/profile';
import { collectDailyCoins, grantLuckySpins, loadRelics, saveRelics, RELICS_EVENT } from '../relics/relics';
import { claimAchievementSpins, paySeasonRewards } from '../relics/rewards';
import { claimChallenge, today } from '../retention/dailyChallenge';
import { notePass } from '../retention/pass';
import { claimStreakBonus } from '../retention/season';
import { noteVisit } from '../retention/streak';
import type { TradeDifficulty } from '../simulation/gm';
import type { SaveSummary } from '../storage/saves';
import { RivalAlerts } from './cloud/RivalAlerts';
import { SaveSafetyNudge } from './cloud/SaveSafetyNudge';
import { WelcomeSignIn, needsSignInWelcome } from './cloud/WelcomeSignIn';
import { DISCORD_URL } from './DiscordLink';
import { TrophyUnlock } from './locker/TrophyUnlock';
import { MenuLearn } from './MenuLearn';
import { MenuMasthead } from './MenuMasthead';
import { MenuPhone } from './MenuPhone';
import { Modal } from './Modal';
import { PixelIcon } from './PixelIcon';
import { PrivacyLink } from './PrivacyLink';
import { ThemeWelcome, needsThemeChoice } from './ThemePicker';
import { UpdateBanner } from './UpdateBanner';
import { WhatsNew } from './WhatsNew';
import { PlayHub } from './menu/PlayHub';
import { MinigamesHub } from './menu/MinigamesHub';
import { WeeklyHub } from './menu/WeeklyHub';
import { OthersHub } from './menu/OthersHub';
import '@fontsource/bungee/latin-400.css';
import '@fontsource/barlow-semi-condensed/latin-600.css';
import './menuLearn.css';
import './relics/relics.css';
import './menu/arenaMenu.css';

const SeasonTierUp = lazy(() => import('./roads/SeasonTierUp').then(m => ({ default: m.SeasonTierUp })));

export type GameMode = 'random' | 'real' | 'legends' | 'perfect' | 'category' | 'career' | 'rebuild' | 'draft' | 'survival' | 'story' | 'timeMachine' | 'yourCareer';
export interface RealLeagueOptions { source: 'history' | 'csv'; realDevelopment: boolean; forceRosters?: boolean; userTeamToo?: boolean; allPlayers?: boolean }

interface Props {
  section: MenuSection;
  onSection: (section: MenuSection) => void;
  onStart: (mode: GameMode, difficulty: TradeDifficulty, year: string, leagueName: string, real?: RealLeagueOptions, scenarioId?: string) => void;
  busy: string | null;
  saves: SaveSummary[];
  onOpenContinue: () => void;
  onOpenMode: (entry: ModeEntry) => void;
  onCode: (code: string) => string | null;
  onCommunity: (tab?: 'boards' | 'friends') => void;
  onProfile: () => void;
  onProfileTab: (tab: 'achievements') => void;
  onLocker: () => void;
  onFriends: () => void;
  onFriendList: () => void;
  onCloset: () => void;
  onSettings: () => void;
  onRelics: () => void;
  onShop: () => void;
  onRoad: (road: 'level' | 'trophy' | 'season') => void;
}

export function MainMenu({ section, onSection, onStart, saves, onOpenContinue, busy, onLocker, onCode, onCommunity, onProfile, onFriends, onFriendList, onCloset, onSettings, onRelics, onShop, onRoad, onProfileTab, onOpenMode }: Props) {
  const [design, setDesign] = useState(readMenuDesign);
  const [pickLook, setPickLook] = useState(needsThemeChoice);
  const [visit] = useState<Visit>(() => ({ v: noteVisit(), p: notePass(totalXp()) }));
  const [seasonPay, setSeasonPay] = useState(() => {
    claimStreakBonus(visit.v.streak.current, totalXp());
    return paySeasonRewards(totalXp());
  });
  const [wallet, setWallet] = useState(loadRelics);
  const [xp, setXp] = useState(totalXp);
  const [phone, setPhone] = useState(false);
  const [askSignIn, setAskSignIn] = useState(true);
  const account = useAccount();
  const showSignIn = askSignIn && needsSignInWelcome(account.status);
  useEffect(() => {
    const refresh = () => setWallet(loadRelics());
    const refreshXp = () => setXp(totalXp());
    window.addEventListener(RELICS_EVENT, refresh);
    window.addEventListener(PROFILE_EVENT, refreshXp);
    window.addEventListener('courtvision:progress', refreshXp);
    // All four landing pages pay the existing daily rewards on arrival.
    if (claimChallenge(today())) saveRelics(grantLuckySpins(loadRelics(), 1));
    const before = loadRelics(), after = collectDailyCoins(before);
    if (after !== before) saveRelics(after);
    void claimAchievementSpins().catch(() => {});
    return () => {
      window.removeEventListener(RELICS_EVENT, refresh);
      window.removeEventListener(PROFILE_EVENT, refreshXp);
      window.removeEventListener('courtvision:progress', refreshXp);
    };
  }, []);
  useEffect(() => { if (window.scrollY) window.scrollTo(0, 0); }, [section]);
  const boards = () => onCommunity('boards');
  const achievements = () => onProfileTab('achievements');
  const openPhone = () => setPhone(true);
  const openMode = (entry: ModeEntry) => { if (!busy) onOpenMode(entry); };
  return <>
    {isMenuArtPreview() && <div className="cv-art-preview" role="group" aria-label="Preview artwork">
      <span>Preview artwork</span>
      {MENU_DESIGNS.map(d => <button key={d.id} type="button" aria-pressed={design === d.id}
        onClick={() => { setDesign(d.id); saveMenuDesign(d.id); }}>{d.name}</button>)}
    </div>}
    <div className="cv-arena" data-menu-design={design}>
    <MenuMasthead design={design} xp={xp} wallet={wallet} onProfile={onProfile} onBoards={boards} onShop={onShop} onPhone={openPhone} onFriendList={onFriendList} onFriends={onFriends} />
    {IS_DESKTOP_BUILD && <UpdateBanner />}
    <SaveSafetyNudge /><RivalAlerts />
    <div className="arena-layout">
      <aside className="arena-rail">
        <nav className="arena-nav" aria-label="Main menu">{MENU_SECTIONS.map(item =>
          <button key={item.id} className={item.id === section ? 'is-current' : undefined} aria-current={item.id === section ? 'page' : undefined}
            type="button" onClick={() => onSection(item.id)}><span><PixelIcon name={item.icon} size={22} />{item.title}</span></button>)}</nav>
        <div className="arena-shortcuts" aria-label="Shortcuts">{[
          { name: 'Leaderboards', icon: 'menuPodium', go: boards },
          { name: 'Friends', icon: 'menuFriends', go: onFriendList },
          { name: 'Settings', icon: 'menuSetup', go: onSettings },
        ].map(link => <button key={link.name} aria-label={link.name} title={link.name} onClick={link.go}><PixelIcon name={link.icon} size={22} /></button>)}</div>
      </aside>
      <main className={`arena-content arena-view-${section}`}>
        {section === 'play' && <PlayHub design={design} onOpen={openMode} onContinue={onOpenContinue} saves={saves} busy={busy} />}
        {section === 'minigames' && <MinigamesHub design={design} onOpen={openMode} />}
        {section === 'weekly' && <WeeklyHub design={design} onOpen={openMode} onRebuild={() => onStart('rebuild', 'normal', '', '', undefined, 'weekly')}
          onRewards={() => onRoad('season')} onBoards={boards} busy={busy} xp={xp} />}
        {section === 'others' && <><OthersHub design={design} saves={saves} wallet={wallet} onOpen={openMode} onProfile={onProfile} onBoards={boards} onRelics={onRelics}
          onCloset={onCloset} onLocker={onLocker} onFriendList={onFriendList} onRoad={onRoad} onAchievements={achievements} onSettings={onSettings} onPhone={openPhone} />
          <details className="arena-code"><summary>Enter a league code</summary><CodeEntry busy={busy} onCode={onCode} /></details></>}
      </main>
    </div>
    <footer className="arena-footer">
      <nav aria-label="Help and community">{!IS_DESKTOP_BUILD && <><a href="/how-to-play.html">How to play</a><a href="/guides/">Guides</a><a href="/faq.html">FAQ</a><a href="/about.html">About</a><a href="/contact.html">Contact</a><a href="/terms.html">Terms</a><a href="/changelog.html">Changelog</a></>}
        <PrivacyLink /><CookieSettingsLink /><a href={DISCORD_URL} target="_blank" rel="noopener noreferrer">Discord</a></nav>
      <small>NineFoldVision</small>
      {!IS_DESKTOP_BUILD && <details><summary>Learn CourtVision</summary><MenuLearn /></details>}
    </footer>
    {phone && <Modal label="Menu phone" onClose={() => setPhone(false)} className="arena-dialog arena-phone-dialog">
      <div className="arena-dialog-head"><h2>Menu phone</h2><button onClick={() => setPhone(false)}>Close</button></div>
      <MenuPhone onClans={() => openMode(modeById('clubs')!)} onFriendList={onFriendList} onCloset={onCloset} onBoards={boards} onFriends={onFriends} onProfile={onProfile}
        onRelics={onRelics} onShop={onShop} onRoad={onRoad} onSettings={onSettings} onWhatsNew={() => { location.hash = '#/updates'; }} onAchievements={achievements} streak={visit.v.streak} />
    </Modal>}
    {seasonPay.cosmetics.length > 0 && <Suspense fallback={null}><SeasonTierUp cosmetics={seasonPay.cosmetics} spins={seasonPay.spins} onClose={() => setSeasonPay({ spins: 0, cosmetics: [] })} onOpenPass={() => onRoad('season')} /></Suspense>}
    <LevelUpNote onProfile={onProfile} /><StreakNote visit={visit} onProfile={onProfile} /><TrophyUnlock onProfile={onProfile} /><ConsentBanner />
    {pickLook ? <ThemeWelcome onDone={() => setPickLook(false)} /> : showSignIn ? <WelcomeSignIn onDone={() => setAskSignIn(false)} /> : <WhatsNew />}
  </div></>;
}
type Visit = { v: ReturnType<typeof noteVisit>; p: ReturnType<typeof notePass> };
/** A note when today's visit reaches a streak reward or a Season Pass tier. */
function StreakNote({ visit, onProfile }: { visit: Visit; onProfile?: () => void }) {
  const [open, setOpen] = useState(true);
  const { v, p } = visit;
  const got = [...v.reached.map(r => r.title ? `the "${r.title}" title` : `${r.trophies.toLocaleString()} trophies`), ...(p.newTiers.length ? [`Season Pass tier ${p.tier}`] : [])];
  if (!open || !got.length) return null;
  return <div className="level-up level-up-corner streak-note" role="status"><b>{v.reached.length ? `${v.streak.best}-DAY STREAK` : 'SEASON PASS'}</b><span>You reached {got.join(' and ')}.</span>
    {onProfile && <button onClick={onProfile}>See your rewards</button>}<button className="link-button" onClick={() => setOpen(false)}>Close</button></div>;
}

/** Level up since the last visit to the menu: what it unlocked. */
function LevelUpNote({ onProfile }: { onProfile?: () => void }) {
  const [up] = useState(() => takeLevelUp(levelFor(totalXp()).level));
  const [open, setOpen] = useState(true);
  useEffect(() => { if (up) { const t = window.setTimeout(() => burst(document.querySelector('.level-up-corner'), { count: 40, power: 6 }), 300); return () => window.clearTimeout(t); } }, [up]);
  if (!up || !open) return null;
  const unlocks = unlocksBetween(up.from, up.to);
  return <div className="level-up level-up-corner fx-pop" role="status"><b>LEVEL UP · LV {up.to}</b><span>{unlocks.length ? `Unlocked ${unlocks.slice(0, 3).join(', ')}${unlocks.length > 3 ? ` and ${unlocks.length - 3} more` : ''}.` : 'Keep going: new unlocks are on the way.'}</span>
    {onProfile && unlocks.length > 0 && <button onClick={onProfile}>Equip in your profile</button>}<button className="link-button" onClick={() => setOpen(false)}>Close</button></div>;
}

/** "Have a league code?": a friend's league, same rosters, draft classes and schedule. */
function CodeEntry({ busy, onCode }: { busy: string | null; onCode: (code: string) => string | null }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  return <form className="code-entry" onSubmit={e => { e.preventDefault(); if (code.trim()) setError(onCode(code)); }}>
    <label htmlFor="league-code"><b>Have a league code?</b> <span>Play the exact league a friend started: same rosters, draft classes and schedule.</span></label>
    <div><input id="league-code" className="year-input" value={code} onChange={e => { setCode(e.target.value); setError(null); }} placeholder="e.g. H2016-A-4K2J9Z-LAL-7" autoComplete="off" spellCheck={false} />
      <button className="primary" type="submit" disabled={!!busy || !code.trim()}>{busy ?? 'Start'}</button></div>
    {error && <p className="backup-msg err" role="alert">{error}</p>}
  </form>;
}
