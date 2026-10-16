import type { CropId } from '../core/Config';

// AD-3: ONLY mutator of seeds/produce. Sales use reserve/commit atomically.
export class InventoryService {
  seeds: Record<CropId, number>;
  produce: Record<CropId, number>;

  constructor(startSeeds: Record<CropId, number>) {
    this.seeds = { ...startSeeds };
    this.produce = { maize: 0, tomato: 0, carrot: 0 };
  }

  takeSeed(crop: CropId): { ok: boolean; reason?: string } {
    if (this.seeds[crop] <= 0) return { ok: false, reason: `No ${crop} seeds` };
    this.seeds[crop] -= 1;
    return { ok: true };
  }

  addProduce(crop: CropId, qty: number): void {
    this.produce[crop] += qty;
  }

  takeProduce(crop: CropId, qty: number): { ok: boolean; reason?: string } {
    if (qty <= 0) return { ok: false, reason: 'Quantity must be > 0' };
    if (this.produce[crop] < qty) return { ok: false, reason: `Not enough ${crop} in storage` };
    this.produce[crop] -= qty;
    return { ok: true };
  }
}
