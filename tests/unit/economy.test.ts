import { describe, it, expect } from 'vitest';
import { EconomyService } from '../../src/economy/economy';

describe('economy', () => {
  it('blocks overspend', () => {
    const e = new EconomyService(200);
    expect(e.transact(-250, 'test').ok).toBe(false);
    expect(e.balance).toBe(200);
  });
  it('ledger stays consistent', () => {
    const e = new EconomyService(200);
    e.transact(-50, 'seeds');
    e.transact(80, 'sale');
    expect(e.balance).toBe(230);
    const sum = e.ledger.reduce((a, l) => a + l.delta, 0);
    expect(200 + sum).toBe(e.balance);
  });
});
