import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';
import { orderApi } from '../api/orderApi';
import { ErrorMessage, LoadingState, MessageState } from '../components/StateViews';
import { AddressForm } from '../features/addresses/AddressForm';
import { AddressText } from '../features/addresses/AddressText';
import type { AddressInput } from '../features/addresses/types';
import { useAddresses, useCreateAddress } from '../features/addresses/useAddresses';
import { CART_KEY, useCart } from '../features/cart/useCart';
import { formatPaise } from '../lib/money';

function CheckoutError({ error }: { error: Error }) {
  if (error instanceof ApiError && error.code === 'PENDING_ORDER_EXISTS') {
    const orderId = error.details.orderId as string | null;
    return (
      <ErrorMessage>
        {error.message}{' '}
        {orderId && (
          <Link to={`/orders/${orderId}`} className="font-semibold underline">
            Go to that order
          </Link>
        )}
      </ErrorMessage>
    );
  }
  if (error instanceof ApiError && error.code === 'INSUFFICIENT_STOCK') {
    const items = (error.details.items as { name: string; available: number; requested: number }[] | undefined) ?? [];
    return (
      <ErrorMessage>
        {error.message}
        {items.length > 0 && (
          <ul className="mt-1 list-inside list-disc">
            {items.map((item) => (
              <li key={item.name}>
                {item.name}: {item.available} available, {item.requested} requested
              </li>
            ))}
          </ul>
        )}{' '}
        <Link to="/cart" className="font-semibold underline">
          Update your cart
        </Link>
      </ErrorMessage>
    );
  }
  return <ErrorMessage>{error.message}</ErrorMessage>;
}

