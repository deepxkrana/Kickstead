import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api/adminApi';
import { ApiError } from '../../api/client';
import { ProductImage } from '../../components/ProductImage';
import { ErrorMessage, LoadingState } from '../../components/StateViews';
import { AdminPage, MOVEMENT_LABEL, TableWrap, td, th } from '../../features/admin/AdminPage';
import type { AdminProductDetail, ProductInput } from '../../features/admin/types';
import { formatDateTime } from '../../lib/format';

interface FormState {
  name: string;
  slug: string;
  brand: string;
  description: string;
  priceRupees: string;
  imageUrl: string;
  categoryId: string;
  isActive: boolean;
  isFeatured: boolean;
  initialStock: string;
}

function toForm(p?: AdminProductDetail): FormState {
  return {
    name: p?.name ?? '',
    slug: p?.slug ?? '',
    brand: p?.brand ?? '',
    description: p?.description ?? '',
    priceRupees: p ? (p.pricePaise / 100).toFixed(2) : '',
    imageUrl: p?.imageUrl ?? '',
    categoryId: p?.category.id ?? '',
    isActive: p?.isActive ?? true,
    isFeatured: p?.isFeatured ?? false,
    initialStock: '0',
  };
}

function Field({ id, label, error, children, wide }: { id: string; label: string; error?: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`flex flex-col gap-1 ${wide ? 'sm:col-span-2' : ''}`}>
      <label htmlFor={id} className="text-label-sm uppercase">
        {label}
      </label>
      {children}
      {error && <p className="text-caption text-error-strong">{error}</p>}
    </div>
  );
}

