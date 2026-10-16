import { describe, it, expect } from 'vitest';
import { defaultSave, writeSave, loadSave, SAVE_KEY } from '../../src/save/save';

function memStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => { m.set(k, v); },
    removeItem: (k: string) => { m.delete(k); },
    clear: () => m.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;
}

describe('save', () => {
  it('round-trips v4 with tractors/stock/prices/staff/goals', () => {
    const s = memStorage();
    const d = defaultSave();
    d.coins = 999;
    d.tractors = [{ uid: 't1', defId: 't20', x: 5, z: 5, angle: 0 }];
    d.shopStock = { maize: 4, tomato: 0, carrot: 0, wheat: 1, pumpkin: 0 };
    d.staff = [{ uid: 's1', role: 'cashier', state: 'busy', taskLabel: 'x', current: null, busyLeft: 2 }];
    d.stats = { earned: 500, sales: 12, happyServes: 3, harvests: 4 };
    d.claimed = ['first-harvest'];
    writeSave(s, d);
    const loaded = loadSave(s);
    expect(loaded?.coins).toBe(999);
    expect(loaded?.tractors.length).toBe(1);
    expect(loaded?.shopStock.maize).toBe(4);
    // in-flight tasks are not restored: roster reloads idle (no phantom busy)
    expect(loaded?.staff.length).toBe(1);
    expect(loaded?.staff[0].state).toBe('idle');
    expect(loaded?.stats.sales).toBe(12);
    expect(loaded?.claimed).toEqual(['first-harvest']);
  });
  it('migrates v1 -> v4 (plots default tilled, empty tractors/shop/staff)', () => {
    const s = memStorage();
    s.setItem(SAVE_KEY, JSON.stringify({
      version: 1, coins: 200,
      seeds: { maize: 5, tomato: 0, carrot: 5 },
      produce: { maize: 0, tomato: 0, carrot: 0 },
      plots: [{ index: 0, state: 'empty', crop: null, progress: 0, water: 0, growthTime: 0 }],
      buildings: [], tutorialStep: 0,
    }));
    const loaded = loadSave(s);
    expect(loaded?.version).toBe(4);
    expect(loaded?.plots[0].tilled).toBe(true);
    expect(loaded?.tractors).toEqual([]);
    expect(loaded?.staff).toEqual([]);
  });
  it('migrates v3 (6 plots) -> v4 (appends 6 locked expansion plots)', () => {
    const s = memStorage();
    const six = [0, 1, 2, 3, 4, 5].map((index) => ({
      index, state: 'empty', crop: null, progress: 0, water: 0, growthTime: 0, tilled: true,
    }));
    s.setItem(SAVE_KEY, JSON.stringify({
      version: 3, coins: 300,
      seeds: { maize: 5, tomato: 0, carrot: 5, wheat: 0, pumpkin: 0 },
      produce: { maize: 1, tomato: 0, carrot: 0, wheat: 0, pumpkin: 0 },
      plots: six, buildings: [],
      tractors: [], selectedTractorUid: null,
      shopStock: { maize: 2, tomato: 0, carrot: 0, wheat: 0, pumpkin: 0 },
      prices: { maize: 9, tomato: 14, carrot: 5, wheat: 10, pumpkin: 18 },
      staff: [], paydayTimer: 100, tutorialStep: 5,
    }));
    const loaded = loadSave(s);
    expect(loaded?.version).toBe(4);
    expect(loaded?.plots.length).toBe(12);
    expect(loaded?.plots[5].locked).toBe(false);
    expect(loaded?.plots[6].locked).toBe(true);
    expect(loaded?.shopStock.maize).toBe(2);
  });
  it('corrupt save returns null, never throws', () => {
    const s = memStorage();
    s.setItem(SAVE_KEY, '{broken');
    expect(loadSave(s)).toBeNull();
    s.setItem(SAVE_KEY, JSON.stringify({ version: 999 }));
    expect(loadSave(s)).toBeNull();
  });
});
