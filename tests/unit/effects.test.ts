import { describe, it, expect } from 'vitest';
import {
  levelOf, countOf, upgradeCost, canUpgrade, storageCap, staffCap,
  customerCap, coopIncomePerCycle, hasGarage,
} from '../../src/buildings/effects';
import type { PlacedBuilding } from '../../src/buildings/placement';
import { Balance } from '../../src/core/Config';

function b(defId: string, level = 0): PlacedBuilding {
  return { id: `${defId}${level}`, defId, x: 0, z: 0, rot: 0, level };
}

describe('building effects', () => {
  it('defaults with no buildings', () => {
    expect(storageCap([])).toBe(Balance.baseStorageCap);
    expect(staffCap([])).toBe(Balance.baseStaffCap);
    expect(customerCap([])).toBe(Balance.baseMaxCustomers);
    expect(coopIncomePerCycle([])).toBe(0);
    expect(hasGarage([])).toBe(false);
  });
  it('barn levels and warehouse stack storage', () => {
    expect(storageCap([b('barn', 2)])).toBe(Balance.baseStorageCap + 2 * Balance.barnCapPerLevel);
    expect(storageCap([b('warehouse'), b('barn', 1)]))
      .toBe(Balance.baseStorageCap + Balance.warehouseCap + Balance.barnCapPerLevel);
  });
  it('quarters raise staff cap, shops raise customer cap', () => {
    expect(staffCap([b('quarters'), b('quarters')])).toBe(Balance.baseStaffCap + 2 * Balance.quartersStaffCap);
    expect(customerCap([b('shop', 2)])).toBe(Balance.baseMaxCustomers + 2);
  });
  it('coop income scales with level', () => {
    expect(coopIncomePerCycle([b('coop', 0)])).toBe(Balance.eggBase);
    expect(coopIncomePerCycle([b('coop', 0), b('coop', 1)])).toBe(
      Balance.eggBase + Math.round(Balance.eggBase * 1.5),
    );
  });
  it('upgrade cost curve + max level gate', () => {
    expect(upgradeCost('barn', 0)).toBeLessThan(upgradeCost('barn', 1));
    expect(canUpgrade('barn', 0)).toBe(true);
    expect(canUpgrade('barn', 3)).toBe(false);
    expect(canUpgrade('fence', 0)).toBe(false);
    expect(canUpgrade('warehouse', 0)).toBe(false);
  });
  it('levelOf takes the best, countOf counts', () => {
    expect(levelOf([b('barn', 1), b('barn', 2)], 'barn')).toBe(2);
    expect(countOf([b('fence'), b('fence')], 'fence')).toBe(2);
  });
});
