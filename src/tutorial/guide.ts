import type { HintId } from './lessons';
import type { NavMode } from './tutorialState';

export interface GuideContext {
  teamName: string | null;
  navMode: NavMode;
  /** Some tools are still locked in the Simple menu. */
  hasLocks: boolean;
}

export interface GuideStep {
  id: string;
  title: string;
  body: string;
  /** CSS selectors tried in order; the first visible match is spotlighted. None: the card shows on its own. */
  targets: string[];
  /** Page to open before the step shows. */
  tab?: string;
}

const PLAY = '.play-button-fixed';

export function tourSteps(ctx: GuideContext): GuideStep[] {
  const simple = ctx.navMode === 'simple';
  return [
    {
      id: 'welcome', title: 'Welcome, GM', tab: 'dashboard', targets: [],
      body: `${ctx.teamName ? `You run ${ctx.teamName} now.` : 'You run the front office now.'} Your job is to build a team that wins: set the rotation, make trades and draft well. I'm your assistant coach, and I'll show you around in eight quick stops.`,
    },
    {
      id: 'play', title: 'The Play button', targets: [PLAY],
      body: 'This is how time moves. Press Play to open the menu: play one game, a week or a month, jump to the trade deadline, or watch or coach your next game yourself. Between seasons the same button takes you through the playoffs, draft and free agency.',
    },
    {
      id: 'home', title: 'Home', targets: ['[data-tour="hub-home"]'],
      body: 'Home shows your record, your next game, the season road map and your first-season checklist. Come back here whenever you are not sure what to do next.',
    },
    {
      id: 'myTeam', title: simple ? 'My Team' : 'Team', targets: ['[data-tour="hub-myTeam"]'],
      body: `Your roster and rotation live here. Your coach plans minutes and adjusts the rotation as the season goes. On ${simple ? 'Rotation' : 'Your Team'} you can reorder the depth chart yourself: the top five start.`,
    },
    {
      id: 'frontOffice', title: 'Front Office', targets: ['[data-tour="hub-frontOffice"]'],
      body: `Trades, free agents and the draft.${simple && ctx.hasLocks ? ' Some of these tools unlock as the season goes, so day one stays simple. The list under the menu shows when each one opens.' : ''}`,
    },
    {
      id: 'league', title: 'League', targets: ['[data-tour="hub-league"]'],
      body: `Standings, playoffs, stats and award races for every team.${simple ? ' History keeps every season you play.' : ''}`,
    },
    {
      id: 'roadmap', title: 'The season road map', tab: 'dashboard', targets: ['[data-tour="roadmap"]'],
      body: 'Every season runs the same loop: regular season, All-Star weekend, trade deadline, playoffs, awards, draft, re-signing, free agency and preseason. The road map shows where you are and what matters right now.',
    },
    {
      id: 'checklist', title: 'Your checklist', tab: 'dashboard', targets: ['[data-tour="checklist"]', '[data-tour="checklist-toggle"]'],
      body: `Eight lessons for your first season. Each one has a Go button that opens the right page. You can replay this tour from Settings & tools${simple ? '' : ' › Global Settings'}. Good luck, boss.`,
    },
  ];
}

/** One-card pointers opened from a checklist lesson's Go button. */
export function hintStep(id: HintId): GuideStep {
  switch (id) {
    case 'play':
      return { id, title: 'Play your first game', targets: [PLAY],
        body: 'Press Play, then 1 Game to play tonight\'s games. Pick Watch Next Game instead to see your team play it out.' };
    case 'finishSeason':
      return { id, title: 'Finish the regular season', targets: [PLAY],
        body: 'Keep pressing Play. 1 Week and 1 Month move faster, and Rest of Season plays every game left in the background. Then Play offers the playoffs.' };
    case 'rotation':
      return { id, title: 'Your rotation', targets: ['[data-tour="rotation"]'],
        body: 'The top five in this list start. Drag a row onto another, or use the arrows, to change the order. Your coach plans the minutes; the Coaching page sets how many players get them.' };
    case 'development':
      return { id, title: 'Player development', targets: ['[data-tour="development"]'],
        body: 'Practice plans, reports and settings for your whole roster. Open a player to set their development plan or start a long-term project.' };
    case 'trade':
      return { id, title: 'Build a trade', targets: ['[data-tour="trade"]'],
        body: 'Tick players or picks on your side, choose a team on the right and tick what you want back. The panel below checks salaries and value. Then press Propose Trade.' };
    case 'draft':
      return { id, title: 'The draft', targets: ['[data-tour="draft"]'],
        body: 'Scout prospects here before the draft. On draft night, press To Your Next Pick to skip ahead to your turn, then choose your player.' };
  }
}
