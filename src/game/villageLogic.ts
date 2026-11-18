import {
  BUILDING_CATALOG,
  getTroopLevelStats,
  getTroopUpgradeRequirement,
  MAX_TROOP_LEVEL,
  SPELL_CATALOG,
  SPELL_ORDER,
  TROOP_CATALOG,
  TROOP_ORDER,
} from './catalog';
import { canPlaceBuilding } from './isoMath';
import type {
  BuildingType,
  FavoriteArmyComposition,
  PlacedBuilding,
  SpellType,
  TrainingQueueSnapshot,
  TroopType,
  VillageState,
} from './types';

export function getResourceCaps(village: VillageState): {
  maxGold: number;
  maxElixir: number;
  maxTroopSpace: number;
  maxSpellSpace: number;
  maxClanSpace: number;
  maxBarracksLevel: number;
  hasSpellFactory: boolean;
  hasClanCastle: boolean;
} {
  let maxGold = 0;
  let maxElixir = 0;
  let maxTroopSpace = 0;
  let maxSpellSpace = 0;
  let maxClanSpace = 0;
  let maxBarracksLevel = 0;
  let hasSpellFactory = false;
  let hasClanCastle = false;

  for (const b of village.buildings) {
    // Only finished level 1+ buildings contribute (level > 0)
    const activeLevel = b.upgradingToLevel === 1 ? 0 : b.level;
    if (activeLevel <= 0) continue;
    const stats = BUILDING_CATALOG[b.type].levels[activeLevel - 1];
    if (!stats) continue;

    if (b.type === 'town_hall') {
      maxGold += stats.storageCapacity ?? 0;
      maxElixir += stats.storageCapacity ?? 0;
    } else if (b.type === 'gold_storage') {
      maxGold += stats.storageCapacity ?? 0;
    } else if (b.type === 'elixir_storage') {
      maxElixir += stats.storageCapacity ?? 0;
    } else if (b.type === 'army_camp') {
      maxTroopSpace += stats.troopCapacity ?? 0;
    } else if (b.type === 'spell_factory') {
      hasSpellFactory = true;
      maxSpellSpace += stats.spellCapacity ?? 0;
    } else if (b.type === 'clan_castle') {
      hasClanCastle = true;
      maxClanSpace += stats.clanCapacity ?? 0;
    } else if (b.type === 'barracks') {
      maxBarracksLevel = Math.max(maxBarracksLevel, activeLevel);
    }
  }

  return {
    maxGold: Math.max(1000, maxGold),
    maxElixir: Math.max(1000, maxElixir),
    maxTroopSpace,
    maxSpellSpace,
    maxClanSpace,
    maxBarracksLevel,
    hasSpellFactory,
    hasClanCastle,
  };
}

export function getUsedTroopSpace(army: Partial<Record<TroopType, number>>): number {
  let total = 0;
  for (const [k, count] of Object.entries(army)) {
    const def = TROOP_CATALOG[k as TroopType];
    if (def && count) total += def.housingSpace * count;
  }
  return total;
}

export function getUsedClanSpace(
  reinforcements?: Partial<Record<TroopType, number>>
): number {
  if (!reinforcements) return 0;
  return getUsedTroopSpace(reinforcements);
}

export function getUsedSpellSpace(spells: Record<SpellType, number>): number {
  let total = 0;
  for (const [k, count] of Object.entries(spells)) {
    const def = SPELL_CATALOG[k as SpellType];
    if (def) total += def.housingSpace * count;
  }
  return total;
}

export function getBusyBuilderCount(village: VillageState): number {
  return village.buildings.filter((b) => b.upgradingToLevel !== undefined).length;
}

export function getBuildingCountByType(village: VillageState, type: BuildingType): number {
  return village.buildings.filter((b) => b.type === type).length;
}

/**
 * Advances village resource production & finishes completed building upgrades.
 */
