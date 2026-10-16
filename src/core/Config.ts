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

export type CropId = 'maize' | 'tomato' | 'carrot' | 'wheat' | 'pumpkin';

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
  wheat: { id: 'wheat', name: 'Wheat', seedPrice: 12, growTime: 100, waterNeeded: 1, yield: 3, sellBase: 10, minPrice: 5, maxPrice: 16 },
  pumpkin: { id: 'pumpkin', name: 'Pumpkin', seedPrice: 20, growTime: 150, waterNeeded: 2, yield: 2, sellBase: 18, minPrice: 9, maxPrice: 28 },
};

/** Zeroed per-crop record — use everywhere instead of hardcoded crop keys. */
export function emptyCrops(): Record<CropId, number> {
  return { maize: 0, tomato: 0, carrot: 0, wheat: 0, pumpkin: 0 };
}

export interface BuildingDef {
  id: string;
  name: string;
  cost: number;
  size: [number, number]; // w,d in meters
  desc: string;
  maxLevel: number; // 0 = not upgradeable
}

export interface TractorDef {
  id: string;
  name: string;
  price: number;
  speed: number; // m/s
  capability: string;
}

export const BUILDINGS: Record<string, BuildingDef> = {
  shop: { id: 'shop', name: 'Farm Shop', cost: 150, size: [6, 5], desc: 'Upgrade: +1 customer capacity per level', maxLevel: 3 },
  barn: { id: 'barn', name: 'Barn', cost: 120, size: [5, 4], desc: 'Upgrade: +60 storage per level', maxLevel: 3 },
  fence: { id: 'fence', name: 'Fence (1m)', cost: 5, size: [1, 0.3], desc: 'Decoration', maxLevel: 0 },
  path: { id: 'path', name: 'Path (1m)', cost: 2, size: [1, 1], desc: 'Decoration', maxLevel: 0 },
  warehouse: { id: 'warehouse', name: 'Warehouse', cost: 250, size: [6, 5], desc: '+100 produce storage', maxLevel: 0 },
  quarters: { id: 'quarters', name: 'Staff Quarters', cost: 180, size: [5, 4], desc: '+4 staff capacity', maxLevel: 0 },
  coop: { id: 'coop', name: 'Chicken Coop', cost: 200, size: [4, 4], desc: 'Lays eggs for passive income. Upgrade: x1.5 rate/level', maxLevel: 3 },
  garage: { id: 'garage', name: 'Garage', cost: 220, size: [6, 5], desc: 'Unlocks the T-50 tractor tier', maxLevel: 0 },
};

export interface LandTier {
  id: string;
  name: string;
  cost: number;
  plots: number[]; // plot indices unlocked
}

export const LAND_TIERS: LandTier[] = [
  { id: 'east', name: 'East Field (3 plots)', cost: 150, plots: [6, 7, 8] },
  { id: 'north', name: 'North Field (3 plots)', cost: 300, plots: [9, 10, 11] },
];

export const TRACTORS: Record<string, TractorDef> = {
  t20: { id: 't20', name: 'Fieldhand T-20', price: 300, speed: 6, capability: 'Cultivates fields' },
  t50: { id: 't50', name: 'Fieldhand T-50', price: 600, speed: 9, capability: 'Cultivates fields, faster. Requires a garage' },
};

export const Balance = {
  startCoins: 200,
  plots: 12,
  startSeeds: { maize: 5, tomato: 0, carrot: 5, wheat: 2, pumpkin: 0 } as Record<CropId, number>,
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
  // Phase 4 — staff (P0)
  paydayInterval: 120, // s between wage payments
  restockThreshold: 3, // shop stock below this triggers stock-worker restock
  restockQty: 6, // max units per restock trip
  collectTime: 3, // s attendant spends per in-store customer
  checkoutTime: 3, // s cashier spends per checkout
  driveServeTime: 4, // s drive attendant spends per order
  restockTime: 4, // s stock worker spends per restock trip
  // Phase 5 — expansion (P1)
  baseStorageCap: 60, // max produce units without storage buildings
  barnCapPerLevel: 60,
  warehouseCap: 100,
  baseStaffCap: 4,
  quartersStaffCap: 4,
  baseMaxCustomers: 4,
  fertilizerPrice: 20,
  fertilizerBoost: 1.3, // growth speed multiplier on boosted plots
  eggCycle: 60, // s per coop payout
  eggBase: 6, // coins per cycle per coop
  maintenancePerBuilding: 1, // coins per building per payday
  dayLength: 240, // s per day for P/L summaries
} as const;
