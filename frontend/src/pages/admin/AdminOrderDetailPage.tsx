import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api/adminApi';
import { ApiError } from '../../api/client';
import { ProductImage } from '../../components/ProductImage';
import { ErrorMessage, LoadingState } from '../../components/StateViews';
import { StatusBadge, statusLabel } from '../../components/StatusBadge';
import { AddressText } from '../../features/addresses/AddressText';
import { AdminPage, MOVEMENT_LABEL } from '../../features/admin/AdminPage';
import type { OrderStatus } from '../../features/orders/types';
import { formatDateTime } from '../../lib/format';
import { formatPaise } from '../../lib/money';

const ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  PACKED: 'Mark as packed',
  SHIPPED: 'Mark as shipped',
  DELIVERED: 'Mark as delivered',
  CANCELLED: 'Cancel order',
};

function describe(action: string, metadata: Record<string, unknown> | null): string {
  const m = metadata ?? {};
  switch (action) {
    case 'ORDER_CREATED':
      return `Order placed (${formatPaise(Number(m.totalPaise ?? 0))})`;
    case 'PAYMENT_RECORDED':
      return `Payment ${String(m.outcome).toLowerCase()} → ${statusLabel(m.to as OrderStatus)}`;
    case 'ORDER_STATUS_CHANGED':
      return `${statusLabel(m.from as OrderStatus)} → ${statusLabel(m.to as OrderStatus)}`;
    case 'ORDER_CANCELLED':
      return `Cancelled from ${statusLabel(m.from as OrderStatus)}${m.refund ? ' (refunded)' : ''}${m.reason ? ` — ${String(m.reason)}` : ''}`;
    default:
      return action;
  }
}

