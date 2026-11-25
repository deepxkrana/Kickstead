import { Link, useLocation, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';
import { orderApi } from '../api/orderApi';
import { ProductImage } from '../components/ProductImage';
import { ErrorMessage, LoadingState, MessageState } from '../components/StateViews';
import { StatusBadge } from '../components/StatusBadge';
import { AddressText } from '../features/addresses/AddressText';
import { CART_KEY } from '../features/cart/useCart';
import { DummyPaymentPanel } from '../features/orders/DummyPaymentPanel';
import type { Order, PaymentOutcome } from '../features/orders/types';
import { formatDateTime } from '../lib/format';
import { formatPaise } from '../lib/money';

const PAYMENT_LABEL: Record<NonNullable<Order['payment']>['status'], string> = {
  PENDING: 'Pending',
  SUCCEEDED: 'Succeeded',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded (simulated)',
};

function useOrderMutation<TVars>(orderId: string, fn: (vars: TVars) => Promise<Order>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (order) => {
      queryClient.setQueryData(['order', orderId], order);
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: CART_KEY });
    },
    // The order may have changed elsewhere (e.g. an admin action): reload the truth.
    onError: () => void queryClient.invalidateQueries({ queryKey: ['order', orderId] }),
  });
}

function ResultBanner({ order, lastOutcome }: { order: Order; lastOutcome?: PaymentOutcome }) {
  if (!lastOutcome) return null;
  if (order.status === 'PAID') {
    return (
      <p role="status" className="rounded-md border border-primary bg-neutral px-4 py-3 text-body-sm">
        <strong>Payment successful.</strong> Thanks! We'll start packing your order.
      </p>
    );
  }
  if (order.status === 'PAYMENT_FAILED' || order.status === 'PAYMENT_CANCELLED') {
    return (
      <p role="status" className="rounded-md border border-error px-4 py-3 text-body-sm">
        <strong>{order.status === 'PAYMENT_FAILED' ? 'Payment failed.' : 'Payment cancelled.'}</strong> Nothing was
        charged and the items are back in stock. They're still in your{' '}
        <Link to="/cart" className="font-semibold underline">
          cart
        </Link>{' '}
        if you want to try again.
      </p>
    );
  }
  return null;
}

