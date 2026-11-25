import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orderApi } from '../api/orderApi';
import { Pagination } from '../components/Pagination';
import { ProductImage } from '../components/ProductImage';
import { LoadingState, MessageState } from '../components/StateViews';
import { StatusBadge } from '../components/StatusBadge';
import { CART_KEY } from '../features/cart/useCart';
import { DummyPaymentPanel } from '../features/orders/DummyPaymentPanel';
import type { Order, OrderSummary, PaymentOutcome } from '../features/orders/types';
import { formatDate } from '../lib/format';
import { formatPaise } from '../lib/money';

export function OrdersPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const queryClient = useQueryClient();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [activeOrder, setActiveOrder] = useState<OrderSummary | null>(null);
  const [banner, setBanner] = useState<{ order: Order; outcome: PaymentOutcome } | null>(null);

  const orders = useQuery({
    queryKey: ['orders', page],
    queryFn: () => orderApi.list(page),
    placeholderData: keepPreviousData,
  });

  const pay = useMutation({
    mutationFn: ({ id, outcome }: { id: string; outcome: PaymentOutcome }) => orderApi.pay(id, outcome),
    onSuccess: (updatedOrder, variables) => {
      queryClient.setQueryData(['order', updatedOrder.id], updatedOrder);
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: CART_KEY });
      setBanner({ order: updatedOrder, outcome: variables.outcome });
      dialogRef.current?.close();
    },
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (activeOrder && !dialog.open) {
      dialog.showModal();
    }
  }, [activeOrder]);

  function handleCloseDialog() {
    dialogRef.current?.close();
    setActiveOrder(null);
    pay.reset();
  }

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

      {banner && (
        <div className="mt-5" aria-live="polite">
          {banner.outcome === 'SUCCESS' && banner.order.status === 'PAID' ? (
            <p role="status" className="rounded-md border border-primary bg-neutral px-4 py-3 text-body-sm">
              <strong>Payment successful for {banner.order.orderNumber}.</strong> Your order is now paid and we&apos;ll start packing it.
            </p>
          ) : (
            <p role="status" className="rounded-md border border-error px-4 py-3 text-body-sm">
              <strong>
                {banner.outcome === 'FAILED' ? `Payment failed for ${banner.order.orderNumber}.` : `Payment cancelled for ${banner.order.orderNumber}.`}
              </strong>{' '}
              Nothing was charged and the items are back in stock.
            </p>
          )}
        </div>
      )}

      {orders.isFetching && orders.isPlaceholderData && <p className="mt-2 text-caption text-primary-60">Loading…</p>}
      <ul className="mt-7.5 flex flex-col gap-3">
        {orders.data.data.map((order) => (
          <li key={order.id} className="card flex flex-wrap items-center gap-4 transition-colors hover:border-primary">
            <Link
              to={`/orders/${order.id}`}
              className="flex min-w-0 flex-1 items-center gap-4 rounded-md focus-visible:outline-2 focus-visible:outline-primary"
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
            {order.status === 'PLACED' && (
              <button
                type="button"
                className="btn-primary shrink-0"
                onClick={() => {
                  pay.reset();
                  setActiveOrder(order);
                }}
              >
                Pay now
              </button>
            )}
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

      <dialog
        ref={dialogRef}
        aria-labelledby="orders-payment-title"
        onClose={() => {
          setActiveOrder(null);
          pay.reset();
        }}
        className="m-auto w-[min(100%-2rem,32rem)] rounded-lg border-2 border-primary bg-surface p-6 text-on-surface"
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h1 id="orders-payment-title" className="text-headline-sm uppercase">
            Complete payment
          </h1>
          <button type="button" className="btn-tertiary text-body-sm" onClick={handleCloseDialog}>
            Close
          </button>
        </div>
        {activeOrder && (
          <DummyPaymentPanel
            key={activeOrder.id}
            orderNumber={activeOrder.orderNumber}
            totalPaise={activeOrder.totalPaise}
            busy={pay.isPending}
            pendingOutcome={pay.variables?.outcome}
            error={pay.error}
            onPay={(outcome) => pay.mutate({ id: activeOrder.id, outcome })}
            onDismiss={handleCloseDialog}
          />
        )}
      </dialog>
    </section>
  );
}
