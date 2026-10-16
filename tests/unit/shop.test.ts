import { describe, it, expect } from 'vitest';
import { EconomyService } from '../../src/economy/economy';
import { InventoryService } from '../../src/inventory/inventory';
import { ShopService } from '../../src/shop/shop';
import { CROPS } from '../../src/core/Config';

describe('shop', () => {
  it('transfer produce -> stock -> priced sale is exact (no dupes)', () => {
    const eco = new EconomyService(200);
    const inv = new InventoryService({ maize: 0, tomato: 0, carrot: 0, wheat: 0, pumpkin: 0 });
    const shop = new ShopService();
    inv.addProduce('maize', 6);
    // transfer 4
    expect(inv.takeProduce('maize', 4).ok).toBe(true);
    shop.addStock('maize', 4);
    expect(inv.produce.maize).toBe(2);
    expect(shop.stock.maize).toBe(4);
    // price within bounds
    expect(shop.setPrice('maize', 12).ok).toBe(true);
    // sell 3 at 12
    const s = shop.commitSale('maize', 3);
    expect(s.ok && s.revenue).toBe(36);
    expect(eco.transact(s.revenue!, 'sale maize').ok).toBe(true);
    expect(shop.stock.maize).toBe(1);
    expect(eco.balance).toBe(236);
    // oversell blocked
    expect(shop.commitSale('maize', 5).ok).toBe(false);
    expect(eco.balance).toBe(236);
  });
  it('price clamps to min/max', () => {
    const shop = new ShopService();
    shop.setPrice('carrot', 999);
    expect(shop.prices.carrot).toBe(CROPS.carrot.maxPrice);
    shop.setPrice('carrot', -5);
    expect(shop.prices.carrot).toBe(CROPS.carrot.minPrice);
  });
  it('invalid transfer qty blocked', () => {
    const inv = new InventoryService({ maize: 0, tomato: 0, carrot: 0, wheat: 0, pumpkin: 0 });
    expect(inv.takeProduce('maize', 0).ok).toBe(false);
    expect(inv.takeProduce('maize', 5).ok).toBe(false);
  });
});
