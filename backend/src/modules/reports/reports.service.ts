import type { OrderStatus } from '@prisma/client';
import { LOW_STOCK_THRESHOLD } from '../../config/pricing.js';
import { prisma } from '../../db/prisma.js';
import { REVENUE_STATUSES } from '../../shared/orderStates/orderStates.js';

export const REVENUE_RULE =
  'Revenue = sum of order totals (incl. GST and shipping) for orders in PAID, PACKED, SHIPPED or DELIVERED. ' +
  'Cancelled (incl. refunded), unpaid and failed-payment orders are excluded.';

/**
 * Dashboard figures, all computed from the orders table in one grouped query so they reconcile
 * exactly with the admin order list.
 */
export async function getDashboard() {
  const [grouped, lowStock, lowStockCount, recentOrders] = await Promise.all([
    prisma.order.groupBy({ by: ['status'], _count: { _all: true }, _sum: { totalPaise: true } }),
    prisma.product.findMany({
      where: { isActive: true, stockQuantity: { lte: LOW_STOCK_THRESHOLD } },
      orderBy: [{ stockQuantity: 'asc' }, { name: 'asc' }],
      take: 10,
      select: { id: true, name: true, brand: true, stockQuantity: true, imageUrl: true },
    }),
    prisma.product.count({ where: { isActive: true, stockQuantity: { lte: LOW_STOCK_THRESHOLD } } }),
    prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, orderNumber: true, status: true, totalPaise: true, createdAt: true, user: { select: { name: true, email: true } } },
    }),
  ]);

  const byStatus = Object.fromEntries(
    (['PLACED', 'PAID', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'PAYMENT_FAILED', 'PAYMENT_CANCELLED'] as OrderStatus[]).map((s) => [s, 0]),
  ) as Record<OrderStatus, number>;
  let revenuePaise = 0;
  let totalOrders = 0;
  for (const row of grouped) {
    byStatus[row.status] = row._count._all;
    totalOrders += row._count._all;
    if (REVENUE_STATUSES.includes(row.status)) revenuePaise += row._sum.totalPaise ?? 0;
  }

  return {
    totals: {
      totalOrders,
      paidOrders: REVENUE_STATUSES.reduce((sum, s) => sum + byStatus[s], 0),
      pendingOrders: byStatus.PLACED,
      toFulfil: byStatus.PAID + byStatus.PACKED,
      cancelledOrders: byStatus.CANCELLED,
      failedPayments: byStatus.PAYMENT_FAILED + byStatus.PAYMENT_CANCELLED,
      revenuePaise,
    },
    byStatus,
    revenueRule: REVENUE_RULE,
    lowStock: { threshold: LOW_STOCK_THRESHOLD, count: lowStockCount, products: lowStock },
    recentOrders: recentOrders.map(({ user, ...order }) => ({ ...order, customer: user })),
  };
}
