import { CROPS, Balance, type CropId } from '../core/Config';

export type PlotState = 'empty' | 'planted' | 'growing' | 'ready';

export interface Plot {
  index: number;
  state: PlotState;
  crop: CropId | null;
  progress: number; // 0..1 growth
  water: number; // water applied
  growthTime: number; // elapsed growing seconds
  tilled: boolean; // Phase 2: must cultivate before planting
  locked: boolean; // Phase 5: land expansion tiers
  boosted: boolean; // Phase 5: fertilizer x1.3 growth
}

export function createPlots(n: number): Plot[] {
  return Array.from({ length: n }, (_, i) => ({
    index: i, state: 'empty' as PlotState, crop: null, progress: 0, water: 0, growthTime: 0,
    tilled: i < 2, // starter: 2 pre-tilled so tutorial works without tractor
    locked: i >= 6, // Phase 5: east/north fields unlockable
    boosted: false,
  }));
}

/** Cultivate an empty untilled plot (tractor action). */
export function till(plot: Plot): { ok: boolean; reason?: string } {
  if (plot.locked) return { ok: false, reason: 'Locked plot — expand land first' };
  if (plot.state !== 'empty') return { ok: false, reason: 'Plot is occupied' };
  if (plot.tilled) return { ok: false, reason: 'Already cultivated' };
  plot.tilled = true;
  return { ok: true };
}

export function plant(plot: Plot, crop: CropId): { ok: boolean; reason?: string } {
  if (plot.locked) return { ok: false, reason: 'Locked plot — expand land first' };
  if (plot.state !== 'empty') return { ok: false, reason: 'Plot is occupied' };
  if (!plot.tilled) return { ok: false, reason: 'Needs cultivating — use a tractor' };
  plot.state = 'planted';
  plot.crop = crop;
  plot.progress = 0;
  plot.water = 0;
  plot.growthTime = 0;
  plot.boosted = false;
  return { ok: true };
}

/** Fertilizer: one-time x1.3 growth boost for the current crop. */
export function fertilize(plot: Plot): { ok: boolean; reason?: string } {
  if (plot.locked) return { ok: false, reason: 'Locked plot' };
  if (plot.state !== 'planted' && plot.state !== 'growing') return { ok: false, reason: 'Nothing to fertilize' };
  if (plot.boosted) return { ok: false, reason: 'Already fertilized' };
  plot.boosted = true;
  return { ok: true };
}

export function water(plot: Plot): { ok: boolean; reason?: string } {
  if (plot.state !== 'planted' && plot.state !== 'growing') {
    return { ok: false, reason: 'Nothing to water' };
  }
  plot.water += 1;
  if (plot.state === 'planted') plot.state = 'growing';
  return { ok: true };
}

/** Advance growth by dt seconds. Requires water >= waterNeeded (simple P0 rule). */
export function tickPlot(plot: Plot, dt: number): void {
  if (plot.state !== 'growing' || !plot.crop) return;
  const def = CROPS[plot.crop];
  if (plot.water < def.waterNeeded) return; // paused until watered
  plot.growthTime += dt * (plot.boosted ? Balance.fertilizerBoost : 1);
  plot.progress = Math.min(1, plot.growthTime / def.growTime);
  if (plot.progress >= 1) plot.state = 'ready';
}

export function harvest(plot: Plot): { ok: boolean; crop?: CropId; qty?: number; reason?: string } {
  if (plot.state !== 'ready' || !plot.crop) return { ok: false, reason: 'Crop is not ready' };
  const def = CROPS[plot.crop];
  const crop = plot.crop;
  const qty = def.yield;
  plot.state = 'empty';
  plot.crop = null;
  plot.progress = 0;
  plot.water = 0;
  plot.growthTime = 0;
  return { ok: true, crop, qty };
}
