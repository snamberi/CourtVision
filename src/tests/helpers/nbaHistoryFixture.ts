import { parseNbaHistory, NBA_HISTORY_URL, type NbaHistory } from '../../history/nbaHistoryData';

let cached: NbaHistory | null = null;
/** Loads the built dataset from disk for tests (the app fetches it instead). */
export async function loadHistoryForTests(): Promise<NbaHistory> {
  if (cached) return cached;
  const spec = 'node:fs';
  const fs = (await import(/* @vite-ignore */ spec)) as { readFileSync(path: string): Uint8Array };
  cached = parseNbaHistory(new Uint8Array(fs.readFileSync(`public/${NBA_HISTORY_URL}`)));
  return cached;
}
