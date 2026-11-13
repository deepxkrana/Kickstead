import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../features/auth/AuthProvider';
import { GoogleButton } from '../features/auth/GoogleButton';
import { defaultPathFor } from '../features/auth/returnTo';
import { ErrorMessage, LoadingState } from '../components/StateViews';

// Dummy demo accounts, published in the README for reviewers.
const DEMO_ACCOUNTS = [
  { label: 'Demo customer', email: 'customer@kickstead.dev' },
  { label: 'Demo admin', email: 'admin@kickstead.dev' },
] as const;
const DEMO_PASSWORD = 'Kickstead@Demo1';

export function LoginPage() {
  const { state, signInWithPassword, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state.status === 'signedIn') {
      navigate(from ?? defaultPathFor(state.user.role), { replace: true });
    }
  }, [state, from, navigate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signInWithPassword(email.trim(), password);
      // Navigation happens in the effect once /api/auth/me has loaded the role.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  }

  if (state.status === 'signedIn') return <LoadingState label="Signing you in…" />;

  const busy = submitting || state.status === 'loading';

  return (
    <section className="mx-auto grid max-w-5xl gap-12.5 px-4 py-12.5 md:grid-cols-2">
      <div className="flex flex-col gap-5">
        <div>
          <p className="text-label-sm text-error uppercase">Welcome back</p>
          <h1 className="mt-2 text-headline-lg uppercase">Sign in</h1>
          <p className="mt-2 text-body-md text-primary-60">
            Use your Google account. New here? Signing in with Google creates your account.
          </p>
        </div>
        <GoogleButton returnTo={from} />
        <p className="text-body-sm text-primary-60">
          No account yet? <Link to="/register" className="btn-tertiary text-body-sm">How sign-up works</Link>
        </p>
        {state.status === 'error' && (
          <ErrorMessage>
            {state.error.message}{' '}
            <button type="button" className="underline" onClick={() => void signOut()}>
              Sign out
            </button>
          </ErrorMessage>
        )}
      </div>

      <div className="card flex flex-col gap-5 border-primary-20 bg-neutral p-7.5">
        <div>
          <h2 className="text-headline-sm uppercase">Demo login</h2>
          <p className="mt-1 text-body-sm text-primary-60">
            For reviewers. Pick an account to fill the form, then sign in.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              className="chip transition-colors hover:bg-tertiary"
              onClick={() => {
                setEmail(account.email);
                setPassword(DEMO_PASSWORD);
                setError(null);
              }}
            >
              {account.label}
            </button>
          ))}
        </div>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-label-md uppercase">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-label-md uppercase">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <ErrorMessage>{error}</ErrorMessage>}
          <button type="submit" className="btn-secondary" disabled={busy || !email || !password}>
            {busy ? 'Signing in…' : 'Sign in with email'}
          </button>
        </form>
      </div>
    </section>
  );
}
