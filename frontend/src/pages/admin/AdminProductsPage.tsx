import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api/adminApi';
import { Pagination } from '../../components/Pagination';
import { ProductImage } from '../../components/ProductImage';
import { ErrorMessage } from '../../components/StateViews';
import { AdminPage, EmptyRow, TableWrap, td, th } from '../../features/admin/AdminPage';
import type { AdminProduct } from '../../features/admin/types';
import { formatPaise } from '../../lib/money';

function StockEditor({ product, onDone }: { product: AdminProduct; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'adjust' | 'set'>('adjust');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const save = useMutation({
    mutationFn: () => adminApi.adjustStock(product.id, { mode, quantity: Number(quantity), note: note.trim() || undefined }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      onDone();
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save.mutate();
  }

  const n = Number(quantity);
  const preview = quantity === '' || !Number.isInteger(n) ? null : mode === 'set' ? n : product.stockQuantity + n;

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3 bg-neutral px-4 py-4" aria-label={`Change stock for ${product.name}`}>
      <div className="flex flex-col gap-1">
        <label htmlFor={`mode-${product.id}`} className="text-label-sm uppercase">
          Change
        </label>
        <select id={`mode-${product.id}`} className="input w-40" value={mode} onChange={(e) => setMode(e.target.value as 'adjust' | 'set')}>
          <option value="adjust">Add / remove</option>
          <option value="set">Set to</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`qty-${product.id}`} className="text-label-sm uppercase">
          {mode === 'adjust' ? 'Units (+/−)' : 'New stock'}
        </label>
        <input id={`qty-${product.id}`} type="number" step={1} className="input w-28" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
      </div>
      <div className="flex min-w-48 flex-1 flex-col gap-1">
        <label htmlFor={`note-${product.id}`} className="text-label-sm uppercase">
          Note (optional)
        </label>
        <input id={`note-${product.id}`} className="input" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Supplier delivery" />
      </div>
      <p className="text-body-sm text-primary-60">
        {product.stockQuantity} → <strong className={preview !== null && preview < 0 ? 'text-error-strong' : ''}>{preview ?? '—'}</strong>
      </p>
      <button type="submit" className="btn-primary" disabled={save.isPending || preview === null}>
        {save.isPending ? 'Saving…' : 'Save stock'}
      </button>
      <button type="button" className="btn-secondary" onClick={onDone} disabled={save.isPending}>
        Close
      </button>
      {save.isError && (
        <div className="w-full">
          <ErrorMessage>{save.error.message}</ErrorMessage>
        </div>
      )}
    </form>
  );
}

function ActiveToggle({ product }: { product: AdminProduct }) {
  const queryClient = useQueryClient();
  const toggle = useMutation({
    mutationFn: () => adminApi.updateProduct(product.id, { isActive: !product.isActive }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin'] }),
  });
  return (
    <button
      type="button"
      className={`chip transition-colors ${product.isActive ? 'bg-primary text-secondary' : 'hover:bg-tertiary'}`}
      onClick={() => {
        const verb = product.isActive ? 'Deactivate' : 'Activate';
        if (window.confirm(`${verb} "${product.name}"?${product.isActive ? ' Shoppers will no longer see it.' : ''}`)) toggle.mutate();
      }}
      disabled={toggle.isPending}
      title={toggle.error?.message}
      aria-label={`${product.name} is ${product.isActive ? 'active' : 'inactive'}. Toggle.`}
    >
      {toggle.isPending ? '…' : product.isActive ? 'Active' : 'Inactive'}
    </button>
  );
}

export function AdminProductsPage() {
  const [params, setParams] = useSearchParams();
  const [editingStock, setEditingStock] = useState<string | null>(null);
  const [search, setSearch] = useState(params.get('q') ?? '');
  const query = {
    q: params.get('q') ?? undefined,
    categoryId: params.get('categoryId') ?? undefined,
    status: params.get('status') ?? 'all',
    lowStock: params.get('lowStock') === 'true' ? 'true' : undefined,
    page: Number(params.get('page')) || 1,
    limit: 20,
  };
  const products = useQuery({ queryKey: ['admin', 'products', query], queryFn: () => adminApi.products(query), placeholderData: keepPreviousData });
  const categories = useQuery({ queryKey: ['admin', 'categories'], queryFn: adminApi.categories });

  function update(changes: Record<string, string | undefined>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) (v ? next.set(k, v) : next.delete(k));
    if (!('page' in changes)) next.delete('page');
    setParams(next, { replace: true });
  }

  return (
    <AdminPage
      title="Products"
      subtitle={products.data ? `${products.data.meta.total} products` : undefined}
      actions={
        <>
          <Link to="/admin/categories" className="btn-secondary">
            Categories
          </Link>
          <Link to="/admin/products/new" className="btn-primary">
            New product
          </Link>
        </>
      }
    >
      <form
        className="mb-5 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: search.trim() || undefined });
        }}
      >
        <div className="flex min-w-56 flex-1 flex-col gap-1">
          <label htmlFor="admin-search" className="text-label-sm uppercase">
            Search
          </label>
          <input id="admin-search" type="search" className="input" placeholder="Name, brand or slug" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="admin-category" className="text-label-sm uppercase">
            Category
          </label>
          <select id="admin-category" className="input w-44" value={query.categoryId ?? ''} onChange={(e) => update({ categoryId: e.target.value || undefined })}>
            <option value="">All</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.isActive ? '' : ' (inactive)'}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="admin-status" className="text-label-sm uppercase">
            Status
          </label>
          <select id="admin-status" className="input w-36" value={query.status} onChange={(e) => update({ status: e.target.value === 'all' ? undefined : e.target.value })}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <label className="flex h-10 items-center gap-2 text-body-sm">
          <input type="checkbox" className="size-4 accent-primary" checked={query.lowStock === 'true'} onChange={(e) => update({ lowStock: e.target.checked ? 'true' : undefined })} />
          Low stock only
        </label>
        <button type="submit" className="btn-secondary">
          Search
        </button>
      </form>

      {products.isError && <ErrorMessage>{products.error.message}</ErrorMessage>}

      <TableWrap>
        <table className={`w-full min-w-[820px] border-collapse ${products.isPlaceholderData ? 'opacity-60' : ''}`}>
          <thead>
            <tr>
              <th className={th}>Product</th>
              <th className={th}>Category</th>
              <th className={`${th} text-right`}>Price</th>
              <th className={`${th} text-right`}>Stock</th>
              <th className={th}>Status</th>
              <th className={th}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {products.isPending && <EmptyRow colSpan={6}>Loading…</EmptyRow>}
            {products.data?.data.length === 0 && <EmptyRow colSpan={6}>No products match these filters.</EmptyRow>}
            {products.data?.data.map((product) => (
              <ProductRows key={product.id} product={product} editing={editingStock === product.id} onEditStock={setEditingStock} />
            ))}
          </tbody>
        </table>
      </TableWrap>

      {products.data && (
        <div className="mt-5">
          <Pagination page={products.data.meta.page} totalPages={products.data.meta.totalPages} onChange={(p) => update({ page: String(p) })} />
        </div>
      )}
    </AdminPage>
  );
}

