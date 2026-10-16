import { describe, it, expect } from 'vitest';
import { createPlots, plant, water, tickPlot, harvest, till } from '../../src/farming/farming';

describe('farming', () => {
  it('full cycle maize with 1 water (pre-tilled plot 0)', () => {
    const plots = createPlots(6);
    const p = plots[0];
    expect(p.tilled).toBe(true);
    expect(plant(p, 'maize').ok).toBe(true);
    expect(plant(p, 'maize').ok).toBe(false); // occupied
    expect(water(p).ok).toBe(true);
    tickPlot(p, 90);
    expect(p.state).toBe('ready');
    const h = harvest(p);
    expect(h.ok && h.qty).toBe(3);
    expect(p.state).toBe('empty');
  });
  it('untilled plot needs cultivating first', () => {
    const plots = createPlots(6);
    const p = plots[4];
    expect(p.tilled).toBe(false);
    expect(plant(p, 'maize').ok).toBe(false);
    expect(till(p).ok).toBe(true);
    expect(plant(p, 'maize').ok).toBe(true);
  });
  it('pauses without water', () => {
    const plots = createPlots(6);
    const p = plots[0];
    plant(p, 'carrot');
    p.state = 'growing';
    p.water = 0;
    tickPlot(p, 60);
    expect(p.state).not.toBe('ready');
  });
  it('tomato needs 2 water', () => {
    const plots = createPlots(6);
    const p = plots[1];
    plant(p, 'tomato');
    water(p);
    tickPlot(p, 120);
    expect(p.state).not.toBe('ready'); // only 1 water
    water(p);
    tickPlot(p, 120);
    expect(p.state).toBe('ready');
  });
});
