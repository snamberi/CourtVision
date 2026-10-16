/*
 * Every way to play, as cards: the six main modes, their sub-modes, the Quick Games and the competitive and online
 * spots. Each has a title, a one-line description, a pixel icon (no emoji anywhere), the colours of its card artwork
 * and what opening it does. The main menu, the phone's Play and Compete sheets all read this one list.
 */

export type ArcadeTabId = 'grid' | 'guess' | 'hilo' | 'bracket' | 'quiz' | 'legends' | 'street' | 'oneOnOne' | 'tour' | 'categorize' | 'guessTeam';
export type CreateChallengeId = 'free' | 'decade' | 'dynasty' | 'rebuild' | 'draft' | 'worldgames' | 'timeMachine';
export type StartModeId = 'legends' | 'perfect' | 'category' | 'career' | 'survival' | 'story';

export type ModeAction =
  | { kind: 'create'; challenge: CreateChallengeId }
  | { kind: 'start'; mode: StartModeId }
  | { kind: 'arcade'; tab: ArcadeTabId }
  | { kind: 'screen'; screen: 'clubs' | 'online' | 'community' | 'friends' };

export type ModeGroup = 'main' | 'franchise' | 'perfect' | 'quick' | 'compete';
export interface ModeEntry {
  id: string;
  group: ModeGroup;
  /** For a sub-mode: the main mode it belongs to. */
  parent?: 'franchise' | 'legends' | 'perfect' | 'career' | 'survival' | 'story';
  title: string;
  desc: string;
  icon: string;
  /** Card artwork: sky, floor and accent colours. */
  art: [string, string, string];
  action: ModeAction;
}

