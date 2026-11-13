import { Link, Navigate } from 'react-router';
import { useAuth } from '../features/auth/AuthProvider';
import { GoogleButton } from '../features/auth/GoogleButton';
import { defaultPathFor } from '../features/auth/returnTo';

export function RegisterPage() {
  const { state } = useAuth();

  if (state.status === 'signedIn') return <Navigate to={defaultPathFor(state.user.role)} replace />;

  return (
    <section className="mx-auto flex max-w-md flex-col gap-5 px-4 py-12.5">
      <div>
        <p className="text-label-sm text-error uppercase">Join Kickstead</p>
        <h1 className="mt-2 text-headline-lg uppercase">Create account</h1>
        <p className="mt-2 text-body-md text-primary-60">
          Kickstead accounts are created with Google. The first time you continue, we set up your
          customer account. No separate password needed.
        </p>
      </div>
      <GoogleButton label="Sign up with Google" />
      <p className="text-body-sm text-primary-60">
        Already have an account? <Link to="/login" className="btn-tertiary text-body-sm">Sign in</Link>
      </p>
    </section>
  );
}
