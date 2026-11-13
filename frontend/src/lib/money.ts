const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
});

/** Formats integer paise for display only. Never use the result for calculations. */
export function formatPaise(paise: number): string {
  return inr.format(paise / 100);
}
