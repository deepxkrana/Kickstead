import { NavLink, Outlet, Link } from 'react-router';
import { useAuth } from '../features/auth/AuthProvider';
import { useCart } from '../features/cart/useCart';

const navItems = [
  { to: '/products', label: 'Shop' },
  { to: '/orders', label: 'Orders' },
];

function CartLink() {
  const cart = useCart();
  const count = cart.data?.itemCount ?? 0;
  return (
    <NavLink to="/cart" className={navClass} aria-label={count ? `Cart, ${count} items` : 'Cart'}>
      Cart
      {count > 0 && (
        <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-error-strong px-1.5 text-label-sm text-secondary no-underline">
          {count}
        </span>
      )}
    </NavLink>
  );
}

function navClass({ isActive }: { isActive: boolean }) {
  return `text-label-sm sm:text-label-md uppercase whitespace-nowrap transition-colors hover:text-primary-20 ${
    isActive ? 'underline decoration-error decoration-2 underline-offset-8' : ''
  }`;
}

function AccountNav() {
  const { state, signOut } = useAuth();

  if (state.status === 'loading') {
    return <span className="text-label-sm text-primary-40 uppercase" aria-hidden>…</span>;
  }

  if (state.status !== 'signedIn') {
    return (
      <NavLink to="/login" className={navClass}>
        Sign in
      </NavLink>
    );
  }

  return (
    <>
      {state.user.role === 'ADMIN' && (
        <NavLink to="/admin" className={({ isActive }) => `${navClass({ isActive })} text-error`}>
          Admin
        </NavLink>
      )}
      <NavLink to="/profile" className={navClass} title={state.user.email}>
        <span className="hidden sm:inline">{state.user.name.split(' ')[0]}</span>
        <span className="sm:hidden">Account</span>
      </NavLink>
      <button
        type="button"
        onClick={() => void signOut()}
        className="text-label-sm whitespace-nowrap text-primary-20 uppercase transition-colors hover:text-secondary"
      >
        Sign out
      </button>
    </>
  );
}

export function StoreLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="bg-primary text-secondary">
        <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-x-5 gap-y-2 px-4 py-3">
          <Link to="/" className="text-headline-sm tracking-tight uppercase">
            Kickstead
          </Link>
          <nav aria-label="Main" className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:gap-x-5">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={navClass}>
                {item.label}
              </NavLink>
            ))}
            <CartLink />
            <AccountNav />
          </nav>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="flex-1">
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
