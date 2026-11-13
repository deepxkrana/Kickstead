import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminApi } from '../../api/adminApi';
import { Pagination } from '../../components/Pagination';
import { ErrorMessage } from '../../components/StateViews';
import { StatusBadge, statusLabel } from '../../components/StatusBadge';
import { AdminPage, EmptyRow, TableWrap, td, th } from '../../features/admin/AdminPage';
import type { OrderStatus } from '../../features/orders/types';
import { formatDateTime } from '../../lib/format';
import { formatPaise } from '../../lib/money';

const STATUSES: OrderStatus[] = ['PLACED', 'PAID', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'PAYMENT_FAILED', 'PAYMENT_CANCELLED'];

export function AdminOrdersPage() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const status = params.get('status') ?? '';
  const query = { q: params.get('q') ?? undefined, status: status || undefined, page: Number(params.get('page')) || 1, limit: 20 };
  const orders = useQuery({ queryKey: ['admin', 'orders', query], queryFn: () => adminApi.orders(query), placeholderData: keepPreviousData });

  function update(changes: Record<string, string | undefined>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) (v ? next.set(k, v) : next.delete(k));
    if (!('page' in changes)) next.delete('page');
    setParams(next, { replace: true });
  }

  return (
    <AdminPage title="Orders" subtitle={orders.data ? `${orders.data.meta.total} orders` : undefined}>
      <div className="mb-5 flex flex-col gap-4">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: search.trim() || undefined });
          }}
        >
          <div className="flex min-w-64 flex-1 flex-col gap-1">
            <label htmlFor="order-search" className="text-label-sm uppercase">
              Search
            </label>
            <input id="order-search" type="search" className="input" placeholder="Order number, customer name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button type="submit" className="btn-secondary">
            Search
          </button>
        </form>
        <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={!status} className={`chip ${!status ? 'bg-primary text-secondary' : 'hover:bg-tertiary'}`} onClick={() => update({ status: undefined })}>
            All
          </button>
          {STATUSES.map((s) => (
            <button key={s} type="button" aria-pressed={status === s} className={`chip ${status === s ? 'bg-primary text-secondary' : 'hover:bg-tertiary'}`} onClick={() => update({ status: s })}>
              {statusLabel(s)}
            </button>
          ))}
        </div>
      </div>

      {orders.isError && <ErrorMessage>{orders.error.message}</ErrorMessage>}

      <TableWrap>
        <table className={`w-full min-w-[820px] border-collapse ${orders.isPlaceholderData ? 'opacity-60' : ''}`}>
          <thead>
            <tr>
              <th className={th}>Order</th>
              <th className={th}>Customer</th>
              <th className={th}>Placed</th>
              <th className={`${th} text-right`}>Items</th>
              <th className={`${th} text-right`}>Total</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.isPending && <EmptyRow colSpan={6}>Loading…</EmptyRow>}
            {orders.data?.data.length === 0 && <EmptyRow colSpan={6}>No orders match.</EmptyRow>}
            {orders.data?.data.map((order) => (
              <tr key={order.id} className="hover:bg-neutral">
                <td className={td}>
                  <Link to={`/admin/orders/${order.id}`} className="font-semibold hover:underline">
                    {order.orderNumber}
                  </Link>
                </td>
                <td className={td}>
                  {order.customer.name}
                  <p className="text-caption text-primary-60">{order.customer.email}</p>
                </td>
                <td className={`${td} whitespace-nowrap`}>{formatDateTime(order.createdAt)}</td>
                <td className={`${td} text-right`}>{order.itemCount}</td>
                <td className={`${td} text-right whitespace-nowrap`}>{formatPaise(order.totalPaise)}</td>
                <td className={td}>
                  <StatusBadge status={order.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>

      {orders.data && (
        <div className="mt-5">
          <Pagination page={orders.data.meta.page} totalPages={orders.data.meta.totalPages} onChange={(p) => update({ page: String(p) })} />
        </div>
      )}
    </AdminPage>
  );
}
