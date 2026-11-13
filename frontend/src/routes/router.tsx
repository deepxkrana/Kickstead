import { createBrowserRouter } from 'react-router';
import { StoreLayout } from '../layouts/StoreLayout';
import { AdminLayout } from '../layouts/AdminLayout';
import { RequireAuth } from '../features/auth/RequireAuth';
import { HomePage } from '../pages/HomePage';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { AuthCallbackPage } from '../pages/AuthCallbackPage';
import { NotFoundPage } from '../pages/NotFoundPage';
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
      { path: '/products', element: <PagePlaceholder title="Shop" phase="Phase 4" /> },
      { path: '/products/:id', element: <PagePlaceholder title="Product" phase="Phase 4" /> },

      // Signed-in customers (admins may shop too)
      {
        element: <RequireAuth />,
        children: [
          { path: '/cart', element: <PagePlaceholder title="Cart" phase="Phase 4" /> },
          { path: '/checkout', element: <PagePlaceholder title="Checkout" phase="Phase 5" /> },
          { path: '/orders', element: <PagePlaceholder title="Orders" phase="Phase 5" /> },
          { path: '/orders/:id', element: <PagePlaceholder title="Order" phase="Phase 5" /> },
          { path: '/profile', element: <PagePlaceholder title="Profile" phase="Phase 5" /> },
          { path: '/addresses', element: <PagePlaceholder title="Addresses" phase="Phase 5" /> },
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
