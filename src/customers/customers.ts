import { CROPS, Balance, type CropId } from '../core/Config';

// Phase 3 — customer vehicles: reservations, requests, purchase validation.
// Pure logic (no three.js) so it is fully unit-testable.

export type CustomerMode = 'instore' | 'drive';
export type CustomerState =
  | 'arriving' | 'toSlot' | 'parked' | 'queued'
  | 'shopping' | 'ordering' | 'served' | 'leaving' | 'gone';

export interface OrderItem { crop: CropId; qty: number; }

export interface Customer {
  id: string;
  mode: CustomerMode;
  items: OrderItem[];
  budget: number;
  state: CustomerState;
  slot: number; // parking bay or queue index, -1 if none
  wait: number; // s spent waiting for service
  reason: string; // last status / leave reason
  waypoints: Array<{ x: number; z: number }>;
  wpIndex: number;
  x: number;
  z: number;
}

/** Deterministic RNG (AD-4): reproducible spawns/budgets. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fixed route geometry shared with world/roads.ts. */
export const ROUTE = {
  entrance: { x: 36, z: -24 },
  junctionIn: { x: 28, z: -12 },
  approach: { x: 24, z: -1 },
  junctionOut: { x: 28, z: 14 },
  exit: { x: 36, z: 24 },
  bays: [
    { x: 20, z: -6 }, { x: 20, z: -1 }, { x: 20, z: 4 }, { x: 20, z: 9 },
  ],
  queue: [
    { x: 4, z: -12 }, { x: 4, z: -6 }, { x: 4, z: 0 },
  ],
};

export class ReservationManager {
  bays: boolean[];
  queue: boolean[];
  constructor(bays: number = Balance.parkingBays, queue: number = Balance.driveQueueSlots) {
    this.bays = new Array(bays).fill(false);
    this.queue = new Array(queue).fill(false);
  }
  reserveBay(): number {
    const i = this.bays.indexOf(false);
    if (i === -1) return -1;
    this.bays[i] = true;
    return i;
  }
  reserveQueue(): number {
    const i = this.queue.indexOf(false);
    if (i === -1) return -1;
    this.queue[i] = true;
    return i;
  }
  releaseBay(i: number): void { if (i >= 0 && i < this.bays.length) this.bays[i] = false; }
  releaseQueue(i: number): void { if (i >= 0 && i < this.queue.length) this.queue[i] = false; }
}

/** Build a shopping list from in-stock types when possible (PRD §4.6). */
export function generateRequest(
  rng: () => number,
  stock: Record<CropId, number>,
  prices: Record<CropId, number>,
): { items: OrderItem[]; budget: number } {
  const available = (Object.keys(CROPS) as CropId[]).filter((c) => stock[c] > 0);
  const pool = available.length > 0 ? available : (Object.keys(CROPS) as CropId[]);
  const n = 1 + Math.floor(rng() * Math.min(3, pool.length));
  const items: OrderItem[] = [];
  for (let i = 0; i < n; i++) {
    const crop = pool[Math.floor(rng() * pool.length)];
    const qty = 1 + Math.floor(rng() * 3);
    const existing = items.find((it) => it.crop === crop);
    if (existing) existing.qty += qty;
    else items.push({ crop, qty });
  }
  const total = items.reduce((a, it) => a + it.qty * prices[it.crop], 0);
  const budget = Math.max(10, Math.min(120, Math.round(total * (0.8 + rng() * 0.7))));
  return { items, budget };
}

export function orderTotal(items: OrderItem[], prices: Record<CropId, number>): number {
  return items.reduce((a, it) => a + it.qty * prices[it.crop], 0);
}

export interface PurchaseCheck {
  ok: boolean;
  reason?: string;
  total?: number;
}

/** Validate without mutating: stock for every line + budget covers total. */
export function checkPurchase(
  items: OrderItem[],
  budget: number,
  stock: Record<CropId, number>,
  prices: Record<CropId, number>,
): PurchaseCheck {
  for (const it of items) {
    if ((stock[it.crop] ?? 0) < it.qty) return { ok: false, reason: `Out of stock: ${it.crop}` };
  }
  const total = orderTotal(items, prices);
  if (total > budget) return { ok: false, reason: `Over budget (${total} > ${budget})` };
  return { ok: true, total };
}

export function spawnCustomer(
  id: string,
  mode: CustomerMode,
  slot: number,
  req: { items: OrderItem[]; budget: number },
): Customer {
  const dest = mode === 'instore' ? ROUTE.bays[slot] : ROUTE.queue[slot];
  return {
    id, mode, items: req.items, budget: req.budget,
    state: 'arriving', slot, wait: 0, reason: 'Arriving',
    waypoints: [ROUTE.entrance, ROUTE.junctionIn, ROUTE.approach, dest],
    wpIndex: 0, x: ROUTE.entrance.x, z: ROUTE.entrance.z,
  };
}

export function exitWaypoints(): Array<{ x: number; z: number }> {
  return [ROUTE.junctionOut, ROUTE.exit];
}

/** Advance one customer along waypoints. Returns true when destination reached. */
export function moveAlong(c: Customer, dt: number, speed = Balance.vehicleSpeed): boolean {
  const wp = c.waypoints[c.wpIndex];
  if (!wp) return true;
  const dx = wp.x - c.x;
  const dz = wp.z - c.z;
  const dist = Math.hypot(dx, dz);
  const step = speed * dt;
  if (dist <= step) {
    c.x = wp.x;
    c.z = wp.z;
    c.wpIndex += 1;
    return c.wpIndex >= c.waypoints.length;
  }
  c.x += (dx / dist) * step;
  c.z += (dz / dist) * step;
  return false;
}