export function tickVillage(
  village: VillageState,
  nowMs: number
): { next: VillageState; completedUpgrades: PlacedBuilding[] } {
  const dtSec = Math.max(0, Math.min(3600, (nowMs - village.lastTickAt) / 1000));
  const completedUpgrades: PlacedBuilding[] = [];
  let newTHLevel = village.townHallLevel;
  let newBuilders = village.buildersTotal;
  let xpGain = 0;

  const nextBuildings = village.buildings.map((b) => {
    let updated = b;

    // Check upgrade/build completion
    if (b.upgradingToLevel !== undefined && b.upgradeEndsAt !== undefined && nowMs >= b.upgradeEndsAt) {
      const finishedLevel = b.upgradingToLevel;
      updated = {
        ...b,
        level: finishedLevel,
        upgradingToLevel: undefined,
        upgradeEndsAt: undefined,
        upgradeTotalSec: undefined,
        lastCollectedAt: nowMs,
      };
      completedUpgrades.push(updated);
      xpGain += finishedLevel * 12;
      if (b.type === 'town_hall') {
        newTHLevel = Math.max(newTHLevel, finishedLevel);
      }
    }

    // Produce resources for active mines/collectors
    if (
      (updated.type === 'gold_mine' || updated.type === 'elixir_collector') &&
      updated.upgradingToLevel === undefined &&
      updated.level > 0
    ) {
      const stats = BUILDING_CATALOG[updated.type].levels[updated.level - 1];
      if (stats?.productionPerHour && stats.storageCapacity) {
        const gained = (stats.productionPerHour / 3600) * dtSec;
        const currentStored = updated.storedResource ?? 0;
        const nextStored = Math.min(stats.storageCapacity, currentStored + gained);
        if (nextStored !== currentStored) {
          updated = { ...updated, storedResource: nextStored };
        }
      }
    }

    return updated;
  });

  newBuilders = Math.max(
    1,
    nextBuildings.filter((b) => b.type === 'builders_hut').length
  );

  return {
    next: {
      ...village,
      townHallLevel: newTHLevel,
      buildersTotal: newBuilders,
      xp: village.xp + xpGain,
      buildings: nextBuildings,
      lastTickAt: nowMs,
    },
    completedUpgrades,
  };
}

export function collectBuildingResource(
  village: VillageState,
  buildingId: string
): { next: VillageState; collectedAmount: number; resourceType: 'gold' | 'elixir' | null } {
  const target = village.buildings.find((b) => b.id === buildingId);
  if (!target) return { next: village, collectedAmount: 0, resourceType: null };

  const stored = Math.floor(target.storedResource ?? 0);
  if (stored <= 0) return { next: village, collectedAmount: 0, resourceType: null };

  const caps = getResourceCaps(village);
  const isGold = target.type === 'gold_mine';
  const isElixir = target.type === 'elixir_collector';
  if (!isGold && !isElixir) {
    return { next: village, collectedAmount: 0, resourceType: null };
  }

  let actualCollected = 0;
  let nextGold = village.gold;
  let nextElixir = village.elixir;
  let remaining = stored;

  if (isGold) {
    const room = Math.max(0, caps.maxGold - village.gold);
    actualCollected = Math.min(stored, room);
    nextGold += actualCollected;
    remaining = stored - actualCollected;
  } else {
    const room = Math.max(0, caps.maxElixir - village.elixir);
    actualCollected = Math.min(stored, room);
    nextElixir += actualCollected;
    remaining = stored - actualCollected;
  }

  if (actualCollected <= 0) {
    return { next: village, collectedAmount: 0, resourceType: isGold ? 'gold' : 'elixir' };
  }

  return {
    next: {
      ...village,
      gold: nextGold,
      elixir: nextElixir,
      buildings: village.buildings.map((b) =>
        b.id === buildingId ? { ...b, storedResource: remaining, lastCollectedAt: Date.now() } : b
      ),
    },
    collectedAmount: actualCollected,
    resourceType: isGold ? 'gold' : 'elixir',
  };
}

