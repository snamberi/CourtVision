import type { Badge } from './types';

// Data-driven: badges are NOT hard-coded into simulation branches wherever avoidable.
// The engine reads `effect.attributeModifiers` and `effect.flags` generically.

export const NORMAL_BADGES: Badge[] = [
  {"id": "deep_range", "name": "Deep Range", "category": "shooting", "description": "+6 three point; +5 above-the-break threes.", "effect": {"attributeModifiers": {"offense.threePoint": 6, "offense.aboveBreak3": 5}}, "stackable": false},
  {"id": "deadeye", "name": "Deadeye", "category": "shooting", "description": "+7 shot IQ; +3 offensive consistency.", "effect": {"attributeModifiers": {"offense.shotIQ": 7, "offense.offensiveConsistency": 3}}, "stackable": false},
  {"id": "quick_release", "name": "Quick Release", "category": "shooting", "description": "+5 catch and shoot; +5 offensive IQ.", "effect": {"attributeModifiers": {"offense.catchAndShoot": 5, "offense.offensiveIQ": 5}}, "stackable": false},
  {"id": "catch_and_shoot", "name": "Catch & Shoot", "category": "shooting", "description": "+8 catch and shoot; +4 corner threes.", "effect": {"attributeModifiers": {"offense.catchAndShoot": 8, "offense.corner3": 4}}, "stackable": false},
  {"id": "difficult_shots", "name": "Difficult Shots", "category": "shooting", "description": "+6 midrange; +5 post fade; +3 shot IQ.", "effect": {"attributeModifiers": {"offense.midrange": 6, "offense.postFade": 5, "offense.shotIQ": 3}}, "stackable": false},
  {"id": "pullup_specialist", "name": "Pull-Up Specialist", "category": "shooting", "description": "+8 pull-up threes; +4 long midrange.", "effect": {"attributeModifiers": {"offense.pullUp3": 8, "offense.longMidrange": 4}}, "stackable": false},
  {"id": "handles", "name": "Handles", "category": "ballhandling", "description": "+7 ball handling; +3 speed with ball.", "effect": {"attributeModifiers": {"offense.ballHandling": 7, "offense.speedWithBall": 3}}, "stackable": false},
  {"id": "unpluckable", "name": "Unpluckable", "category": "ballhandling", "description": "+8 ball security.", "effect": {"attributeModifiers": {"offense.ballSecurity": 8}}, "stackable": false},
  {"id": "tight_handle", "name": "Tight Handle", "category": "ballhandling", "description": "+4 ball handling; +5 decision making.", "effect": {"attributeModifiers": {"offense.ballHandling": 4, "offense.decisionMaking": 5}}, "stackable": false},
  {"id": "speed_booster", "name": "Speed Booster", "category": "ballhandling", "description": "+7 speed with ball; +3 acceleration.", "effect": {"attributeModifiers": {"offense.speedWithBall": 7, "physical.acceleration": 3}}, "stackable": false},
  {"id": "rim_protector", "name": "Rim Protector", "category": "defense", "description": "+6 rim protection; +5 block.", "effect": {"attributeModifiers": {"defense.rimProtection": 6, "defense.block": 5}}, "stackable": false},
  {"id": "lockdown", "name": "Lockdown", "category": "defense", "description": "+7 perimeter defense; +4 contest.", "effect": {"attributeModifiers": {"defense.perimeterDefense": 7, "defense.contest": 4}}, "stackable": false},
  {"id": "interceptor", "name": "Interceptor", "category": "defense", "description": "+7 passing lane steal; +4 steal IQ.", "effect": {"attributeModifiers": {"defense.passingLaneSteal": 7, "defense.stealIQ": 4}}, "stackable": false},
  {"id": "pick_pocket", "name": "Pick Pocket", "category": "defense", "description": "+7 on ball steal; +4 steal.", "effect": {"attributeModifiers": {"defense.onBallSteal": 7, "defense.steal": 4}}, "stackable": false},
  {"id": "chase_down", "name": "Chase Down", "category": "defense", "description": "+6 block timing; +3 speed; +3 vertical.", "effect": {"attributeModifiers": {"defense.blockTiming": 6, "physical.speed": 3, "physical.vertical": 3}}, "stackable": false},
  {"id": "contact_finisher", "name": "Contact Finisher", "category": "finishing", "description": "+6 finishing; +4 strength.", "effect": {"attributeModifiers": {"offense.finishing": 6, "physical.strength": 4}}, "stackable": false},
  {"id": "acrobat", "name": "Acrobat", "category": "finishing", "description": "+7 driving layup; +4 touch.", "effect": {"attributeModifiers": {"offense.drivingLayup": 7, "offense.touch": 4}}, "stackable": false},
  {"id": "posterizer", "name": "Posterizer", "category": "finishing", "description": "+7 driving dunk; +4 vertical.", "effect": {"attributeModifiers": {"offense.drivingDunk": 7, "physical.vertical": 4}}, "stackable": false},
  {"id": "dimer", "name": "Dimer", "category": "passing", "description": "+6 passing IQ; +4 passing.", "effect": {"attributeModifiers": {"offense.passingIQ": 6, "offense.passing": 4}}, "stackable": false},
  {"id": "needle_threader", "name": "Needle Threader", "category": "passing", "description": "+7 passing accuracy; +3 passing.", "effect": {"attributeModifiers": {"offense.passingAccuracy": 7, "offense.passing": 3}}, "stackable": false},
  {"id": "bail_out", "name": "Bail Out", "category": "passing", "description": "+6 decision making; +4 passing accuracy.", "effect": {"attributeModifiers": {"offense.decisionMaking": 6, "offense.passingAccuracy": 4}}, "stackable": false},
  {"id": "glass_cleaner", "name": "Glass Cleaner", "category": "defense", "description": "+7 defensive rebounding; +5 offensive rebounding.", "effect": {"attributeModifiers": {"defense.defensiveRebounding": 7, "offense.offensiveRebounding": 5}}, "stackable": false},
  {"id": "post_craft", "name": "Post Craft", "category": "finishing", "description": "+6 post control; +5 post hook; +4 post fade.", "effect": {"attributeModifiers": {"offense.postControl": 6, "offense.postHook": 5, "offense.postFade": 4}}, "stackable": false},
  {"id": "corner_specialist", "name": "Corner Specialist", "category": "shooting", "description": "+8 corner threes; +3 catch and shoot.", "effect": {"attributeModifiers": {"offense.corner3": 8, "offense.catchAndShoot": 3}}, "stackable": false},
  {"id": "iron_man", "name": "Iron Man", "category": "defense", "description": "+6 stamina; +5 durability.", "effect": {"attributeModifiers": {"physical.stamina": 6, "physical.durability": 5}}, "stackable": false},
  {"id": "switchable", "name": "Switchable", "category": "defense", "description": "+6 pick and roll defense; +4 perimeter defense; +4 interior defense.", "effect": {"attributeModifiers": {"defense.pickAndRollDefense": 6, "defense.perimeterDefense": 4, "defense.interiorDefense": 4}}, "stackable": false},
  {"id": "floor_general", "name": "Floor General", "category": "passing", "description": "+5 passing IQ; +5 decision making; +3 ball security.", "effect": {"attributeModifiers": {"offense.passingIQ": 5, "offense.decisionMaking": 5, "offense.ballSecurity": 3}}, "stackable": false},
];

