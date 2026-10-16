import { describe, it, expect } from 'vitest';
import {
  STAFF_ROLES, canDo, createStaffMember, TaskQueue, wagesDue, isAvailable,
  type StaffRole,
} from '../../src/staff/staff';

describe('capability matrix (role gating)', () => {
  it('each role does only its own task kind', () => {
    const pairs: Array<[StaffRole, 'collect' | 'checkout' | 'restock' | 'driveOrder']> = [
      ['attendant', 'collect'], ['cashier', 'checkout'], ['stock', 'restock'], ['drive', 'driveOrder'],
    ];
    for (const [role, kind] of pairs) {
      expect(canDo(role, kind)).toBe(true);
      for (const [r2, k2] of pairs) {
        if (r2 !== role) expect(canDo(r2, kind)).toBe(false);
        if (k2 !== kind) expect(canDo(role, k2)).toBe(false);
      }
    }
  });
  it('cashier cannot perform tractor/drive work and vice versa', () => {
    expect(canDo('cashier', 'driveOrder')).toBe(false);
    expect(canDo('drive', 'checkout')).toBe(false);
    expect(canDo('stock', 'collect')).toBe(false);
  });
});

describe('task queue: one task at a time', () => {
  it('claim removes task; second claim gets next or undefined', () => {
    const q = new TaskQueue();
    q.enqueue('checkout', 3, { customerId: 'a' });
    q.enqueue('checkout', 3, { customerId: 'b' });
    expect(q.size).toBe(2);
    expect(q.claim('checkout')?.customerId).toBe('a');
    expect(q.size).toBe(1);
    expect(q.claim('checkout')?.customerId).toBe('b');
    expect(q.claim('checkout')).toBeUndefined();
  });
  it('removeForCustomer clears stale tasks on timeout/leave', () => {
    const q = new TaskQueue();
    q.enqueue('collect', 3, { customerId: 'a' });
    q.enqueue('checkout', 3, { customerId: 'b' });
    q.removeForCustomer('a');
    expect(q.size).toBe(1);
    expect(q.claim('collect')).toBeUndefined();
  });
});

describe('wages', () => {
  it('wagesDue sums role wages exactly', () => {
    const staff = [
      createStaffMember('attendant', 1),
      createStaffMember('cashier', 2),
      createStaffMember('stock', 3),
      createStaffMember('drive', 4),
    ];
    const expected = STAFF_ROLES.attendant.wage + STAFF_ROLES.cashier.wage
      + STAFF_ROLES.stock.wage + STAFF_ROLES.drive.wage;
    expect(wagesDue(staff)).toBe(expected);
    expect(wagesDue([])).toBe(0);
  });
  it('busy or unpaid staff are not available', () => {
    const m = createStaffMember('cashier', 1);
    expect(isAvailable(m, false)).toBe(true);
    expect(isAvailable(m, true)).toBe(false); // unpaid wages -> idle, no silent work
    m.state = 'busy';
    expect(isAvailable(m, false)).toBe(false); // one task at a time
  });
});

describe('both modes concurrently', () => {
  it('drive + checkout + collect + restock can all be claimed in one pass', () => {
    const q = new TaskQueue();
    q.enqueue('driveOrder', 4, { customerId: 'd1' });
    q.enqueue('checkout', 3, { customerId: 'c1' });
    q.enqueue('collect', 3, { customerId: 'c2' });
    q.enqueue('restock', 4, { crop: 'maize', qty: 6 });
    // priority order: drive orders > checkout > collect > restock
    expect(q.claim('driveOrder')?.customerId).toBe('d1');
    expect(q.claim('checkout')?.customerId).toBe('c1');
    expect(q.claim('collect')?.customerId).toBe('c2');
    expect(q.claim('restock')?.crop).toBe('maize');
    expect(q.size).toBe(0);
  });
});
