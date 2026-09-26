/* Team names in historical leagues: city names by default (no official team names are shipped); players may type their own. */

export const MAX_TEAM_NAME = 40;

/** City/region part of a team name ("Golden State Warriors" → "Golden State"); the Clippers are "LA". Same rules as the data builder. */
export function cityName(name: string, teamId?: string | null): string {
  if (teamId === 'LAC') return 'LA';
  if (name === 'Spirits of St. Louis') return 'St. Louis';
  if (name === 'The Floridians') return 'Florida';
  for (const nick of ['Trail Blazers', 'Red Skins']) if (name.endsWith(' ' + nick)) return name.slice(0, -nick.length - 1);
  return name.includes(' ') ? name.slice(0, name.lastIndexOf(' ')) : name;
}

/** Parses "GSW = Golden State Warriors" / "GSW: …" lines into { teamId: name }; returns unknown or invalid lines separately. */
export function parseTeamNameLines(text: string, teamIds: string[]): { names: Record<string, string>; rejected: string[] } {
  const ids = new Map(teamIds.map(id => [id.toUpperCase(), id]));
  const names: Record<string, string> = {}, rejected: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z0-9]{2,4})\s*[=:,\t]\s*(.+)$/);
    const id = m ? ids.get(m[1].toUpperCase()) : undefined;
    const name = m?.[2].trim().slice(0, MAX_TEAM_NAME);
    if (id && name) names[id] = name; else rejected.push(line);
  }
  return { names, rejected };
}

