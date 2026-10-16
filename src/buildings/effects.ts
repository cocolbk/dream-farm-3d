import { BUILDINGS, Balance } from '../core/Config';
import type { PlacedBuilding } from './placement';

// Phase 5 — building effects + upgrade costs. Pure functions, unit-tested.

export function levelOf(buildings: PlacedBuilding[], defId: string): number {
  return buildings
    .filter((b) => b.defId === defId)
    .reduce((a, b) => Math.max(a, b.level ?? 0), 0);
}

export function countOf(buildings: PlacedBuilding[], defId: string): number {
  return buildings.filter((b) => b.defId === defId).length;
}

/** Upgrade cost curve: base * 2^level (level 0 -> base, 1 -> 2x, 2 -> 4x). */
export function upgradeCost(defId: string, level: number): number {
  const def = BUILDINGS[defId];
  return Math.round(def.cost * 0.8 * Math.pow(2, level));
}

export function canUpgrade(defId: string, level: number): boolean {
  const def = BUILDINGS[defId];
  if (!def) return false;
  return level < def.maxLevel;
}

/** Max produce units the farm can hold. */
export function storageCap(buildings: PlacedBuilding[]): number {
  const barnBonus = levelOf(buildings, 'barn') * Balance.barnCapPerLevel;
  const warehouseBonus = countOf(buildings, 'warehouse') * Balance.warehouseCap;
  return Balance.baseStorageCap + barnBonus + warehouseBonus;
}

/** Max staff roster size. */
export function staffCap(buildings: PlacedBuilding[]): number {
  return Balance.baseStaffCap + countOf(buildings, 'quarters') * Balance.quartersStaffCap;
}

/** Max concurrent customer vehicles. */
export function customerCap(buildings: PlacedBuilding[]): number {
  return Balance.baseMaxCustomers + levelOf(buildings, 'shop');
}

/** Coins per egg cycle across all coops. */
export function coopIncomePerCycle(buildings: PlacedBuilding[]): number {
  return buildings
    .filter((b) => b.defId === 'coop')
    .reduce((a, b) => a + Math.round(Balance.eggBase * Math.pow(1.5, b.level ?? 0)), 0);
}

export function hasGarage(buildings: PlacedBuilding[]): boolean {
  return countOf(buildings, 'garage') > 0;
}
