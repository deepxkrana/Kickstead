import type { Prisma } from '@prisma/client';
import type { TransactionClient } from '../../db/prisma.js';

export const AuditAction = {
  ORDER_CREATED: 'ORDER_CREATED',
  PAYMENT_RECORDED: 'PAYMENT_RECORDED',
  ORDER_STATUS_CHANGED: 'ORDER_STATUS_CHANGED',
  ORDER_CANCELLED: 'ORDER_CANCELLED',
  PRODUCT_CREATED: 'PRODUCT_CREATED',
  PRODUCT_UPDATED: 'PRODUCT_UPDATED',
  INVENTORY_ADJUSTED: 'INVENTORY_ADJUSTED',
  CATEGORY_CREATED: 'CATEGORY_CREATED',
  CATEGORY_UPDATED: 'CATEGORY_UPDATED',
} as const;

export type AuditActionName = (typeof AuditAction)[keyof typeof AuditAction];

interface AuditEntry {
  actorUserId: string | null;
  action: AuditActionName;
  entityType: 'ORDER' | 'PRODUCT' | 'CATEGORY';
  entityId: string;
  /** Business context only. Never put tokens, passwords or payment credentials here. */
  metadata?: Prisma.InputJsonObject;
}

/** Writes an audit record inside the caller's transaction, so it commits or rolls back with the action. */
export function recordAudit(tx: TransactionClient, entry: AuditEntry) {
  return tx.auditLog.create({ data: entry });
}
