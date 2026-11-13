import { PRICING } from '../../config/pricing.js';

export interface PricingLine {
  unitPricePaise: number;
  quantity: number;
}

export interface OrderTotals {
  subtotalPaise: number;
  discountPaise: number;
  taxPaise: number;
  shippingPaise: number;
  totalPaise: number;
}

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer, received ${value}`);
  }
}

export function lineTotalPaise({ unitPricePaise, quantity }: PricingLine): number {
  assertNonNegativeInteger(unitPricePaise, 'unitPricePaise');
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new RangeError(`quantity must be a positive integer, received ${quantity}`);
  }
  const total = unitPricePaise * quantity;
  assertNonNegativeInteger(total, 'line total');
  return total;
}

/**
 * Calculates order totals from database prices. Never pass client-supplied prices here.
 * Tax is rounded half-up to the nearest paisa.
 */
export function calculateOrderTotals(lines: readonly PricingLine[]): OrderTotals {
  const subtotalPaise = lines.reduce((sum, line) => sum + lineTotalPaise(line), 0);
  const discountPaise = Math.min(PRICING.discountPaise, subtotalPaise);
  const taxablePaise = subtotalPaise - discountPaise;
  const taxPaise = Math.round((taxablePaise * PRICING.gstRateBps) / 10_000);
  const shippingPaise =
    subtotalPaise === 0 || subtotalPaise > PRICING.freeShippingAbovePaise
      ? 0
      : PRICING.shippingFeePaise;
  const totalPaise = taxablePaise + taxPaise + shippingPaise;

  assertNonNegativeInteger(totalPaise, 'totalPaise');

  return { subtotalPaise, discountPaise, taxPaise, shippingPaise, totalPaise };
}
