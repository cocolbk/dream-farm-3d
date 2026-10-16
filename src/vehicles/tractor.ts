import { TRACTORS } from '../core/Config';

export interface TractorInstance {
  uid: string;
  defId: string;
  x: number;
  z: number;
  angle: number; // radians, facing
}

/** Pure ownership helpers (unit-tested). Movement integrated in main.ts. */
export function canBuyTractor(defId: string, balance: number, owned: TractorInstance[]): { ok: boolean; reason?: string } {
  const def = TRACTORS[defId];
  if (!def) return { ok: false, reason: 'Unknown tractor' };
  if (balance < def.price) return { ok: false, reason: 'Not enough coins' };
  return { ok: true };
}

export function createTractor(defId: string, spawnX: number, spawnZ: number): TractorInstance {
  return { uid: `t${Date.now()}`, defId, x: spawnX, z: spawnZ, angle: 0 };
}

/** Kinematic drive step. Returns new x/z/angle. */
export function driveStep(
  t: TractorInstance, throttle: number, steer: number, dt: number, speed: number, bounds: number,
): TractorInstance {
  const angle = t.angle + steer * 2.2 * dt;
  const nx = Math.max(-bounds, Math.min(bounds, t.x + Math.sin(angle) * throttle * speed * dt));
  const nz = Math.max(-bounds, Math.min(bounds, t.z + Math.cos(angle) * throttle * speed * dt));
  return { ...t, x: nx, z: nz, angle };
}