// Experimental abilities remain deliberately powerful and are active only in sandbox mode.
export const EXPERIMENTAL_BADGES: Badge[] = [
  { id: 'perfect_shooter', name: 'Perfect Shooter', category: 'experimental', description: 'Eligible shots always go in.', effect: { flags: { perfectShooter: true } } },
  { id: 'perfect_blocker', name: 'Perfect Blocker', category: 'experimental', description: 'Eligible block attempts always succeed.', effect: { flags: { perfectBlocker: true } } },
  { id: 'perfect_steal', name: 'Perfect Steal', category: 'experimental', description: 'Eligible steal attempts always succeed.', effect: { flags: { perfectStealer: true } } },
  { id: 'never_turnover', name: 'Never Turnover', category: 'experimental', description: 'Player cannot lose the ball.', effect: { flags: { neverTurnover: true } } },
  { id: 'infinite_stamina', name: 'Infinite Stamina', category: 'experimental', description: 'Fatigue never increases.', effect: { flags: { infiniteStamina: true } } },
  { id: 'unlimited_range', name: 'Unlimited Range', category: 'experimental', description: 'Distance does not negatively affect shooting.', effect: { flags: { unlimitedRange: true } } },
  { id: 'god_speed', name: 'God Speed', category: 'experimental', description: 'Extreme speed multiplier.', effect: { flags: { speedMultiplier: 5.0 } } },
  { id: 'clutch_god', name: 'Clutch God', category: 'experimental', description: 'Massive clutch boost.', effect: { attributeModifiers: { 'mental.clutch': 100 } } },
  { id: 'playoff_god', name: 'Playoff God', category: 'experimental', description: 'Massive playoff boost.', effect: { attributeModifiers: { 'mental.playoffPerformance': 100 } } },
  { id: 'no_injury', name: 'No Injury', category: 'experimental', description: 'Player cannot become injured.', effect: { flags: { noInjury: true } } },
  { id: 'no_foul', name: 'No Foul', category: 'experimental', description: 'Player cannot commit fouls.', effect: { flags: { noFoul: true } } },
  { id: 'automatic_assist', name: 'Automatic Assist', category: 'experimental', description: 'Eligible passes automatically create high-quality assists.', effect: { flags: { automaticAssist: true } } },
  { id: 'rebound_god', name: 'Rebound God', category: 'experimental', description: 'Extreme rebounding success.', effect: { flags: { reboundMultiplier: 8.0 } } },
  { id: 'gravity', name: 'Gravity', category: 'experimental', description: 'Defenders are strongly attracted to the player.', effect: { flags: { gravityMultiplier: 6.0 } } },
  { id: 'unblockable_shot', name: 'Unblockable Shot', category: 'experimental', description: 'Shot cannot be blocked.', effect: { flags: { unblockableShot: true } } },
  { id: 'unstealable_ball', name: 'Unstealable Ball', category: 'experimental', description: 'Ball cannot be stolen.', effect: { flags: { unstealableBall: true } } },
  { id: 'infinite_vertical', name: 'Infinite Vertical', category: 'experimental', description: 'Extreme jumping ability.', effect: { flags: { verticalMultiplier: 8.0 } } },
];

