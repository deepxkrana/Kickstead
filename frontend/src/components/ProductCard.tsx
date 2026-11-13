import { Link } from 'react-router';
import type { ProductSummary } from '../features/catalog/types';
import { formatPaise } from '../lib/money';
import { ProductImage } from './ProductImage';
import { StockBadge } from './StockBadge';

export function ProductCard({ product }: { product: ProductSummary }) {
  return (
    <Link
      to={`/products/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-tertiary bg-surface transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <div className="relative">
        <ProductImage src={product.imageUrl} alt={product.name} className="aspect-square w-full" />
        {product.stockStatus !== 'IN_STOCK' && (
          <div className="absolute top-2 left-2">
            <StockBadge status={product.stockStatus} quantity={product.stockQuantity} />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="text-label-sm text-primary-60 uppercase">{product.brand}</p>
        <h3 className="text-body-md font-semibold group-hover:underline">{product.name}</h3>
        <p className="text-caption text-primary-60">{product.category.name}</p>
        <p className="mt-auto pt-2 text-label-lg">{formatPaise(product.pricePaise)}</p>
      </div>
    </Link>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-lg border border-tertiary">
          <div className="aspect-square animate-pulse motion-reduce:animate-none bg-neutral" />
          <div className="space-y-2 p-4">
            <div className="h-3 w-1/3 animate-pulse motion-reduce:animate-none rounded-sm bg-neutral" />
            <div className="h-4 w-2/3 animate-pulse motion-reduce:animate-none rounded-sm bg-neutral" />
            <div className="h-4 w-1/4 animate-pulse motion-reduce:animate-none rounded-sm bg-neutral" />
          </div>
        </div>
      ))}
    </div>
  );
}
