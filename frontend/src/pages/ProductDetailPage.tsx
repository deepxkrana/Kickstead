import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { catalogApi } from '../api/catalogApi';
import { ApiError } from '../api/client';
import { ProductImage } from '../components/ProductImage';
import { QuantitySelect } from '../components/QuantitySelect';
import { ErrorMessage, LoadingState, MessageState } from '../components/StateViews';
import { StockBadge } from '../components/StockBadge';
import { useAuth } from '../features/auth/AuthProvider';
import { useAddToCart, useCart } from '../features/cart/useCart';
import { formatPaise } from '../lib/money';

export function ProductDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = useAuth();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const product = useQuery({ queryKey: ['product', id], queryFn: () => catalogApi.product(id) });
  const cart = useCart();
  const addToCart = useAddToCart();

  if (product.isPending) return <LoadingState label="Loading product…" />;

  if (product.isError) {
    const notFound = product.error instanceof ApiError && product.error.status === 404;
    return (
      <MessageState
        eyebrow={notFound ? '404' : 'Error'}
        title={notFound ? 'Product not found' : 'Could not load product'}
        message={notFound ? 'This product does not exist or is no longer available.' : product.error.message}
        actions={
          <>
            {!notFound && (
              <button type="button" className="btn-primary" onClick={() => void product.refetch()}>
                Try again
              </button>
            )}
            <Link to="/products" className="btn-secondary">
              Back to shop
            </Link>
          </>
        }
      />
    );
  }

  const p = product.data;
  const inCart = cart.data?.items.find((item) => item.product.id === p.id)?.quantity ?? 0;
  const soldOut = p.stockStatus === 'OUT_OF_STOCK';
  const remaining = Math.max(0, p.stockQuantity - inCart);

  function handleAdd() {
    if (state.status !== 'signedIn') {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    setAdded(false);
    addToCart.mutate(
      { productId: p.id, quantity },
      {
        onSuccess: () => {
          setAdded(true);
          setQuantity(1);
        },
      },
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-9.5">
      <nav aria-label="Breadcrumb" className="text-body-sm text-primary-60">
        <Link to="/products" className="hover:underline">
          Shop
        </Link>{' '}
        /{' '}
        <Link to={`/products?category=${p.category.slug}`} className="hover:underline">
          {p.category.name}
        </Link>
      </nav>

      <div className="mt-5 grid gap-9.5 md:grid-cols-2">
        <ProductImage src={p.imageUrl} alt={p.name} className="aspect-square w-full rounded-lg" />

        <div className="flex flex-col gap-5">
          <div>
            <p className="text-label-md text-primary-60 uppercase">{p.brand}</p>
            <h1 className="mt-1 text-headline-lg uppercase">{p.name}</h1>
            <p className="mt-4 text-headline-md">{formatPaise(p.pricePaise)}</p>
            <p className="text-caption text-primary-60">Excludes GST. 18% GST is added at checkout.</p>
          </div>

          <div>
            <StockBadge status={p.stockStatus} quantity={p.stockQuantity} />
          </div>

          <p className="text-body-md text-primary-80">{p.description}</p>

          {!soldOut && (
            <div className="flex flex-wrap items-end gap-4">
              <QuantitySelect
                id="quantity"
                value={quantity}
                max={Math.max(1, remaining)}
                onChange={setQuantity}
                disabled={addToCart.isPending || remaining === 0}
              />
              <button
                type="button"
                className="btn-primary min-w-48"
                onClick={handleAdd}
                disabled={addToCart.isPending || remaining === 0}
              >
                {addToCart.isPending ? 'Adding…' : state.status === 'signedIn' ? 'Add to cart' : 'Sign in to buy'}
              </button>
            </div>
          )}

          {inCart > 0 && (
            <p className="text-body-sm text-primary-60">
              {inCart} in your cart{remaining === 0 ? ' — that is all the stock we have.' : '.'}
            </p>
          )}

          <div aria-live="polite">
            {added && (
              <p className="flex flex-wrap items-center gap-3 rounded-md border border-primary bg-neutral px-3 py-2 text-body-sm">
                Added to your cart.
                <Link to="/cart" className="btn-tertiary text-body-sm font-semibold">
                  View cart →
                </Link>
              </p>
            )}
            {addToCart.isError && <ErrorMessage>{addToCart.error.message}</ErrorMessage>}
          </div>
        </div>
      </div>
    </section>
  );
}
