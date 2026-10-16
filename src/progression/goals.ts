// Phase 5 — achievements/milestones. Pure defs + checks, unit-tested.

export interface FarmStats {
  earned: number; // total coins earned (all time)
  sales: number; // completed sale transactions
  happyServes: number; // customers served fast (wait < 15s)
  harvests: number;
}

export function emptyStats(): FarmStats {
  return { earned: 0, sales: 0, happyServes: 0, harvests: 0 };
}

export interface GoalDef {
  id: string;
  name: string;
  desc: string;
  reward: number;
}

export const GOALS: GoalDef[] = [
  { id: 'first-harvest', name: 'First Sprouts', desc: 'Harvest your first crop', reward: 20 },
  { id: 'seller-10', name: 'Market Regular', desc: 'Complete 10 sales', reward: 50 },
  { id: 'happy-5', name: 'Villager Favorite', desc: 'Serve 5 customers fast (★★★)', reward: 60 },
  { id: 'crew-4', name: 'Full Crew', desc: 'Employ 4 staff at once', reward: 80 },
  { id: 'rich-1000', name: 'Mill Coin', desc: 'Earn 1,000 coins total', reward: 100 },
  { id: 'landowner', name: 'Landowner', desc: 'Unlock all 12 plots', reward: 150 },
];

export interface GoalState {
  stats: FarmStats;
  claimed: string[];
  staffCount: number;
  unlockedPlots: number;
}

/** Returns newly unlocked goals (caller pays rewards + marks claimed). */
export function checkGoals(s: GoalState): GoalDef[] {
  const out: GoalDef[] = [];
  const has = (id: string) => s.claimed.includes(id) || out.some((g) => g.id === id);
  if (!has('first-harvest') && s.stats.harvests >= 1) out.push(GOALS[0]);
  if (!has('seller-10') && s.stats.sales >= 10) out.push(GOALS[1]);
  if (!has('happy-5') && s.stats.happyServes >= 5) out.push(GOALS[2]);
  if (!has('crew-4') && s.staffCount >= 4) out.push(GOALS[3]);
  if (!has('rich-1000') && s.stats.earned >= 1000) out.push(GOALS[4]);
  if (!has('landowner') && s.unlockedPlots >= 12) out.push(GOALS[5]);
  return out;
}
