import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminApi } from '../../api/adminApi';
import { Pagination } from '../../components/Pagination';
import { ErrorMessage } from '../../components/StateViews';
import { AdminPage, EmptyRow, TableWrap, td, th } from '../../features/admin/AdminPage';
import { formatDate } from '../../lib/format';

export function AdminCustomersPage() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const query = { q: params.get('q') ?? undefined, page: Number(params.get('page')) || 1, limit: 20 };
  const customers = useQuery({ queryKey: ['admin', 'customers', query], queryFn: () => adminApi.customers(query), placeholderData: keepPreviousData });

  return (
    <AdminPage title="Customers" subtitle={customers.data ? `${customers.data.meta.total} customers` : undefined}>
      <form
        className="mb-5 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setParams(search.trim() ? { q: search.trim() } : {}, { replace: true });
        }}
      >
        <div className="flex min-w-64 flex-1 flex-col gap-1">
          <label htmlFor="customer-search" className="text-label-sm uppercase">
            Search
          </label>
          <input id="customer-search" type="search" className="input" placeholder="Name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button type="submit" className="btn-secondary">
          Search
        </button>
      </form>
      {customers.isError && <ErrorMessage>{customers.error.message}</ErrorMessage>}
      <TableWrap>
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr>
              <th className={th}>Name</th>
              <th className={th}>Email</th>
              <th className={th}>Joined</th>
              <th className={`${th} text-right`}>Orders</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {customers.isPending && <EmptyRow colSpan={5}>Loading…</EmptyRow>}
            {customers.data?.data.length === 0 && <EmptyRow colSpan={5}>No customers found.</EmptyRow>}
            {customers.data?.data.map((c) => (
              <tr key={c.id} className="hover:bg-neutral">
                <td className={`${td} font-semibold`}>{c.name}</td>
                <td className={td}>{c.email}</td>
                <td className={`${td} whitespace-nowrap`}>{formatDate(c.createdAt)}</td>
                <td className={`${td} text-right`}>{c.orderCount}</td>
                <td className={td}>{c.isActive ? 'Active' : <span className="text-error-strong">Disabled</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
      {customers.data && (
        <div className="mt-5">
          <Pagination
            page={customers.data.meta.page}
            totalPages={customers.data.meta.totalPages}
            onChange={(p) => {
              const next = new URLSearchParams(params);
              next.set('page', String(p));
              setParams(next);
            }}
          />
        </div>
      )}
    </AdminPage>
  );
}
