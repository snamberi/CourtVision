import { RatingSlider } from './RatingSlider';
import { humanize } from '../lib/humanize';

interface Props {
  title: string;
  values: Record<string, number>;
  max: number;
  onChange: (key: string, value: number) => void;
  excludeKeys?: string[];
  hints?: Record<string, string>;
  disabled?: boolean;
}

export function AttributeGroupEditor({ title, values, max, onChange, excludeKeys = [], hints = {}, disabled = false }: Props) {
  const keys = Object.keys(values).filter((k) => !excludeKeys.includes(k) && typeof values[k] === 'number');
  return (
    <section>
      {title && <h4>{title}</h4>}
      {keys.map((k) => (
        <RatingSlider
          key={k}
          label={humanize(k)}
          max={max}
          value={values[k]}
          onChange={(v) => onChange(k, v)}
          hint={hints[k]}
          disabled={disabled}
        />
      ))}
    </section>
  );
}
