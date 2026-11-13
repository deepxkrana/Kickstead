import type { StockStatus } from '../features/catalog/types';

export function StockBadge({ status, quantity }: { status: StockStatus; quantity: number }) {
  if (status === 'OUT_OF_STOCK') {
    return <span className="chip bg-primary text-secondary">Sold out</span>;
  }
  if (status === 'LOW_STOCK') {
    return <span className="chip bg-secondary text-error ring-1 ring-error">Only {quantity} left</span>;
  }
  return <span className="chip">In stock</span>;
}
