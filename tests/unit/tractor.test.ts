import { describe, it, expect } from 'vitest';
import { canBuyTractor, createTractor, driveStep } from '../../src/vehicles/tractor';

describe('tractor', () => {
  it('blocks purchase with insufficient coins', () => {
    expect(canBuyTractor('t20', 100, []).ok).toBe(false);
    expect(canBuyTractor('t20', 300, []).ok).toBe(true);
    expect(canBuyTractor('nope', 9999, []).ok).toBe(false);
  });
  it('drive step moves and clamps to bounds', () => {
    const t = createTractor('t20', 0, 0);
    const moved = driveStep(t, 1, 0, 1, 6, 38);
    expect(moved.z).toBeGreaterThan(0);
    const far = driveStep({ ...t, x: 37.9, z: 37.9, angle: 0 }, 1, 0, 10, 6, 38);
    expect(far.x).toBeLessThanOrEqual(38);
    expect(far.z).toBeLessThanOrEqual(38);
  });
});
