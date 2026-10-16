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
  it('round-trips', () => {
    const s = memStorage();
    const d = defaultSave();
    d.coins = 999;
    writeSave(s, d);
    expect(loadSave(s)?.coins).toBe(999);
  });
  it('corrupt save returns null, never throws', () => {
    const s = memStorage();
    s.setItem(SAVE_KEY, '{broken');
    expect(loadSave(s)).toBeNull();
    s.setItem(SAVE_KEY, JSON.stringify({ version: 999 }));
    expect(loadSave(s)).toBeNull();
  });
});
