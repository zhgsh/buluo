import { BUILDING_CATALOG, getTroopLevelStats, TROOP_CATALOG, TROOP_ORDER } from './catalog';
import type {
  BattleLayoutItem,
  TroopType,
  VillageState,
} from './types';
import { getResourceCaps, getUsedClanSpace, getUsedTroopSpace } from './villageLogic';

export type StrategyReadiness = 'favorable' | 'balanced' | 'risky' | 'unready';

export interface StrategyTargetInput {
  name: string;
  thLevel: number;
  buildings: BattleLayoutItem[];
}

export interface TroopRecommendation {
  troopType: TroopType;
  name: string;
  effectivenessScore: number;
  ownedCount: number;
  reinforcementCount: number;
  unlocked: boolean;
  barracksRequired: number;
  reason: string;
}

export interface AttackStrategyEvaluation {
  targetName: string;
  targetTH: number;
  playerTH: number;
  readiness: StrategyReadiness;
  readinessLabel: string;
  matchupScore: number;
  summary: string;
  armySummary: {
    usedSpace: number;
    maxSpace: number;
    totalHp: number;
    totalDps: number;
    tankCount: number;
    rangedCount: number;
    wallBreakerCount: number;
    airCount: number;
    spellCount: number;
    reinforcementSpace: number;
  };
  defenseSummary: {
    cannonCount: number;
    archerTowerCount: number;
    mortarCount: number;
    airDefenseCount: number;
    wizardTowerCount: number;
    wallCount: number;
    resourceCount: number;
    totalDefensePower: number;
  };
  recommendedTroops: TroopRecommendation[];
  warnings: string[];
  actionTip: string;
}

function getMaxBarracksLevel(village: VillageState): number {
  let maxLv = 1;
  for (const b of village.buildings) {
    if (b.type === 'barracks' && b.level > 0) {
      maxLv = Math.max(maxLv, b.level);
    }
  }
  return maxLv;
}

