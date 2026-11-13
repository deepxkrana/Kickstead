import { Link, useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { orderApi } from '../api/orderApi';
import { Pagination } from '../components/Pagination';
import { ProductImage } from '../components/ProductImage';
import { LoadingState, MessageState } from '../components/StateViews';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate } from '../lib/format';
import { formatPaise } from '../lib/money';

export function OrdersPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const orders = useQuery({
    queryKey: ['orders', page],
    queryFn: () => orderApi.list(page),
    placeholderData: keepPreviousData,
  });

  if (orders.isPending) return <LoadingState label="Loading your orders…" />;

  if (orders.isError) {
    return (
      <MessageState
        eyebrow="Error"
        title="Could not load orders"
        message={orders.error.message}
        actions={
          <button type="button" className="btn-primary" onClick={() => void orders.refetch()}>
            Try again
          </button>
        }
      />
    );
  }

  if (orders.data.data.length === 0) {
    return (
      <MessageState
        title="No orders yet"
        message="When you place an order it will show up here."
        actions={
          <Link to="/products" className="btn-primary">
            Start shopping
          </Link>
        }
      />
    );
  }

  return (
    <section className="mx-auto max-w-4xl px-4 py-9.5">
      <h1 className="text-headline-lg uppercase">Orders</h1>
      {orders.isFetching && orders.isPlaceholderData && <p className="mt-2 text-caption text-primary-60">Loading…</p>}
      <ul className="mt-7.5 flex flex-col gap-3">
        {orders.data.data.map((order) => (
          <li key={order.id}>
            <Link
              to={`/orders/${order.id}`}
              className="card flex items-center gap-4 transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"
            >
              <ProductImage src={order.imageUrl} alt="" className="size-16 shrink-0 rounded-md" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="text-label-md">{order.orderNumber}</p>
                <p className="text-caption text-primary-60">
                  {formatDate(order.createdAt)} · {order.itemCount} item{order.itemCount === 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <p className="text-label-lg">{formatPaise(order.totalPaise)}</p>
                <StatusBadge status={order.status} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-7.5">
        <Pagination
          page={orders.data.meta.page}
          totalPages={orders.data.meta.totalPages}
          onChange={(p) => setParams(p > 1 ? { page: String(p) } : {})}
        />
      </div>
    </section>
  );
}
