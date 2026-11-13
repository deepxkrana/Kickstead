import type { Prisma } from '@prisma/client';
import { prisma, type TransactionClient } from '../../db/prisma.js';
import { pageMeta } from '../../shared/http/pagination.js';

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

export async function listAuditLogs(query: {
  page: number;
  limit: number;
  action?: string;
  entityType?: 'ORDER' | 'PRODUCT' | 'CATEGORY';
  entityId?: string;
}) {
  const where: Prisma.AuditLogWhereInput = {
    ...(query.action ? { action: query.action } : {}),
    ...(query.entityType ? { entityType: query.entityType } : {}),
    ...(query.entityId ? { entityId: query.entityId } : {}),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        createdAt: true,
        actor: { select: { id: true, name: true, email: true, role: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { data: rows, meta: pageMeta(query.page, query.limit, total) };
}
