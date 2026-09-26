import { teamColors } from './teamColors';
import type { LeagueTeam } from './league';

export const LOGO_STYLES = ['bolt', 'crown', 'mountain', 'wings', 'star', 'tower'] as const;
export interface TeamIdentity {
  abbreviation: string;
  primary: string;
  secondary: string;
  courtPaint: string;
  courtApron: string;
  logo: typeof LOGO_STYLES[number];
  jerseyStyle: 'classic' | 'stripe' | 'split';
}
const validColor = (value: unknown, fallback: string) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
export function resolveTeamIdentity(team: Pick<LeagueTeam, 'teamId' | 'name' | 'identity'>): TeamIdentity {
  const colors = teamColors(team.teamId);
  const hash = [...team.teamId].reduce((n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0, 7);
  const identity = team.identity;
  const initials = team.name.split(/\s+/).map(s => s[0]).join('').toUpperCase().slice(0, 4) || 'CV';
  return {
    abbreviation: identity?.abbreviation?.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 4) || initials,
    primary: validColor(identity?.primary, colors.primary), secondary: validColor(identity?.secondary, colors.secondary),
    courtPaint: validColor(identity?.courtPaint, colors.primary), courtApron: validColor(identity?.courtApron, colors.secondary),
    logo: LOGO_STYLES.includes(identity?.logo as typeof LOGO_STYLES[number]) ? identity!.logo : LOGO_STYLES[hash % LOGO_STYLES.length],
    jerseyStyle: identity?.jerseyStyle === 'stripe' || identity?.jerseyStyle === 'split' ? identity.jerseyStyle : 'classic',
  };
}