export function startPlaceNewBuilding(
  village: VillageState,
  type: BuildingType,
  gx: number,
  gy: number,
  nowMs: number
): { ok: true; next: VillageState; buildingId: string } | { ok: false; reason: string } {
  const def = BUILDING_CATALOG[type];
  const maxAllowed = def.maxCountByTH[village.townHallLevel] ?? 0;
  const currentCount = getBuildingCountByType(village, type);
  if (currentCount >= maxAllowed) {
    return { ok: false, reason: `当前大本营等级最多建造 ${maxAllowed} 座${def.name}` };
  }

  const lv1 = def.levels[0];
  if (lv1.thRequired > village.townHallLevel) {
    return { ok: false, reason: `需要 ${lv1.thRequired} 级大本营` };
  }

  if (!canPlaceBuilding(gx, gy, def.size, village.buildings)) {
    return { ok: false, reason: '该区域存在阻挡或超出领地范围' };
  }

  const requiresBuilder = lv1.buildTimeSec > 0;
  if (requiresBuilder && getBusyBuilderCount(village) >= village.buildersTotal) {
    return { ok: false, reason: '没有空闲的建筑工人' };
  }

  if (lv1.costType === 'gold' && village.gold < lv1.cost) {
    return { ok: false, reason: '金币不足' };
  }
  if (lv1.costType === 'elixir' && village.elixir < lv1.cost) {
    return { ok: false, reason: '圣水不足' };
  }
  if (lv1.costType === 'gems' && village.gems < lv1.cost) {
    return { ok: false, reason: '宝石不足' };
  }

  const buildingId = `b_${type}_${nowMs}_${Math.floor(Math.random() * 1000)}`;
  const isInstant = lv1.buildTimeSec <= 0;
  const newBuilding: PlacedBuilding = {
    id: buildingId,
    type,
    level: isInstant ? 1 : 0,
    gx,
    gy,
    upgradingToLevel: isInstant ? undefined : 1,
    upgradeEndsAt: isInstant ? undefined : nowMs + lv1.buildTimeSec * 1000,
    upgradeTotalSec: isInstant ? undefined : lv1.buildTimeSec,
    storedResource: 0,
    lastCollectedAt: nowMs,
  };

  return {
    ok: true,
    buildingId,
    next: {
      ...village,
      gold: lv1.costType === 'gold' ? village.gold - lv1.cost : village.gold,
      elixir: lv1.costType === 'elixir' ? village.elixir - lv1.cost : village.elixir,
      gems: lv1.costType === 'gems' ? village.gems - lv1.cost : village.gems,
      buildersTotal: type === 'builders_hut' ? village.buildersTotal + 1 : village.buildersTotal,
      buildings: [...village.buildings, newBuilding],
    },
  };
}

export function startUpgradeBuilding(
  village: VillageState,
  buildingId: string,
  nowMs: number
): { ok: true; next: VillageState } | { ok: false; reason: string } {
  const target = village.buildings.find((b) => b.id === buildingId);
  if (!target) return { ok: false, reason: '建筑不存在' };
  if (target.upgradingToLevel !== undefined) return { ok: false, reason: '该建筑正在升级中' };

  const def = BUILDING_CATALOG[target.type];
  const nextLvStats = def.levels[target.level]; // 0-indexed, so target.level is next level
  if (!nextLvStats) return { ok: false, reason: '已达到当前最高等级' };
  if (nextLvStats.thRequired > village.townHallLevel) {
    return { ok: false, reason: `需要 ${nextLvStats.thRequired} 级大本营` };
  }

  const requiresBuilder = nextLvStats.buildTimeSec > 0;
  if (requiresBuilder && getBusyBuilderCount(village) >= village.buildersTotal) {
    return { ok: false, reason: '没有空闲的建筑工人' };
  }

  if (nextLvStats.costType === 'gold' && village.gold < nextLvStats.cost) {
    return { ok: false, reason: '金币不足' };
  }
  if (nextLvStats.costType === 'elixir' && village.elixir < nextLvStats.cost) {
    return { ok: false, reason: '圣水不足' };
  }

  const isInstant = nextLvStats.buildTimeSec <= 0;
  return {
    ok: true,
    next: {
      ...village,
      gold: nextLvStats.costType === 'gold' ? village.gold - nextLvStats.cost : village.gold,
      elixir: nextLvStats.costType === 'elixir' ? village.elixir - nextLvStats.cost : village.elixir,
      buildings: village.buildings.map((b) =>
        b.id === buildingId
          ? {
              ...b,
              level: isInstant ? nextLvStats.level : b.level,
              upgradingToLevel: isInstant ? undefined : nextLvStats.level,
              upgradeEndsAt: isInstant ? undefined : nowMs + nextLvStats.buildTimeSec * 1000,
              upgradeTotalSec: isInstant ? undefined : nextLvStats.buildTimeSec,
            }
          : b
      ),
    },
  };
}

