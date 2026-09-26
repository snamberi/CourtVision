import type { Occasion } from '../simulation/bigGames';

/** Broadcast-style stakes card for a playoff or Cup game; Game 7 and finals get the full treatment. */
export function OccasionBanner({ occasion }: { occasion: Occasion }) {
  return <div className={`occasion-banner stakes-${occasion.stakes}`} role="note">
    <span className="pixel-eyebrow">{occasion.eyebrow}</span>
    <b>{occasion.title}</b>
    <span>{occasion.subtitle}</span>
  </div>;
}
