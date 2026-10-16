import { CROPS, type CropId } from '../core/Config';

export type PlotState = 'empty' | 'planted' | 'growing' | 'ready';

export interface Plot {
  index: number;
  state: PlotState;
  crop: CropId | null;
  progress: number; // 0..1 growth
  water: number; // water applied
  growthTime: number; // elapsed growing seconds
}

export function createPlots(n: number): Plot[] {
  return Array.from({ length: n }, (_, i) => ({
    index: i, state: 'empty' as PlotState, crop: null, progress: 0, water: 0, growthTime: 0,
  }));
}

export function plant(plot: Plot, crop: CropId): { ok: boolean; reason?: string } {
  if (plot.state !== 'empty') return { ok: false, reason: 'Plot is occupied' };
  plot.state = 'planted';
  plot.crop = crop;
  plot.progress = 0;
  plot.water = 0;
  plot.growthTime = 0;
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
  plot.growthTime += dt;
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