export function finishUpgradeWithGems(
  village: VillageState,
  buildingId: string,
  nowMs: number
): { ok: true; next: VillageState } | { ok: false; reason: string } {
  const target = village.buildings.find((b) => b.id === buildingId);
  if (!target || target.upgradingToLevel === undefined || target.upgradeEndsAt === undefined) {
    return { ok: false, reason: '当前没有进行中的建造' };
  }
  const remSec = Math.max(1, Math.ceil((target.upgradeEndsAt - nowMs) / 1000));
  const gemCost = Math.max(1, Math.ceil(remSec / 4));
  if (village.gems < gemCost) {
    return { ok: false, reason: `需要 ${gemCost} 宝石` };
  }

  const finishedLevel = target.upgradingToLevel;
  const newTHLevel =
    target.type === 'town_hall'
      ? Math.max(village.townHallLevel, finishedLevel)
      : village.townHallLevel;

  return {
    ok: true,
    next: {
      ...village,
      gems: village.gems - gemCost,
      townHallLevel: newTHLevel,
      xp: village.xp + finishedLevel * 12,
      buildings: village.buildings.map((b) =>
        b.id === buildingId
          ? {
              ...b,
              level: finishedLevel,
              upgradingToLevel: undefined,
              upgradeEndsAt: undefined,
              upgradeTotalSec: undefined,
              lastCollectedAt: nowMs,
            }
          : b
      ),
    },
  };
}

export function moveBuilding(
  village: VillageState,
  buildingId: string,
  gx: number,
  gy: number
): { ok: true; next: VillageState } | { ok: false; reason: string } {
  const target = village.buildings.find((b) => b.id === buildingId);
  if (!target) return { ok: false, reason: '建筑不存在' };
  const size = BUILDING_CATALOG[target.type].size;
  if (!canPlaceBuilding(gx, gy, size, village.buildings, buildingId)) {
    return { ok: false, reason: '目标位置无法放置' };
  }
  return {
    ok: true,
    next: {
      ...village,
      buildings: village.buildings.map((b) =>
        b.id === buildingId ? { ...b, gx, gy } : b
      ),
    },
  };
}

export function trainTroop(
  village: VillageState,
  troopType: TroopType
): { ok: true; next: VillageState } | { ok: false; reason: string } {
  const def = TROOP_CATALOG[troopType];
  const caps = getResourceCaps(village);
  if (caps.maxBarracksLevel < def.barracksLevelRequired) {
    return { ok: false, reason: `需要 ${def.barracksLevelRequired} 级兵营解锁` };
  }
  const used = getUsedTroopSpace(village.army);
  if (used + def.housingSpace > caps.maxTroopSpace) {
    return { ok: false, reason: '军营人口已满' };
  }
  if (village.elixir < def.trainCostElixir) {
    return { ok: false, reason: '圣水不足' };
  }
  return {
    ok: true,
    next: {
      ...village,
      elixir: village.elixir - def.trainCostElixir,
      army: {
        ...village.army,
        [troopType]: (village.army[troopType] ?? 0) + 1,
      },
    },
  };
}

export function dismissTroop(
  village: VillageState,
  troopType: TroopType
): VillageState {
  const current = village.army[troopType] ?? 0;
  if (current <= 0) return village;
  const def = TROOP_CATALOG[troopType];
  const caps = getResourceCaps(village);
  return {
    ...village,
    elixir: Math.min(caps.maxElixir, village.elixir + def.trainCostElixir),
    army: {
      ...village.army,
      [troopType]: current - 1,
    },
  };
}

export interface TroopUpgradeInfo {
  currentLevel: number;
  nextLevel: number | null;
  isMaxLevel: boolean;
  unlocked: boolean;
  meetsTownHall: boolean;
  meetsBarracks: boolean;
  meetsElixir: boolean;
  canUpgrade: boolean;
  elixirCost: number;
  requiredTownHall: number;
  requiredBarracks: number;
  currentStats: ReturnType<typeof getTroopLevelStats>;
  nextStats: ReturnType<typeof getTroopLevelStats> | null;
  blockReason: string | null;
}

export function getTroopLevel(village: VillageState, troopType: TroopType): number {
  const raw = village.troopLevels?.[troopType] ?? 1;
  return Math.max(1, Math.min(MAX_TROOP_LEVEL, Math.floor(raw)));
}

