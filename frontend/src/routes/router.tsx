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
import { PagePlaceholder } from '../components/PagePlaceholder';

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
          { index: true, element: <PagePlaceholder title="Dashboard" phase="Phase 6" /> },
          { path: 'products', element: <PagePlaceholder title="Products" phase="Phase 6" /> },
          { path: 'products/new', element: <PagePlaceholder title="New product" phase="Phase 6" /> },
          { path: 'products/:id/edit', element: <PagePlaceholder title="Edit product" phase="Phase 6" /> },
          { path: 'orders', element: <PagePlaceholder title="Orders" phase="Phase 6" /> },
          { path: 'orders/:id', element: <PagePlaceholder title="Order" phase="Phase 6" /> },
          { path: 'customers', element: <PagePlaceholder title="Customers" phase="Phase 6" /> },
          { path: 'audit-logs', element: <PagePlaceholder title="Audit log" phase="Phase 6" /> },
        ],
      },
    ],
  },
]);
