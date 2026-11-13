import { NavLink, Outlet, Link } from 'react-router';
import { useAuth } from '../features/auth/AuthProvider';

const adminNav = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/products', label: 'Products', end: false },
  { to: '/admin/orders', label: 'Orders', end: false },
  { to: '/admin/customers', label: 'Customers', end: false },
  { to: '/admin/audit-logs', label: 'Audit log', end: false },
];

export function AdminLayout() {
  const { state, signOut } = useAuth();

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="bg-primary text-secondary md:w-60 md:shrink-0">
        <div className="flex h-16 items-center px-5">
          <Link to="/admin" className="text-headline-sm uppercase">
            Kickstead <span className="text-label-sm text-error">Admin</span>
          </Link>
        </div>
        <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col">
          {adminNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-label-md whitespace-nowrap uppercase transition-colors ${
                  isActive ? 'bg-secondary text-primary' : 'hover:bg-primary-80'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <Link to="/" className="rounded-md px-3 py-2 text-label-sm whitespace-nowrap text-primary-20 uppercase hover:text-secondary md:mt-5">
            ← Back to store
          </Link>
        </nav>
        {state.status === 'signedIn' && (
          <div className="hidden border-t border-primary-80 px-5 py-4 md:block">
            <p className="truncate text-body-sm" title={state.user.email}>
              {state.user.name}
            </p>
            <button
              type="button"
              onClick={() => void signOut()}
              className="mt-1 text-label-sm text-primary-20 uppercase hover:text-secondary"
            >
              Sign out
            </button>
          </div>
        )}
      </aside>
      <main className="flex-1 bg-neutral">
        <Outlet />
      </main>
    </div>
  );
}
