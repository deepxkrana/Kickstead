interface PagePlaceholderProps {
  title: string;
  phase: string;
}

/** Scaffold-only page. Each one is replaced when its phase is built. */
export function PagePlaceholder({ title, phase }: PagePlaceholderProps) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12.5">
      <h1 className="text-headline-lg uppercase">{title}</h1>
      <p className="mt-2 text-body-md text-primary-60">Not built yet — scheduled for {phase}.</p>
    </section>
  );
}
