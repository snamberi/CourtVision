interface Props {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  hint?: string;
  disabled?: boolean;
}

export function RatingSlider({ label, value, min = 0, max = 99, step = 1, onChange, hint, disabled = false }: Props) {
  // Ratings are stored with decimals (development moves them a little at a time); they are shown as whole numbers.
  const shown = step >= 1 ? Math.round(value) : value;
  return (
    <label className={`rating-row${disabled ? ' locked' : ''}`} title={disabled ? 'Enable Sandbox Mode to edit actual ratings' : hint}>
      <span className="rating-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={shown}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <input
        className="rating-number"
        type="number"
        min={min}
        max={max}
        step={step}
        value={shown}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
