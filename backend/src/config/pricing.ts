// Single source of truth for checkout charges. All amounts are integer paise.

export const PRICING = {
  currency: 'INR',
  /** GST added on top of the discounted subtotal, in basis points (1800 = 18%). */
  gstRateBps: 1800,
  /** Flat shipping fee: ₹99. */
  shippingFeePaise: 9_900,
  /** Shipping is free when the subtotal is strictly above ₹2,999. */
  freeShippingAbovePaise: 299_900,
  /** No discounts in the MVP. */
  discountPaise: 0,
} as const;

/** Products at or below this stock level count as "low stock" on the admin dashboard. */
export const LOW_STOCK_THRESHOLD = 5;

/** Maximum quantity of a single product in one cart / order line. */
export const MAX_QUANTITY_PER_ITEM = 10;
