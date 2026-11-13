import { Link, useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminApi } from '../../api/adminApi';
import { Pagination } from '../../components/Pagination';
import { ErrorMessage } from '../../components/StateViews';
import { AdminPage, EmptyRow, TableWrap, td, th } from '../../features/admin/AdminPage';
import type { AuditEntry } from '../../features/admin/types';
import { formatDateTime } from '../../lib/format';

const ACTIONS = [
  'ORDER_CREATED',
  'PAYMENT_RECORDED',
  'ORDER_STATUS_CHANGED',
  'ORDER_CANCELLED',
  'PRODUCT_CREATED',
  'PRODUCT_UPDATED',
  'INVENTORY_ADJUSTED',
  'CATEGORY_CREATED',
  'CATEGORY_UPDATED',
];

function entityLink(entry: AuditEntry) {
  if (!entry.entityId) return entry.entityType;
  const label = (entry.metadata?.orderNumber ?? entry.metadata?.name ?? entry.entityId.slice(0, 8)) as string;
  if (entry.entityType === 'ORDER') return <Link to={`/admin/orders/${entry.entityId}`} className="hover:underline">{label}</Link>;
  if (entry.entityType === 'PRODUCT') return <Link to={`/admin/products/${entry.entityId}/edit`} className="hover:underline">{label}</Link>;
  return label;
}

/** Compact one-line metadata summary (values only, no secrets are ever stored). */
function summary(metadata: AuditEntry['metadata']) {
  if (!metadata) return '';
  return Object.entries(metadata)
    .filter(([key]) => !['orderNumber', 'name'].includes(key))
    .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
    .join(' · ');
}

export function AdminAuditLogsPage() {
  const [params, setParams] = useSearchParams();
  const query = {
    action: params.get('action') ?? undefined,
    entityType: params.get('entityType') ?? undefined,
    page: Number(params.get('page')) || 1,
    limit: 25,
  };
  const logs = useQuery({ queryKey: ['admin', 'audit', query], queryFn: () => adminApi.auditLogs(query), placeholderData: keepPreviousData });

  function update(changes: Record<string, string | undefined>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) (v ? next.set(k, v) : next.delete(k));
    if (!('page' in changes)) next.delete('page');
    setParams(next, { replace: true });
  }

  return (
    <AdminPage title="Audit log" subtitle="Every material business action, newest first.">
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-action" className="text-label-sm uppercase">
            Action
          </label>
          <select id="audit-action" className="input w-60" value={query.action ?? ''} onChange={(e) => update({ action: e.target.value || undefined })}>
            <option value="">All actions</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-entity" className="text-label-sm uppercase">
            Entity
          </label>
          <select id="audit-entity" className="input w-40" value={query.entityType ?? ''} onChange={(e) => update({ entityType: e.target.value || undefined })}>
            <option value="">All</option>
            <option value="ORDER">Orders</option>
            <option value="PRODUCT">Products</option>
            <option value="CATEGORY">Categories</option>
          </select>
        </div>
      </div>
      {logs.isError && <ErrorMessage>{logs.error.message}</ErrorMessage>}
      <TableWrap>
        <table className="w-full min-w-[900px] border-collapse">
          <thead>
            <tr>
              <th className={th}>When</th>
              <th className={th}>Actor</th>
              <th className={th}>Action</th>
              <th className={th}>Entity</th>
              <th className={th}>Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.isPending && <EmptyRow colSpan={5}>Loading…</EmptyRow>}
            {logs.data?.data.length === 0 && <EmptyRow colSpan={5}>No audit records.</EmptyRow>}
            {logs.data?.data.map((entry) => (
              <tr key={entry.id} className="align-top hover:bg-neutral">
                <td className={`${td} whitespace-nowrap`}>{formatDateTime(entry.createdAt)}</td>
                <td className={td}>
                  {entry.actor ? (
                    <>
                      {entry.actor.name}
                      <p className="text-caption text-primary-60">{entry.actor.role === 'ADMIN' ? 'Admin' : 'Customer'}</p>
                    </>
                  ) : (
                    'System'
                  )}
                </td>
                <td className={`${td} text-label-sm whitespace-nowrap`}>{entry.action}</td>
                <td className={td}>
                  <span className="text-caption text-primary-60">{entry.entityType}</span>
                  <br />
                  {entityLink(entry)}
                </td>
                <td className={`${td} max-w-md break-words text-caption text-primary-60`}>{summary(entry.metadata)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
      {logs.data && (
        <div className="mt-5">
          <Pagination page={logs.data.meta.page} totalPages={logs.data.meta.totalPages} onChange={(p) => update({ page: String(p) })} />
        </div>
      )}
    </AdminPage>
  );
}
