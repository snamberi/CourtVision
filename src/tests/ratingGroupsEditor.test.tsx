// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { RatingGroupsEditor } from '../components/RatingGroupsEditor';

afterEach(cleanup);
const PATHS = ['offense.threePoint', 'offense.corner3', 'offense.pullUp3'];
let values: Record<string, number> = {};
let locks = new Set<string>();
function Harness() {
  const [v, setV] = useState<Record<string, number>>({ 'offense.threePoint': 70, 'offense.corner3': 70, 'offense.pullUp3': 70 });
  const [locked, setLocked] = useState<ReadonlySet<string>>(new Set());
  values = v; locks = new Set(locked);
  return <RatingGroupsEditor groups={[{ id: 'threePoint', name: 'Three-Point', blurb: 'Every kind of three.', paths: PATHS }]} value={p => v[p]} min={1} max={120}
    onSet={(paths, n) => setV(x => ({ ...x, ...Object.fromEntries(paths.map(p => [p, n])) }))}
    locked={locked} onLock={(paths, on) => setLocked(prev => { const next = new Set(prev); for (const p of paths) { if (on) next.add(p); else next.delete(p); } return next; })} />;
}

describe('grouped ratings with locks', () => {
  it('the group slider skips locked ratings; a fully locked group cannot move', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /Fine-tune 3 ratings/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Lock Corner 3' }));
    expect(locks.has('offense.corner3')).toBe(true);
    fireEvent.change(screen.getByLabelText('Three-Point value'), { target: { value: '90' } });
    expect(values).toEqual({ 'offense.threePoint': 90, 'offense.corner3': 70, 'offense.pullUp3': 90 });
    // One by one: a single unlocked rating moves alone; a locked one can't be dragged.
    fireEvent.change(screen.getByLabelText('Pull Up 3'), { target: { value: '55' } });
    expect(values['offense.pullUp3']).toBe(55);
    expect((screen.getByLabelText('Corner 3') as HTMLInputElement).disabled).toBe(true);
    // Lock the whole group: every rating locked, the group's controls off; unlock it again.
    fireEvent.click(screen.getByRole('button', { name: 'Lock Three-Point' }));
    expect(locks.size).toBe(3);
    expect((screen.getByLabelText('Three-Point') as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Unlock Three-Point' }));
    expect(locks.size).toBe(0);
  });
});
