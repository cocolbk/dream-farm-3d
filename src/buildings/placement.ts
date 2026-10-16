import { BUILDINGS, Balance } from '../core/Config';

export interface PlacedBuilding {
  id: string; // unique instance id
  defId: string;
  x: number;
  z: number;
  rot: number;
}

export interface AABB { minX: number; maxX: number; minZ: number; maxZ: number; }

export function footprint(defId: string, x: number, z: number): AABB {
  const def = BUILDINGS[defId];
  const [w, d] = def.size;
  return { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 };
}

function overlaps(a: AABB, b: AABB): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
}

/** Pure validation (unit-tested): bounds + no overlap. Coins checked separately. */
export function validatePlacement(
  defId: string, x: number, z: number, existing: PlacedBuilding[],
): { ok: boolean; reason?: string } {
  if (!BUILDINGS[defId]) return { ok: false, reason: 'Unknown building' };
  const b = Balance.farmBounds;
  const fp = footprint(defId, x, z);
  if (fp.minX < -b || fp.maxX > b || fp.minZ < -b || fp.maxZ > b) {
    return { ok: false, reason: 'Outside owned land' };
  }
  for (const e of existing) {
    if (overlaps(fp, footprint(e.defId, e.x, e.z))) {
      return { ok: false, reason: 'Overlaps another building' };
    }
  }
  return { ok: true };
}
