import { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../features/auth/AuthProvider';
import { defaultPathFor, takeReturnTo } from '../features/auth/returnTo';
import { LoadingState, MessageState } from '../components/StateViews';

/** Supabase reports OAuth failures in the query string or the hash. */
function oauthError(): string | null {
  const params = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.slice(1));
  return (
    params.get('error_description') ?? hash.get('error_description') ?? params.get('error') ?? hash.get('error')
  );
}

/**
 * Landing page after Google. The Supabase client exchanges the `?code=` for a session on load;
 * once /api/auth/me returns the role we continue to the saved page or the role's default.
 */
export function AuthCallbackPage() {
  const { state } = useAuth();
  const navigate = useNavigate();
  const navigated = useRef(false);
  const error = oauthError();

  useEffect(() => {
    if (state.status !== 'signedIn' || navigated.current) return;
    navigated.current = true;
    navigate(takeReturnTo() ?? defaultPathFor(state.user.role), { replace: true });
  }, [state, navigate]);

  if (error || state.status === 'signedOut' || state.status === 'error') {
    return (
      <MessageState
        eyebrow="Sign-in failed"
        title="We couldn't sign you in"
        message={
          error ??
          (state.status === 'error' ? state.error.message : 'The sign-in link was invalid or expired. Please try again.')
        }
        actions={
          <Link to="/login" className="btn-primary">
            Back to sign in
          </Link>
        }
      />
    );
  }

  return <LoadingState label="Completing sign-in…" />;
}
