import { TROOP_CATALOG } from './catalog';
import type { TroopType, VillageState } from './types';
import { getResourceCaps, getUsedClanSpace } from './villageLogic';

export type ReinforcementPreference = 'balanced' | 'tank' | 'ranged' | 'air';

export interface SimulatedAlliance {
  id: string;
  name: string;
  badge: string;
  level: number;
  motto: string;
  members: Array<{ name: string; role: string; specialty: TroopType }>;
}

export const SIMULATED_ALLIANCES: SimulatedAlliance[] = [
  {
    id: 'dragon_flame',
    name: '龙焰守护者',
    badge: 'Lv.4 活跃联盟',
    level: 4,
    motto: '快速秒捐援军，永不缺席部落战！',
    members: [
      { name: '战锤巴尔', role: '首领', specialty: 'giant' },
      { name: '银弓艾琳', role: '副首领', specialty: 'archer' },
      { name: '天空领主凯恩', role: '长老', specialty: 'balloon' },
      { name: '狂战雷夫', role: '成员', specialty: 'barbarian' },
    ],
  },
  {
    id: 'northern_shield',
    name: '北境圣盾盟',
    badge: 'Lv.5 精英联盟',
    level: 5,
    motto: '重装防线与精锐支援，守护每一座村庄。',
    members: [
      { name: '铁壁奥恩', role: '首领', specialty: 'giant' },
      { name: '凛冬游侠芙蕾', role: '副首领', specialty: 'archer' },
      { name: '爆破工兵洛克', role: '长老', specialty: 'wall_breaker' },
      { name: '铁剑托尔', role: '成员', specialty: 'barbarian' },
    ],
  },
  {
    id: 'star_expedition',
    name: '星辰远征军',
    badge: 'Lv.3 远征联盟',
    level: 3,
    motto: '奇袭与空军协同，三星平推敌营！',
    members: [
      { name: '飞艇大师维克', role: '首领', specialty: 'balloon' },
      { name: '疾风盗贼奇拉', role: '副首领', specialty: 'goblin' },
      { name: '神射手莉亚', role: '长老', specialty: 'archer' },
      { name: '先锋卡洛', role: '成员', specialty: 'barbarian' },
    ],
  },
];

export const CLAN_REQUEST_COOLDOWN_MS = 10_000;

export interface ClanRequestCooldownState {
  active: boolean;
  totalMs: number;
  elapsedMs: number;
  remainingMs: number;
  remainingSec: number;
  /** 0 -> 100 recovery progress toward being ready to request again */
  progressPercent: number;
}

export function getAllianceByName(name?: string): SimulatedAlliance {
  return (
    SIMULATED_ALLIANCES.find((a) => a.name === name) ?? SIMULATED_ALLIANCES[0]
  );
}

export function getClanRequestCooldownState(
  village: VillageState,
  nowMs: number = Date.now()
): ClanRequestCooldownState {
  if (!village.clanLastRequestAt) {
    return {
      active: false,
      totalMs: CLAN_REQUEST_COOLDOWN_MS,
      elapsedMs: CLAN_REQUEST_COOLDOWN_MS,
      remainingMs: 0,
      remainingSec: 0,
      progressPercent: 100,
    };
  }
  const elapsedMs = Math.max(0, nowMs - village.clanLastRequestAt);
  if (elapsedMs >= CLAN_REQUEST_COOLDOWN_MS) {
    return {
      active: false,
      totalMs: CLAN_REQUEST_COOLDOWN_MS,
      elapsedMs: CLAN_REQUEST_COOLDOWN_MS,
      remainingMs: 0,
      remainingSec: 0,
      progressPercent: 100,
    };
  }
  const remainingMs = CLAN_REQUEST_COOLDOWN_MS - elapsedMs;
  const remainingSec = Math.ceil(remainingMs / 1000);
  const progressPercent = Math.min(
    100,
    Math.max(0, (elapsedMs / CLAN_REQUEST_COOLDOWN_MS) * 100)
  );
  return {
    active: true,
    totalMs: CLAN_REQUEST_COOLDOWN_MS,
    elapsedMs,
    remainingMs,
    remainingSec,
    progressPercent,
  };
}

export function getClanRequestCooldownRemainingSec(
  village: VillageState,
  nowMs: number = Date.now()
): number {
  return getClanRequestCooldownState(village, nowMs).remainingSec;
}

