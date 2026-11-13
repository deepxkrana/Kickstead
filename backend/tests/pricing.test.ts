import { describe, expect, it } from 'vitest';
import { calculateOrderTotals, lineTotalPaise } from '../src/shared/money/pricing.js';

describe('calculateOrderTotals', () => {
  it('adds 18% GST and ₹99 shipping below the free-shipping threshold', () => {
    expect(calculateOrderTotals([{ unitPricePaise: 100_000, quantity: 1 }])).toEqual({
      subtotalPaise: 100_000,
      discountPaise: 0,
      taxPaise: 18_000,
      shippingPaise: 9_900,
      totalPaise: 127_900,
    });
  });

  it('still charges shipping at exactly ₹2,999', () => {
    const totals = calculateOrderTotals([{ unitPricePaise: 299_900, quantity: 1 }]);
    expect(totals.shippingPaise).toBe(9_900);
    expect(totals.taxPaise).toBe(53_982);
    expect(totals.totalPaise).toBe(299_900 + 53_982 + 9_900);
  });

  it('gives free shipping above ₹2,999', () => {
    expect(calculateOrderTotals([{ unitPricePaise: 299_901, quantity: 1 }]).shippingPaise).toBe(0);
  });

  it('sums multiple lines', () => {
    const totals = calculateOrderTotals([
      { unitPricePaise: 150_000, quantity: 2 },
      { unitPricePaise: 50_000, quantity: 1 },
    ]);
    expect(totals.subtotalPaise).toBe(350_000);
    expect(totals.shippingPaise).toBe(0);
    expect(totals.taxPaise).toBe(63_000);
    expect(totals.totalPaise).toBe(413_000);
  });

  it('rounds tax half-up to the nearest paisa', () => {
    expect(calculateOrderTotals([{ unitPricePaise: 25, quantity: 1 }]).taxPaise).toBe(5); // 4.5 -> 5
    expect(calculateOrderTotals([{ unitPricePaise: 1, quantity: 3 }]).taxPaise).toBe(1); // 0.54 -> 1
  });

  it('returns zeros for an empty cart', () => {
    expect(calculateOrderTotals([])).toEqual({
      subtotalPaise: 0,
      discountPaise: 0,
      taxPaise: 0,
      shippingPaise: 0,
      totalPaise: 0,
    });
  });
});

describe('lineTotalPaise', () => {
  it('rejects invalid prices and quantities', () => {
    expect(() => lineTotalPaise({ unitPricePaise: -1, quantity: 1 })).toThrow(RangeError);
    expect(() => lineTotalPaise({ unitPricePaise: 10.5, quantity: 1 })).toThrow(RangeError);
    expect(() => lineTotalPaise({ unitPricePaise: 100, quantity: 0 })).toThrow(RangeError);
    expect(() => lineTotalPaise({ unitPricePaise: 100, quantity: 1.5 })).toThrow(RangeError);
  });
});