export function getTroopUpgradeInfo(
  village: VillageState,
  troopType: TroopType
): TroopUpgradeInfo {
  const def = TROOP_CATALOG[troopType];
  const caps = getResourceCaps(village);
  const currentLevel = getTroopLevel(village, troopType);
  const currentStats = getTroopLevelStats(troopType, currentLevel);
  const unlocked = caps.maxBarracksLevel >= def.barracksLevelRequired;
  const req = getTroopUpgradeRequirement(troopType, currentLevel);

  if (!req) {
    return {
      currentLevel,
      nextLevel: null,
      isMaxLevel: true,
      unlocked,
      meetsTownHall: true,
      meetsBarracks: true,
      meetsElixir: true,
      canUpgrade: false,
      elixirCost: 0,
      requiredTownHall: village.townHallLevel,
      requiredBarracks: def.barracksLevelRequired,
      currentStats,
      nextStats: null,
      blockReason: '已达最高等级',
    };
  }

  const meetsTownHall = village.townHallLevel >= req.requiredTownHall;
  const meetsBarracks = caps.maxBarracksLevel >= req.requiredBarracks;
  const meetsElixir = village.elixir >= req.elixirCost;
  const canUpgrade = unlocked && meetsTownHall && meetsBarracks && meetsElixir;

  let blockReason: string | null = null;
  if (!unlocked) {
    blockReason = `需 ${def.barracksLevelRequired} 级兵营解锁`;
  } else if (!meetsTownHall) {
    blockReason = `需 ${req.requiredTownHall} 级大本营`;
  } else if (!meetsBarracks) {
    blockReason = `需 ${req.requiredBarracks} 级兵营`;
  } else if (!meetsElixir) {
    blockReason = `圣水需 ${req.elixirCost}`;
  }

  return {
    currentLevel,
    nextLevel: req.nextLevel,
    isMaxLevel: false,
    unlocked,
    meetsTownHall,
    meetsBarracks,
    meetsElixir,
    canUpgrade,
    elixirCost: req.elixirCost,
    requiredTownHall: req.requiredTownHall,
    requiredBarracks: req.requiredBarracks,
    currentStats,
    nextStats: getTroopLevelStats(troopType, req.nextLevel),
    blockReason,
  };
}

export function upgradeTroop(
  village: VillageState,
  troopType: TroopType
):
  | {
      ok: true;
      next: VillageState;
      previousLevel: number;
      newLevel: number;
      elixirSpent: number;
      hpGain: number;
      dpsGain: number;
    }
  | { ok: false; reason: string } {
  const info = getTroopUpgradeInfo(village, troopType);
  if (!info.canUpgrade || !info.nextLevel || !info.nextStats) {
    return { ok: false, reason: info.blockReason ?? '暂不满足升级条件' };
  }

  const nextLevels: Partial<Record<TroopType, number>> = {
    ...(village.troopLevels ?? {}),
    [troopType]: info.nextLevel,
  };

  return {
    ok: true,
    next: {
      ...village,
      elixir: village.elixir - info.elixirCost,
      xp: (village.xp ?? 0) + 15 * info.currentLevel,
      troopLevels: nextLevels,
    },
    previousLevel: info.currentLevel,
    newLevel: info.nextLevel,
    elixirSpent: info.elixirCost,
    hpGain: info.nextStats.hp - info.currentStats.hp,
    dpsGain: info.nextStats.dps - info.currentStats.dps,
  };
}

export function brewSpell(
  village: VillageState,
  spellType: SpellType
): { ok: true; next: VillageState } | { ok: false; reason: string } {
  const def = SPELL_CATALOG[spellType];
  const caps = getResourceCaps(village);
  if (!caps.hasSpellFactory) {
    return { ok: false, reason: '需要先建造法术工厂' };
  }
  const used = getUsedSpellSpace(village.spells);
  if (used + def.housingSpace > caps.maxSpellSpace) {
    return { ok: false, reason: '法术容量已满' };
  }
  if (village.elixir < def.brewCostElixir) {
    return { ok: false, reason: '圣水不足' };
  }
  return {
    ok: true,
    next: {
      ...village,
      elixir: village.elixir - def.brewCostElixir,
      spells: {
        ...village.spells,
        [spellType]: (village.spells[spellType] ?? 0) + 1,
      },
    },
  };
}

export function dismissSpell(
  village: VillageState,
  spellType: SpellType
): VillageState {
  const current = village.spells[spellType] ?? 0;
  if (current <= 0) return village;
  const def = SPELL_CATALOG[spellType];
  const caps = getResourceCaps(village);
  return {
    ...village,
    elixir: Math.min(caps.maxElixir, village.elixir + def.brewCostElixir),
    spells: {
      ...village.spells,
      [spellType]: current - 1,
    },
  };
}

export function hasTrainingQueueEntries(queue?: TrainingQueueSnapshot): boolean {
  if (!queue) return false;
  for (const count of Object.values(queue.army ?? {})) {
    if ((count ?? 0) > 0) return true;
  }
  for (const count of Object.values(queue.spells ?? {})) {
    if ((count ?? 0) > 0) return true;
  }
  return false;
}

