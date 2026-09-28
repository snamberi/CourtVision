import type { TradeSideView } from './gm';

export type Mood = 'furious' | 'unhappy' | 'thinking' | 'happy' | 'thrilled';
/** The other GM's mood: what he gets over what he gives, against how much less than even he will accept. */
export function tradeMood(view: TradeSideView, tolerance: number): { mood: Mood; ratio: number } {
  if (view.give <= 0 && view.receive <= 0) return { mood: 'thinking', ratio: 1 };
  const ratio = view.give <= 0 ? 2 : view.receive / view.give;
  const floor = 1 - tolerance;
  const mood: Mood = ratio < floor - 0.2 ? 'furious' : ratio < floor ? 'unhappy' : ratio < 1.08 ? 'thinking' : ratio < 1.35 ? 'happy' : 'thrilled';
  return { mood, ratio };
}
