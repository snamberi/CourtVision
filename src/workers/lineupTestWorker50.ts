import { lineupTestGame50, summarizeLineupTest50, type LineupTestRequest50, type LineupTestResult50 } from '../simulation/lineupTest50';
self.onmessage = (e: MessageEvent<LineupTestRequest50>) => {
  try {
    const request = e.data, games = Math.max(2, Math.min(30, Math.floor(request.games))), a: LineupTestResult50[] = [], b: LineupTestResult50[] = [];
    for (let i = 0; i < games; i++) { a.push(lineupTestGame50(request, 'a', i)); b.push(lineupTestGame50(request, 'b', i)); self.postMessage({ type: 'progress', progress: Math.round((i + 1) / games * 100) }); }
    self.postMessage({ type: 'done', a: summarizeLineupTest50(a), b: summarizeLineupTest50(b) });
  } catch (e) { self.postMessage({ type: 'error', error: e instanceof Error ? e.message : String(e) }); }
};