export function cloneTrainingQueue(queue?: TrainingQueueSnapshot): TrainingQueueSnapshot {
  const army: Partial<Record<TroopType, number>> = {};
  const spells: Partial<Record<SpellType, number>> = {};
  if (queue?.army) {
    for (const t of TROOP_ORDER) {
      const c = Math.floor(queue.army[t] ?? 0);
      if (c > 0) army[t] = c;
    }
  }
  if (queue?.spells) {
    for (const s of SPELL_ORDER) {
      const c = Math.floor(queue.spells[s] ?? 0);
      if (c > 0) spells[s] = c;
    }
  }
  return { army, spells };
}

export function repeatTrainingQueue(
  village: VillageState,
  queue: TrainingQueueSnapshot | undefined = village.lastTrainingQueue
):
  | {
      ok: true;
      next: VillageState;
      trainedTroopsCount: number;
      brewedSpellsCount: number;
    }
  | { ok: false; reason: string } {
  if (!hasTrainingQueueEntries(queue) || !queue) {
    return { ok: false, reason: '暂无上次训练记录' };
  }

  let cur = village;
  let trainedTroopsCount = 0;
  let brewedSpellsCount = 0;
  let lastFailureReason: string | null = null;

  for (const tType of TROOP_ORDER) {
    const targetCount = Math.max(0, Math.floor(queue.army?.[tType] ?? 0));
    for (let i = 0; i < targetCount; i++) {
      const res = trainTroop(cur, tType);
      if (!res.ok) {
        lastFailureReason = res.reason;
        break;
      }
      cur = res.next;
      trainedTroopsCount += 1;
    }
  }

  for (const sType of SPELL_ORDER) {
    const targetCount = Math.max(0, Math.floor(queue.spells?.[sType] ?? 0));
    for (let i = 0; i < targetCount; i++) {
      const res = brewSpell(cur, sType);
      if (!res.ok) {
        lastFailureReason = res.reason;
        break;
      }
      cur = res.next;
      brewedSpellsCount += 1;
    }
  }

  if (trainedTroopsCount + brewedSpellsCount === 0) {
    return {
      ok: false,
      reason: lastFailureReason ?? '当前空间或圣水不足，无法重复训练',
    };
  }

  return {
    ok: true,
    next: cur,
    trainedTroopsCount,
    brewedSpellsCount,
  };
}

export const MAX_FAVORITE_ARMIES = 8;

export function suggestFavoriteArmyName(
  army: Partial<Record<TroopType, number>>,
  spells: Partial<Record<SpellType, number>>
): string {
  const giants = army.giant ?? 0;
  const balloons = army.balloon ?? 0;
  const archers = army.archer ?? 0;
  const barbarians = army.barbarian ?? 0;
  const goblins = army.goblin ?? 0;
  const heals = spells.heal ?? 0;

  if (giants > 0 && heals > 0) return 'Giant-Healer';
  if (balloons > 0) return '气球空袭流';
  if (giants > 0 && archers > 0) return '胖弓推进流';
  if (goblins >= 6) return '哥布林掠夺流';
  if (barbarians > 0 && archers > 0) return '野蛮弓箭流';
  return '自定义配兵';
}

export function saveFavoriteArmyComposition(
  village: VillageState,
  rawName: string,
  source: TrainingQueueSnapshot = { army: village.army, spells: village.spells },
  nowMs = Date.now()
):
  | { ok: true; next: VillageState; favorite: FavoriteArmyComposition }
  | { ok: false; reason: string } {
  const trimmedName = rawName.trim().slice(0, 24);
  if (!trimmedName) {
    return { ok: false, reason: '请输入配兵方案名称' };
  }
  const cloned = cloneTrainingQueue(source);
  if (!hasTrainingQueueEntries(cloned)) {
    return { ok: false, reason: '当前军队与法术为空，无法保存配兵方案' };
  }

  const existing = village.favoriteArmies ?? [];
  const favorite: FavoriteArmyComposition = {
    id: `fav_${nowMs}_${Math.random().toString(36).slice(2, 6)}`,
    name: trimmedName,
    army: cloned.army,
    spells: cloned.spells,
    createdAtMs: nowMs,
  };

  // Replace if a scheme with the exact same name exists, otherwise prepend cleanly within limit
  const filtered = existing.filter((item) => item.name !== trimmedName);
  const nextFavorites = [favorite, ...filtered].slice(0, MAX_FAVORITE_ARMIES);

  return {
    ok: true,
    favorite,
    next: {
      ...village,
      favoriteArmies: nextFavorites,
    },
  };
}

