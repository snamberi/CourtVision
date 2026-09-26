import type { EraRules, PlayerSeason } from './types';
import { ERA_PRESETS } from './types';
import { makeDefaultSeason } from './presets/samplePlayers';

/**
 * IMPORTANT DATA-PROVENANCE NOTE (spec §62, §130, §131):
 * These are GENERATED archetype teams meant to illustrate the Legends /
 * era-matchup system end-to-end. They are era-flavored (pace/style/spacing
 * tendencies typical of the period) but are NOT official historical ratings
 * and must never be presented as such. Every season built here is tagged
 * `source: 'generated'`. A real implementation would replace this module
 * with an importer over a legally-obtained historical dataset, normalized
 * into the same PlayerSeason shape, tagged `source: 'historical'`.
 */

export interface LegendTeamTemplate {
  id: string;
  label: string; // e.g. "'96-Style Bulls (Generated)"
  eraKey: keyof typeof ERA_PRESETS;
  paceStyle: 'slow' | 'balanced' | 'fast';
  threePointEmphasis: number; // 0-1, how heavily this era-style team leans on threes
}

export const LEGEND_TEAM_TEMPLATES: LegendTeamTemplate[] = [
  { id: 'legend-90s-bulls-style', label: "'90s-Style Dynasty (Generated)", eraKey: '1990s', paceStyle: 'balanced', threePointEmphasis: 0.15 },
  { id: 'legend-2010s-warriors-style', label: "2010s-Style Splash Team (Generated)", eraKey: '2010s', paceStyle: 'fast', threePointEmphasis: 0.55 },
  { id: 'legend-2000s-spurs-style', label: "2000s-Style Fundamentals Team (Generated)", eraKey: '2000s', paceStyle: 'slow', threePointEmphasis: 0.2 },
  { id: 'legend-1980s-showtime-style', label: "'80s-Style Showtime (Generated)", eraKey: '1980s', paceStyle: 'fast', threePointEmphasis: 0.05 },
];

export function buildLegendTeam(template: LegendTeamTemplate): { teamId: string; name: string; seasons: PlayerSeason[] } {
  const seasons: PlayerSeason[] = [];
  const roles: Array<{ suffix: string; ballDominance: number; threeLean: number; bhPriority: number }> = [
    { suffix: 'star', ballDominance: 85, threeLean: template.threePointEmphasis, bhPriority: 90 },
    { suffix: 'wing1', ballDominance: 30, threeLean: template.threePointEmphasis, bhPriority: 25 },
    { suffix: 'wing2', ballDominance: 20, threeLean: template.threePointEmphasis, bhPriority: 15 },
    { suffix: 'forward', ballDominance: 25, threeLean: template.threePointEmphasis * 0.5, bhPriority: 20 },
    { suffix: 'center', ballDominance: 15, threeLean: template.threePointEmphasis * 0.2, bhPriority: 5 },
  ];

  for (const r of roles) {
    const id = `${template.id}-${r.suffix}`;
    const s = makeDefaultSeason(id, template.eraKey, template.id);
    s.source = 'generated';
    s.tendencies.ballDominance = r.ballDominance;
    s.ballHandlerPriority = r.bhPriority;
    const threeBoost = Math.round(r.threeLean * 40);
    s.tendencies.shot = {
      ...s.tendencies.shot,
      corner3: s.tendencies.shot.corner3 + threeBoost,
      aboveBreak3: s.tendencies.shot.aboveBreak3 + threeBoost,
      pullUp3: s.tendencies.shot.pullUp3 + Math.round(threeBoost * 0.6),
      catchAndShoot3: s.tendencies.shot.catchAndShoot3 + threeBoost,
    };
    if (template.paceStyle === 'fast') s.attributes.physical.speed += 8;
    if (template.paceStyle === 'slow') s.attributes.physical.speed -= 5;
    seasons.push(s);
  }

  return { teamId: template.id, name: template.label, seasons };
}

export function eraRulesFor(key: keyof typeof ERA_PRESETS): EraRules {
  return ERA_PRESETS[key];
}
