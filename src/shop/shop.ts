import { CROPS, emptyCrops, type CropId } from '../core/Config';

// Shop stock + pricing. Works with InventoryService + EconomyService atomically
// via transfer()/sell() helpers (no dupes: validate first, mutate once).
export interface SaleRecord {
  t: number;
  crop: CropId;
  qty: number;
  revenue: number;
}

export class ShopService {
  stock: Record<CropId, number> = emptyCrops();
  prices: Record<CropId, number>;
  recentSales: SaleRecord[] = [];

  constructor() {
    const prices = emptyCrops();
    for (const id of Object.keys(CROPS) as CropId[]) prices[id] = CROPS[id].sellBase;
    this.prices = prices;
  }

  setPrice(crop: CropId, price: number): { ok: boolean; reason?: string } {
    const def = CROPS[crop];
    if (!Number.isFinite(price)) return { ok: false, reason: 'Invalid price' };
    const clamped = Math.round(Math.min(def.maxPrice, Math.max(def.minPrice, price)));
    this.prices[crop] = clamped;
    if (clamped !== price) return { ok: true, reason: `Clamped to ${clamped}` };
    return { ok: true };
  }

  /** Move produce -> shop stock. Caller must have validated via inventory.takeProduce first. */
  addStock(crop: CropId, qty: number): void {
    this.stock[crop] += qty;
  }

  /** Validate a sale without mutating (Phase 3 customers reuse this). */
  canSell(crop: CropId, qty: number): { ok: boolean; reason?: string } {
    if (qty <= 0) return { ok: false, reason: 'Quantity must be > 0' };
    if (this.stock[crop] < qty) return { ok: false, reason: `Out of stock: ${crop}` };
    return { ok: true };
  }

  /** Commit a validated sale: deduct stock + record. Coins handled by EconomyService. */
  commitSale(crop: CropId, qty: number): { ok: boolean; revenue?: number; reason?: string } {
    const c = this.canSell(crop, qty);
    if (!c.ok) return c;
    this.stock[crop] -= qty;
    const revenue = qty * this.prices[crop];
    this.recentSales.unshift({ t: Date.now(), crop, qty, revenue });
    if (this.recentSales.length > 20) this.recentSales.pop();
    return { ok: true, revenue };
  }
}
