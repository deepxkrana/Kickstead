import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { catalogApi } from '../api/catalogApi';
import { ProductCard, ProductGridSkeleton } from '../components/ProductCard';
import { Pagination } from '../components/Pagination';
import { ErrorMessage } from '../components/StateViews';
import type { ProductSort } from '../features/catalog/types';

const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'name_asc', label: 'Name: A–Z' },
];

const PAGE_SIZE = 12;

/** URL holds rupees (readable, shareable); the API takes paise. */
function rupeesToPaise(value: string | null): number | undefined {
  if (!value) return undefined;
  const rupees = Number(value);
  return Number.isFinite(rupees) && rupees >= 0 ? Math.round(rupees * 100) : undefined;
}

function isSort(value: string | null): value is ProductSort {
  return SORT_OPTIONS.some((option) => option.value === value);
}

export function ProductsPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const sortParam = params.get('sort');
  const sort: ProductSort = isSort(sortParam) ? sortParam : 'newest';
  const minRupees = params.get('min') ?? '';
  const maxRupees = params.get('max') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);

  /** Updates URL params; any filter change returns to page 1. */
  function update(changes: Record<string, string | undefined>, resetPage = true) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (resetPage) next.delete('page');
    setParams(next, { replace: !('page' in changes) });
  }

  // Debounced search box.
  const [searchText, setSearchText] = useState(q);
  useEffect(() => setSearchText(q), [q]);
  useEffect(() => {
    if (searchText.trim() === q) return;
    const timer = setTimeout(() => update({ q: searchText.trim() || undefined }), 350);
    return () => clearTimeout(timer);
    // Only the typed text should trigger this; `update` reads the latest params on each run.
  }, [searchText]);

  const [minInput, setMinInput] = useState(minRupees);
  const [maxInput, setMaxInput] = useState(maxRupees);
  useEffect(() => setMinInput(minRupees), [minRupees]);
  useEffect(() => setMaxInput(maxRupees), [maxRupees]);

  const categories = useQuery({ queryKey: ['categories'], queryFn: catalogApi.categories, staleTime: 5 * 60_000 });

  const query = {
    q: q || undefined,
    category: category || undefined,
    sort,
    minPrice: rupeesToPaise(minRupees),
    maxPrice: rupeesToPaise(maxRupees),
    page,
    limit: PAGE_SIZE,
  };
  const products = useQuery({
    queryKey: ['products', query],
    queryFn: ({ signal }) => catalogApi.products(query, signal),
    placeholderData: keepPreviousData,
  });

  function applyPrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    update({ min: minInput.trim() || undefined, max: maxInput.trim() || undefined });
  }

  const hasFilters = Boolean(q || category || minRupees || maxRupees);

  return (
    <section className="mx-auto max-w-6xl px-4 py-9.5">
      <header className="flex flex-col gap-2">
        <h1 className="text-headline-lg uppercase">Shop</h1>
        <p className="text-body-md text-primary-60">Running, court, street and skate — find your next pair.</p>
      </header>

      <div className="mt-7.5 flex flex-col gap-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="search" className="text-label-sm uppercase">
              Search
            </label>
            <input
              id="search"
              type="search"
              className="input"
              placeholder="Search by name, brand or description"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="sort" className="text-label-sm uppercase">
              Sort
            </label>
            <select
              id="sort"
              className="input cursor-pointer md:w-56"
              value={sort}
              onChange={(e) => update({ sort: e.target.value === 'newest' ? undefined : e.target.value })}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div role="group" aria-label="Category" className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={!category}
              className={`chip transition-colors ${!category ? 'bg-primary text-secondary' : 'hover:bg-tertiary'}`}
              onClick={() => update({ category: undefined })}
            >
              All
            </button>
            {categories.data?.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={category === c.slug}
                className={`chip transition-colors ${category === c.slug ? 'bg-primary text-secondary' : 'hover:bg-tertiary'}`}
                onClick={() => update({ category: category === c.slug ? undefined : c.slug })}
              >
                {c.name}
              </button>
            ))}
          </div>

          <form className="flex flex-wrap items-end gap-2" onSubmit={applyPrice} aria-label="Price range">
            <div className="flex flex-col gap-1">
              <label htmlFor="min-price" className="text-label-sm uppercase">
                Min ₹
              </label>
              <input
                id="min-price"
                type="number"
                min={0}
                inputMode="numeric"
                className="input w-28"
                value={minInput}
                onChange={(e) => setMinInput(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="max-price" className="text-label-sm uppercase">
                Max ₹
              </label>
              <input
                id="max-price"
                type="number"
                min={0}
                inputMode="numeric"
                className="input w-28"
                value={maxInput}
                onChange={(e) => setMaxInput(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-secondary">
              Apply
            </button>
          </form>
        </div>
      </div>

      <div className="mt-7.5 flex min-h-6 items-center justify-between gap-4">
        <p className="text-body-sm text-primary-60" aria-live="polite">
          {products.data ? `${products.data.meta.total} product${products.data.meta.total === 1 ? '' : 's'}` : ''}
        </p>
        {hasFilters && (
          <button
            type="button"
            className="btn-tertiary text-body-sm"
            onClick={() => setParams(sort === 'newest' ? {} : { sort })}
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="mt-4">
        {products.isPending ? (
          <ProductGridSkeleton />
        ) : products.isError ? (
          <div className="flex flex-col items-start gap-4">
            <ErrorMessage>{products.error.message}</ErrorMessage>
            <button type="button" className="btn-secondary" onClick={() => void products.refetch()}>
              Try again
            </button>
          </div>
        ) : products.data.data.length === 0 ? (
          <div className="rounded-lg border border-dashed border-primary-20 px-5 py-12.5 text-center">
            <h2 className="text-headline-sm uppercase">No products found</h2>
            <p className="mt-2 text-body-sm text-primary-60">Try a different search or remove some filters.</p>
          </div>
        ) : (
          <div
            className={`grid grid-cols-2 gap-4 transition-opacity md:grid-cols-3 lg:grid-cols-4 ${
              products.isPlaceholderData ? 'opacity-60' : ''
            }`}
          >
            {products.data.data.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>

      {products.data && (
        <div className="mt-9.5">
          <Pagination
            page={products.data.meta.page}
            totalPages={products.data.meta.totalPages}
            onChange={(p) => {
              update({ page: p > 1 ? String(p) : undefined }, false);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </div>
      )}
    </section>
  );
}
