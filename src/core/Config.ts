// Design tokens + economy balance (single source of truth, Phase 0).
// Palette from IMPLEMENTATION_PLAN.md §0.2 — all materials must reference these.

export const Palette = {
  grass: 0x7ec850,
  grassDark: 0x5da93c,
  path: 0xd9b382,
  soilTilled: 0x8a5a33,
  wood: 0xa67c52,
  barnRed: 0xc94f4f,
  roof: 0x7a4a3a,
  cream: 0xfff6e9,
  water: 0x5bc0eb,
  maize: 0xffc93c,
  stalk: 0x3e9b4f,
} as const;

export const Balance = {
  startCoins: 200,
  plots: 6,
} as const;
