/** Discord's mascot drawn on a 14x10 pixel grid, offset into a 16x16 tile. */
const CLYDE = [
  '00011000011000',
  '00111111111100',
  '01111111111110',
  '01111111111110',
  '11100111100111',
  '11100111100111',
  '11111111111111',
  '11111111111111',
  '01110000001110',
  '00100000000100',
];
export const CLYDE_PATH = CLYDE.flatMap((row, y) => [...row].flatMap((c, x) => c === '1' ? [`M${x + 1} ${y + 3}h1v1h-1z`] : [])).join('');
