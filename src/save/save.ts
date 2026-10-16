import { Balance, CROPS, type CropId } from '../core/Config';
import type { Plot } from '../farming/farming';
import type { PlacedBuilding } from '../buildings/placement';
import type { TractorInstance } from '../vehicles/tractor';
import type { StaffMember } from '../staff/staff';

export const SAVE_KEY = 'dream-farm-3d-save-v1';
export const SAVE_VERSION = 3;

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
  staff: StaffMember[];
  paydayTimer: number;
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
    staff: [],
    paydayTimer: Balance.paydayInterval,
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

function normalizeStaff(raw: unknown): StaffMember[] {
  if (!Array.isArray(raw)) return [];
  const roles = ['attendant', 'cashier', 'stock', 'drive'];
  return (raw as Array<Partial<StaffMember>>)
    .filter((s) => s && roles.includes(s.role as string))
    .map((s, i) => ({
      // in-flight tasks are not restored: everyone reloads idle (no phantom busy, §6)
      uid: typeof s.uid === 'string' ? s.uid : `s${i}`,
      role: s.role as StaffMember['role'],
      state: 'idle' as const,
      taskLabel: null,
      current: null,
      busyLeft: 0,
    }));
}

/** Never throws: returns null on missing/corrupt data (PRD §6). Migrates v1/v2 -> v3. */
export function loadSave(storage: Pick<Storage, 'getItem'>): SaveData | null {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<SaveData> & { version?: number };
    if (typeof data !== 'object' || data === null) return null;
    if (typeof data.coins !== 'number' || !Array.isArray(data.plots) || !Array.isArray(data.buildings)) return null;
    const fallback = defaultSave();
    const plots = normalizePlots(data.plots as unknown[]);
    const base = {
      version: SAVE_VERSION,
      coins: data.coins,
      seeds: { ...fallback.seeds, ...(data.seeds ?? {}) },
      produce: { ...fallback.produce, ...(data.produce ?? {}) },
      plots,
      buildings: data.buildings as PlacedBuilding[],
      tutorialStep: typeof data.tutorialStep === 'number' ? data.tutorialStep : 0,
      timestamp: Date.now(),
    };
    if (data.version === 1 || data.version === 2) {
      // migrate: tractors/shop new in v2, staff new in v3
      const v2 = data as Partial<SaveData>;
      return {
        ...base,
        tractors: data.version === 2 && Array.isArray(v2.tractors) ? (v2.tractors as TractorInstance[]) : [],
        selectedTractorUid: data.version === 2 && typeof v2.selectedTractorUid === 'string' ? v2.selectedTractorUid : null,
        shopStock: data.version === 2 ? { ...fallback.shopStock, ...(v2.shopStock ?? {}) } : { ...fallback.shopStock },
        prices: data.version === 2 ? { ...fallback.prices, ...(v2.prices ?? {}) } : { ...fallback.prices },
        staff: [],
        paydayTimer: Balance.paydayInterval,
      };
    }
    if (data.version !== SAVE_VERSION) return null;
    return {
      ...base,
      tractors: Array.isArray(data.tractors) ? (data.tractors as TractorInstance[]) : [],
      selectedTractorUid: typeof data.selectedTractorUid === 'string' ? data.selectedTractorUid : null,
      shopStock: { ...fallback.shopStock, ...(data.shopStock ?? {}) },
      prices: { ...fallback.prices, ...(data.prices ?? {}) },
      staff: normalizeStaff(data.staff),
      paydayTimer: typeof data.paydayTimer === 'number' ? data.paydayTimer : Balance.paydayInterval,
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