export function CheckoutPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cart = useCart();
  const addresses = useAddresses();
  const createAddress = useCreateAddress();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [oneTimeAddress, setOneTimeAddress] = useState<AddressInput | null>(null);
  const [addingAddress, setAddingAddress] = useState(false);
  const [cancelledEmptyForm, setCancelledEmptyForm] = useState(false);

  // One key per checkout attempt. Retrying after a network error reuses it, so the server
  // returns the original order instead of creating a second one.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (selectedId || oneTimeAddress || !addresses.data?.length) return;
    setSelectedId((addresses.data.find((a) => a.isDefault) ?? addresses.data[0])!.id);
  }, [addresses.data, selectedId, oneTimeAddress]);

  const placeOrder = useMutation({
    mutationFn: () => {
      if (selectedId) {
        return orderApi.checkout({ addressId: selectedId, idempotencyKey });
      }
      const { isDefault: _ignored, ...address } = oneTimeAddress!;
      return orderApi.checkout({ address, idempotencyKey });
    },
    onSuccess: (order) => {
      queryClient.setQueryData(['order', order.id], order);
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      navigate(`/orders/${order.id}`, { replace: true, state: { justPlaced: true } });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'INSUFFICIENT_STOCK') {
        void queryClient.invalidateQueries({ queryKey: CART_KEY });
      }
    },
  });

  if (cart.isPending || addresses.isPending) return <LoadingState label="Preparing checkout…" />;

  if (cart.isError || addresses.isError) {
    return (
      <MessageState
        eyebrow="Error"
        title="Could not load checkout"
        message={(cart.error ?? addresses.error)!.message}
        actions={
          <Link to="/cart" className="btn-primary">
            Back to cart
          </Link>
        }
      />
    );
  }

  if (cart.data.items.length === 0) {
    return (
      <MessageState
        title="Your cart is empty"
        message="Add something to your cart before checking out."
        actions={
          <Link to="/products" className="btn-primary">
            Shop now
          </Link>
        }
      />
    );
  }

  if (!cart.data.canCheckout) {
    return (
      <MessageState
        eyebrow="Action needed"
        title="Some items need attention"
        message="One or more items are unavailable or exceed the stock we have. Update your cart to continue."
        actions={
          <Link to="/cart" className="btn-primary">
            Review cart
          </Link>
        }
      />
    );
  }

  const { items, totals } = cart.data;
  const showForm = addingAddress || (addresses.data.length === 0 && !oneTimeAddress && !cancelledEmptyForm);
  const hasSelectedAddress = Boolean(selectedId || oneTimeAddress);

  return (
    <section className="mx-auto max-w-6xl px-4 py-9.5">
      <h1 className="text-headline-lg uppercase">Checkout</h1>

      <div className="mt-7.5 grid gap-9.5 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-5">
          <fieldset className="flex flex-col gap-4">
            <legend className="mb-4 text-headline-sm uppercase">1. Delivery address</legend>

            {(addresses.data.length > 0 || oneTimeAddress) && (
              <div className="grid gap-3 sm:grid-cols-2">
                {addresses.data.map((address) => (
                  <label
                    key={address.id}
                    className={`card flex cursor-pointer gap-3 transition-colors ${
                      selectedId === address.id ? 'border-primary ring-1 ring-primary' : 'hover:border-primary-40'
                    }`}
                  >
                    <input
                      type="radio"
                      name="address"
                      className="mt-1 size-4 accent-primary"
                      checked={selectedId === address.id}
                      onChange={() => {
                        setSelectedId(address.id);
                        setOneTimeAddress(null);
                      }}
                    />
                    <AddressText address={address} />
                  </label>
                ))}
                {oneTimeAddress && (
                  <label
                    className={`card flex cursor-pointer gap-3 transition-colors ${
                      !selectedId ? 'border-primary ring-1 ring-primary' : 'hover:border-primary-40'
                    }`}
                  >
                    <input
                      type="radio"
                      name="address"
                      className="mt-1 size-4 accent-primary"
                      checked={!selectedId}
                      onChange={() => setSelectedId(null)}
                    />
                    <div className="flex flex-col gap-1">
                      <span className="chip w-fit">This order only</span>
                      <AddressText address={{ ...oneTimeAddress, line2: oneTimeAddress.line2 ?? null }} />
                    </div>
                  </label>
                )}
              </div>
            )}

            {showForm ? (
              <div className="card p-5">
                <h2 className="mb-4 text-label-lg uppercase">New address</h2>
                <AddressForm
                  initial={oneTimeAddress ?? undefined}
                  submitLabel="Save and use this address"
                  pending={createAddress.isPending}
                  error={createAddress.error}
                  onSubmit={(input) =>
                    createAddress.mutate(input, {
                      onSuccess: (address) => {
                        setSelectedId(address.id);
                        setOneTimeAddress(null);
                        setAddingAddress(false);
                        setCancelledEmptyForm(false);
                      },
                    })
                  }
                  secondaryAction={{
                    label: 'Use this address',
                    onClick: (input) => {
                      setOneTimeAddress(input);
                      setSelectedId(null);
                      setAddingAddress(false);
                      setCancelledEmptyForm(false);
                    },
                  }}
                  onCancel={() => {
                    setAddingAddress(false);
                    if (addresses.data.length === 0 && !oneTimeAddress) {
                      setCancelledEmptyForm(true);
                    }
                  }}
                />
              </div>
            ) : (
              <button
                type="button"
                className="btn-tertiary self-start text-body-sm"
                onClick={() => {
                  setCancelledEmptyForm(false);
                  setAddingAddress(true);
                }}
              >
                + Add a new address
              </button>
            )}
          </fieldset>

          <section aria-labelledby="items-heading">
            <h2 id="items-heading" className="mb-4 text-headline-sm uppercase">
              2. Review items
            </h2>
            <ul className="divide-y divide-tertiary border-y border-tertiary">
              {items.map((item) => (
                <li key={item.id} className="flex justify-between gap-4 py-3 text-body-sm">
                  <span>
                    {item.product.brand} {item.product.name} <span className="text-primary-60">× {item.quantity}</span>
                  </span>
                  <span className="font-semibold">{formatPaise(item.lineTotalPaise)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="card h-fit p-5" aria-labelledby="pay-heading">
          <h2 id="pay-heading" className="text-headline-sm uppercase">
            3. Place order
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
          <p className="mt-3 text-caption text-primary-60">
            Placing the order reserves your items. You'll complete a simulated payment on the next screen.
          </p>
          <button
            type="button"
            className="btn-primary mt-5 w-full"
            disabled={!hasSelectedAddress || placeOrder.isPending || showForm}
            onClick={() => placeOrder.mutate()}
          >
            {placeOrder.isPending ? 'Placing order…' : 'Place order'}
          </button>
          {showForm && <p className="mt-2 text-caption text-primary-60">Choose an address option above first.</p>}
          {placeOrder.isError && (
            <div className="mt-4">
              <CheckoutError error={placeOrder.error} />
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