function ProductRows({ product, editing, onEditStock }: { product: AdminProduct; editing: boolean; onEditStock: (id: string | null) => void }) {
  return (
    <>
      <tr className="hover:bg-neutral">
        <td className={td}>
          <div className="flex items-center gap-3">
            <ProductImage src={product.imageUrl} alt="" className="size-12 shrink-0 rounded-md" />
            <div>
              <Link to={`/admin/products/${product.id}/edit`} className="font-semibold hover:underline">
                {product.name}
              </Link>
              <p className="text-caption text-primary-60">
                {product.brand} · {product.slug}
                {product.isFeatured ? ' · Featured' : ''}
              </p>
            </div>
          </div>
        </td>
        <td className={td}>
          {product.category.name}
          {!product.category.isActive && <span className="ml-1 text-caption text-error-strong">(inactive)</span>}
        </td>
        <td className={`${td} text-right whitespace-nowrap`}>{formatPaise(product.pricePaise)}</td>
        <td className={`${td} text-right`}>
          <span className={product.stockStatus === 'OUT_OF_STOCK' ? 'font-semibold text-error-strong' : product.stockStatus === 'LOW_STOCK' ? 'font-semibold' : ''}>
            {product.stockQuantity}
          </span>
        </td>
        <td className={td}>
          <ActiveToggle product={product} />
        </td>
        <td className={`${td} whitespace-nowrap text-right`}>
          <button type="button" className="btn-tertiary text-body-sm" onClick={() => onEditStock(editing ? null : product.id)} aria-expanded={editing}>
            Stock
          </button>
          <Link to={`/admin/products/${product.id}/edit`} className="btn-tertiary ml-4 text-body-sm">
            Edit
          </Link>
        </td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={6} className="border-b border-tertiary p-0">
            <StockEditor product={product} onDone={() => onEditStock(null)} />
          </td>
        </tr>
      )}
    </>
  );
}
