import { useEffect, useRef, useState, type ReactNode } from 'react';
import { SANDBOX_TABS } from '../navigation/permissions';
import type { SeasonPhase } from '../simulation/league';
import { GROUPS, NAV_ICONS, type LeagueSettingsSub, type NavItem } from '../navigation/menu';
import { SIMPLE_HUBS, hubForTab, type HubId, type SimpleNavItem } from '../tutorial/simpleNav';
import type { NavMode } from '../tutorial/tutorialState';
import type { FeatureStatus } from '../tutorial/unlocks';
import logoIcon from '../assets/brand/logo-icon.png';
import { PixelIcon } from './PixelIcon';

interface Props {
  sandboxMode?: boolean;
  onMainMenu?: () => void;
  tab: string;
  onNavigate: (tab: string) => void;
  onNavigateLeagueSettings: (sub: LeagueSettingsSub) => void;
  collapsed: boolean;
  hasControlledTeam: boolean;
  seasonPhase?: SeasonPhase;
  /** Shown as a badge on the "Trade Offers" nav item. */
  pendingTradeOfferCount?: number;
  /** The league was started from the built-in NBA history (shows the NBA History archive). */
  historical?: boolean;
  /** Simple shows five places to go; Full (the default) is the complete menu. */
  navMode?: NavMode;
  onNavModeChange?: (mode: NavMode) => void;
  /** Simple mode: tools that open as the season goes, with when. */
  lockedFeatures?: FeatureStatus[];
  /** Simple mode: pages unlocked by play and not opened yet. */
  newTabs?: Set<string>;
  onUnlockAll?: () => void;
}

const DATA_TOUR_FULL: Record<string, string> = { League: 'hub-league', Team: 'hub-myTeam', 'Front Office': 'hub-frontOffice' };

function ModeSwitch({ mode, onChange }: { mode: NavMode; onChange: (mode: NavMode) => void }) {
  return (
    <div className="nav-mode-switch" role="radiogroup" aria-label="Menu size">
      {(['simple', 'full'] as const).map((m) => (
        <button key={m} type="button" role="radio" aria-checked={mode === m} className={mode === m ? 'active' : ''} onClick={() => mode !== m && onChange(m)}>
          {m === 'simple' ? 'Simple' : 'Full'}
        </button>
      ))}
    </div>
  );
}