export function evaluateAttackStrategy(
  village: VillageState,
  target: StrategyTargetInput
): AttackStrategyEvaluation {
  const caps = getResourceCaps(village);
  const maxBarracksLv = getMaxBarracksLevel(village);

  let cannonCount = 0;
  let archerTowerCount = 0;
  let mortarCount = 0;
  let airDefenseCount = 0;
  let wizardTowerCount = 0;
  let wallCount = 0;
  let resourceCount = 0;
  let totalDefensePower = target.thLevel * 160;

  for (const b of target.buildings) {
    const def = BUILDING_CATALOG[b.type];
    const lvStats = def.levels[Math.min(b.level, def.levels.length) - 1] ?? def.levels[0];
    if (b.type === 'cannon') cannonCount += 1;
    else if (b.type === 'archer_tower') archerTowerCount += 1;
    else if (b.type === 'mortar') mortarCount += 1;
    else if (b.type === 'air_defense') airDefenseCount += 1;
    else if (b.type === 'wizard_tower') wizardTowerCount += 1;
    else if (b.type === 'wall') wallCount += 1;
    else if (
      b.type === 'gold_mine' ||
      b.type === 'elixir_collector' ||
      b.type === 'gold_storage' ||
      b.type === 'elixir_storage'
    ) {
      resourceCount += 1;
    }

    if (b.type === 'wall') {
      totalDefensePower += 12 + b.level * 4;
    } else if (def.category === 'defense') {
      totalDefensePower += (lvStats.hp ?? 300) * 0.28 + (lvStats.dps ?? 15) * 18;
    }
  }

  const usedSpace = getUsedTroopSpace(village.army);
  const reinforcementSpace = getUsedClanSpace(village.clanReinforcements);
  const spellCount = (village.spells.heal ?? 0) + (village.spells.rage ?? 0);

  let totalHp = 0;
  let totalDps = 0;
  let tankCount = 0;
  let rangedCount = 0;
  let wallBreakerCount = 0;
  let airCount = 0;

  for (const t of TROOP_ORDER) {
    const def = TROOP_CATALOG[t];
    const lvStats = getTroopLevelStats(t, village.troopLevels?.[t] ?? 1);
    const owned = village.army[t] ?? 0;
    const reinf = village.clanReinforcements?.[t] ?? 0;
    if (owned > 0) {
      totalHp += owned * lvStats.hp;
      totalDps += owned * lvStats.dps;
    }
    if (reinf > 0) {
      totalHp += reinf * lvStats.hp * 1.15;
      totalDps += reinf * lvStats.dps * 1.15;
    }
    const combined = owned + reinf;
    if (t === 'giant') tankCount += combined;
    if (t === 'archer') rangedCount += combined;
    if (t === 'wall_breaker') wallBreakerCount += combined;
    if (def.isAir) airCount += combined;
  }

  const splashCount = mortarCount + wizardTowerCount;
  const singleGroundCount = cannonCount + archerTowerCount;

  const recommendedTroops: TroopRecommendation[] = TROOP_ORDER.map((t) => {
    const def = TROOP_CATALOG[t];
    const ownedCount = village.army[t] ?? 0;
    const reinforcementCount = village.clanReinforcements?.[t] ?? 0;
    const unlocked = maxBarracksLv >= def.barracksLevelRequired;

    let score = 62;
    let reason = def.role;

    if (t === 'giant') {
      score = 68;
      if (singleGroundCount >= 2 || target.thLevel >= 2) score += 16;
      if (splashCount >= 1) score += 10;
      if (wallCount >= 12) score -= 4;
      score = Math.min(96, Math.max(40, score));
      reason =
        splashCount >= 1
          ? `可稳定吸收加农炮与${mortarCount > 0 ? '迫击炮' : '法师塔'}火力，掩护后排输出`
          : `优先拆毁敌方 ${singleGroundCount} 座防塔，是正面突破的核心前排`;
    } else if (t === 'archer') {
      score = 78;
      if (wallCount >= 8) score += 8;
      if (airDefenseCount === 0 && cannonCount >= 1) score += 4;
      if (splashCount >= 2) score -= 6;
      score = Math.min(94, Math.max(50, score));
      reason =
        wallCount >= 8
          ? '射程优势可隔墙点射建筑，配合前排抗伤稳定拿星'
          : '远程集中输出，清理外围矿场与无遮挡防塔效率极高';
    } else if (t === 'wall_breaker') {
      if (wallCount >= 16) {
        score = 92;
        reason = `敌阵筑有 ${wallCount} 段城墙闭环，炸弹人破墙可让近战与巨人直插核心`;
      } else if (wallCount >= 8) {
        score = 83;
        reason = `目标配有 ${wallCount} 段城墙防线，开墙可大幅缩短部队接敌时间`;
      } else {
        score = 32;
        reason = '敌阵城墙较少且缺口明显，无需额外占用破墙人口';
      }
    } else if (t === 'balloon') {
      if (airDefenseCount === 0) {
        score = 95;
        reason = '敌方未部署防空火箭，气球兵无视城墙与加农炮，可高效率拆光防御';
      } else if (airDefenseCount === 1 && wizardTowerCount === 0) {
        score = 76;
        reason = '仅 1 座防空火箭，可先派地面部队拆防空或配合法术空袭突破';
      } else {
        score = 54;
        reason = `敌阵含 ${airDefenseCount} 座防空${wizardTowerCount > 0 ? `与 ${wizardTowerCount} 座法师塔` : ''}，纯空军需谨慎下兵`;
      }
    } else if (t === 'goblin') {
      score = 58 + Math.min(20, resourceCount * 4);
      if (wallCount >= 16) score -= 12;
      if (splashCount >= 1) score -= 8;
      score = Math.min(88, Math.max(38, score));
      reason =
        wallCount >= 12
          ? '资源建筑双倍伤害，建议待前排破墙清炮后再派哥布林收割资源'
          : `外围共 ${resourceCount} 座矿场/仓库，极速掠夺资源效率极佳`;
    } else if (t === 'barbarian') {
      score = target.thLevel <= 2 && splashCount === 0 ? 86 : 64;
      if (splashCount >= 1) score -= splashCount * 9;
      score = Math.min(90, Math.max(42, score));
      reason =
        splashCount === 0
          ? '敌阵缺乏范围溅射防御，低费野蛮人集团冲锋极具性价比'
          : '注意避开迫击炮与法师塔火力中心，宜分散包围或跟在巨人后方';
    }

    return {
      troopType: t,
      name: def.name,
      effectivenessScore: Math.round(score),
      ownedCount,
      reinforcementCount,
      unlocked,
      barracksRequired: def.barracksLevelRequired,
      reason,
    };
  }).sort((a, b) => b.effectivenessScore - a.effectivenessScore);

  const warnings: string[] = [];
  let synergyAdjustment = 0;

  if (usedSpace === 0 && reinforcementSpace === 0) {
    warnings.push('当前军营与援军为空，无法发起进攻');
  } else {
    if (usedSpace < caps.maxTroopSpace * 0.75) {
      warnings.push(
        `军营尚有 ${caps.maxTroopSpace - usedSpace} 人口空位，建议补满部队后再开战`
      );
      synergyAdjustment -= 8;
    }

    if (target.thLevel > village.townHallLevel) {
      warnings.push(
        `目标为 ${target.thLevel} 本（高于我方 ${village.townHallLevel} 本），防塔火力与血量压力较大`
      );
      synergyAdjustment -= (target.thLevel - village.townHallLevel) * 10;
    }

    if ((cannonCount + archerTowerCount + splashCount >= 2 || target.thLevel >= 2) && tankCount === 0 && airCount === 0) {
      warnings.push('当前配兵缺少巨人前排抗伤，脆弱兵种易被防塔集火快速击溃');
      synergyAdjustment -= 12;
    }

    if (splashCount >= 1 && (village.army.barbarian ?? 0) + (village.army.goblin ?? 0) >= 8 && tankCount === 0) {
      warnings.push('敌阵拥有迫击炮/法师塔范围溅射，无坦克掩护时请分散下兵或配疗伤法术');
      synergyAdjustment -= 8;
    }

    if (wallCount >= 14 && wallBreakerCount === 0 && airCount === 0 && rangedCount < 4) {
      warnings.push('敌阵城墙封锁严密，缺少炸弹人破墙或足够弓箭手隔墙火力');
      synergyAdjustment -= 8;
    }

    if (airDefenseCount >= 1 && airCount > 0 && tankCount === 0 && rangedCount < 4) {
      warnings.push('敌方已部署防空火箭，纯气球强攻风险较高，建议搭配地面部队先拆防空');
      synergyAdjustment -= 8;
    }

    if (spellCount === 0 && target.thLevel >= 3) {
      warnings.push('面对 3 本以上防线建议在法术工厂炼制疗伤或狂暴法术提升容错');
      synergyAdjustment -= 5;
    }
  }

  const totalEffectiveUnits = usedSpace + reinforcementSpace;
  const armyPower = totalHp * 0.16 + totalDps * 9.5 + spellCount * 165;
  const powerRatio = totalDefensePower > 0 ? armyPower / totalDefensePower : 1;

  let matchupScore = 0;
  let readiness: StrategyReadiness = 'unready';
  let readinessLabel = '未整备出征';

  if (totalEffectiveUnits > 0) {
    const rawScore = 54 + (powerRatio - 1) * 38 + synergyAdjustment + (tankCount > 0 && rangedCount >= 3 ? 6 : 0);
    matchupScore = Math.max(8, Math.min(98, Math.round(rawScore)));
    if (matchupScore >= 72) {
      readiness = 'favorable';
      readinessLabel = '胜算较高 · 优势配置';
    } else if (matchupScore >= 46) {
      readiness = 'balanced';
      readinessLabel = '势均力敌 · 稳健可行';
    } else {
      readiness = 'risky';
      readinessLabel = '战力偏弱 · 建议补强';
    }
  }

  const topUnlocked = recommendedTroops.find((r) => r.unlocked) ?? recommendedTroops[0];
  const secondaryUnlocked =
    recommendedTroops.find((r) => r.unlocked && r.troopType !== topUnlocked.troopType) ??
    recommendedTroops[1];

  let actionTip = '';
  if (totalEffectiveUnits === 0) {
    actionTip = `请先在兵营训练至少一批 ${topUnlocked.name}${secondaryUnlocked ? ` 与 ${secondaryUnlocked.name}` : ''}`;
  } else if (topUnlocked.ownedCount + topUnlocked.reinforcementCount === 0) {
    actionTip = `当前未携带本关高克制兵种「${topUnlocked.name}」，建议在兵营训练数名以提升胜率`;
  } else if (warnings.length > 0) {
    actionTip = warnings[0];
  } else {
    actionTip = `当前以 ${topUnlocked.name}${secondaryUnlocked ? ` + ${secondaryUnlocked.name}` : ''} 为主力的配兵契合度高，可先放前排抗塔再跟进输出`;
  }

  const summary =
    totalEffectiveUnits === 0
      ? `请先训练部队后再评估对「${target.name}」的实战配兵。`
      : `当前出征战力（${usedSpace}/${caps.maxTroopSpace} 人口${reinforcementSpace > 0 ? ` + ${reinforcementSpace} 援军` : ''}）对阵 ${target.thLevel} 本防线，综合契合评分 ${matchupScore} 分。`;

  return {
    targetName: target.name,
    targetTH: target.thLevel,
    playerTH: village.townHallLevel,
    readiness,
    readinessLabel,
    matchupScore,
    summary,
    armySummary: {
      usedSpace,
      maxSpace: caps.maxTroopSpace,
      totalHp: Math.round(totalHp),
      totalDps: Math.round(totalDps),
      tankCount,
      rangedCount,
      wallBreakerCount,
      airCount,
      spellCount,
      reinforcementSpace,
    },
    defenseSummary: {
      cannonCount,
      archerTowerCount,
      mortarCount,
      airDefenseCount,
      wizardTowerCount,
      wallCount,
      resourceCount,
      totalDefensePower: Math.round(totalDefensePower),
    },
    recommendedTroops,
    warnings,
    actionTip,
  };
}
