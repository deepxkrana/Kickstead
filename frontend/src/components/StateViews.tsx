import type { ReactNode } from 'react';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-12.5">
      <span className="size-4 animate-spin rounded-full border-2 border-primary-20 border-t-primary" aria-hidden />
      <span className="text-body-sm text-primary-60">{label}</span>
    </div>
  );
}

interface MessageStateProps {
  eyebrow?: string;
  title: string;
  message: string;
  actions?: ReactNode;
}

export function MessageState({ eyebrow, title, message, actions }: MessageStateProps) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12.5">
      {eyebrow && <p className="text-label-sm text-error uppercase">{eyebrow}</p>}
      <h1 className="mt-2 text-headline-lg uppercase">{title}</h1>
      <p className="mt-2 max-w-xl text-body-md text-primary-60">{message}</p>
      {actions && <div className="mt-7.5 flex flex-wrap gap-2">{actions}</div>}
    </section>
  );
}

/** Inline error for forms and panels. Announced to screen readers. */
export function ErrorMessage({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-md border border-error bg-surface px-3 py-2 text-body-sm text-error">
      {children}
    </p>
  );
}
