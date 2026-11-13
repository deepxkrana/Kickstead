import { Link } from 'react-router';

export function HomePage() {
  return (
    <>
      <section className="relative isolate overflow-hidden bg-primary text-secondary">
        <img
          src="https://images.unsplash.com/photo-1552346154-21d32810aba3?w=1600&q=80"
          alt=""
          className="absolute inset-0 -z-10 h-full w-full object-cover opacity-50"
        />
        <div className="mx-auto flex min-h-[420px] max-w-6xl flex-col justify-end gap-5 px-4 py-12.5">
          <p className="text-label-sm text-error uppercase">New season drop</p>
          <h1 className="max-w-2xl text-headline-display uppercase">Sneakers for every stride.</h1>
          <div>
            <Link to="/products" className="btn-primary bg-secondary text-primary hover:bg-tertiary">
              Shop all
            </Link>
          </div>
        </div>
      </section>
      {/* Featured product grid is added in Phase 4 once the catalogue API exists. */}
    </>
  );
}
