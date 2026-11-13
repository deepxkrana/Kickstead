export type Role = 'CUSTOMER' | 'ADMIN';

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}