export function joinSimulatedAlliance(
  village: VillageState,
  allianceName: string
): VillageState {
  const alliance = getAllianceByName(allianceName);
  return {
    ...village,
    clanName: alliance.name,
  };
}

const PREFERENCE_PRIORITY: Record<ReinforcementPreference, TroopType[]> = {
  balanced: ['giant', 'archer', 'barbarian'],
  tank: ['giant', 'barbarian', 'archer'],
  ranged: ['balloon', 'archer', 'barbarian'],
  air: ['balloon', 'archer', 'barbarian'],
};

export interface ClanDonationEvent {
  donorName: string;
  troopType: TroopType;
  count: number;
}

export function requestClanReinforcements(
  village: VillageState,
  preference: ReinforcementPreference = 'balanced',
  nowMs: number = Date.now()
):
  | { ok: true; next: VillageState; donations: ClanDonationEvent[] }
  | { ok: false; reason: string } {
  const caps = getResourceCaps(village);
  if (!caps.hasClanCastle || caps.maxClanSpace <= 0) {
    return { ok: false, reason: '请先建造并完成部落城堡' };
  }

  const used = getUsedClanSpace(village.clanReinforcements);
  let remainingSpace = caps.maxClanSpace - used;
  if (remainingSpace <= 0) {
    return { ok: false, reason: '部落城堡援军容量已满' };
  }

  const cooldownSec = getClanRequestCooldownRemainingSec(village, nowMs);
  if (cooldownSec > 0) {
    return { ok: false, reason: `请等待 ${cooldownSec}s 后再次向联盟请求增援` };
  }

  const alliance = getAllianceByName(village.clanName);
  const priority = PREFERENCE_PRIORITY[preference];
  const nextReinforcements: Partial<Record<TroopType, number>> = {
    ...(village.clanReinforcements ?? {}),
  };
  const addedCounts: Partial<Record<TroopType, number>> = {};

  // Fill remaining space intelligently according to requested preference
  let guard = 0;
  while (remainingSpace > 0 && guard < 40) {
    guard++;
    let placedAny = false;
    for (const tType of priority) {
      const space = TROOP_CATALOG[tType].housingSpace;
      if (space <= remainingSpace) {
        // Limit heavy 5-space units slightly in balanced mode so mix feels authentic
        if (
          preference === 'balanced' &&
          space >= 5 &&
          (addedCounts[tType] ?? 0) >= Math.max(1, Math.floor(caps.maxClanSpace / 10))
        ) {
          continue;
        }
        nextReinforcements[tType] = (nextReinforcements[tType] ?? 0) + 1;
        addedCounts[tType] = (addedCounts[tType] ?? 0) + 1;
        remainingSpace -= space;
        placedAny = true;
        if (preference !== 'balanced') {
          break;
        }
      }
    }
    if (!placedAny) {
      // Top off any leftover 1-space slots with Archers or Barbarians
      if (remainingSpace >= 1) {
        const filler: TroopType = preference === 'tank' ? 'barbarian' : 'archer';
        nextReinforcements[filler] = (nextReinforcements[filler] ?? 0) + 1;
        addedCounts[filler] = (addedCounts[filler] ?? 0) + 1;
        remainingSpace -= 1;
      } else {
        break;
      }
    }
  }

  const donations: ClanDonationEvent[] = [];
  for (const [tKey, count] of Object.entries(addedCounts)) {
    if (!count || count <= 0) continue;
    const tType = tKey as TroopType;
    const matchedMember =
      alliance.members.find((m) => m.specialty === tType) ??
      alliance.members[donations.length % alliance.members.length];
    donations.push({
      donorName: matchedMember.name,
      troopType: tType,
      count,
    });
  }

  return {
    ok: true,
    donations,
    next: {
      ...village,
      clanName: alliance.name,
      clanReinforcements: nextReinforcements,
      clanLastRequestAt: nowMs,
    },
  };
}

export function dismissClanReinforcement(
  village: VillageState,
  troopType: TroopType
): VillageState {
  const cur = village.clanReinforcements?.[troopType] ?? 0;
  if (cur <= 0) return village;
  const next = { ...(village.clanReinforcements ?? {}) };
  if (cur <= 1) {
    delete next[troopType];
  } else {
    next[troopType] = cur - 1;
  }
  return {
    ...village,
    clanReinforcements: next,
  };
}

