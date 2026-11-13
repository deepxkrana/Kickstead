import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { catalogApi } from '../api/catalogApi';
import { ProductCard, ProductGridSkeleton } from '../components/ProductCard';
import { ErrorMessage } from '../components/StateViews';

function FeaturedProducts() {
  const featured = useQuery({
    queryKey: ['products', { featured: true, limit: 4 }],
    queryFn: () => catalogApi.products({ featured: true, limit: 4 }),
  });

  if (featured.isPending) return <ProductGridSkeleton count={4} />;
  if (featured.isError) return <ErrorMessage>{featured.error.message}</ErrorMessage>;
  if (featured.data.data.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {featured.data.data.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

export function HomePage() {
  return (
    <>
      <section className="relative isolate overflow-hidden bg-primary text-secondary">
        <img
          src="https://images.unsplash.com/photo-1552346154-21d32810aba3?w=1600&q=80"
          alt=""
          className="absolute inset-0 -z-10 h-full w-full object-cover opacity-50"
        />
        <div className="mx-auto flex min-h-[420px] max-w-6xl flex-col justify-end gap-5 px-4 py-12.5">
          <p className="text-label-sm text-error uppercase">New season drop</p>
          <h1 className="max-w-2xl text-headline-display uppercase">Sneakers for every stride.</h1>
          <div>
            <Link to="/products" className="btn-primary bg-secondary text-primary hover:bg-tertiary">
              Shop all
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12.5">
        <div className="mb-5 flex items-end justify-between gap-4">
          <h2 className="text-headline-md uppercase">
            Featured <span className="underline decoration-error decoration-2 underline-offset-8">drops</span>
          </h2>
          <Link to="/products" className="btn-tertiary text-body-sm">
            View all →
          </Link>
        </div>
        <FeaturedProducts />
      </section>
    </>
  );
}