export function OrderDetailPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const justPlaced = Boolean((location.state as { justPlaced?: boolean } | null)?.justPlaced);

  const order = useQuery({ queryKey: ['order', id], queryFn: () => orderApi.get(id) });
  const pay = useOrderMutation(id, (outcome: PaymentOutcome) => orderApi.pay(id, outcome));
  const cancel = useOrderMutation(id, () => orderApi.cancel(id));

  if (order.isPending) return <LoadingState label="Loading order…" />;

  if (order.isError) {
    const notFound = order.error instanceof ApiError && order.error.status === 404;
    return (
      <MessageState
        eyebrow={notFound ? '404' : 'Error'}
        title={notFound ? 'Order not found' : 'Could not load order'}
        message={notFound ? 'This order does not exist or belongs to another account.' : order.error.message}
        actions={
          <Link to="/orders" className="btn-primary">
            Your orders
          </Link>
        }
      />
    );
  }

  const o = order.data;
  const busy = pay.isPending || cancel.isPending;

  function handleCancel() {
    const message =
      o.status === 'PAID'
        ? 'Cancel this order? Your simulated payment will be refunded.'
        : 'Cancel this order? The items will be released.';
    if (window.confirm(message)) cancel.mutate(undefined);
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-9.5">
      <p className="text-body-sm text-primary-60">
        <Link to="/orders" className="hover:underline">
          Orders
        </Link>{' '}
        / {o.orderNumber}
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-headline-lg uppercase">{o.orderNumber}</h1>
        <StatusBadge status={o.status} />
      </div>
      <p className="mt-1 text-caption text-primary-60">Placed {formatDateTime(o.createdAt)}</p>

      <div className="mt-5 flex flex-col gap-3" aria-live="polite">
        {justPlaced && o.status === 'PLACED' && !pay.data && (
          <p className="rounded-md border border-primary bg-neutral px-4 py-3 text-body-sm">
            <strong>Order placed.</strong> Your items are reserved. Complete the payment below.
          </p>
        )}
        <ResultBanner order={o} lastOutcome={pay.variables} />
        {o.status === 'CANCELLED' && (
          <p className="rounded-md border border-tertiary bg-neutral px-4 py-3 text-body-sm">
            Cancelled{o.cancelledAt ? ` on ${formatDateTime(o.cancelledAt)}` : ''}
            {o.cancelReason ? ` — ${o.cancelReason}` : ''}.
          </p>
        )}
        {(pay.error ?? cancel.error) && <ErrorMessage>{(pay.error ?? cancel.error)!.message}</ErrorMessage>}
      </div>

      <div className="mt-7.5 grid gap-9.5 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-7.5">
          {o.actions.canPay && (
            <section className="rounded-lg border-2 border-primary p-5" aria-labelledby="payment-heading">
              <h2 id="payment-heading" className="mb-3 text-headline-sm uppercase">
                Payment
              </h2>
              <DummyPaymentPanel
                orderNumber={o.orderNumber}
                totalPaise={o.totals.totalPaise}
                busy={busy}
                pendingOutcome={pay.variables}
                error={null}
                onPay={(outcome) => pay.mutate(outcome)}
              />
            </section>
          )}

          <section aria-labelledby="items-heading">
            <h2 id="items-heading" className="mb-4 text-headline-sm uppercase">
              Items
            </h2>
            <ul className="divide-y divide-tertiary border-y border-tertiary">
              {o.items.map((item) => (
                <li key={item.id} className="flex items-center gap-4 py-4">
                  <ProductImage src={item.imageUrl} alt="" className="size-16 shrink-0 rounded-md" />
                  <div className="flex-1">
                    {item.productSlug ? (
                      <Link to={`/products/${item.productSlug}`} className="text-body-md font-semibold hover:underline">
                        {item.name}
                      </Link>
                    ) : (
                      <p className="text-body-md font-semibold">{item.name}</p>
                    )}
                    <p className="text-caption text-primary-60">
                      {formatPaise(item.unitPricePaise)} × {item.quantity}
                    </p>
                  </div>
                  <p className="text-label-lg">{formatPaise(item.lineTotalPaise)}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="flex flex-col gap-5">
          <section className="card p-5" aria-labelledby="totals-heading">
            <h2 id="totals-heading" className="text-label-lg uppercase">
              Summary
            </h2>
            <dl className="mt-3 space-y-2 text-body-sm">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd>{formatPaise(o.totals.subtotalPaise)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>GST (18%)</dt>
                <dd>{formatPaise(o.totals.taxPaise)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Shipping</dt>
                <dd>{o.totals.shippingPaise === 0 ? 'Free' : formatPaise(o.totals.shippingPaise)}</dd>
              </div>
              <div className="flex justify-between border-t border-tertiary pt-3 text-label-lg">
                <dt>Total</dt>
                <dd>{formatPaise(o.totals.totalPaise)}</dd>
              </div>
            </dl>
            {o.payment && (
              <p className="mt-4 text-caption text-primary-60">
                Payment: {PAYMENT_LABEL[o.payment.status]}
                {o.payment.reference ? ` · Ref ${o.payment.reference.slice(0, 12)}…` : ''}
              </p>
            )}
          </section>

          <section className="card p-5" aria-labelledby="address-heading">
            <h2 id="address-heading" className="mb-3 text-label-lg uppercase">
              Delivery address
            </h2>
            <AddressText address={o.address} />
          </section>

          {o.actions.canCancel && (
            <button type="button" className="btn-secondary w-full" disabled={busy} onClick={handleCancel}>
              {cancel.isPending ? 'Cancelling…' : 'Cancel order'}
            </button>
          )}
        </aside>
      </div>
    </section>
  );
}
