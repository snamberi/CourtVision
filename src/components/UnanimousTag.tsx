/** Gold badge for an award won with every first-place vote. */
export function UnanimousTag({ compact }: { compact?: boolean }) {
  return <span className={`unanimous-tag${compact ? ' unanimous-tag--compact' : ''}`} title="Won with every first-place vote">
    <span aria-hidden="true">★</span> Unanimous
  </span>;
}
