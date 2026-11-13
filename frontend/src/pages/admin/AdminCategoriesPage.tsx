import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api/adminApi';
import { ErrorMessage } from '../../components/StateViews';
import { AdminPage, EmptyRow, TableWrap, td, th } from '../../features/admin/AdminPage';
import type { AdminCategory } from '../../features/admin/types';

function CategoryRow({ category }: { category: AdminCategory }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const update = useMutation({
    mutationFn: (input: { name?: string; isActive?: boolean }) => adminApi.updateCategory(category.id, input),
    onSuccess: () => {
      setEditing(false);
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    update.mutate({ name: name.trim() });
  }

  return (
    <tr className="hover:bg-neutral">
      <td className={td}>
        {editing ? (
          <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
            <label htmlFor={`cat-${category.id}`} className="sr-only">
              Category name
            </label>
            <input id={`cat-${category.id}`} className="input w-56" value={name} onChange={(e) => setName(e.target.value)} />
            <button type="submit" className="btn-primary" disabled={update.isPending}>
              Save
            </button>
            <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </form>
        ) : (
          <span className="font-semibold">{category.name}</span>
        )}
        {update.isError && <p className="mt-1 text-caption text-error-strong">{update.error.message}</p>}
      </td>
      <td className={td}>{category.slug}</td>
      <td className={`${td} text-right`}>
        <Link to={`/admin/products?categoryId=${category.id}`} className="hover:underline">
          {category.productCount}
        </Link>
      </td>
      <td className={td}>
        <button
          type="button"
          className={`chip transition-colors ${category.isActive ? 'bg-primary text-secondary' : 'hover:bg-tertiary'}`}
          disabled={update.isPending}
          onClick={() => {
            const msg = category.isActive
              ? `Deactivate "${category.name}"? All ${category.productCount} of its products will be hidden from shoppers.`
              : `Activate "${category.name}"?`;
            if (window.confirm(msg)) update.mutate({ isActive: !category.isActive });
          }}
        >
          {category.isActive ? 'Active' : 'Inactive'}
        </button>
      </td>
      <td className={`${td} text-right`}>
        {!editing && (
          <button type="button" className="btn-tertiary text-body-sm" onClick={() => setEditing(true)}>
            Rename
          </button>
        )}
      </td>
    </tr>
  );
}

export function AdminCategoriesPage() {
  const queryClient = useQueryClient();
  const categories = useQuery({ queryKey: ['admin', 'categories'], queryFn: adminApi.categories });
  const [name, setName] = useState('');
  const create = useMutation({
    mutationFn: () => adminApi.createCategory({ name: name.trim() }),
    onSuccess: () => {
      setName('');
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  return (
    <AdminPage
      title="Categories"
      subtitle={
        <Link to="/admin/products" className="hover:underline">
          ← Products
        </Link>
      }
    >
      <form
        className="mb-5 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="new-category" className="text-label-sm uppercase">
            New category
          </label>
          <input id="new-category" className="input w-64" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Trail running" />
        </div>
        <button type="submit" className="btn-primary" disabled={create.isPending || name.trim().length < 2}>
          {create.isPending ? 'Adding…' : 'Add category'}
        </button>
      </form>
      {create.isError && (
        <div className="mb-5">
          <ErrorMessage>{create.error.message}</ErrorMessage>
        </div>
      )}

      <TableWrap>
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr>
              <th className={th}>Name</th>
              <th className={th}>Slug</th>
              <th className={`${th} text-right`}>Products</th>
              <th className={th}>Status</th>
              <th className={th}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {categories.isPending && <EmptyRow colSpan={5}>Loading…</EmptyRow>}
            {categories.isError && <EmptyRow colSpan={5}>{categories.error.message}</EmptyRow>}
            {categories.data?.map((category) => <CategoryRow key={category.id} category={category} />)}
          </tbody>
        </table>
      </TableWrap>
    </AdminPage>
  );
}
