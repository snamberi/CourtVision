import { LOGO_MARKS, teamTheme } from './teamColors';
import type { LeagueTeam } from './league';

export const LOGO_STYLES = LOGO_MARKS;
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
  // A stored logo from before the bigger set keeps working; teams without one get the theme of their name.
  const colors = teamTheme(team.teamId, team.name);
  const identity = team.identity;
  const initials = team.name.split(/\s+/).map(s => s[0]).join('').toUpperCase().slice(0, 4) || 'CV';
  return {
    abbreviation: identity?.abbreviation?.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 4) || (/^[A-Z]{3}$/.test(team.teamId) ? team.teamId : initials),
    primary: validColor(identity?.primary, colors.primary), secondary: validColor(identity?.secondary, colors.secondary),
    courtPaint: validColor(identity?.courtPaint, colors.primary), courtApron: validColor(identity?.courtApron, colors.secondary),
    logo: LOGO_STYLES.includes(identity?.logo as typeof LOGO_STYLES[number]) ? identity!.logo : colors.logo,
    jerseyStyle: identity?.jerseyStyle === 'stripe' || identity?.jerseyStyle === 'split' ? identity.jerseyStyle : 'classic',
  };
}
