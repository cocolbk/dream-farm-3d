import { Balance, CROPS, type CropId } from '../core/Config';
import type { Plot } from '../farming/farming';
import type { PlacedBuilding } from '../buildings/placement';
import type { TractorInstance } from '../vehicles/tractor';

export const SAVE_KEY = 'dream-farm-3d-save-v1';
export const SAVE_VERSION = 2;

export interface SaveData {
  version: number;
  coins: number;
  seeds: Record<CropId, number>;
  produce: Record<CropId, number>;
  plots: Plot[];
  buildings: PlacedBuilding[];
  tractors: TractorInstance[];
  selectedTractorUid: string | null;
  shopStock: Record<CropId, number>;
  prices: Record<CropId, number>;
  tutorialStep: number;
  timestamp: number;
}

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    coins: Balance.startCoins,
    seeds: { ...Balance.startSeeds },
    produce: { maize: 0, tomato: 0, carrot: 0 },
    plots: [],
    buildings: [],
    tractors: [],
    selectedTractorUid: null,
    shopStock: { maize: 0, tomato: 0, carrot: 0 },
    prices: { maize: CROPS.maize.sellBase, tomato: CROPS.tomato.sellBase, carrot: CROPS.carrot.sellBase },
    tutorialStep: 0,
    timestamp: Date.now(),
  };
}

function normalizePlots(raw: unknown[]): Plot[] {
  return raw.map((p, i) => {
    const o = p as Partial<Plot>;
    return {
      index: typeof o.index === 'number' ? o.index : i,
      state: o.state === 'planted' || o.state === 'growing' || o.state === 'ready' ? o.state : 'empty',
      crop: o.crop === 'maize' || o.crop === 'tomato' || o.crop === 'carrot' ? o.crop : null,
      progress: typeof o.progress === 'number' ? o.progress : 0,
      water: typeof o.water === 'number' ? o.water : 0,
      growthTime: typeof o.growthTime === 'number' ? o.growthTime : 0,
      // v1 saves have no tilled flag: old plots were all plantable -> default true
      tilled: typeof o.tilled === 'boolean' ? o.tilled : true,
    };
  });
}

/** Never throws: returns null on missing/corrupt data (PRD §6). Migrates v1 -> v2. */
export function loadSave(storage: Pick<Storage, 'getItem'>): SaveData | null {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<SaveData> & { version?: number };
    if (typeof data !== 'object' || data === null) return null;
    if (typeof data.coins !== 'number' || !Array.isArray(data.plots) || !Array.isArray(data.buildings)) return null;
    const fallback = defaultSave();
    const plots = normalizePlots(data.plots as unknown[]);
    if (data.version === 1) {
      // migrate v1 -> v2: tractors/shop new, plots default tilled=true
      return {
        version: SAVE_VERSION,
        coins: data.coins,
        seeds: { ...fallback.seeds, ...(data.seeds ?? {}) },
        produce: { ...fallback.produce, ...(data.produce ?? {}) },
        plots,
        buildings: data.buildings as PlacedBuilding[],
        tractors: [],
        selectedTractorUid: null,
        shopStock: { ...fallback.shopStock },
        prices: { ...fallback.prices },
        tutorialStep: typeof data.tutorialStep === 'number' ? data.tutorialStep : 0,
        timestamp: Date.now(),
      };
    }
    if (data.version !== SAVE_VERSION) return null;
    return {
      version: SAVE_VERSION,
      coins: data.coins,
      seeds: { ...fallback.seeds, ...(data.seeds ?? {}) },
      produce: { ...fallback.produce, ...(data.produce ?? {}) },
      plots,
      buildings: data.buildings as PlacedBuilding[],
      tractors: Array.isArray(data.tractors) ? (data.tractors as TractorInstance[]) : [],
      selectedTractorUid: typeof data.selectedTractorUid === 'string' ? data.selectedTractorUid : null,
      shopStock: { ...fallback.shopStock, ...(data.shopStock ?? {}) },
      prices: { ...fallback.prices, ...(data.prices ?? {}) },
      tutorialStep: typeof data.tutorialStep === 'number' ? data.tutorialStep : 0,
      timestamp: Date.now(),
    };
  } catch {
    return null;
  }
}

export function writeSave(storage: Pick<Storage, 'setItem'>, data: SaveData): void {
  storage.setItem(SAVE_KEY, JSON.stringify({ ...data, timestamp: Date.now() }));
}

export function clearSave(storage: Pick<Storage, 'removeItem'>): void {
  storage.removeItem(SAVE_KEY);
}
