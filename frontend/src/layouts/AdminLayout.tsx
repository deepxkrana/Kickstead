import { NavLink, Outlet, Link } from 'react-router';

const adminNav = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/products', label: 'Products', end: false },
  { to: '/admin/orders', label: 'Orders', end: false },
  { to: '/admin/customers', label: 'Customers', end: false },
  { to: '/admin/audit-logs', label: 'Audit log', end: false },
];

export function AdminLayout() {
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
          <Link to="/" className="mt-auto rounded-md px-3 py-2 text-label-sm text-primary-20 uppercase hover:text-secondary">
            ← Back to store
          </Link>
        </nav>
      </aside>
      <main className="flex-1 bg-neutral">
        <Outlet />
      </main>
    </div>
  );
}