export function Sidebar(props: Props) {
  const {
    tab, onNavigate, onNavigateLeagueSettings, sandboxMode = false, onMainMenu, collapsed, hasControlledTeam, seasonPhase,
    pendingTradeOfferCount = 0, historical = false, navMode = 'full', onNavModeChange,
  } = props;
  const [lastHub, setLastHub] = useState<HubId>('home');
  const scrollRef = useRef<HTMLDivElement>(null);
  // The menu scrolls on its own; whenever the page changes, bring its menu entry into view.
  useEffect(() => {
    const current = scrollRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!current || !scrollRef.current) return;
    const box = scrollRef.current.getBoundingClientRect();
    const item = current.getBoundingClientRect();
    if (item.top < box.top || item.bottom > box.bottom) current.scrollIntoView({ block: 'nearest' });
  }, [tab, navMode]);

  const handleClick = (item: NavItem | SimpleNavItem) => {
    if (item.leagueSettingsSub) onNavigateLeagueSettings(item.leagueSettingsSub);
    else onNavigate(item.tab);
  };
  const brand = (
    <div className="sidebar-brand">
      <img src={logoIcon} alt="" className="sidebar-logo" />
      {!collapsed && <span className="sidebar-brand-text">COURT VISION<small>FRONT OFFICE</small></span>}
    </div>
  );
  const modeSwitch = !collapsed && onNavModeChange ? <ModeSwitch mode={navMode} onChange={onNavModeChange} /> : null;
  const exit = <div className="sidebar-group sidebar-exit"><button className="sidebar-item" onClick={onMainMenu} aria-label="Main Menu" title="Main Menu"><PixelIcon name="exit" size={18} />{!collapsed && <span className="sidebar-item-label">Main Menu</span>}</button></div>;
  /** Brand and menu switch stay on top and Main Menu stays at the bottom; everything between scrolls. */
  const frame = (className: string, body: ReactNode) => (
    <nav id="game-navigation" className={`sidebar ${className} ${collapsed ? 'collapsed' : ''}`} aria-label="Game navigation">
      <div className="sidebar-head">{brand}{modeSwitch}</div>
      <div className="sidebar-scroll" ref={scrollRef}>{body}</div>
      <div className="sidebar-foot">{exit}</div>
    </nav>
  );

  if (navMode === 'simple') {
    const lockedTabs = new Set((props.lockedFeatures ?? []).flatMap((s) => s.feature.tabs));
    const fresh = props.newTabs ?? new Set<string>();
    const activeHub = hubForTab(tab);
    const openHub = activeHub ?? lastHub;
    const visible = (item: SimpleNavItem) => {
      if (item.requiresControlledTeam && !hasControlledTeam) return false;
      if (item.onlyDuringPhase && item.onlyDuringPhase !== seasonPhase) return false;
      if (item.requiresHistorical && !historical) return false;
      if (item.sandboxOnly && !sandboxMode) return false;
      return !lockedTabs.has(item.tab);
    };
    const renderHub = (hubId: HubId) => {
      const hub = SIMPLE_HUBS.find((h) => h.id === hubId)!;
      const items = hub.items.filter(visible);
      if (items.length === 0) return null;
      // The hub button opens its first page; a page named like the hub (Home) isn't listed again under it.
      const subItems = items.filter((i) => i.label !== hub.label);
      const hubIsPage = items[0].label === hub.label;
      const expanded = openHub === hub.id && subItems.length > 0;
      const hasNew = items.some((i) => fresh.has(i.tab));
      return (
        <div className={`simple-hub ${hub.id === 'settings' ? 'simple-hub-settings' : ''}`} key={hub.id} data-tour={`hub-${hub.id}`}>
          <button
            className={`sidebar-item simple-hub-button ${activeHub === hub.id ? 'active' : ''}`}
            onClick={() => { setLastHub(hub.id); handleClick(items[0]); }}
            aria-expanded={subItems.length > 0 ? expanded : undefined}
            aria-current={hubIsPage && tab === items[0].tab ? 'page' : undefined}
            aria-label={hasNew ? `${hub.label} (new tools)` : hub.label}
            title={hub.label}
          >
            <PixelIcon name={hub.icon} size={18} />
            {!collapsed && <span className="sidebar-item-label">{hub.label}</span>}
            {hasNew && <span className="sidebar-item-new-dot" aria-hidden="true" />}
          </button>
          {expanded && (
            <div className="simple-hub-items">
              {subItems.map((item) => {
                const current = tab === item.tab;
                const badge = item.tab === 'tradeOffers' ? pendingTradeOfferCount : 0;
                return (
                  <button
                    key={item.label}
                    className={`sidebar-item simple-sub-item ${current ? 'active' : ''}`}
                    onClick={() => handleClick(item)}
                    aria-label={item.label}
                    aria-current={current ? 'page' : undefined}
                    title={item.label}
                  >
                    {collapsed ? <PixelIcon name={NAV_ICONS[item.tab] ?? 'list'} size={16} /> : <span className="sidebar-item-label">{item.label}</span>}
                    {fresh.has(item.tab) && !collapsed && <span className="sidebar-item-new">NEW</span>}
                    {badge > 0 && <span className="sidebar-item-badge">{badge}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );
    };
    const locked = props.lockedFeatures ?? [];
    return frame('sidebar-simple', (
      <>
        <div className="sidebar-group simple-hubs">
          {(['home', 'myTeam', 'frontOffice', 'league', 'history'] as const).map(renderHub)}
        </div>
        {!collapsed && locked.length > 0 && (
          <section className="simple-unlocks" aria-labelledby="simple-unlocks-title" data-tour="unlocks">
            <h2 id="simple-unlocks-title" className="simple-unlocks-title">Unlocks as you play</h2>
            <ul>
              {locked.map((s) => (
                <li key={s.feature.id}>
                  <PixelIcon name="lock" size={14} />
                  <span><b>{s.feature.label}</b><span>{s.progress ?? s.when}</span></span>
                </li>
              ))}
            </ul>
            {props.onUnlockAll && <button type="button" className="simple-unlock-all" onClick={props.onUnlockAll}>I know the game: unlock everything</button>}
          </section>
        )}
        <div className="sidebar-group simple-hubs simple-hubs-bottom">{renderHub('settings')}</div>
        {!collapsed && onNavModeChange && <button type="button" className="simple-show-all" onClick={() => onNavModeChange('full')}>Show all tools</button>}
      </>
    ));
  }

  return frame('sidebar-full', (
    <>
      {GROUPS.map((group) => {
        const visibleItems = group.items.filter((item) => {
          if (item.requiresControlledTeam && !hasControlledTeam) return false;
          if (item.onlyDuringPhase && item.onlyDuringPhase !== seasonPhase) return false;
          if (item.requiresHistorical && !historical) return false;
          return true;
        });
        if (visibleItems.length === 0) return null;
        return (
          <div className="sidebar-group" key={group.title} data-tour={DATA_TOUR_FULL[group.title]}>
            {!collapsed && <div className="sidebar-group-title">{group.title}</div>}
            {visibleItems.map((item) => {
              const badge = item.tab === 'tradeOffers' ? pendingTradeOfferCount : 0;
              return (
                <button
                  key={`${group.title}-${item.label}`}
                  className={`sidebar-item ${tab === item.tab ? 'active' : ''}`}
                  disabled={!sandboxMode && SANDBOX_TABS.has(item.tab)}
                  onClick={() => handleClick(item)}
                  title={!sandboxMode && SANDBOX_TABS.has(item.tab) ? `${item.label} — enable Sandbox Mode` : item.label}
                  aria-label={item.label}
                  aria-current={tab === item.tab ? 'page' : undefined}
                  data-tour={item.tab === 'dashboard' ? 'hub-home' : undefined}
                >
                  <PixelIcon name={!sandboxMode && SANDBOX_TABS.has(item.tab) ? 'lock' : NAV_ICONS[item.tab] ?? 'list'} size={18} />
                  {!collapsed && <span className="sidebar-item-label">{item.label}</span>}
                  {badge > 0 && <span className="sidebar-item-badge">{badge}</span>}
                </button>
              );
            })}
          </div>
        );
      })}
    </>
  ));
}
