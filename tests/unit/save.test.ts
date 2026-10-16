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
  it('round-trips v3 with tractors/stock/prices/staff', () => {
    const s = memStorage();
    const d = defaultSave();
    d.coins = 999;
    d.tractors = [{ uid: 't1', defId: 't20', x: 5, z: 5, angle: 0 }];
    d.shopStock = { maize: 4, tomato: 0, carrot: 0 };
    d.staff = [{ uid: 's1', role: 'cashier', state: 'busy', taskLabel: 'x', current: null, busyLeft: 2 }];
    writeSave(s, d);
    const loaded = loadSave(s);
    expect(loaded?.coins).toBe(999);
    expect(loaded?.tractors.length).toBe(1);
    expect(loaded?.shopStock.maize).toBe(4);
    // in-flight tasks are not restored: roster reloads idle (no phantom busy)
    expect(loaded?.staff.length).toBe(1);
    expect(loaded?.staff[0].state).toBe('idle');
  });
  it('migrates v1 -> v3 (plots default tilled, empty tractors/shop/staff)', () => {
    const s = memStorage();
    s.setItem(SAVE_KEY, JSON.stringify({
      version: 1, coins: 200,
      seeds: { maize: 5, tomato: 0, carrot: 5 },
      produce: { maize: 0, tomato: 0, carrot: 0 },
      plots: [{ index: 0, state: 'empty', crop: null, progress: 0, water: 0, growthTime: 0 }],
      buildings: [], tutorialStep: 0,
    }));
    const loaded = loadSave(s);
    expect(loaded?.version).toBe(3);
    expect(loaded?.plots[0].tilled).toBe(true);
    expect(loaded?.tractors).toEqual([]);
    expect(loaded?.staff).toEqual([]);
  });
  it('migrates v2 -> v3 (keeps tractors/shop, empty staff)', () => {
    const s = memStorage();
    s.setItem(SAVE_KEY, JSON.stringify({
      version: 2, coins: 300,
      seeds: { maize: 5, tomato: 0, carrot: 5 },
      produce: { maize: 1, tomato: 0, carrot: 0 },
      plots: [], buildings: [],
      tractors: [{ uid: 't1', defId: 't20', x: 1, z: 1, angle: 0 }],
      selectedTractorUid: 't1',
      shopStock: { maize: 2, tomato: 0, carrot: 0 },
      prices: { maize: 9, tomato: 14, carrot: 5 },
      tutorialStep: 5,
    }));
    const loaded = loadSave(s);
    expect(loaded?.version).toBe(3);
    expect(loaded?.tractors.length).toBe(1);
    expect(loaded?.shopStock.maize).toBe(2);
    expect(loaded?.staff).toEqual([]);
  });
  it('corrupt save returns null, never throws', () => {
    const s = memStorage();
    s.setItem(SAVE_KEY, '{broken');
    expect(loadSave(s)).toBeNull();
    s.setItem(SAVE_KEY, JSON.stringify({ version: 999 }));
    expect(loadSave(s)).toBeNull();
  });
});
