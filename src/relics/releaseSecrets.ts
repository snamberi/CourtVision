import type { HolidayId } from '../retention/holiday';

export const RELEASE_SECRETS = [
  { id: 'overtimeToken', name: 'Overtime Token', mode: 'Career Mode', ability: 'Start each personal Career wheel with one extra respin.', hint: 'A rare regular Secret spin drop.' },
  { id: 'scoutsLens', name: 'Scout’s Lens', mode: 'Franchise', ability: 'One extra prospect workout per draft.', hint: 'A rare regular Secret spin drop.' },
  { id: 'draftWhisperer', name: 'The Draft Whisperer', mode: 'Franchise', ability: '+1 detailed prospect scouting report per draft.', hint: 'Draft three future Hall of Famers with one franchise.', feat: 'Draft 3 players who later enter the Hall of Fame with the same franchise.', earnedOnly: true },
  { id: 'loyaltyPays', name: 'Loyalty Pays', mode: 'Franchise', ability: '+1 contract negotiation retry per offseason.', hint: 'Bring five titles home to the same franchise.', feat: 'Win 5 titles with the same franchise.', earnedOnly: true },
  { id: 'rebuilder', name: 'The Rebuilder', mode: 'Franchise', ability: '+1 trade proposal refresh per season.', hint: 'Turn a 20-win season into a championship.', feat: 'Take a franchise from 20 or fewer wins to a later championship.', earnedOnly: true },
  { id: 'forbiddenPlaybook', name: 'Forbidden Playbook', mode: 'League Hunt', ability: 'Reroll one offered player free, once per run.', event: 'halloween', hint: 'Found only in Halloween spins.' },
  { id: 'trickOrTreat', name: 'Trick or Treat', mode: '82-0 Challenge', ability: 'One extra coach-only reroll per run.', event: 'halloween', hint: 'Found only in Halloween spins.' },
  { id: 'secondLife', name: 'Second Life', mode: 'Survival', ability: 'Survive one loss per run and return with one Shield.', event: 'halloween', hint: 'Found only in Halloween spins.' },
  { id: 'cursedDice', name: 'Cursed Dice', mode: 'Career Mode', ability: 'Reroll your lowest completed starting category free once.', event: 'halloween', hint: 'Found only in Halloween spins.' },
  { id: 'winterScout', name: 'Winter Scout', mode: 'Franchise', ability: 'One extra prospect workout per draft.', event: 'christmas', hint: 'Found only in Christmas spins.' },
  { id: 'snowGlobe', name: 'Snow Globe', mode: 'Story Mode', ability: 'Begin with +3 grit.', event: 'christmas', hint: 'Found only in Christmas spins.' },
  { id: 'stockingStuffer', name: 'Stocking Stuffer', mode: 'League Hunt', ability: 'Start with 20 extra run coins.', event: 'christmas', hint: 'Found only in Christmas spins.' },
  { id: 'winterGuard', name: 'Winter Guard', mode: 'Survival', ability: 'Start with one extra Shield.', event: 'christmas', hint: 'Found only in Christmas spins.' },
  { id: 'midnightReset', name: 'Midnight Reset', mode: 'Career Mode', ability: 'Start with one extra wheel respin.', event: 'newyear', hint: 'Found only in New Year spins.' },
  { id: 'heartOfTeam', name: 'Heart of the Team', mode: 'Story Mode', ability: 'Begin with +2 grit.', event: 'valentine', hint: 'Found only in Valentine spins.' },
  { id: 'allStarClipboard', name: 'All-Star Clipboard', mode: '82-0 Challenge', ability: 'One extra coach-only reroll per run.', event: 'allstar', hint: 'Found only in All-Star spins.' },
  { id: 'goldenEgg', name: 'Golden Egg', mode: 'League Hunt', ability: 'Start with 15 extra run coins.', event: 'easter', hint: 'Found only in Easter spins.' },
  { id: 'playoffArmor', name: 'Playoff Armor', mode: 'Survival', ability: 'Start with one extra Shield.', event: 'playoffs', hint: 'Found only in Playoff Fever spins.' },
  { id: 'summerFilm', name: 'Summer Film', mode: 'Franchise', ability: 'One extra prospect workout per draft.', event: 'summer', hint: 'Found only in Summer Heat spins.' },
  { id: 'foundersWhistle', name: 'Founder’s Whistle', mode: 'Career Mode', ability: 'Start with one extra wheel respin.', event: 'anniversary', hint: 'Found only in Anniversary spins, September 27–30.' },
] as const;
export type ReleaseSecretId = typeof RELEASE_SECRETS[number]['id'];
export const eventSecretIds = (event: HolidayId) => RELEASE_SECRETS.filter(r => 'event' in r && r.event === event).map(r => r.id);
