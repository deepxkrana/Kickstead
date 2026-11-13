import { MAX_QUANTITY_PER_ITEM } from '../lib/constants';

interface QuantitySelectProps {
  id: string;
  value: number;
  /** Highest quantity offered (stock), capped at the per-item limit. */
  max: number;
  onChange: (quantity: number) => void;
  disabled?: boolean;
  label?: string;
  hideLabel?: boolean;
}

export function QuantitySelect({ id, value, max, onChange, disabled, label = 'Quantity', hideLabel }: QuantitySelectProps) {
  // Always include the current value so an over-stock quantity is still displayed truthfully.
  const limit = Math.max(1, Math.min(max, MAX_QUANTITY_PER_ITEM));
  const options = Array.from({ length: Math.max(limit, value) }, (_, i) => i + 1);
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'text-label-sm uppercase'}>
        {label}
      </label>
      <select
        id={id}
        className="input w-24 cursor-pointer"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {options.map((n) => (
          <option key={n} value={n} disabled={n > limit}>
            {n}
          </option>
        ))}
      </select>
    </div>
  );
}
