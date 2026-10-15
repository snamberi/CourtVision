// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { GameLengthPicker } from '../components/GameLengthPicker';

afterEach(cleanup);
let last = { periods: 4, minutes: 12 };
function Harness() {
  const [g, setG] = useState({ periods: 4, minutes: 12 });
  return <GameLengthPicker id="t" periods={g.periods} minutes={g.minutes} onChange={(periods, minutes) => { last = { periods, minutes }; setG(last); }} />;
}

describe('game length picker', () => {
  it('presets, periods and any minutes, with the total spelled out', () => {
    render(<Harness />);
    expect(screen.getByText(/4 × 12-minute quarters \(48 minutes\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: /College/ }));
    expect(last).toEqual({ periods: 2, minutes: 20 });
    fireEvent.change(screen.getByLabelText('Periods'), { target: { value: '3' } });
    expect(last).toEqual({ periods: 3, minutes: 20 });
    const minutes = screen.getByLabelText('Minutes each') as HTMLInputElement;
    fireEvent.change(minutes, { target: { value: '' } });
    expect(minutes.value).toBe('');
    expect(last.minutes).toBe(20);
    fireEvent.change(minutes, { target: { value: '16' } });
    expect(last).toEqual({ periods: 3, minutes: 16 });
    expect(screen.getByText(/3 × 16-minute periods \(48 minutes\)/)).toBeTruthy();
    fireEvent.change(minutes, { target: { value: '45' } });
    expect(last.minutes).toBe(16);
    fireEvent.blur(minutes);
    expect(minutes.value).toBe('16');
  });
});