export function AdminOrderDetailPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const order = useQuery({ queryKey: ['admin', 'order', id], queryFn: () => adminApi.order(id) });
  const updateStatus = useMutation({
    mutationFn: ({ status, reason }: { status: OrderStatus; reason?: string }) => adminApi.updateOrderStatus(id, status, reason),
    onSuccess: (updated) => {
      queryClient.setQueryData(['admin', 'order', id], updated);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
    },
    // The server is authoritative (e.g. the customer paid or cancelled meanwhile): reload.
    onError: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'order', id] }),
  });

  if (order.isPending) return <LoadingState label="Loading order…" />;
  if (order.isError) {
    const notFound = order.error instanceof ApiError && order.error.status === 404;
    return (
      <AdminPage title={notFound ? 'Order not found' : 'Order'}>
        <ErrorMessage>{order.error.message}</ErrorMessage>
      </AdminPage>
    );
  }

  const o = order.data;

  function act(status: OrderStatus) {
    if (status === 'CANCELLED') {
      const reason = window.prompt(
        `Cancel ${o.orderNumber}? Stock will be returned${o.status === 'PAID' ? ' and the payment refunded (simulated)' : ''}.\n\nReason (optional):`,
      );
      if (reason === null) return;
      updateStatus.mutate({ status, reason: reason.trim() || undefined });
      return;
    }
    if (window.confirm(`${ACTION_LABEL[status]} for ${o.orderNumber}?`)) updateStatus.mutate({ status });
  }

  return (
    <AdminPage
      title={o.orderNumber}
      subtitle={
        <>
          <Link to="/admin/orders" className="hover:underline">
            ← Orders
          </Link>{' '}
          · Placed {formatDateTime(o.createdAt)}
        </>
      }
      actions={<StatusBadge status={o.status} />}
    >
      <section className="card mb-7.5 flex flex-wrap items-center gap-3 p-5" aria-label="Order actions">
        {o.adminActions.nextStatuses.length === 0 ? (
          <p className="text-body-sm text-primary-60">
            {o.status === 'PLACED'
              ? 'Waiting for the customer to pay. Payment outcomes are recorded by the payment flow.'
              : 'No further actions — this order is in a final state.'}
          </p>
        ) : (
          o.adminActions.nextStatuses.map((status) => (
            <button
              key={status}
              type="button"
              className={status === 'CANCELLED' ? 'btn-secondary' : 'btn-primary'}
              disabled={updateStatus.isPending}
              onClick={() => act(status)}
            >
              {updateStatus.isPending && updateStatus.variables?.status === status ? 'Saving…' : ACTION_LABEL[status]}
            </button>
          ))
        )}
        {o.status === 'PLACED' && o.adminActions.nextStatuses.length > 0 && (
          <p className="w-full text-caption text-primary-60">Awaiting customer payment. You can cancel it to release the reserved stock.</p>
        )}
        {updateStatus.isError && (
          <div className="w-full">
            <ErrorMessage>{updateStatus.error.message}</ErrorMessage>
          </div>
        )}
      </section>

      <div className="grid gap-7.5 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-7.5">
          <section aria-labelledby="items-h">
            <h2 id="items-h" className="mb-3 text-headline-sm uppercase">
              Items
            </h2>
            <ul className="card divide-y divide-tertiary p-0">
              {o.items.map((item) => (
                <li key={item.id} className="flex items-center gap-4 px-4 py-3">
                  <ProductImage src={item.imageUrl} alt="" className="size-12 shrink-0 rounded-md" />
                  <div className="flex-1 text-body-sm">
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-primary-60">
                      {formatPaise(item.unitPricePaise)} × {item.quantity}
                    </p>
                  </div>
                  <p className="text-label-md">{formatPaise(item.lineTotalPaise)}</p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="history-h">
            <h2 id="history-h" className="mb-3 text-headline-sm uppercase">
              History
            </h2>
            <ol className="card flex flex-col gap-3 p-5">
              {o.history.map((entry) => (
                <li key={entry.id} className="flex flex-wrap justify-between gap-2 text-body-sm">
                  <span>
                    <strong>{describe(entry.action, entry.metadata)}</strong>
                    <span className="text-primary-60">
                      {' '}
                      · {entry.actor ? `${entry.actor.name} (${entry.actor.role.toLowerCase()})` : 'system'}
                    </span>
                  </span>
                  <span className="text-caption text-primary-60">{formatDateTime(entry.createdAt)}</span>
                </li>
              ))}
            </ol>
          </section>

          {o.movements.length > 0 && (
            <section aria-labelledby="stock-h">
              <h2 id="stock-h" className="mb-3 text-headline-sm uppercase">
                Stock movements
              </h2>
              <ul className="card flex flex-col gap-2 p-5 text-body-sm">
                {o.movements.map((m) => (
                  <li key={m.id} className="flex flex-wrap justify-between gap-2">
                    <span>
                      {m.product.name}: <strong className={m.quantityChange < 0 ? 'text-error-strong' : ''}>{m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}</strong>{' '}
                      <span className="text-primary-60">({MOVEMENT_LABEL[m.reason]}, stock after {m.stockAfter})</span>
                    </span>
                    <span className="text-caption text-primary-60">{formatDateTime(m.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-5">
          <section className="card p-5">
            <h2 className="mb-2 text-label-lg uppercase">Customer</h2>
            <p className="text-body-sm font-semibold">{o.customer.name}</p>
            <p className="text-body-sm text-primary-60">{o.customer.email}</p>
          </section>
          <section className="card p-5">
            <h2 className="mb-2 text-label-lg uppercase">Payment</h2>
            <dl className="space-y-1 text-body-sm">
              <div className="flex justify-between">
                <dt>Status</dt>
                <dd className="font-semibold">{o.payment?.status ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Provider</dt>
                <dd>{o.payment?.provider ?? '—'}</dd>
              </div>
              {o.payment?.reference && <p className="break-all text-caption text-primary-60">Ref {o.payment.reference}</p>}
            </dl>
          </section>
          <section className="card p-5">
            <h2 className="mb-2 text-label-lg uppercase">Totals</h2>
            <dl className="space-y-1 text-body-sm">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd>{formatPaise(o.totals.subtotalPaise)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>GST</dt>
                <dd>{formatPaise(o.totals.taxPaise)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Shipping</dt>
                <dd>{o.totals.shippingPaise ? formatPaise(o.totals.shippingPaise) : 'Free'}</dd>
              </div>
              <div className="flex justify-between border-t border-tertiary pt-2 font-semibold">
                <dt>Total</dt>
                <dd>{formatPaise(o.totals.totalPaise)}</dd>
              </div>
            </dl>
          </section>
          <section className="card p-5">
            <h2 className="mb-2 text-label-lg uppercase">Ship to</h2>
            <AddressText address={o.address} />
          </section>
        </aside>
      </div>
    </AdminPage>
  );
}
