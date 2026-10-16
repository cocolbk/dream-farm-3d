import { Balance, CROPS, emptyCrops, type CropId } from '../core/Config';
import type { Plot } from '../farming/farming';
import type { PlacedBuilding } from '../buildings/placement';
import type { TractorInstance } from '../vehicles/tractor';
import type { StaffMember } from '../staff/staff';
import { emptyStats, type FarmStats } from '../progression/goals';

export const SAVE_KEY = 'dream-farm-3d-save-v1';
export const SAVE_VERSION = 4;

export interface SaveData {
  version: number;
  coins: number;
  seeds: Record<CropId, number>;
  produce: Record<CropId, number>;
  fertilizer: number;
  plots: Plot[];
  buildings: PlacedBuilding[];
  tractors: TractorInstance[];
  selectedTractorUid: string | null;
  shopStock: Record<CropId, number>;
  prices: Record<CropId, number>;
  staff: StaffMember[];
  paydayTimer: number;
  stats: FarmStats;
  claimed: string[];
  day: number;
  todayIn: number;
  todayOut: number;
  tutorialStep: number;
  timestamp: number;
}

export function defaultSave(): SaveData {
  const prices = emptyCrops();
  for (const id of Object.keys(CROPS) as CropId[]) prices[id] = CROPS[id].sellBase;
  return {
    version: SAVE_VERSION,
    coins: Balance.startCoins,
    seeds: { ...Balance.startSeeds },
    produce: emptyCrops(),
    fertilizer: 0,
    plots: [],
    buildings: [],
    tractors: [],
    selectedTractorUid: null,
    shopStock: emptyCrops(),
    prices,
    staff: [],
    paydayTimer: Balance.paydayInterval,
    stats: emptyStats(),
    claimed: [],
    day: 1,
    todayIn: 0,
    todayOut: 0,
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
      crop: o.crop === 'maize' || o.crop === 'tomato' || o.crop === 'carrot' || o.crop === 'wheat' || o.crop === 'pumpkin' ? o.crop : null,
      progress: typeof o.progress === 'number' ? o.progress : 0,
      water: typeof o.water === 'number' ? o.water : 0,
      growthTime: typeof o.growthTime === 'number' ? o.growthTime : 0,
      // v1 saves have no tilled flag: old plots were all plantable -> default true
      tilled: typeof o.tilled === 'boolean' ? o.tilled : true,
      // pre-v4 saves have 6 plots: expansion fields default locked
      locked: typeof o.locked === 'boolean' ? o.locked : (typeof o.index === 'number' ? o.index : i) >= 6,
      boosted: typeof o.boosted === 'boolean' ? o.boosted : false,
    };
  });
}

function normalizeBuildings(raw: unknown): PlacedBuilding[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Array<Partial<PlacedBuilding>>)
    .filter((b) => b && typeof b.defId === 'string')
    .map((b) => ({
      id: typeof b.id === 'string' ? b.id : `b${Math.round(Math.random() * 1e9)}`,
      defId: b.defId as string,
      x: typeof b.x === 'number' ? b.x : 0,
      z: typeof b.z === 'number' ? b.z : 0,
      rot: typeof b.rot === 'number' ? b.rot : 0,
      level: typeof b.level === 'number' ? b.level : 0,
    }));
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

/** Never throws: returns null on missing/corrupt data (PRD §6). Migrates v1/v2/v3 -> v4. */
export function loadSave(storage: Pick<Storage, 'getItem'>): SaveData | null {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<SaveData> & { version?: number };
    if (typeof data !== 'object' || data === null) return null;
    if (typeof data.coins !== 'number' || !Array.isArray(data.plots) || !Array.isArray(data.buildings)) return null;
    const fallback = defaultSave();
    let plots = normalizePlots(data.plots as unknown[]);
    // pre-v4 saves have 6 plots: append locked expansion fields
    if ((data.version ?? 0) < 4 && plots.length === 6) {
      const extra = normalizePlots([6, 7, 8, 9, 10, 11].map((index) => ({ index })));
      plots = plots.concat(extra);
    }
    const buildings = normalizeBuildings(data.buildings);
    const base = {
      version: SAVE_VERSION,
      coins: data.coins,
      seeds: { ...fallback.seeds, ...(data.seeds ?? {}) },
      produce: { ...fallback.produce, ...(data.produce ?? {}) },
      fertilizer: typeof data.fertilizer === 'number' ? data.fertilizer : 0,
      plots,
      buildings,
      tutorialStep: typeof data.tutorialStep === 'number' ? data.tutorialStep : 0,
      timestamp: Date.now(),
    };
    if ((data.version ?? 0) < 4) {
      // migrate: tractors/shop new in v2, staff new in v3, expansion/goals new in v4
      const v = data as Partial<SaveData>;
      const hasShop = data.version === 2 || data.version === 3;
      const hasStaff = data.version === 3;
      return {
        ...base,
        tractors: hasShop && Array.isArray(v.tractors) ? (v.tractors as TractorInstance[]) : [],
        selectedTractorUid: hasShop && typeof v.selectedTractorUid === 'string' ? v.selectedTractorUid : null,
        shopStock: hasShop ? { ...fallback.shopStock, ...(v.shopStock ?? {}) } : { ...fallback.shopStock },
        prices: hasShop ? { ...fallback.prices, ...(v.prices ?? {}) } : { ...fallback.prices },
        staff: hasStaff ? normalizeStaff(v.staff) : [],
        paydayTimer: hasStaff && typeof v.paydayTimer === 'number' ? v.paydayTimer : Balance.paydayInterval,
        stats: emptyStats(),
        claimed: [],
        day: 1,
        todayIn: 0,
        todayOut: 0,
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
      stats: { ...emptyStats(), ...(data.stats ?? {}) },
      claimed: Array.isArray(data.claimed) ? (data.claimed as string[]) : [],
      day: typeof data.day === 'number' ? data.day : 1,
      todayIn: typeof data.todayIn === 'number' ? data.todayIn : 0,
      todayOut: typeof data.todayOut === 'number' ? data.todayOut : 0,
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