export function deleteFavoriteArmyComposition(
  village: VillageState,
  favoriteId: string
): VillageState {
  const nextFavorites = (village.favoriteArmies ?? []).filter(
    (item) => item.id !== favoriteId
  );
  return {
    ...village,
    favoriteArmies: nextFavorites,
  };
}

export function queueFavoriteArmyComposition(
  village: VillageState,
  favoriteId: string
):
  | {
      ok: true;
      next: VillageState;
      favorite: FavoriteArmyComposition;
      trainedTroopsCount: number;
      brewedSpellsCount: number;
    }
  | { ok: false; reason: string } {
  const fav = (village.favoriteArmies ?? []).find((item) => item.id === favoriteId);
  if (!fav) {
    return { ok: false, reason: '未找到该配兵方案' };
  }
  const res = repeatTrainingQueue(village, {
    army: fav.army,
    spells: fav.spells,
  });
  if (!res.ok) {
    return res;
  }
  return {
    ok: true,
    favorite: fav,
    trainedTroopsCount: res.trainedTroopsCount,
    brewedSpellsCount: res.brewedSpellsCount,
    next: {
      ...res.next,
      lastTrainingQueue: cloneTrainingQueue({ army: fav.army, spells: fav.spells }),
    },
  };
}

export interface ResourceProductionInfo {
  resourceType: 'gold' | 'elixir';
  resourceLabel: '金币' | '圣水';
  perHour: number;
  basePerHour: number;
  nextLevelPerHour: number | null;
  stored: number;
  capacity: number;
  isPausedByUpgrade: boolean;
}

export function getBuildingProductionInfo(
  building: PlacedBuilding
): ResourceProductionInfo | null {
  if (building.type !== 'gold_mine' && building.type !== 'elixir_collector') {
    return null;
  }

  const levels = BUILDING_CATALOG[building.type].levels;
  const resourceType = building.type === 'gold_mine' ? 'gold' : 'elixir';
  const resourceLabel = resourceType === 'gold' ? '金币' : '圣水';
  const isPausedByUpgrade = building.upgradingToLevel !== undefined;

  const activeStats = building.level > 0 ? levels[building.level - 1] : undefined;
  const basePerHour = activeStats?.productionPerHour ?? 0;
  const perHour = isPausedByUpgrade ? 0 : basePerHour;
  const capacity = activeStats?.storageCapacity ?? 0;
  const stored = Math.floor(building.storedResource ?? 0);

  const nextIdx = isPausedByUpgrade
    ? (building.upgradingToLevel ?? 1) - 1
    : building.level;
  const nextStats = levels[nextIdx];
  const nextLevelPerHour = nextStats?.productionPerHour ?? null;

  return {
    resourceType,
    resourceLabel,
    perHour,
    basePerHour,
    nextLevelPerHour,
    stored,
    capacity,
    isPausedByUpgrade,
  };
}

export function getVillageProductionRates(village: VillageState): {
  goldPerHour: number;
  elixirPerHour: number;
} {
  let goldPerHour = 0;
  let elixirPerHour = 0;

  for (const b of village.buildings) {
    const info = getBuildingProductionInfo(b);
    if (!info) continue;
    if (info.resourceType === 'gold') goldPerHour += info.perHour;
    else elixirPerHour += info.perHour;
  }

  return { goldPerHour, elixirPerHour };
}

export interface EditModeBuildingEntry {
  id: string;
  type: BuildingType;
  level: number;
  gx: number;
  gy: number;
  placed: boolean;
}

export interface EditModeState {
  entries: EditModeBuildingEntry[];
  selectedId: string | null;
  activeTrayType: BuildingType | null;
}

export interface StashedBuildingGroup {
  type: BuildingType;
  count: number;
  highestLevel: number;
  nextId: string;
}

export function createEditModeState(village: VillageState): EditModeState {
  return {
    entries: village.buildings.map((b) => ({
      id: b.id,
      type: b.type,
      level: b.level,
      gx: b.gx,
      gy: b.gy,
      placed: true,
    })),
    selectedId: null,
    activeTrayType: null,
  };
}

export function getEditPlacedBuildings(state: EditModeState): PlacedBuilding[] {
  return state.entries
    .filter((e) => e.placed)
    .map((e) => ({
      id: e.id,
      type: e.type,
      level: e.level,
      gx: e.gx,
      gy: e.gy,
    }));
}

