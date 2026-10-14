/** Small, defensive record reads keep the menu independent of the simulation bundles. */
const read = <T extends object>(key: string): Partial<T> => { try { const x = JSON.parse(localStorage.getItem(key) ?? '{}'); return x && typeof x === 'object' && !Array.isArray(x) ? x : {}; } catch { return {}; } };
const count = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
export function modeRecords(): Partial<Record<string, string>> {
  const hunt = read<{ runs: number; wins: number; bestStop: number }>('cv-hunt-records');
  const perfect = read<{ runs: number; bestWins: number; perfect98: number }>('cv-perfect-records');
  const survival = read<{ runs: number; best: Record<string, { wins?: number }> }>('cv-survival-records');
  const story = read<{ name: string; done: boolean }>('cv-story');
  const bestSurvival = Math.max(0, ...Object.values(survival.best ?? {}).map(v => count((v as { wins?: number } | null)?.wins)));
  return {
    ...(count(hunt.runs) ? { legends: count(hunt.wins) ? `${count(hunt.wins)} hunts conquered` : `Best: series ${Math.min(10, count(hunt.bestStop) + 1)} / 10` } : {}),
    ...(count(perfect.runs) ? { perfect: count(perfect.perfect98) ? `98–0 achieved · ${count(perfect.perfect98)} perfect run${count(perfect.perfect98) === 1 ? '' : 's'}` : `Best season: ${Math.min(82, count(perfect.bestWins))}–${82 - Math.min(82, count(perfect.bestWins))}` } : {}),
    ...(count(survival.runs) ? { survival: `Best: ${bestSurvival} wins survived` } : {}),
    ...(story.done === true ? { story: `${typeof story.name === 'string' ? story.name : 'Your player'} · story complete` } : {}),
  };
}

export const MODE_SHORT: Record<string, string> = {
  franchise: 'Build a team. Turn seasons into a dynasty.', legends: 'Draft legends. Conquer ten all-time teams.', perfect: '82 wins. Zero losses. Then chase the title.', career: 'From draft night to the Hall of Fame.', survival: 'Every win costs a player. One loss ends it.', story: 'From the park to the league. Your choices matter.',
};
