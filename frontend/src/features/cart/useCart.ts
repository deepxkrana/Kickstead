import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cartApi } from '../../api/cartApi';
import { useAuth } from '../auth/AuthProvider';
import type { Cart } from './types';

export const CART_KEY = ['cart'] as const;

/** The server cart. Loaded only when signed in; the server is always the source of truth. */
export function useCart() {
  const { state } = useAuth();
  return useQuery({
    queryKey: CART_KEY,
    queryFn: cartApi.get,
    enabled: state.status === 'signedIn',
  });
}

/** Every cart mutation returns the full recalculated cart, which replaces the cached one. */
function useCartMutation<TVars>(fn: (vars: TVars) => Promise<Cart>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (cart) => queryClient.setQueryData(CART_KEY, cart),
    // On a stock conflict the cached cart may be stale; refetch the truth.
    onError: () => void queryClient.invalidateQueries({ queryKey: CART_KEY }),
  });
}

export const useAddToCart = () =>
  useCartMutation(({ productId, quantity }: { productId: string; quantity: number }) =>
    cartApi.add(productId, quantity),
  );

export const useUpdateCartItem = () =>
  useCartMutation(({ itemId, quantity }: { itemId: string; quantity: number }) => cartApi.update(itemId, quantity));

export const useRemoveCartItem = () => useCartMutation((itemId: string) => cartApi.remove(itemId));

export const useClearCart = () => useCartMutation(() => cartApi.clear());
