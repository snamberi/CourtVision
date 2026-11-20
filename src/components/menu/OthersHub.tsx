import { useState } from 'react';
import { modeById, modesIn, type ModeEntry } from '../../menu/modeCatalog';
import { routeHash } from '../../navigation/routes';
import { formatSeasonYear } from '../../simulation/calendar';
import type { SaveSummary } from '../../storage/saves';
import { IS_DESKTOP_BUILD } from '../../appMode';
import { startInstall, downloadsWindows, useInstallState } from '../../pwa/pwa';
import { collectionProgress, type RelicState } from '../../relics/relics';
import { Modal } from '../Modal';
import { PixelIcon } from '../PixelIcon';
import { menuArt } from '../../menu/art';

interface Props {
  saves: SaveSummary[];
  wallet: RelicState;
  onOpen: (e: ModeEntry) => void;
  onProfile: () => void;
  onBoards: () => void;
  onRelics: () => void;
  onCloset: () => void;
  onLocker: () => void;
  onFriendList: () => void;
  onRoad: (road: 'season' | 'level' | 'trophy') => void;
  onAchievements: () => void;
  onSettings: () => void;
  onPhone: () => void;
}

export function OthersHub({ saves, wallet, onOpen, onProfile, onBoards, onRelics, onCloset, onLocker, onFriendList, onRoad, onAchievements, onSettings, onPhone }: Props) {
  const [panel, setPanel] = useState<'Almanac' | 'Rewards' | 'Collection' | 'Credits' | null>(null);
  const install = useInstallState(), collection = collectionProgress(wallet);
  const tiles = [
    { title: 'Profile', art: 'profile', text: 'Your GM, stats and progress.', go: onProfile },
    { title: 'Leaderboards', art: 'podium', text: 'Global and mode-specific rankings.', go: onBoards },
    { title: 'Almanac', art: 'almanac', text: 'Seasons, awards and league history.', go: () => setPanel('Almanac') },
    { title: 'Rewards', art: 'gifts', text: 'Chests, spins and gifts.', go: () => setPanel('Rewards') },
    { title: 'Settings', art: 'settings', text: 'Display, audio and account options.', go: onSettings },
    { title: 'Collection', art: 'collection', text: `${collection.owned} / ${collection.total} relics collected.`, go: () => setPanel('Collection') },
    { title: 'Achievements', art: 'achievements', text: 'Track goals and unlock rewards.', go: onAchievements },
    { title: 'Credits', art: 'credits', text: 'About CourtVision and its creator.', go: () => setPanel('Credits') },
  ];
  const destinations = panel === 'Rewards' ? [
    { title: 'Relic Vault', detail: `${wallet.spins} relic spins available`, go: onRelics },
    { title: 'Season Pass', detail: 'Tier rewards and season cosmetics', go: () => onRoad('season') },
    { title: 'Friend gifts', detail: 'Send and collect daily gifts', go: onFriendList },
    { title: 'Level Road', detail: 'Unlocks earned with XP', go: () => onRoad('level') },
    { title: 'Trophy Road', detail: 'Rewards for trophy milestones', go: () => onRoad('trophy') },
  ] : [
    { title: 'Relic Vault', detail: 'Browse your relics and loadout', go: onRelics },
    { title: 'Closet', detail: 'Equip your character and cosmetics', go: onCloset },
    { title: 'Trophy room', detail: 'Your GM trophies and records', go: onLocker },
  ];
  return <>
    <div className="arena-heading"><h1>Others hub</h1><p>Your account, collection and community</p></div>
    <div className="arena-utility-grid">{tiles.map(tile => <button className="arena-utility" key={tile.title} onClick={tile.go}>
      <img src={menuArt(tile.art)} alt="" /><span><strong>{tile.title}</strong><small>{tile.text}</small></span><b aria-hidden="true">»</b>
    </button>)}</div>
    <div className="arena-community"><h2>Play with others</h2><div>{modesIn('compete').filter(e => e.action.kind === 'screen' && e.id !== 'ranked').map(e =>
      <button key={e.id} onClick={() => onOpen(e)}><PixelIcon name={e.icon} size={17} />{e.title}</button>)}</div></div>
    <div className="arena-week-extra"><button onClick={onPhone}>Menu phone »</button><a href="#/updates">What’s new »</a>
      {!IS_DESKTOP_BUILD && install !== 'installed' && <button onClick={() => void startInstall('menu')}>{downloadsWindows(install) ? 'Download' : 'Install app'} »</button>}</div>
    {panel && <Modal label={panel} className="arena-dialog" onClose={() => setPanel(null)}>
      <div className="arena-dialog-head"><h2>{panel}</h2><button onClick={() => setPanel(null)}>Close</button></div>
      {panel === 'Almanac' ? (saves.length ? <><p>Choose a league to open its almanac.</p><div className="arena-option-list">{[...saves].sort((a, b) => b.updatedAt - a.updatedAt).map(s =>
        <a key={s.id} href={routeHash({ saveId: s.id, tab: 'almanac' })}><PixelIcon name="book" /><span><strong>{s.name}</strong><small>{[s.controlledTeamName, s.season && formatSeasonYear(s.season)].filter(Boolean).join(' · ')}</small></span><b>»</b></a>)}</div></>
        : <><p>Start a franchise to build a league almanac. Each saved league keeps its own history.</p><button className="arena-gold" onClick={() => onOpen(modeById('franchise')!)}>New franchise »</button></>)
        : panel === 'Credits' ? <><p>CourtVision is a basketball management and simulation game by NineFoldVision.</p>
          {!IS_DESKTOP_BUILD && <a href="/about.html">About CourtVision »</a>}</>
          : <div className="arena-option-list">{destinations.map(d => <button key={d.title} onClick={d.go}><span><strong>{d.title}</strong><small>{d.detail}</small></span><b>»</b></button>)}</div>}
    </Modal>}
  </>;
}
