import type { ReactNode } from 'react';

/** Standard admin page frame: title, optional actions, content. */
export function AdminPage({ title, subtitle, actions, children }: { title: string; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-7.5 md:px-7.5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-headline-lg uppercase">{title}</h1>
          {subtitle && <div className="mt-1 text-body-sm text-primary-60">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      <div className="mt-7.5">{children}</div>
    </section>
  );
}

/** Horizontally scrollable table wrapper so wide tables never break the page on mobile. */
export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-lg border border-tertiary bg-surface">{children}</div>;
}

export const th = 'whitespace-nowrap border-b border-tertiary px-4 py-3 text-left text-label-sm uppercase text-primary-60';
export const td = 'border-b border-tertiary px-4 py-3 align-middle text-body-sm';

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12.5 text-center text-body-sm text-primary-60">
        {children}
      </td>
    </tr>
  );
}

export const MOVEMENT_LABEL: Record<string, string> = {
  ORDER_RESERVED: 'Order reserved',
  ORDER_RELEASED: 'Payment failed / cancelled',
  ORDER_CANCELLED: 'Order cancelled',
  ADMIN_ADJUSTMENT: 'Admin adjustment',
  SEED: 'Seed',
};
