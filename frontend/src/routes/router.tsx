import { createBrowserRouter } from 'react-router';
import { StoreLayout } from '../layouts/StoreLayout';
import { AdminLayout } from '../layouts/AdminLayout';
import { RequireAuth } from '../features/auth/RequireAuth';
import { HomePage } from '../pages/HomePage';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { AuthCallbackPage } from '../pages/AuthCallbackPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { ProductsPage } from '../pages/ProductsPage';
import { ProductDetailPage } from '../pages/ProductDetailPage';
import { CartPage } from '../pages/CartPage';
import { CheckoutPage } from '../pages/CheckoutPage';
import { OrdersPage } from '../pages/OrdersPage';
import { OrderDetailPage } from '../pages/OrderDetailPage';
import { ProfilePage } from '../pages/ProfilePage';
import { AddressesPage } from '../pages/AddressesPage';

// Guards improve navigation only — the API enforces every authorization rule.
export const router = createBrowserRouter([
  {
    element: <StoreLayout />,
    children: [
      // Public
      { path: '/', element: <HomePage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/auth/callback', element: <AuthCallbackPage /> },
      { path: '/products', element: <ProductsPage /> },
      { path: '/products/:id', element: <ProductDetailPage /> },

      // Signed-in customers (admins may shop too)
      {
        element: <RequireAuth />,
        children: [
          { path: '/cart', element: <CartPage /> },
          { path: '/checkout', element: <CheckoutPage /> },
          { path: '/orders', element: <OrdersPage /> },
          { path: '/orders/:id', element: <OrderDetailPage /> },
          { path: '/profile', element: <ProfilePage /> },
          { path: '/addresses', element: <AddressesPage /> },
        ],
      },

      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: '/admin',
    element: <RequireAuth role="ADMIN" />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          // Admin pages are code-split: shoppers never download them.
          { index: true, lazy: async () => ({ Component: (await import('../pages/admin/AdminDashboardPage')).AdminDashboardPage }) },
          { path: 'products', lazy: async () => ({ Component: (await import('../pages/admin/AdminProductsPage')).AdminProductsPage }) },
          { path: 'products/new', lazy: async () => ({ Component: (await import('../pages/admin/AdminProductFormPage')).AdminProductFormPage }) },
          { path: 'products/:id/edit', lazy: async () => ({ Component: (await import('../pages/admin/AdminProductFormPage')).AdminProductFormPage }) },
          { path: 'categories', lazy: async () => ({ Component: (await import('../pages/admin/AdminCategoriesPage')).AdminCategoriesPage }) },
          { path: 'orders', lazy: async () => ({ Component: (await import('../pages/admin/AdminOrdersPage')).AdminOrdersPage }) },
          { path: 'orders/:id', lazy: async () => ({ Component: (await import('../pages/admin/AdminOrderDetailPage')).AdminOrderDetailPage }) },
          { path: 'customers', lazy: async () => ({ Component: (await import('../pages/admin/AdminCustomersPage')).AdminCustomersPage }) },
          { path: 'audit-logs', lazy: async () => ({ Component: (await import('../pages/admin/AdminAuditLogsPage')).AdminAuditLogsPage }) },
        ],
      },
    ],
  },
]);
