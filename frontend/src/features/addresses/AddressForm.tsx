import { useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { ErrorMessage } from '../../components/StateViews';
import type { Address, AddressInput } from './types';

const FIELDS: { name: keyof AddressInput; label: string; autoComplete: string; optional?: boolean; wide?: boolean }[] = [
  { name: 'fullName', label: 'Full name', autoComplete: 'name', wide: true },
  { name: 'phone', label: 'Phone', autoComplete: 'tel' },
  { name: 'postalCode', label: 'PIN code', autoComplete: 'postal-code' },
  { name: 'line1', label: 'Address line 1', autoComplete: 'address-line1', wide: true },
  { name: 'line2', label: 'Address line 2 (optional)', autoComplete: 'address-line2', optional: true, wide: true },
  { name: 'city', label: 'City', autoComplete: 'address-level2' },
  { name: 'state', label: 'State', autoComplete: 'address-level1' },
  { name: 'country', label: 'Country', autoComplete: 'country-name' },
];

interface AddressFormProps {
  initial?: Address;
  submitLabel: string;
  pending: boolean;
  error: Error | null;
  onSubmit: (input: AddressInput) => void;
  onCancel?: () => void;
}

/** Server validation messages are shown next to the matching field. */
export function AddressForm({ initial, submitLabel, pending, error, onSubmit, onCancel }: AddressFormProps) {
  const [values, setValues] = useState<AddressInput>({
    fullName: initial?.fullName ?? '',
    phone: initial?.phone ?? '',
    line1: initial?.line1 ?? '',
    line2: initial?.line2 ?? '',
    city: initial?.city ?? '',
    state: initial?.state ?? '',
    postalCode: initial?.postalCode ?? '',
    country: initial?.country ?? 'India',
    isDefault: initial?.isDefault ?? false,
  });

  const fieldErrors = new Map<string, string>();
  if (error instanceof ApiError && error.code === 'VALIDATION_ERROR') {
    for (const issue of (error.details.issues as { path: string; message: string }[] | undefined) ?? []) {
      fieldErrors.set(issue.path, issue.message);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({ ...values, line2: values.line2?.trim() ? values.line2 : undefined });
  }

  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit} noValidate>
      {FIELDS.map((field) => {
        const message = fieldErrors.get(field.name);
        return (
          <div key={field.name} className={`flex flex-col gap-1 ${field.wide ? 'sm:col-span-2' : ''}`}>
            <label htmlFor={`addr-${field.name}`} className="text-label-sm uppercase">
              {field.label}
            </label>
            <input
              id={`addr-${field.name}`}
              className={`input ${message ? 'border-error' : ''}`}
              autoComplete={field.autoComplete}
              required={!field.optional}
              aria-invalid={Boolean(message)}
              aria-describedby={message ? `addr-${field.name}-error` : undefined}
              value={String(values[field.name] ?? '')}
              onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
            />
            {message && (
              <p id={`addr-${field.name}-error`} className="text-caption text-error">
                {message}
              </p>
            )}
          </div>
        );
      })}

      {!initial?.isDefault && (
        <label className="flex items-center gap-2 text-body-sm sm:col-span-2">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={values.isDefault}
            onChange={(e) => setValues((v) => ({ ...v, isDefault: e.target.checked }))}
          />
          Make this my default address
        </label>
      )}

      {error && !fieldErrors.size && (
        <div className="sm:col-span-2">
          <ErrorMessage>{error.message}</ErrorMessage>
        </div>
      )}

      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Saving…' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
