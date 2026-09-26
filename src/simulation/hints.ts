export const OFFENSE_HINTS: Record<string, string> = {
  ballSecurity: 'How difficult it is to lose possession while dribbling or under pressure.',
  ballHandling: 'How technically skilled the player is at controlling/dribbling the ball.',
  passingIQ: 'How good the player\'s passing decisions are, independent of raw accuracy.',
  decisionMaking: 'Whether the player makes smart offensive choices in general.',
  shotIQ: 'Shot selection quality — taking good shots, avoiding bad ones.',
};

export const DEFENSE_HINTS: Record<string, string> = {
  stealIQ: 'How effectively a defender recognizes opportunities to attempt steals.',
  onBallSteal: 'Strip/steal chance when directly guarding the ball handler.',
  passingLaneSteal: 'Chance of jumping a passing lane for a steal.',
  blockIQ: 'How well a defender reads shot attempts to contest/block them.',
  blockTiming: 'Timing precision on block attempts (fewer over-the-back fouls).',
  rimProtection: 'General interior deterrence — makes nearby shots harder even without a block.',
};

export const ROLE_HINTS: Record<string, string> = {
  ballDominance: 'How much of the offense flows through this player — independent of Usage or shot volume.',
};
