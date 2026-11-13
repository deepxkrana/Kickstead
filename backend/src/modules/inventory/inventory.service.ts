import type { InventoryReason } from '@prisma/client';
import type { TransactionClient } from '../../db/prisma.js';
import { Errors } from '../../shared/errors/AppError.js';

export interface StockLine {
  productId: string;
  quantity: number;
}

/**
 * Takes stock for an order. Must run inside a transaction that has already locked the product
 * rows (SELECT … FOR UPDATE). The conditional UPDATE is a second guard, and the CHECK
 * (stock_quantity >= 0) constraint is the last one: stock can never go negative.
 */
export async function reserveStock(
  tx: TransactionClient,
  lines: readonly StockLine[],
  context: { orderId: string; actorUserId: string },
) {
  for (const line of lines) {
    const { count } = await tx.product.updateMany({
      where: { id: line.productId, stockQuantity: { gte: line.quantity } },
      data: { stockQuantity: { decrement: line.quantity } },
    });
    if (count === 0) {
      throw Errors.conflict('INSUFFICIENT_STOCK', 'One or more products are no longer available in the requested quantity.', {
        productId: line.productId,
      });
    }
    const { stockQuantity } = await tx.product.findUniqueOrThrow({
      where: { id: line.productId },
      select: { stockQuantity: true },
    });
    await tx.inventoryMovement.create({
      data: {
        productId: line.productId,
        quantityChange: -line.quantity,
        stockAfter: stockQuantity,
        reason: 'ORDER_RESERVED',
        orderId: context.orderId,
        actorUserId: context.actorUserId,
      },
    });
  }
}

/** Returns an order's stock (failed/cancelled payment or order cancellation) and logs each movement. */
export async function releaseStock(
  tx: TransactionClient,
  lines: readonly { productId: string | null; quantity: number }[],
  context: { orderId: string; actorUserId: string; reason: Extract<InventoryReason, 'ORDER_RELEASED' | 'ORDER_CANCELLED'> },
) {
  for (const line of lines) {
    // A product deleted from the catalogue (product_id set null) has no stock to return.
    if (!line.productId) continue;
    const product = await tx.product.update({
      where: { id: line.productId },
      data: { stockQuantity: { increment: line.quantity } },
      select: { stockQuantity: true },
    });
    await tx.inventoryMovement.create({
      data: {
        productId: line.productId,
        quantityChange: line.quantity,
        stockAfter: product.stockQuantity,
        reason: context.reason,
        orderId: context.orderId,
        actorUserId: context.actorUserId,
      },
    });
  }
}
