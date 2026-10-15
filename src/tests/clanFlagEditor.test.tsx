// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { FlagArt, FlagEditor } from '../components/cloud/ClanFlag';
import { DEFAULT_FLAG, FLAG_CELLS, encodeFlag, decodeFlag, type ClanFlag } from '../cloud/clanFlag';

afterEach(cleanup);
let last: ClanFlag = DEFAULT_FLAG;
function Harness() {
  const [f, setF] = useState<ClanFlag>(DEFAULT_FLAG);
  return <FlagEditor value={f} onChange={next => { last = next; setF(next); }} />;
}

describe('clan flag editor', () => {
  it('draws a flag: one path per colour used, plus the emblem', () => {
    const { container } = render(<FlagArt flag={{ ...DEFAULT_FLAG, pattern: 'h3' }} width={60} title="Flag" />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('viewBox')).toBe('0 0 15 10');
    expect(svg.querySelectorAll('path')).toHaveLength(4);
    expect(screen.getByRole('img', { name: 'Flag' })).toBeTruthy();
  });
  it('changes pattern, emblem and size, and paints pixels', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTitle('Cross'));
    expect(last.pattern).toBe('cross');
    fireEvent.click(screen.getByTitle('Crown'));
    expect(last.emblem).toBe('crown');
    fireEvent.click(screen.getByRole('button', { name: 'Large' }));
    expect(last.size).toBe(3);
    fireEvent.click(screen.getByTitle('Paint it yourself'));
    expect(last.pattern).toBe('paint');
    expect(last.paint).toHaveLength(FLAG_CELLS);
    // The paint starts from the cross: the middle row is colour 1.
    expect(last.paint[15 * 4 + 1]).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Paint with colour 3' }));
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Pixel 1, 1' }));
    expect(last.paint[0]).toBe(2);
    expect(decodeFlag(encodeFlag(last)).paint[0]).toBe(2);
    fireEvent.click(screen.getByTitle('No emblem'));
    expect(last.emblem).toBe('none');
  });
});
