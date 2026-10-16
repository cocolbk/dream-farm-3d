import { bus } from '../core/EventBus';

export interface LedgerEntry {
  t: number;
  delta: number;
  balance: number;
  reason: string;
}

// AD-3: ONLY mutator of coins. Validates, logs, emits.
export class EconomyService {
  balance: number;
  ledger: LedgerEntry[] = [];

  constructor(startCoins: number) {
    this.balance = startCoins;
  }

  /** Returns ok:false with reason instead of throwing for gameplay blocks. */
  transact(delta: number, reason: string): { ok: boolean; reason?: string } {
    if (!Number.isFinite(delta)) return { ok: false, reason: 'Invalid amount' };
    if (this.balance + delta < 0) return { ok: false, reason: 'Not enough coins' };
    this.balance += delta;
    this.ledger.push({ t: Date.now(), delta, balance: this.balance, reason });
    if (this.ledger.length > 200) this.ledger.shift();
    bus.emit({ type: 'coins:changed', balance: this.balance, delta, reason });
    return { ok: true };
  }
}
