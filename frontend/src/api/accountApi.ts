import { api } from './client';
import type { Address, AddressInput } from '../features/addresses/types';
import type { CurrentUser } from '../features/auth/types';

export const accountApi = {
  addresses: () => api.get<{ data: Address[] }>('/addresses').then((res) => res.data),
  createAddress: (input: AddressInput) => api.post<{ data: Address }>('/addresses', input).then((res) => res.data),
  updateAddress: (id: string, input: Partial<AddressInput>) =>
    api.patch<{ data: Address }>(`/addresses/${id}`, input).then((res) => res.data),
  deleteAddress: (id: string) => api.delete<void>(`/addresses/${id}`),
  updateProfile: (name: string) => api.patch<{ data: CurrentUser }>('/profile', { name }).then((res) => res.data),
};
