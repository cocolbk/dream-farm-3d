import { describe, it, expect } from 'vitest';
import { validatePlacement, type PlacedBuilding } from '../../src/buildings/placement';

describe('placement', () => {
  it('rejects overlap without charging (pure check)', () => {
    const existing: PlacedBuilding[] = [{ id: 'a', defId: 'barn', x: 0, z: 0, rot: 0 }];
    expect(validatePlacement('barn', 0, 0, existing).ok).toBe(false);
    expect(validatePlacement('barn', 20, 20, existing).ok).toBe(true);
  });
  it('rejects outside owned land', () => {
    expect(validatePlacement('barn', 100, 100, []).ok).toBe(false);
  });
});
