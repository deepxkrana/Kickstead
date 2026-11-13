import { describe, expect, it } from 'vitest';
import { OrderStatus } from '@prisma/client';
import {
  ALLOWED_TRANSITIONS,
  assertTransition,
  canTransition,
  isTerminal,
} from '../src/shared/orderStates/orderStates.js';
import { AppError } from '../src/shared/errors/AppError.js';

describe('order state machine', () => {
  it('covers every OrderStatus in the database enum', () => {
    expect(Object.keys(ALLOWED_TRANSITIONS).sort()).toEqual(Object.values(OrderStatus).sort());
  });

  it.each([
    ['PLACED', 'PAID'],
    ['PLACED', 'PAYMENT_FAILED'],
    ['PLACED', 'PAYMENT_CANCELLED'],
    ['PLACED', 'CANCELLED'],
    ['PAID', 'PACKED'],
    ['PAID', 'CANCELLED'],
    ['PACKED', 'SHIPPED'],
    ['SHIPPED', 'DELIVERED'],
  ] as const)('allows %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
    expect(() => assertTransition(from, to)).not.toThrow();
  });

  it.each([
    ['DELIVERED', 'PLACED'],
    ['CANCELLED', 'SHIPPED'],
    ['PAID', 'DELIVERED'],
    ['PACKED', 'CANCELLED'],
    ['PAYMENT_FAILED', 'PAID'],
    ['PLACED', 'PLACED'],
  ] as const)('rejects %s -> %s with 409 INVALID_STATUS_TRANSITION', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
    try {
      assertTransition(from, to);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).status).toBe(409);
      expect((err as AppError).code).toBe('INVALID_STATUS_TRANSITION');
    }
  });

  it('treats delivered, cancelled and failed payments as terminal', () => {
    for (const status of ['DELIVERED', 'CANCELLED', 'PAYMENT_FAILED', 'PAYMENT_CANCELLED'] as const) {
      expect(isTerminal(status)).toBe(true);
    }
    expect(isTerminal('PLACED')).toBe(false);
  });
});