export const ALL_BUILTIN_BADGES: Badge[] = [...NORMAL_BADGES, ...EXPERIMENTAL_BADGES];

export function getBadgeById(id: string, customBadges: Badge[] = []): Badge | undefined {
  return ALL_BUILTIN_BADGES.find((b) => b.id === id) ?? customBadges.find((b) => b.id === id);
}

/** Seeded, unique normal badges favor a player's existing strengths. Older players keep their saved badges. */
export function generateNormalBadges(season: import('./types').PlayerSeason, rng: { next: () => number }): string[] {
  const count = Math.floor(rng.next() * 4);
  const available = [...NORMAL_BADGES];
  const selected: string[] = [];
  for (let i = 0; i < count; i++) {
    const weights = available.map(b => {
      const paths = Object.keys(b.effect.attributeModifiers ?? {});
      const average = paths.reduce((n, path) => {
        const [group, key] = path.split('.');
        return n + Number((season.attributes[group as keyof typeof season.attributes] as unknown as Record<string, number>)[key] ?? 50);
      }, 0) / Math.max(1, paths.length);
      return Math.max(1, average - 35) ** 2;
    });
    let roll = rng.next() * weights.reduce((a, b) => a + b, 0);
    let index = 0;
    while (index < weights.length - 1 && (roll -= weights[index]) > 0) index++;
    selected.push(available.splice(index, 1)[0].id);
  }
  return selected;
}
