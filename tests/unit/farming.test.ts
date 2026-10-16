import { describe, it, expect } from 'vitest';
import { createPlots, plant, water, tickPlot, harvest } from '../../src/farming/farming';

describe('farming', () => {
  it('full cycle maize with 1 water', () => {
    const [p] = createPlots(1);
    expect(plant(p, 'maize').ok).toBe(true);
    expect(plant(p, 'maize').ok).toBe(false); // occupied
    expect(water(p).ok).toBe(true);
    tickPlot(p, 90);
    expect(p.state).toBe('ready');
    const h = harvest(p);
    expect(h.ok && h.qty).toBe(3);
    expect(p.state).toBe('empty');
  });
  it('pauses without water', () => {
    const [p] = createPlots(1);
    plant(p, 'carrot');
    p.state = 'growing'; // simulate watered then dried? direct growing without water
    p.water = 0;
    tickPlot(p, 60);
    expect(p.state).not.toBe('ready');
  });
  it('tomato needs 2 water', () => {
    const [p] = createPlots(1);
    plant(p, 'tomato');
    water(p);
    tickPlot(p, 120);
    expect(p.state).not.toBe('ready'); // only 1 water
    water(p);
    tickPlot(p, 120);
    expect(p.state).toBe('ready');
  });
});
