import { NavLink, Outlet, Link } from 'react-router';

const navItems = [
  { to: '/products', label: 'Shop' },
  { to: '/orders', label: 'Orders' },
  { to: '/cart', label: 'Cart' },
];

function navClass({ isActive }: { isActive: boolean }) {
  return `text-label-md uppercase transition-colors hover:text-primary-20 ${
    isActive ? 'underline decoration-error decoration-2 underline-offset-8' : ''
  }`;
}

export function StoreLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-primary text-secondary">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-5 px-4">
          <Link to="/" className="text-headline-sm tracking-tight uppercase">
            Kickstead
          </Link>
          <nav aria-label="Main" className="flex items-center gap-5">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={navClass}>
                {item.label}
              </NavLink>
            ))}
            <NavLink to="/login" className={navClass}>
              Sign in
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-tertiary">
        <div className="mx-auto max-w-6xl px-4 py-7.5 text-caption text-primary-60">
          © {new Date().getFullYear()} Kickstead. Demo store — payments are simulated.
        </div>
      </footer>
    </div>
  );
}
