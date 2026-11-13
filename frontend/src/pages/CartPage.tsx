import { Link } from 'react-router';
import { ProductImage } from '../components/ProductImage';
import { QuantitySelect } from '../components/QuantitySelect';
import { ErrorMessage, LoadingState, MessageState } from '../components/StateViews';
import type { CartItem, CartItemIssue } from '../features/cart/types';
import { useCart, useClearCart, useRemoveCartItem, useUpdateCartItem } from '../features/cart/useCart';
import { formatPaise } from '../lib/money';

const ISSUE_TEXT: Record<CartItemIssue, string> = {
  UNAVAILABLE: 'No longer available. Remove it to continue.',
  OUT_OF_STOCK: 'Sold out. Remove it to continue.',
  INSUFFICIENT_STOCK: 'Not enough stock for this quantity. Lower it to continue.',
};

function CartLine({ item, busy }: { item: CartItem; busy: boolean }) {
  const update = useUpdateCartItem();
  const remove = useRemoveCartItem();
  const pending = busy || update.isPending || remove.isPending;
  const error = update.error ?? remove.error;

  return (
    <li className="flex gap-4 py-5">
      <Link to={`/products/${item.product.slug}`} className="shrink-0">
        <ProductImage src={item.product.imageUrl} alt={item.product.name} className="size-24 rounded-md sm:size-28" />
      </Link>
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-label-sm text-primary-60 uppercase">{item.product.brand}</p>
            <Link to={`/products/${item.product.slug}`} className="text-body-md font-semibold hover:underline">
              {item.product.name}
            </Link>
            <p className="text-body-sm text-primary-60">{formatPaise(item.product.pricePaise)} each</p>
          </div>
          <p className="text-label-lg">{formatPaise(item.lineTotalPaise)}</p>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          {item.product.isAvailable && (
            <QuantitySelect
              id={`qty-${item.id}`}
              label={`Quantity for ${item.product.name}`}
              hideLabel
              value={item.quantity}
              max={item.product.stockQuantity}
              disabled={pending}
              onChange={(quantity) => update.mutate({ itemId: item.id, quantity })}
            />
          )}
          <button
            type="button"
            className="btn-tertiary h-10 text-body-sm"
            disabled={pending}
            onClick={() => remove.mutate(item.id)}
          >
            {remove.isPending ? 'Removing…' : 'Remove'}
          </button>
        </div>

        {item.issue && <p className="text-body-sm font-semibold text-error-strong">{ISSUE_TEXT[item.issue]}</p>}
        {error && <ErrorMessage>{error.message}</ErrorMessage>}
      </div>
    </li>
  );
}

export function CartPage() {
  const cart = useCart();
  const clear = useClearCart();

  if (cart.isPending) return <LoadingState label="Loading your cart…" />;

  if (cart.isError) {
    return (
      <MessageState
        eyebrow="Error"
        title="Could not load your cart"
        message={cart.error.message}
        actions={
          <button type="button" className="btn-primary" onClick={() => void cart.refetch()}>
            Try again
          </button>
        }
      />
    );
  }

  const { items, totals, canCheckout, itemCount } = cart.data;

  if (items.length === 0) {
    return (
      <MessageState
        title="Your cart is empty"
        message="Find something you like and add it to your cart."
        actions={
          <Link to="/products" className="btn-primary">
            Start shopping
          </Link>
        }
      />
    );
  }

  function handleClear() {
    if (window.confirm('Remove all items from your cart?')) clear.mutate();
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-9.5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-headline-lg uppercase">
          Cart <span className="text-primary-40">({itemCount})</span>
        </h1>
        <button type="button" className="btn-tertiary text-body-sm" onClick={handleClear} disabled={clear.isPending}>
          {clear.isPending ? 'Clearing…' : 'Clear cart'}
        </button>
      </div>
      {clear.isError && (
        <div className="mt-4">
          <ErrorMessage>{clear.error.message}</ErrorMessage>
        </div>
      )}

      <div className="mt-5 grid gap-9.5 lg:grid-cols-[1fr_360px]">
        <ul className="divide-y divide-tertiary border-y border-tertiary">
          {items.map((item) => (
            <CartLine key={item.id} item={item} busy={clear.isPending} />
          ))}
        </ul>

        <aside className="card h-fit p-5" aria-labelledby="summary-heading">
          <h2 id="summary-heading" className="text-headline-sm uppercase">
            Order summary
          </h2>
          <dl className="mt-4 space-y-2 text-body-sm">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{formatPaise(totals.subtotalPaise)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>GST (18%)</dt>
              <dd>{formatPaise(totals.taxPaise)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Shipping</dt>
              <dd>{totals.shippingPaise === 0 ? 'Free' : formatPaise(totals.shippingPaise)}</dd>
            </div>
            <div className="flex justify-between border-t border-tertiary pt-3 text-label-lg">
              <dt>Total</dt>
              <dd>{formatPaise(totals.totalPaise)}</dd>
            </div>
          </dl>
          {totals.shippingPaise > 0 && (
            <p className="mt-3 text-caption text-primary-60">Free shipping on orders above ₹2,999.</p>
          )}
          {canCheckout ? (
            <Link to="/checkout" className="btn-primary mt-5 w-full">
              Checkout
            </Link>
          ) : (
            <button type="button" className="btn-primary mt-5 w-full" disabled>
              Checkout
            </button>
          )}
          {!canCheckout && (
            <p className="mt-2 text-caption text-error-strong">Fix the highlighted items to continue.</p>
          )}
          <p className="mt-3 text-caption text-primary-60">Final amount is confirmed at checkout.</p>
        </aside>
      </div>
    </section>
  );
}
