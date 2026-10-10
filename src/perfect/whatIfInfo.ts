import type { NbaHistory } from '../history/nbaHistoryData';
import { cardPool, seasonLabel } from '../hunt/cards';
import { legendFranchises, type WhatIf, type WhatIfKind } from './run';

/* The 82-0 What If and Fun modes: names, blurbs and run titles. */

export const WHAT_IF_INFO: { kind: WhatIfKind; group: 'whatif' | 'fun'; name: string; icon: string; blurb: string }[] = [
  { kind: 'prime', group: 'whatif', name: 'All in Their Prime', icon: 'star', blurb: 'Any real team from any year, every player at the best season of his career, against that same year\'s league.' },
  { kind: 'travel', group: 'whatif', name: 'Time Travel', icon: 'clock', blurb: 'Send a real team to another season. The 1996 Bulls in the 2016 league? The 2017 Warriors in 1965?' },
  { kind: 'legends', group: 'whatif', name: 'Franchise Legends', icon: 'crown', blurb: 'A franchise\'s ten best players ever on one team, each at his best season there. Pick the year they play.' },
  { kind: 'rookies', group: 'whatif', name: 'Rookie Year', icon: 'shoe', blurb: 'A real team where everyone is back in his first season. Can the rookie Bulls survive the real 1996?' },
  { kind: 'star', group: 'whatif', name: 'Add a Star', icon: 'jersey', blurb: 'What if he signed there? Put any player (at his prime) on any real team and replay that season.' },
  { kind: 'create', group: 'fun', name: 'Create-a-Player', icon: 'settings', blurb: 'Build one player from the best: Curry\'s shooting, LeBron\'s finishing, Magic\'s passing, Rodman\'s boards. Name him and drop him on any team.' },
  { kind: 'super', group: 'fun', name: 'Superteam', icon: 'team', blurb: 'No spins, no rules: pick any ten players you want, at their prime, and play any season or all of history.' },
  { kind: 'chaos', group: 'fun', name: 'Chaos Spin', icon: 'shuffle', blurb: 'Ten random players from all of history thrown together, in a random season. Anything can happen.' },
];
export const whatIfInfo = (k: WhatIfKind) => WHAT_IF_INFO.find(x => x.kind === k)!;

/** A one-line name for a What If run ("Time Travel: 1995-96 Chicago in 2015-16"). */
export function whatIfTitle(h: NbaHistory, w: WhatIf, teamName: (id: string) => string): string {
  const yr = w.year != null ? seasonLabel(w.year) : 'all of history';
  const team = w.team ? teamName(w.team) : '';
  switch (w.kind) {
    case 'prime': return `All in Their Prime: the ${team}, everyone at his best`;
    case 'travel': return `Time Travel: the ${team} in the ${yr} league`;
    case 'legends': return `Franchise Legends: the all-time ${legendFranchises(h).find(f => f.id === w.franchise)?.name ?? w.franchise} in ${yr}`;
    case 'rookies': return `Rookie Year: the ${team}, everyone a rookie`;
    case 'star': return `Add a Star: ${cardPool(h).byId.get(w.star ?? '')?.name ?? 'a star'} joins the ${team}`;
    case 'create': return `Create-a-Player: ${w.hybrid?.name ?? 'your player'} joins the ${team}`;
    case 'super': return `Superteam in ${yr}`;
    case 'chaos': return `Chaos Spin in ${yr}`;
  }
}