export function getStashedBuildingGroups(state: EditModeState): StashedBuildingGroup[] {
  const byType = new Map<BuildingType, StashedBuildingGroup>();
  for (const entry of state.entries) {
    if (entry.placed) continue;
    const existing = byType.get(entry.type);
    if (existing) {
      existing.count += 1;
      existing.highestLevel = Math.max(existing.highestLevel, entry.level);
    } else {
      byType.set(entry.type, {
        type: entry.type,
        count: 1,
        highestLevel: entry.level,
        nextId: entry.id,
      });
    }
  }
  const catalogOrder = Object.keys(BUILDING_CATALOG) as BuildingType[];
  return Array.from(byType.values()).sort(
    (a, b) => catalogOrder.indexOf(a.type) - catalogOrder.indexOf(b.type)
  );
}

export function hideAllBuildingsInEdit(state: EditModeState): EditModeState {
  const nextEntries = state.entries.map((e) => ({
    ...e,
    placed: false,
  }));
  const nextState: EditModeState = {
    entries: nextEntries,
    selectedId: null,
    activeTrayType: null,
  };
  const groups = getStashedBuildingGroups(nextState);
  return {
    ...nextState,
    activeTrayType: groups[0]?.type ?? null,
  };
}

export function hideBuildingInEdit(
  state: EditModeState,
  buildingId: string
): EditModeState {
  const target = state.entries.find((e) => e.id === buildingId);
  if (!target) return state;
  return {
    ...state,
    entries: state.entries.map((e) =>
      e.id === buildingId ? { ...e, placed: false } : e
    ),
    selectedId: state.selectedId === buildingId ? null : state.selectedId,
    activeTrayType: target.type,
  };
}

export function restoreAllBuildingsInEdit(village: VillageState): EditModeState {
  return createEditModeState(village);
}

export function placeOrMoveBuildingInEdit(
  state: EditModeState,
  buildingId: string,
  gx: number,
  gy: number
): { ok: true; next: EditModeState } | { ok: false; reason: string } {
  const target = state.entries.find((e) => e.id === buildingId);
  if (!target) {
    return { ok: false, reason: '建筑不存在' };
  }
  const size = BUILDING_CATALOG[target.type].size;
  const placedBuildings = getEditPlacedBuildings(state);
  if (!canPlaceBuilding(gx, gy, size, placedBuildings, buildingId)) {
    return { ok: false, reason: '目标位置存在阻挡或超出领地范围' };
  }

  const nextEntries = state.entries.map((e) =>
    e.id === buildingId ? { ...e, gx, gy, placed: true } : e
  );
  const remainingSameType = nextEntries.some(
    (e) => !e.placed && e.type === target.type
  );

  let nextActiveTray = state.activeTrayType;
  if (!remainingSameType && nextActiveTray === target.type) {
    const nextGroup = nextEntries.find((e) => !e.placed);
    nextActiveTray = nextGroup ? nextGroup.type : null;
  }

  return {
    ok: true,
    next: {
      entries: nextEntries,
      selectedId: target.placed ? buildingId : null,
      activeTrayType: nextActiveTray,
    },
  };
}

export function applyEditLayoutToVillage(
  village: VillageState,
  state: EditModeState
): { ok: true; next: VillageState } | { ok: false; reason: string } {
  const unplacedCount = state.entries.filter((e) => !e.placed).length;
  if (unplacedCount > 0) {
    return {
      ok: false,
      reason: `还有 ${unplacedCount} 座建筑未放置，请先全部放回村庄再保存`,
    };
  }

  const entryById = new Map(state.entries.map((e) => [e.id, e]));
  const verifiedPlaced: PlacedBuilding[] = [];

  for (const b of village.buildings) {
    const draft = entryById.get(b.id);
    if (!draft || !draft.placed) {
      return { ok: false, reason: '阵型数据不完整，请重新检查建筑放置' };
    }
    const size = BUILDING_CATALOG[b.type].size;
    if (!canPlaceBuilding(draft.gx, draft.gy, size, verifiedPlaced)) {
      return { ok: false, reason: '存在重叠或越界建筑，无法保存阵型' };
    }
    verifiedPlaced.push({
      ...b,
      gx: draft.gx,
      gy: draft.gy,
    });
  }

  // Only update (gx, gy); preserve storedResource, lastCollectedAt, lastTickAt, upgrades, etc.
  return {
    ok: true,
    next: {
      ...village,
      buildings: verifiedPlaced,
    },
  };
}

