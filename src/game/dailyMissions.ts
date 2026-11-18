import type {
  DailyMission,
  DailyMissionKind,
  DailyMissionsState,
  ResourceType,
  VillageState,
} from './types';
import { getResourceCaps } from './villageLogic';

interface MissionTemplate {
  kind: DailyMissionKind;
  title: string;
  description: string;
  target: number;
  rewardType: ResourceType;
  rewardAmount: number;
}

const MISSION_POOL: MissionTemplate[] = [
  {
    kind: 'collect_elixir',
    title: '采集圣水',
    description: '从圣水收集器累计收取 200 圣水',
    target: 200,
    rewardType: 'gold',
    rewardAmount: 450,
  },
  {
    kind: 'collect_gold',
    title: '开采金币',
    description: '从金矿累计收取 200 金币',
    target: 200,
    rewardType: 'elixir',
    rewardAmount: 450,
  },
  {
    kind: 'train_troops',
    title: '整军备战',
    description: '在兵营中训练 5 名士兵',
    target: 5,
    rewardType: 'gems',
    rewardAmount: 25,
  },
  {
    kind: 'upgrade_or_build',
    title: '大兴土木',
    description: '建造或升级 1 座村庄建筑',
    target: 1,
    rewardType: 'gold',
    rewardAmount: 550,
  },
  {
    kind: 'battle_stars',
    title: '战旗飘扬',
    description: '在战役或联机进攻中赢得 1 颗星',
    target: 1,
    rewardType: 'gems',
    rewardAmount: 35,
  },
  {
    kind: 'loot_resources',
    title: '凯旋掠夺',
    description: '在进攻战斗中累计掠夺 600 资源',
    target: 600,
    rewardType: 'elixir',
    rewardAmount: 600,
  },
];

export function getLocalDateKey(nowMs = Date.now()): string {
  const d = new Date(nowMs);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function hashDateKey(dateKey: string): number {
  let h = 2166136261;
  for (let i = 0; i < dateKey.length; i++) {
    h ^= dateKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Deterministically picks 3 distinct daily missions for a given calendar date.
 * Picks 1 resource-collection task, 1 village/army task, and 1 combat/upgrade task.
 */
export function generateDailyMissions(dateKey: string): DailyMissionsState {
  const h = hashDateKey(dateKey);
  const resourceGroup = [MISSION_POOL[0], MISSION_POOL[1]];
  const armyBuildGroup = [MISSION_POOL[2], MISSION_POOL[3]];
  const battleGroup = [MISSION_POOL[4], MISSION_POOL[5]];

  const picks: MissionTemplate[] = [
    resourceGroup[h % resourceGroup.length],
    armyBuildGroup[(h >>> 3) % armyBuildGroup.length],
    battleGroup[(h >>> 6) % battleGroup.length],
  ];

  const missions: DailyMission[] = picks.map((tpl, idx) => ({
    id: `dm_${dateKey}_${idx}_${tpl.kind}`,
    kind: tpl.kind,
    title: tpl.title,
    description: tpl.description,
    target: tpl.target,
    progress: 0,
    rewardType: tpl.rewardType,
    rewardAmount: tpl.rewardAmount,
    claimed: false,
  }));

  return { dateKey, missions };
}

export function ensureDailyMissions(
  village: VillageState,
  dateKey = getLocalDateKey()
): VillageState {
  if (
    village.dailyMissions &&
    village.dailyMissions.dateKey === dateKey &&
    village.dailyMissions.missions.length === 3
  ) {
    return village;
  }
  return {
    ...village,
    dailyMissions: generateDailyMissions(dateKey),
  };
}

export function recordMissionProgress(
  village: VillageState,
  kind: DailyMissionKind,
  delta: number,
  dateKey = getLocalDateKey()
): VillageState {
  if (delta <= 0) return village;
  const synced = ensureDailyMissions(village, dateKey);
  const current = synced.dailyMissions!;
  let changed = false;

  const nextMissions = current.missions.map((m) => {
    if (m.kind !== kind || m.progress >= m.target) return m;
    changed = true;
    return {
      ...m,
      progress: Math.min(m.target, m.progress + Math.floor(delta)),
    };
  });

  if (!changed) return synced;
  return {
    ...synced,
    dailyMissions: {
      ...current,
      missions: nextMissions,
    },
  };
}

export function claimDailyMissionReward(
  village: VillageState,
  missionId: string,
  dateKey = getLocalDateKey()
):
  | { ok: true; next: VillageState; rewardType: ResourceType; rewardAmount: number }
  | { ok: false; reason: string } {
  const synced = ensureDailyMissions(village, dateKey);
  const current = synced.dailyMissions!;
  const targetMission = current.missions.find((m) => m.id === missionId);

  if (!targetMission) {
    return { ok: false, reason: '任务不存在或已过期' };
  }
  if (targetMission.claimed) {
    return { ok: false, reason: '奖励已领取' };
  }
  if (targetMission.progress < targetMission.target) {
    return { ok: false, reason: '任务尚未完成' };
  }

  const caps = getResourceCaps(synced);
  let nextGold = synced.gold;
  let nextElixir = synced.elixir;
  let nextGems = synced.gems;

  if (targetMission.rewardType === 'gold') {
    nextGold = Math.min(caps.maxGold, synced.gold + targetMission.rewardAmount);
  } else if (targetMission.rewardType === 'elixir') {
    nextElixir = Math.min(caps.maxElixir, synced.elixir + targetMission.rewardAmount);
  } else {
    nextGems = synced.gems + targetMission.rewardAmount;
  }

  return {
    ok: true,
    rewardType: targetMission.rewardType,
    rewardAmount: targetMission.rewardAmount,
    next: {
      ...synced,
      gold: nextGold,
      elixir: nextElixir,
      gems: nextGems,
      dailyMissions: {
        ...current,
        missions: current.missions.map((m) =>
          m.id === missionId ? { ...m, claimed: true } : m
        ),
      },
    },
  };
}

export function getClaimableMissionCount(village: VillageState): number {
  if (!village.dailyMissions) return 0;
  return village.dailyMissions.missions.filter(
    (m) => m.progress >= m.target && !m.claimed
  ).length;
}
