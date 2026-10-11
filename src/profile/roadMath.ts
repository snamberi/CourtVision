/* Placing a value along a road of stops (the Level Road, the Trophy Road): see components/roads/BrawlRoad.tsx. */

/** Column width of one stop, in pixels (the track and the marker are placed by it). */
export const ROAD_COL = 172;

/** Where a value sits along the road, in pixels: each stop is the middle of its column, in between is a straight line. */
export function roadPosition(stops: number[], value: number, width = ROAD_COL): number {
  if (!stops.length) return 0;
  if (value <= stops[0]) return Math.max(0, value / Math.max(1, stops[0])) * (width / 2);
  for (let i = 0; i < stops.length - 1; i++) {
    if (value < stops[i + 1]) return i * width + width / 2 + ((value - stops[i]) / (stops[i + 1] - stops[i])) * width;
  }
  return (stops.length - 1) * width + width / 2;
}

