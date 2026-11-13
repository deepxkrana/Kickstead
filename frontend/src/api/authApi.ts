import { api } from './client';
import type { CurrentUser } from '../features/auth/types';

export const authApi = {
  me: () => api.get<{ data: CurrentUser }>('/auth/me').then((res) => res.data),
};
