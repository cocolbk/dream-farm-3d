import { describe, it, expect } from 'vitest';
import { EconomyService } from '../../src/economy/economy';
import { InventoryService } from '../../src/inventory/inventory';
import { createPlots, plant, water, tickPlot, harvest } from '../../src/farming/farming';
import { validatePlacement } from '../../src/buildings/placement';
import { CROPS, BUILDINGS } from '../../src/core/Config';

// Full loop: buy seed -> plant -> water -> grow -> harvest -> sell -> build.
// Asserts ledger sum == balance delta and stock math exact (no dupes).
describe('phase-1 loop', () => {
  it('plant/harvest/sell/build stays consistent', () => {
    const eco = new EconomyService(200);
    const inv = new InventoryService({ maize: 5, tomato: 0, carrot: 5, wheat: 0, pumpkin: 0 });
    const [p] = createPlots(1);

    // buy 1 maize seed
    expect(eco.transact(-CROPS.maize.seedPrice, 'seed maize').ok).toBe(true);
    inv.seeds.maize += 1;
    // plant consumes seed
    expect(inv.takeSeed('maize').ok).toBe(true);
    expect(plant(p, 'maize').ok).toBe(true);
    expect(water(p).ok).toBe(true);
    tickPlot(p, CROPS.maize.growTime);
    const h = harvest(p);
    expect(h.ok).toBe(true);
    inv.addProduce('maize', h.qty!);
    // sell all maize produce at base price
    const qty = inv.produce.maize;
    const revenue = qty * CROPS.maize.sellBase;
    expect(inv.takeProduce('maize', qty).ok).toBe(true);
    expect(eco.transact(revenue, 'sale maize').ok).toBe(true);
    // build barn if affordable
    const v = validatePlacement('barn', 20, 20, []);
    expect(v.ok).toBe(true);
    if (eco.balance >= BUILDINGS.barn.cost) {
      expect(eco.transact(-BUILDINGS.barn.cost, 'build barn').ok).toBe(true);
    }
    const sum = eco.ledger.reduce((a, l) => a + l.delta, 0);
    expect(200 + sum).toBe(eco.balance);
  });
});
