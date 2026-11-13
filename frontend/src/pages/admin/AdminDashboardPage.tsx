import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../api/adminApi';
import { ErrorMessage, LoadingState } from '../../components/StateViews';
import { StatusBadge } from '../../components/StatusBadge';
import { AdminPage, TableWrap, td, th } from '../../features/admin/AdminPage';
import { formatDateTime } from '../../lib/format';
import { formatPaise } from '../../lib/money';

function Stat({ label, value, to, accent }: { label: string; value: string | number; to?: string; accent?: boolean }) {
  const body = (
    <>
      <p className="text-label-sm text-primary-60 uppercase">{label}</p>
      <p className={`mt-2 text-headline-lg ${accent ? 'text-error-strong' : ''}`}>{value}</p>
    </>
  );
  return to ? (
    <Link to={to} className="card block transition-colors hover:border-primary">
      {body}
    </Link>
  ) : (
    <div className="card">{body}</div>
  );
}

export function AdminDashboardPage() {
  const dashboard = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: adminApi.dashboard, refetchOnWindowFocus: true });

  if (dashboard.isPending) return <LoadingState label="Loading dashboard…" />;
  if (dashboard.isError) {
    return (
      <AdminPage title="Dashboard">
        <ErrorMessage>{dashboard.error.message}</ErrorMessage>
      </AdminPage>
    );
  }

  const { totals, lowStock, recentOrders, revenueRule } = dashboard.data;

  return (
    <AdminPage title="Dashboard" subtitle="Live figures, calculated from the orders table.">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Revenue" value={formatPaise(totals.revenuePaise)} />
        <Stat label="Total orders" value={totals.totalOrders} to="/admin/orders" />
        <Stat label="Paid / fulfilled" value={totals.paidOrders} />
        <Stat label="To pack or ship" value={totals.toFulfil} to="/admin/orders?status=PAID" accent={totals.toFulfil > 0} />
        <Stat label="Awaiting payment" value={totals.pendingOrders} to="/admin/orders?status=PLACED" />
        <Stat label="Cancelled" value={totals.cancelledOrders} to="/admin/orders?status=CANCELLED" />
        <Stat label="Failed payments" value={totals.failedPayments} to="/admin/orders?status=PAYMENT_FAILED" />
        <Stat label={`Low stock (≤ ${lowStock.threshold})`} value={lowStock.count} to="/admin/products?lowStock=true" accent={lowStock.count > 0} />
      </div>
      <p className="mt-3 text-caption text-primary-60">{revenueRule}</p>

      <div className="mt-9.5 grid gap-7.5 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="text-headline-sm uppercase">Recent orders</h2>
            <Link to="/admin/orders" className="btn-tertiary text-body-sm">
              All orders →
            </Link>
          </div>
          <TableWrap>
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr>
                  <th className={th}>Order</th>
                  <th className={th}>Customer</th>
                  <th className={th}>Placed</th>
                  <th className={`${th} text-right`}>Total</th>
                  <th className={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-neutral">
                    <td className={td}>
                      <Link to={`/admin/orders/${order.id}`} className="font-semibold hover:underline">
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className={td}>{order.customer.name}</td>
                    <td className={`${td} whitespace-nowrap`}>{formatDateTime(order.createdAt)}</td>
                    <td className={`${td} text-right`}>{formatPaise(order.totalPaise)}</td>
                    <td className={td}>
                      <StatusBadge status={order.status} />
                    </td>
                  </tr>
                ))}
                {recentOrders.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-7.5 text-center text-body-sm text-primary-60">
                      No orders yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableWrap>
        </div>

        <div>
          <h2 className="mb-3 text-headline-sm uppercase">Low stock</h2>
          <ul className="card divide-y divide-tertiary p-0">
            {lowStock.products.map((product) => (
              <li key={product.id}>
                <Link to={`/admin/products/${product.id}/edit`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-neutral">
                  <span className="text-body-sm">
                    <span className="text-primary-60">{product.brand}</span> {product.name}
                  </span>
                  <span className={`text-label-md ${product.stockQuantity === 0 ? 'text-error-strong' : ''}`}>{product.stockQuantity}</span>
                </Link>
              </li>
            ))}
            {lowStock.products.length === 0 && <li className="px-4 py-5 text-body-sm text-primary-60">All products are well stocked.</li>}
          </ul>
        </div>
      </div>
    </AdminPage>
  );
}