export const MODE_CATALOG: ModeEntry[] = [
  // Franchise and its sub-modes
  { id: 'franchise', group: 'franchise', parent: 'franchise', title: 'Franchise', desc: 'Run a real or random team for as many seasons as you like.', icon: 'court', art: ['#1d428a', '#c98a4b', '#f47b20'], action: { kind: 'create', challenge: 'free' } },
  { id: 'decade', group: 'franchise', parent: 'franchise', title: '10-Season Dynasty', desc: 'Ten seasons on the clock. Titles score the most.', icon: 'calendar', art: ['#3b2a6b', '#b07a45', '#ffd166'], action: { kind: 'create', challenge: 'decade' } },
  { id: 'dynasty', group: 'franchise', parent: 'franchise', title: 'Dynasty Mode', desc: 'Fifty seasons and more: relocations, sons of stars, a History Book.', icon: 'crown', art: ['#4a1d2e', '#a8743f', '#ffd166'], action: { kind: 'create', challenge: 'dynasty' } },
  { id: 'rebuild', group: 'franchise', parent: 'franchise', title: 'Rebuild Challenge', desc: 'A real team at its lowest. Win a title before time runs out.', icon: 'hammer', art: ['#2b3a2b', '#9c6b3c', '#55c878'], action: { kind: 'create', challenge: 'rebuild' } },
  { id: 'draft', group: 'franchise', parent: 'franchise', title: 'All-Time Draft', desc: 'Thirty teams, thirteen rounds, every player in history.', icon: 'cards', art: ['#14324a', '#b58550', '#4da3ff'], action: { kind: 'create', challenge: 'draft' } },
  { id: 'timeMachine', group: 'franchise', parent: 'franchise', title: 'Time Machine', desc: 'Send any real team to any season in NBA history.', icon: 'hourglass', art: ['#2a2350', '#8c6a9e', '#c18cff'], action: { kind: 'create', challenge: 'timeMachine' } },
  { id: 'worldgames', group: 'franchise', parent: 'franchise', title: 'World Games', desc: 'Coach a national team. Pick twelve, win medals.', icon: 'globe', art: ['#0d3b4f', '#b5894e', '#55c8c8'], action: { kind: 'create', challenge: 'worldgames' } },

  // The other main modes
  { id: 'legends', group: 'main', parent: 'legends', title: 'League Hunt', desc: 'Spin a squad from all of history and beat ten great teams.', icon: 'trophy', art: ['#3a1f0f', '#b0773f', '#ffd166'], action: { kind: 'start', mode: 'legends' } },
  { id: 'perfect', group: 'perfect', parent: 'perfect', title: '82-0 Challenge', desc: 'Spin a team and go 82-0, then 16-0 in the playoffs.', icon: 'star', art: ['#11314f', '#c28d52', '#f47b20'], action: { kind: 'start', mode: 'perfect' } },
  { id: 'category', group: 'perfect', parent: 'perfect', title: 'Category Draft', desc: 'Draft your 82-0 team from a category: MVPs, the 90s, the Lakers.', icon: 'grid', art: ['#1f2f4f', '#a77b4c', '#4da3ff'], action: { kind: 'start', mode: 'category' } },
  { id: 'career', group: 'main', parent: 'career', title: 'Career Mode', desc: 'One player, one whole career: draft night to the Hall of Fame.', icon: 'user', art: ['#13314a', '#b98a55', '#55c878'], action: { kind: 'start', mode: 'career' } },
  { id: 'survival', group: 'main', parent: 'survival', title: 'Survival', desc: 'Ten greats. Every win costs you one. One loss ends it.', icon: 'shield', art: ['#3d1212', '#8f5a35', '#e85d5d'], action: { kind: 'start', mode: 'survival' } },
  { id: 'story', group: 'main', parent: 'story', title: 'Story Mode', desc: 'From the park to fifteen seasons in the real NBA: your choices, nine endings.', icon: 'book', art: ['#22223b', '#9a7048', '#f4a259'], action: { kind: 'start', mode: 'story' } },

  // Quick Games
  { id: 'grid', group: 'quick', title: 'Daily Grid', desc: 'Three teams, three categories. Fill all nine squares.', icon: 'grid', art: ['#123a2c', '#a8814f', '#55c878'], action: { kind: 'arcade', tab: 'grid' } },
  { id: 'guess', group: 'quick', title: 'Guess the Player', desc: 'A daily mystery player for everyone, then endless.', icon: 'question', art: ['#1b2550', '#a57a4a', '#4da3ff'], action: { kind: 'arcade', tab: 'guess' } },
  { id: 'categorize', group: 'quick', title: 'Categorize', desc: 'Sixteen players, four hidden categories. Find the groups.', icon: 'grid', art: ['#2a1d47', '#9d7448', '#c18cff'], action: { kind: 'arcade', tab: 'categorize' } },
  { id: 'guessTeam', group: 'quick', title: 'Guess the Team', desc: 'A real starting five, names hidden, one clue each.', icon: 'team', art: ['#3a1f0e', '#b07c45', '#f47b20'], action: { kind: 'arcade', tab: 'guessTeam' } },
  { id: 'hilo', group: 'quick', title: 'Higher or Lower', desc: 'Career numbers head to head. How long can you go?', icon: 'up', art: ['#2c1a45', '#9b6e45', '#c18cff'], action: { kind: 'arcade', tab: 'hilo' } },
  { id: 'bracket', group: 'quick', title: 'Bracket Challenge', desc: 'Sixteen all-time teams. Pick every series.', icon: 'trophy', art: ['#3b2a0f', '#b78a4c', '#ffd166'], action: { kind: 'arcade', tab: 'bracket' } },
  { id: 'quiz', group: 'quick', title: 'NBA Quiz', desc: 'Ten questions on titles, MVPs, picks and legends.', icon: 'question', art: ['#0f3340', '#a98450', '#55c8c8'], action: { kind: 'arcade', tab: 'quiz' } },
  { id: 'legendsT', group: 'quick', title: 'Legends Tournament', desc: 'Pick one of the 64 greatest. Win six 1v1 games.', icon: 'crown', art: ['#401c10', '#ad7442', '#f47b20'], action: { kind: 'arcade', tab: 'legends' } },
  { id: 'street', group: 'quick', title: '3v3 Street', desc: 'You and two legends against tougher and tougher crews.', icon: 'team', art: ['#2e2e2e', '#7a7a7a', '#f4a259'], action: { kind: 'arcade', tab: 'street' } },
  { id: 'oneOnOne', group: 'quick', title: '1v1', desc: 'Your own player against any NBA player ever, or another GM.', icon: 'swords', art: ['#3a1212', '#a8664a', '#e85d5d'], action: { kind: 'arcade', tab: 'oneOnOne' } },
  { id: 'tour', group: 'compete', title: 'GM Tournament', desc: 'Sixteen GMs, one bracket, one week. Draft three legends.', icon: 'swords', art: ['#3a2a05', '#b8913f', '#ffd166'], action: { kind: 'arcade', tab: 'tour' } },

  // Compete and online
  { id: 'ranked', group: 'compete', title: 'Leaderboards', desc: 'Weekly boards, ranked seasons and the PvP ladder.', icon: 'podium', art: ['#1d2a44', '#a5824f', '#ffd166'], action: { kind: 'screen', screen: 'community' } },
  { id: 'clubs', group: 'compete', title: 'Clans', desc: 'Team up under your own flag. Weekend Showdowns every Friday.', icon: 'team', art: ['#16324a', '#9f7a4e', '#55c878'], action: { kind: 'screen', screen: 'clubs' } },
  { id: 'online', group: 'compete', title: 'Online Leagues', desc: 'Two to eight friends share one league.', icon: 'online', art: ['#14304a', '#a07c50', '#4da3ff'], action: { kind: 'screen', screen: 'online' } },
  { id: 'friends', group: 'compete', title: 'Challenge a Friend', desc: 'Same spins, head to head. No rating on the line.', icon: 'heart', art: ['#3d1630', '#a06d4f', '#ff7aa2'], action: { kind: 'screen', screen: 'friends' } },
];

export const modeById = (id: string) => MODE_CATALOG.find(m => m.id === id);
/** The sub-modes shown under a main menu card (more than one way to play it). */
export const subModesOf = (parent: string) => MODE_CATALOG.filter(m => m.parent === parent && m.id !== parent);
export const modesIn = (...groups: ModeGroup[]) => MODE_CATALOG.filter(m => groups.includes(m.group));
