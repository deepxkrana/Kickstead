import { Link, Navigate, Outlet, useLocation } from 'react-router';
import { ApiError } from '../../api/client';
import { LoadingState, MessageState } from '../../components/StateViews';
import { useAuth } from './AuthProvider';
import type { Role } from './types';

/**
 * Route guard for signed-in pages. This only improves navigation: the API enforces
 * authentication and roles on every request regardless of what the browser shows.
 */
export function RequireAuth({ role }: { role?: Role }) {
  const { state, signOut, retry } = useAuth();
  const location = useLocation();

  if (state.status === 'loading') return <LoadingState label="Checking your session…" />;

  if (state.status === 'signedOut') {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  if (state.status === 'error') {
    const disabled = state.error instanceof ApiError && state.error.code === 'ACCOUNT_DISABLED';
    return (
      <MessageState
        eyebrow={disabled ? 'Account disabled' : 'Something went wrong'}
        title={disabled ? 'Access blocked' : 'Could not load your account'}
        message={state.error.message}
        actions={
          <>
            {!disabled && (
              <button type="button" className="btn-primary" onClick={retry}>
                Try again
              </button>
            )}
            <button type="button" className="btn-secondary" onClick={() => void signOut()}>
              Sign out
            </button>
          </>
        }
      />
    );
  }

  if (role && state.user.role !== role) {
    return (
      <MessageState
        eyebrow="403"
        title="Not authorized"
        message="Your account does not have access to this page."
        actions={
          <Link to="/" className="btn-primary">
            Back to store
          </Link>
        }
      />
    );
  }

  return <Outlet />;
}
