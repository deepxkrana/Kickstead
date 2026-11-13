import type { OrderStatus, Prisma } from '@prisma/client';
import { CUSTOMER_CANCELLABLE_STATUSES } from '../../shared/orderStates/orderStates.js';

export const orderDetailInclude = {
  items: { orderBy: { productNameSnapshot: 'asc' }, include: { product: { select: { slug: true } } } },
  payment: true,
} satisfies Prisma.OrderInclude;

export type OrderWithDetail = Prisma.OrderGetPayload<{ include: typeof orderDetailInclude }>;

export function toOrderView(order: OrderWithDetail) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    currency: order.currency,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    cancelledAt: order.cancelledAt,
    cancelReason: order.cancelReason,
    totals: {
      subtotalPaise: order.subtotalPaise,
      discountPaise: order.discountPaise,
      taxPaise: order.taxPaise,
      shippingPaise: order.shippingPaise,
      totalPaise: order.totalPaise,
    },
    address: order.addressSnapshot,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productSlug: item.product?.slug ?? null,
      name: item.productNameSnapshot,
      imageUrl: item.productImageSnapshot,
      unitPricePaise: item.unitPricePaise,
      quantity: item.quantity,
      lineTotalPaise: item.lineTotalPaise,
    })),
    payment: order.payment
      ? {
          status: order.payment.status,
          provider: order.payment.provider,
          reference: order.payment.providerReference,
          amountPaise: order.payment.amountPaise,
          updatedAt: order.payment.updatedAt,
        }
      : null,
    actions: {
      canPay: order.status === 'PLACED',
      canCancel: (CUSTOMER_CANCELLABLE_STATUSES as readonly OrderStatus[]).includes(order.status),
    },
  };
}

export type OrderView = ReturnType<typeof toOrderView>;
