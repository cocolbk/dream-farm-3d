// Design tokens + economy balance (single source of truth).
// Palette from IMPLEMENTATION_PLAN.md §0.2 — all materials must reference these.

export const Palette = {
  grass: 0x7ec850,
  grassDark: 0x5da93c,
  path: 0xd9b382,
  soilTilled: 0x8a5a33,
  soilDry: 0x6e4426,
  wood: 0xa67c52,
  barnRed: 0xc94f4f,
  roof: 0x7a4a3a,
  cream: 0xfff6e9,
  water: 0x5bc0eb,
  maize: 0xffc93c,
  stalk: 0x3e9b4f,
  tomato: 0xe94f37,
  carrot: 0xf08a24,
  leaf: 0x4caf50,
} as const;

export type CropId = 'maize' | 'tomato' | 'carrot';

export interface CropDef {
  id: CropId;
  name: string;
  seedPrice: number;
  growTime: number; // seconds
  waterNeeded: number;
  yield: number;
  sellBase: number;
  minPrice: number;
  maxPrice: number;
}

export const CROPS: Record<CropId, CropDef> = {
  maize: { id: 'maize', name: 'Maize', seedPrice: 10, growTime: 90, waterNeeded: 1, yield: 3, sellBase: 8, minPrice: 4, maxPrice: 14 },
  tomato: { id: 'tomato', name: 'Tomato', seedPrice: 15, growTime: 120, waterNeeded: 2, yield: 2, sellBase: 14, minPrice: 7, maxPrice: 22 },
  carrot: { id: 'carrot', name: 'Carrot', seedPrice: 8, growTime: 60, waterNeeded: 1, yield: 4, sellBase: 5, minPrice: 2, maxPrice: 9 },
};

export interface BuildingDef {
  id: string;
  name: string;
  cost: number;
  size: [number, number]; // w,d in meters
}

export interface TractorDef {
  id: string;
  name: string;
  price: number;
  speed: number; // m/s
  capability: string;
}

export const BUILDINGS: Record<string, BuildingDef> = {
  shop: { id: 'shop', name: 'Farm Shop', cost: 150, size: [6, 5] },
  barn: { id: 'barn', name: 'Barn', cost: 120, size: [5, 4] },
  fence: { id: 'fence', name: 'Fence (1m)', cost: 5, size: [1, 0.3] },
  path: { id: 'path', name: 'Path (1m)', cost: 2, size: [1, 1] },
};

export const TRACTORS: Record<string, TractorDef> = {
  t20: { id: 't20', name: 'Fieldhand T-20', price: 300, speed: 6, capability: 'Cultivates fields' },
};

export const Balance = {
  startCoins: 200,
  plots: 6,
  startSeeds: { maize: 5, tomato: 0, carrot: 5 } as Record<CropId, number>,
  confirmThreshold: 100,
  farmBounds: 38, // half-size of owned land square
  // Phase 3 — customer vehicles (P0)
  parkingBays: 4,
  driveQueueSlots: 3,
  maxCustomers: 4,
  spawnMin: 20, // seconds
  spawnMax: 35,
  shopWait: 8, // s parked before checkout attempt
  serveTimeout: 45, // s before unserved customer leaves
  driveAutoServe: 12, // s before drive-through auto-handoff (pre-staff fallback)
  vehicleSpeed: 5, // m/s
} as const;
