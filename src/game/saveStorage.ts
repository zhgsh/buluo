import { createInitialVillage, SPELL_ORDER, TROOP_ORDER } from './catalog';
import {
  ensureDailyMissions,
  getLocalDateKey,
  recordMissionProgress,
} from './dailyMissions';
import { appendBattleReplay } from './replayLogic';
import type { BattleReplay, BattleResult, TroopType, VillageState } from './types';
import {
  cloneTrainingQueue,
  getResourceCaps,
  hasTrainingQueueEntries,
  tickVillage,
} from './villageLogic';

export const SAVE_STORAGE_KEY = 'clash_of_realms_save_v1';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface WxStorageApi {
  getStorageSync?: (key: string) => unknown;
  setStorageSync?: (key: string, data: string) => void;
  removeStorageSync?: (key: string) => void;
}

function getDefaultStorage(): StorageLike | null {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    return window.localStorage;
  }
  const wxObj = (globalThis as unknown as { wx?: WxStorageApi }).wx;
  if (wxObj?.getStorageSync && wxObj?.setStorageSync && wxObj?.removeStorageSync) {
    return {
      getItem: (key) => {
        try {
          const val = wxObj.getStorageSync!(key);
          return typeof val === 'string' && val.length > 0 ? val : null;
        } catch {
          return null;
        }
      },
      setItem: (key, value) => {
        wxObj.setStorageSync!(key, value);
      },
      removeItem: (key) => {
        wxObj.removeStorageSync!(key);
      },
    };
  }
  return null;
}

export function serializeVillageSave(village: VillageState): string {
  return JSON.stringify(village);
}

export function saveVillageToStorage(
  village: VillageState,
  storage: StorageLike | null = getDefaultStorage()
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SAVE_STORAGE_KEY, serializeVillageSave(village));
    return true;
  } catch {
    return false;
  }
}

export function clearVillageSave(
  storage: StorageLike | null = getDefaultStorage()
): void {
  if (!storage) return;
  try {
    storage.removeItem(SAVE_STORAGE_KEY);
  } catch {
    // Ignore storage removal failure
  }
}

export function loadSavedVillage(
  nowMs: number = Date.now(),
  storage: StorageLike | null = getDefaultStorage()
): { village: VillageState; hasSave: boolean } {
  const dateKey = getLocalDateKey(nowMs);
  if (storage) {
    try {
      const raw = storage.getItem(SAVE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as VillageState;
        if (parsed && Array.isArray(parsed.buildings) && parsed.buildings.length > 0) {
          const { next: caughtUp } = tickVillage(parsed, nowMs);
          const defaultLevels: Record<TroopType, number> = {
            barbarian: 1,
            archer: 1,
            giant: 1,
            goblin: 1,
            wall_breaker: 1,
            balloon: 1,
          };
          const normalizedLevels: Partial<Record<TroopType, number>> = {
            ...defaultLevels,
            ...(caughtUp.troopLevels ?? {}),
          };
          return {
            village: ensureDailyMissions(
              { ...caughtUp, troopLevels: normalizedLevels },
              dateKey
            ),
            hasSave: true,
          };
        }
      }
    } catch {
      // Ignore corrupt save data
    }
  }
  return {
    village: ensureDailyMissions(createInitialVillage(), dateKey),
    hasSave: false,
  };
}

export function applyBattleResultToVillage(
  cur: VillageState,
  r: BattleResult,
  dateKey = getLocalDateKey(),
  replay?: BattleReplay
): VillageState {
  const caps = getResourceCaps(cur);

  const nextArmy = { ...cur.army };
  for (const t of TROOP_ORDER) {
    const used = r.troopsDeployed[t] ?? 0;
    nextArmy[t] = Math.max(0, (nextArmy[t] ?? 0) - used);
  }

  const nextSpells = { ...cur.spells };
  for (const s of SPELL_ORDER) {
    const used = r.spellsUsed[s] ?? 0;
    nextSpells[s] = Math.max(0, (nextSpells[s] ?? 0) - used);
  }

  const nextReinforcements: Partial<Record<TroopType, number>> = {
    ...(cur.clanReinforcements ?? {}),
  };
  if (r.reinforcementsDeployed) {
    for (const t of TROOP_ORDER) {
      const used = r.reinforcementsDeployed[t] ?? 0;
      if (used > 0) {
        const rem = Math.max(0, (nextReinforcements[t] ?? 0) - used);
        if (rem > 0) nextReinforcements[t] = rem;
        else delete nextReinforcements[t];
      }
    }
  }

  const nextCampaignStars = { ...cur.campaignStars };
  if (r.campaignStageId !== undefined) {
    nextCampaignStars[r.campaignStageId] = Math.max(
      nextCampaignStars[r.campaignStageId] ?? 0,
      r.stars
    );
  }

  const battleQueue = cloneTrainingQueue({
    army: r.troopsDeployed,
    spells: r.spellsUsed,
  });

  let updatedVillage: VillageState = ensureDailyMissions(
    {
      ...cur,
      gold: Math.min(caps.maxGold, cur.gold + r.lootGold),
      elixir: Math.min(caps.maxElixir, cur.elixir + r.lootElixir),
      trophies: Math.max(0, cur.trophies + r.trophyDelta),
      army: nextArmy,
      spells: nextSpells,
      clanReinforcements: nextReinforcements,
      campaignStars: nextCampaignStars,
      lastTrainingQueue: hasTrainingQueueEntries(battleQueue)
        ? battleQueue
        : cur.lastTrainingQueue,
      battleReplays: replay
        ? appendBattleReplay(cur.battleReplays, replay)
        : cur.battleReplays,
    },
    dateKey
  );

  if (r.stars > 0) {
    updatedVillage = recordMissionProgress(updatedVillage, 'battle_stars', r.stars, dateKey);
  }
  const totalLoot = r.lootGold + r.lootElixir;
  if (totalLoot > 0) {
    updatedVillage = recordMissionProgress(updatedVillage, 'loot_resources', totalLoot, dateKey);
  }
  return updatedVillage;
}
