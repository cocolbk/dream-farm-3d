import { Balance, type CropId } from '../core/Config';
import type { Plot } from '../farming/farming';
import type { PlacedBuilding } from '../buildings/placement';

export const SAVE_KEY = 'dream-farm-3d-save-v1';
export const SAVE_VERSION = 1;

export interface SaveData {
  version: number;
  coins: number;
  seeds: Record<CropId, number>;
  produce: Record<CropId, number>;
  plots: Plot[];
  buildings: PlacedBuilding[];
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
    tutorialStep: 0,
    timestamp: Date.now(),
  };
}

/** Never throws: returns null on missing/corrupt data (PRD §6). */
export function loadSave(storage: Pick<Storage, 'getItem'>): SaveData | null {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<SaveData>;
    if (typeof data !== 'object' || data === null) return null;
    if (data.version !== SAVE_VERSION) return null; // migrate in Phase 5
    if (typeof data.coins !== 'number' || !Array.isArray(data.plots) || !Array.isArray(data.buildings)) return null;
    const fallback = defaultSave();
    return {
      version: SAVE_VERSION,
      coins: data.coins,
      seeds: { ...fallback.seeds, ...(data.seeds ?? {}) },
      produce: { ...fallback.produce, ...(data.produce ?? {}) },
      plots: data.plots,
      buildings: data.buildings,
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
