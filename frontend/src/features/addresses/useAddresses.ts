import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { accountApi } from '../../api/accountApi';
import type { AddressInput } from './types';

export const ADDRESSES_KEY = ['addresses'] as const;

export function useAddresses() {
  return useQuery({ queryKey: ADDRESSES_KEY, queryFn: accountApi.addresses });
}

function useAddressMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    // Default flags can change on other rows, so refetch the list from the server.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADDRESSES_KEY }),
  });
}

export const useCreateAddress = () => useAddressMutation((input: AddressInput) => accountApi.createAddress(input));
export const useUpdateAddress = () =>
  useAddressMutation(({ id, input }: { id: string; input: Partial<AddressInput> }) => accountApi.updateAddress(id, input));
export const useDeleteAddress = () => useAddressMutation((id: string) => accountApi.deleteAddress(id));
