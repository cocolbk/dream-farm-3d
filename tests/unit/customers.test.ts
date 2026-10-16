import { describe, it, expect } from 'vitest';
import {
  ReservationManager, generateRequest, checkPurchase, spawnCustomer,
  moveAlong, mulberry32, exitWaypoints,
} from '../../src/customers/customers';
import { ShopService } from '../../src/shop/shop';
import { EconomyService } from '../../src/economy/economy';

const STOCK = { maize: 10, tomato: 10, carrot: 10, wheat: 10, pumpkin: 10 };
const PRICES = { maize: 8, tomato: 14, carrot: 5, wheat: 10, pumpkin: 18 };

describe('reservations', () => {
  it('rejects double-booking', () => {
    const r = new ReservationManager(1, 1);
    expect(r.reserveBay()).toBe(0);
    expect(r.reserveBay()).toBe(-1); // full
    r.releaseBay(0);
    expect(r.reserveBay()).toBe(0);
    expect(r.reserveQueue()).toBe(0);
    expect(r.reserveQueue()).toBe(-1);
  });
});

describe('purchase validation', () => {
  it('rejects out-of-stock', () => {
    const c = checkPurchase([{ crop: 'maize', qty: 99 }], 999, STOCK, PRICES);
    expect(c.ok).toBe(false);
  });
  it('rejects over-budget', () => {
    const c = checkPurchase([{ crop: 'tomato', qty: 2 }], 5, STOCK, PRICES);
    expect(c.ok).toBe(false);
  });
  it('accepts valid order with exact total', () => {
    const c = checkPurchase(
      [{ crop: 'maize', qty: 2 }, { crop: 'carrot', qty: 1 }], 100, STOCK, PRICES,
    );
    expect(c.ok).toBe(true);
    expect(c.total).toBe(2 * 8 + 5);
  });
});

describe('headless traffic: exact-once revenue', () => {
  it('20 customers: ledger == inventory delta, no dupes', () => {
    const eco = new EconomyService(200);
    const shop = new ShopService();
    shop.stock = { maize: 100, tomato: 100, carrot: 100, wheat: 100, pumpkin: 100 };
    const rng = mulberry32(42);
    let soldQty = 0;
    let expectedRevenue = 0;
    for (let i = 0; i < 20; i++) {
      const req = generateRequest(rng, shop.stock, shop.prices);
      const chk = checkPurchase(req.items, req.budget, shop.stock, shop.prices);
      if (!chk.ok) continue;
      // atomic commit: stock deduct + single coin credit
      let ok = true;
      for (const it of req.items) {
        const s = shop.commitSale(it.crop, it.qty);
        if (!s.ok) { ok = false; break; }
      }
      if (!ok) continue;
      eco.transact(chk.total!, `shop sale customer${i}`);
      soldQty += req.items.reduce((a, it) => a + it.qty, 0);
      expectedRevenue += chk.total!;
    }
    const startStock = 500;
    const endStock = shop.stock.maize + shop.stock.tomato + shop.stock.carrot + shop.stock.wheat + shop.stock.pumpkin;
    expect(startStock - endStock).toBe(soldQty);
    const sum = eco.ledger.reduce((a, l) => a + l.delta, 0);
    expect(200 + sum).toBe(eco.balance);
    expect(sum).toBe(expectedRevenue);
  });
});

describe('movement', () => {
  it('spawned customer reaches its bay', () => {
    const c = spawnCustomer('c1', 'instore', 0, { items: [], budget: 50 });
    let arrived = false;
    for (let i = 0; i < 500 && !arrived; i++) arrived = moveAlong(c, 0.1);
    expect(arrived).toBe(true);
    expect(c.x).toBeCloseTo(20);
    expect(c.z).toBeCloseTo(-6);
  });
  it('leaving customer reaches exit', () => {
    const c = spawnCustomer('c2', 'drive', 0, { items: [], budget: 50 });
    c.waypoints = exitWaypoints();
    c.wpIndex = 0;
    c.x = 4;
    c.z = 0;
    let arrived = false;
    for (let i = 0; i < 500 && !arrived; i++) arrived = moveAlong(c, 0.1);
    expect(arrived).toBe(true);
  });
});