export function AdminProductFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const product = useQuery({ queryKey: ['admin', 'product', id], queryFn: () => adminApi.product(id!), enabled: isEdit });
  const categories = useQuery({ queryKey: ['admin', 'categories'], queryFn: adminApi.categories });
  const [form, setForm] = useState<FormState>(toForm());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (product.data) setForm(toForm(product.data));
  }, [product.data]);

  const save = useMutation({
    mutationFn: (input: ProductInput) => (isEdit ? adminApi.updateProduct(id!, input) : adminApi.createProduct(input)),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      if (isEdit) setSaved(true);
      else navigate(`/admin/products/${result.id}/edit`, { replace: true });
    },
  });

  if (isEdit && product.isPending) return <LoadingState label="Loading product…" />;
  if (isEdit && product.isError) {
    return (
      <AdminPage title="Edit product">
        <ErrorMessage>{product.error.message}</ErrorMessage>
      </AdminPage>
    );
  }

  const errors = new Map<string, string>();
  if (save.error instanceof ApiError) {
    for (const issue of (save.error.details.issues as { path: string; message: string }[] | undefined) ?? []) errors.set(issue.path, issue.message);
    if (save.error.code.endsWith('_SLUG_TAKEN')) errors.set('slug', save.error.message);
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  };

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input: ProductInput = {
      name: form.name.trim(),
      brand: form.brand.trim(),
      description: form.description.trim(),
      // Rupees are typed for convenience; the API stores integer paise.
      pricePaise: Math.round(Number(form.priceRupees) * 100),
      imageUrl: form.imageUrl.trim() || null,
      categoryId: form.categoryId,
      isActive: form.isActive,
      isFeatured: form.isFeatured,
      ...(form.slug.trim() ? { slug: form.slug.trim() } : {}),
      ...(isEdit ? {} : { initialStock: Number(form.initialStock) || 0 }),
    };
    save.mutate(input);
  }

  return (
    <AdminPage
      title={isEdit ? 'Edit product' : 'New product'}
      subtitle={
        <Link to="/admin/products" className="hover:underline">
          ← All products
        </Link>
      }
      actions={
        isEdit && product.data?.isActive ? (
          <Link to={`/products/${product.data.slug}`} className="btn-secondary" target="_blank" rel="noreferrer">
            View in store ↗
          </Link>
        ) : undefined
      }
    >
      <div className="grid gap-7.5 lg:grid-cols-[1fr_320px]">
        <form className="card grid gap-4 p-5 sm:grid-cols-2" onSubmit={submit} noValidate>
          <Field id="p-name" label="Name" error={errors.get('name')} wide>
            <input id="p-name" className="input" value={form.name} onChange={(e) => set('name', e.target.value)} required />
          </Field>
          <Field id="p-brand" label="Brand" error={errors.get('brand')}>
            <input id="p-brand" className="input" value={form.brand} onChange={(e) => set('brand', e.target.value)} required />
          </Field>
          <Field id="p-slug" label={isEdit ? 'Slug' : 'Slug (optional — from name)'} error={errors.get('slug')}>
            <input id="p-slug" className="input" value={form.slug} onChange={(e) => set('slug', e.target.value)} placeholder="tempo-runner" />
          </Field>
          <Field id="p-category" label="Category" error={errors.get('categoryId')}>
            <select id="p-category" className="input" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)} required>
              <option value="">Select…</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.isActive ? '' : ' (inactive)'}
                </option>
              ))}
            </select>
          </Field>
          <Field id="p-price" label="Price (₹, excl. GST)" error={errors.get('pricePaise')}>
            <input id="p-price" type="number" min={0} step="0.01" inputMode="decimal" className="input" value={form.priceRupees} onChange={(e) => set('priceRupees', e.target.value)} required />
          </Field>
          <Field id="p-description" label="Description" error={errors.get('description')} wide>
            <textarea id="p-description" rows={4} className="input h-auto py-2" value={form.description} onChange={(e) => set('description', e.target.value)} required />
          </Field>
          <Field id="p-image" label="Image URL" error={errors.get('imageUrl')} wide>
            <input id="p-image" type="url" className="input" value={form.imageUrl} onChange={(e) => set('imageUrl', e.target.value)} placeholder="https://images.unsplash.com/…" />
          </Field>
          {!isEdit && (
            <Field id="p-stock" label="Initial stock" error={errors.get('initialStock')}>
              <input id="p-stock" type="number" min={0} step={1} className="input" value={form.initialStock} onChange={(e) => set('initialStock', e.target.value)} />
            </Field>
          )}
          <div className="flex flex-wrap items-center gap-5 sm:col-span-2">
            <label className="flex items-center gap-2 text-body-sm">
              <input type="checkbox" className="size-4 accent-primary" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />
              Active (visible to shoppers)
            </label>
            <label className="flex items-center gap-2 text-body-sm">
              <input type="checkbox" className="size-4 accent-primary" checked={form.isFeatured} onChange={(e) => set('isFeatured', e.target.checked)} />
              Featured on homepage
            </label>
          </div>
          {isEdit && <p className="text-caption text-primary-60 sm:col-span-2">Stock is changed from the products list so every change is logged.</p>}

          {save.isError && !errors.size && (
            <div className="sm:col-span-2">
              <ErrorMessage>{save.error.message}</ErrorMessage>
            </div>
          )}
          <div className="flex items-center gap-4 sm:col-span-2">
            <button type="submit" className="btn-primary" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create product'}
            </button>
            {saved && <p role="status" className="text-body-sm">Saved.</p>}
          </div>
        </form>

        <aside className="flex flex-col gap-5">
          <div className="card p-4">
            <p className="mb-2 text-label-sm text-primary-60 uppercase">Preview</p>
            <ProductImage src={form.imageUrl.trim() || null} alt="" className="aspect-square w-full rounded-md" />
            {isEdit && product.data && (
              <p className="mt-3 text-body-sm">
                Stock: <strong>{product.data.stockQuantity}</strong>
              </p>
            )}
          </div>
        </aside>
      </div>

      {isEdit && product.data && (
        <div className="mt-9.5">
          <h2 className="mb-3 text-headline-sm uppercase">Stock history</h2>
          <TableWrap>
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr>
                  <th className={th}>When</th>
                  <th className={th}>Reason</th>
                  <th className={`${th} text-right`}>Change</th>
                  <th className={`${th} text-right`}>Stock after</th>
                  <th className={th}>By / order</th>
                </tr>
              </thead>
              <tbody>
                {product.data.movements.map((m) => (
                  <tr key={m.id}>
                    <td className={`${td} whitespace-nowrap`}>{formatDateTime(m.createdAt)}</td>
                    <td className={td}>
                      {MOVEMENT_LABEL[m.reason] ?? m.reason}
                      {m.note && <span className="text-primary-60"> — {m.note}</span>}
                    </td>
                    <td className={`${td} text-right font-semibold ${m.quantityChange < 0 ? 'text-error-strong' : ''}`}>
                      {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}
                    </td>
                    <td className={`${td} text-right`}>{m.stockAfter}</td>
                    <td className={td}>
                      {m.order ? (
                        <Link to={`/admin/orders/${m.order.id}`} className="hover:underline">
                          {m.order.orderNumber}
                        </Link>
                      ) : (
                        m.actor?.name ?? '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </div>
      )}
    </AdminPage>
  );
}
