import { GROUPS } from '../navigation/menu';
import { PixelIcon } from './PixelIcon';

/*
 * GM mode on a phone: a tab bar along the bottom for the places you go most (Home, your team, trades, the league),
 * and More for the full menu. Hidden on wider screens, where the sidebar is always there.
 */

const groupTabs = (title: string) => new Set(GROUPS.find(g => g.title === title)?.items.map(i => i.tab) ?? []);
const TEAM = groupTabs('Team'), OFFICE = groupTabs('Front Office'), LEAGUE = groupTabs('League');

export function PhoneTabs({ tab, hasControlledTeam, onNavigate, onMore, menuOpen }: { tab: string; hasControlledTeam: boolean; onNavigate: (tab: string) => void; onMore: () => void; menuOpen: boolean }) {
  const area = tab === 'dashboard' ? 'home' : TEAM.has(tab) ? 'team' : OFFICE.has(tab) ? 'trade' : LEAGUE.has(tab) ? 'league' : null;
  const items = [
    { id: 'home', label: 'Home', icon: 'court', go: 'dashboard' },
    { id: 'team', label: 'Team', icon: 'team', go: hasControlledTeam ? 'yourTeam' : 'roster' },
    { id: 'trade', label: 'Trade', icon: 'trade', go: 'trade' },
    { id: 'league', label: 'League', icon: 'chart', go: 'standings' },
  ];
  return <nav className="phone-tabs" aria-label="Quick navigation">
    {items.map(i => <button key={i.id} className={area === i.id && !menuOpen ? 'active' : ''} aria-current={area === i.id && !menuOpen ? 'page' : undefined} onClick={() => onNavigate(i.go)}>
      <PixelIcon name={i.icon} size={18} /><span>{i.label}</span>
    </button>)}
    <button className={menuOpen ? 'active' : ''} aria-expanded={menuOpen} aria-controls="game-navigation" onClick={onMore}><PixelIcon name="menu" size={18} /><span>More</span></button>
  </nav>;
}