export interface ClanChatEntry {
  id: string;
  kind: 'chat' | 'donation' | 'system';
  senderName: string;
  senderRole?: string;
  text: string;
  troopType?: TroopType;
  troopCount?: number;
  timestampMs: number;
  isOwn?: boolean;
}

let chatSeqCounter = 1;
function nextChatId(prefix: string): string {
  chatSeqCounter += 1;
  return `${prefix}_${chatSeqCounter}`;
}

export function createInitialClanChatMessages(
  allianceName?: string,
  nowMs: number = Date.now()
): ClanChatEntry[] {
  const alliance = getAllianceByName(allianceName);
  const leader = alliance.members[0];
  const coLeader = alliance.members[1] ?? alliance.members[0];
  const elder = alliance.members[2] ?? alliance.members[0];

  return [
    {
      id: nextChatId('sys'),
      kind: 'system',
      senderName: '联盟公告',
      text: `欢迎来到「${alliance.name}」· ${alliance.motto}`,
      timestampMs: nowMs - 180_000,
    },
    {
      id: nextChatId('chat'),
      kind: 'chat',
      senderName: leader.name,
      senderRole: leader.role,
      text: '大家进攻前记得先在部落城堡领满援军，满编再推三星！',
      timestampMs: nowMs - 120_000,
    },
    {
      id: nextChatId('don'),
      kind: 'donation',
      senderName: coLeader.name,
      senderRole: coLeader.role,
      text: `向 ${elder.name} 捐赠了 2×${TROOP_CATALOG[coLeader.specialty].name}`,
      troopType: coLeader.specialty,
      troopCount: 2,
      timestampMs: nowMs - 65_000,
    },
    {
      id: nextChatId('chat'),
      kind: 'chat',
      senderName: elder.name,
      senderRole: elder.role,
      text: '我兵营已备好，有需要援军随时在聊天里喊一声或点求援！',
      timestampMs: nowMs - 25_000,
    },
  ];
}

export function formatDonationChatEntries(
  donations: ClanDonationEvent[],
  allianceName?: string,
  nowMs: number = Date.now()
): ClanChatEntry[] {
  const alliance = getAllianceByName(allianceName);
  return donations.map((d) => {
    const member = alliance.members.find((m) => m.name === d.donorName);
    const troopDef = TROOP_CATALOG[d.troopType];
    return {
      id: nextChatId('don'),
      kind: 'donation',
      senderName: d.donorName,
      senderRole: member?.role ?? '盟友',
      text: `已捐赠 ${d.count}×${troopDef.name} 支援你的部落城堡`,
      troopType: d.troopType,
      troopCount: d.count,
      timestampMs: nowMs,
    };
  });
}

export function createSimulatedAllianceReply(
  allianceName: string | undefined,
  playerMessage: string,
  nowMs: number = Date.now()
): ClanChatEntry {
  const alliance = getAllianceByName(allianceName);
  const trimmed = playerMessage.trim();
  const asksForTroops = /援|兵|捐|巨人|弓箭|气球|support|troop|reinforce/i.test(trimmed);
  const asksForStrategy = /攻略|怎么打|阵型|三星|配兵|法术|战术/.test(trimmed);

  const memberIndex = Math.abs(trimmed.length + Math.floor(nowMs / 1000)) % alliance.members.length;
  const responder = alliance.members[memberIndex];

  let replyText: string;
  if (asksForTroops) {
    replyText = `收到！我这边${TROOP_CATALOG[responder.specialty].name}已就位，点击下方“快速求援”或部落城堡就能秒收援军！`;
  } else if (asksForStrategy) {
    replyText = '建议用巨人吸引加农炮火力，后排跟进弓箭手输出，残血再丢一发疗伤法术稳拿三星！';
  } else if (trimmed.includes('你好') || trimmed.includes('大家好') || trimmed.includes('hi')) {
    replyText = `欢迎首领！今天「${alliance.name}」全员在线备战，一起冲杯吧！`;
  } else {
    replyText = `赞同！「${alliance.name}」随时为你提供 +15% 战力加成的精锐援军支援。`;
  }

  return {
    id: nextChatId('chat'),
    kind: 'chat',
    senderName: responder.name,
    senderRole: responder.role,
    text: replyText,
    timestampMs: nowMs,
  };
}

