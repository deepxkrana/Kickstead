import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12.5">
      <p className="text-label-sm text-error-strong uppercase">404</p>
      <h1 className="mt-2 text-headline-lg uppercase">Page not found</h1>
      <p className="mt-2 text-body-md text-primary-60">The page you are looking for does not exist.</p>
      <Link to="/" className="btn-primary mt-7.5">
        Back to home
      </Link>
    </section>
  );
}
