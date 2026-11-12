import type { HolidayId } from '../../retention/holiday';
/** The event's own art: a pixel pumpkin or snowman, drawn in SVG rects. */
export function HolidayArt({ id, size = 64 }: { id: HolidayId; size?: number }) {
  if (id !== 'halloween' && id !== 'christmas') return <span style={{ fontSize: size * .7 }} aria-hidden="true">{({ newyear: '🎆', valentine: '❤️', allstar: '🏀', easter: '🐣', playoffs: '🏆', summer: '☀️', anniversary: '🎂' })[id]}</span>;
  const px: [number, number, number, number, string][] = id === 'halloween'
    ? [[3, 4, 10, 9, '#ff7a1a'], [2, 6, 1, 5, '#ff7a1a'], [13, 6, 1, 5, '#ff7a1a'], [6, 4, 1, 9, '#d9580b'], [9, 4, 1, 9, '#d9580b'], [7, 1, 2, 3, '#3f7a24'],
      [4, 7, 2, 2, '#ffd166'], [10, 7, 2, 2, '#ffd166'], [5, 10, 6, 1, '#ffd166'], [4, 9, 1, 1, '#ffd166'], [11, 9, 1, 1, '#ffd166']]
    : [[5, 1, 6, 1, '#e8323c'], [6, 0, 4, 1, '#e8323c'], [5, 2, 6, 4, '#f4fbff'], [3, 7, 10, 7, '#f4fbff'], [6, 3, 1, 1, '#0b1018'], [9, 3, 1, 1, '#0b1018'],
      [7, 4, 2, 1, '#ff7a1a'], [4, 6, 8, 1, '#e8323c'], [10, 6, 2, 3, '#1f8a3a'], [7, 9, 1, 1, '#0b1018'], [7, 11, 1, 1, '#0b1018'], [1, 8, 2, 1, '#8a5a2b'], [13, 8, 2, 1, '#8a5a2b']];
  return <svg width={size} height={size} viewBox="0 0 16 15" shapeRendering="crispEdges" aria-hidden="true">{px.map(([x, y, w, h, c], i) => <rect key={i} x={x} y={y} width={w} height={h} fill={c} />)}</svg>;
}
