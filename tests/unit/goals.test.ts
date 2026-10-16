import { describe, it, expect } from 'vitest';
import { checkGoals, emptyStats, GOALS, type GoalState } from '../../src/progression/goals';

function state(over: Partial<GoalState>): GoalState {
  return { stats: emptyStats(), claimed: [], staffCount: 0, unlockedPlots: 6, ...over };
}

describe('goals', () => {
  it('unlocks first-harvest once', () => {
    expect(checkGoals(state({ stats: { ...emptyStats(), harvests: 1 } })).map((g) => g.id))
      .toContain('first-harvest');
    expect(checkGoals(state({ stats: emptyStats() }))).toEqual([]);
  });
  it('does not re-unlock claimed goals', () => {
    const s = state({ stats: { ...emptyStats(), harvests: 5, sales: 50 }, claimed: ['first-harvest'] });
    const ids = checkGoals(s).map((g) => g.id);
    expect(ids).not.toContain('first-harvest');
    expect(ids).toContain('seller-10');
  });
  it('all six goals reachable', () => {
    const s = state({
      stats: { earned: 5000, sales: 50, happyServes: 10, harvests: 3 },
      staffCount: 4, unlockedPlots: 12,
    });
    expect(checkGoals(s).length).toBe(6);
    expect(GOALS.length).toBe(6);
  });
});
