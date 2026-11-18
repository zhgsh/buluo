import {
  BUILDING_CATALOG,
  GRID_SIZE,
  SPELL_CATALOG,
  SPELL_ORDER,
  TROOP_CATALOG,
  TROOP_ORDER,
} from './catalog';
import { dist2D, distanceToBuildingEdge } from './isoMath';
import { sound } from './sound';
import type {
  BattleBuilding,
  BattleResult,
  BattleState,
  BattleTroop,
  BuildingType,
  FloatingText,
  Particle,
  SpellType,
  TroopType,
  VillageState,
} from './types';

export interface VFXPools {
  particles: Particle[];
  texts: FloatingText[];
  particleCursor: number;
  textCursor: number;
}

export function createVFXPools(maxParticles = 320, maxTexts = 96): VFXPools {
  const particles: Particle[] = [];
  for (let i = 0; i < maxParticles; i++) {
    particles.push({
      active: false,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      size: 3,
      color: '#ffffff',
      life: 0,
      maxLife: 1,
      gravity: 12,
    });
  }
  const texts: FloatingText[] = [];
  for (let i = 0; i < maxTexts; i++) {
    texts.push({
      active: false,
      x: 0,
      y: 0,
      vy: 0,
      anchorPx: 42,
      risePx: 0,
      riseSpeedPx: 32,
      jitterX: 0,
      scale: 1,
      kind: 'loot',
      text: '',
      color: '#ffffff',
      life: 0,
      maxLife: 1,
    });
  }
  return { particles, texts, particleCursor: 0, textCursor: 0 };
}

export function spawnParticles(
  pools: VFXPools,
  gx: number,
  gy: number,
  count: number,
  color: string,
  speed = 2.6,
  size = 4,
  z = 0.4
) {
  for (let i = 0; i < count; i++) {
    const p = pools.particles[pools.particleCursor];
    pools.particleCursor = (pools.particleCursor + 1) % pools.particles.length;
    const angle = Math.random() * Math.PI * 2;
    const mag = (0.3 + Math.random() * 0.7) * speed;
    p.active = true;
    p.x = gx + (Math.random() - 0.5) * 0.4;
    p.y = gy + (Math.random() - 0.5) * 0.4;
    p.z = z;
    p.vx = Math.cos(angle) * mag;
    p.vy = Math.sin(angle) * mag;
    p.vz = 1.6 + Math.random() * 3.0;
    p.size = size * (0.7 + Math.random() * 0.6);
    p.color = color;
    p.life = 0;
    p.maxLife = 0.35 + Math.random() * 0.35;
    p.gravity = 9.5;
  }
}

export function spawnFloatingText(
  pools: VFXPools,
  gx: number,
  gy: number,
  text: string,
  color: string,
  options?: {
    anchorPx?: number;
    riseSpeedPx?: number;
    jitterX?: number;
    scale?: number;
    kind?: FloatingText['kind'];
    maxLife?: number;
  }
) {
  const t = pools.texts[pools.textCursor];
  pools.textCursor = (pools.textCursor + 1) % pools.texts.length;
  t.active = true;
  t.x = gx;
  t.y = gy;
  t.vy = 0;
  t.anchorPx = options?.anchorPx ?? 48;
  t.risePx = 0;
  t.riseSpeedPx = options?.riseSpeedPx ?? 34;
  t.jitterX = options?.jitterX ?? 0;
  t.scale = options?.scale ?? 1;
  t.kind = options?.kind ?? 'loot';
  t.text = text;
  t.color = color;
  t.life = 0;
  t.maxLife = options?.maxLife ?? 0.85;
}

const BUILDING_DAMAGE_ANCHOR_PX: Partial<Record<BuildingType, number>> = {
  town_hall: 112,
  archer_tower: 112,
  wizard_tower: 116,
  clan_castle: 102,
  army_camp: 92,
  barracks: 92,
  spell_factory: 92,
  gold_mine: 88,
  elixir_collector: 90,
  gold_storage: 84,
  elixir_storage: 86,
  air_defense: 86,
  cannon: 78,
  mortar: 82,
  builders_hut: 72,
  wall: 48,
  flag: 78,
  flower_bed: 44,
  statue: 96,
};

export function spawnDamageNumber(
  pools: VFXPools,
  gx: number,
  gy: number,
  amount: number,
  target:
    | { kind: 'building'; buildingType: BuildingType; isHeavy?: boolean }
    | { kind: 'troop'; isAir: boolean; isHeavy?: boolean }
): void {
  const dmg = Math.max(1, Math.round(amount));
  const jitterX = (Math.random() - 0.5) * (target.kind === 'building' ? 22 : 14);
  if (target.kind === 'building') {
    const anchorPx = BUILDING_DAMAGE_ANCHOR_PX[target.buildingType] ?? 82;
    const heavy = Boolean(target.isHeavy) || dmg >= 80;
    spawnFloatingText(pools, gx, gy, `-${dmg}`, heavy ? '#fb923c' : '#fde047', {
      anchorPx,
      riseSpeedPx: 36,
      jitterX,
      scale: heavy ? 1.15 : 0.96,
      kind: 'damage_building',
      maxLife: 0.72,
    });
  } else {
    const anchorPx = target.isAir ? 68 : 34;
    const heavy = Boolean(target.isHeavy) || dmg >= 60;
    spawnFloatingText(pools, gx, gy, `-${dmg}`, '#f87171', {
      anchorPx,
      riseSpeedPx: 32,
      jitterX,
      scale: heavy ? 1.08 : 0.92,
      kind: 'damage_troop',
      maxLife: 0.68,
    });
  }
}

export function createBattleState(params: {
  targetName: string;
  targetTH: number;
  isCampaign: boolean;
  campaignStageId?: number;
  rewardGold: number;
  rewardElixir: number;
  layout: Array<{ type: BuildingType; level: number; gx: number; gy: number }>;
  playerVillage: VillageState;
}): BattleState {
  // Distribute loot across TH + resource buildings
  const lootGoldHolders = params.layout.filter(
    (b) => b.type === 'town_hall' || b.type === 'gold_mine' || b.type === 'gold_storage'
  );
  const lootElixirHolders = params.layout.filter(
    (b) => b.type === 'town_hall' || b.type === 'elixir_collector' || b.type === 'elixir_storage'
  );

  const goldPerHolder =
    lootGoldHolders.length > 0 ? Math.floor(params.rewardGold / lootGoldHolders.length) : 0;
  const elixirPerHolder =
    lootElixirHolders.length > 0 ? Math.floor(params.rewardElixir / lootElixirHolders.length) : 0;

  let goldRemainder = params.rewardGold - goldPerHolder * lootGoldHolders.length;
  let elixirRemainder = params.rewardElixir - elixirPerHolder * lootElixirHolders.length;

  const buildings: BattleBuilding[] = params.layout.map((item, idx) => {
    const def = BUILDING_CATALOG[item.type];
    const lvStats = def.levels[Math.min(item.level, def.levels.length) - 1] ?? def.levels[0];
    let lootGold = 0;
    let lootElixir = 0;
    if (item.type === 'town_hall' || item.type === 'gold_mine' || item.type === 'gold_storage') {
      lootGold = goldPerHolder + (goldRemainder > 0 ? goldRemainder-- : 0);
      if (goldRemainder < 0) goldRemainder = 0;
    }
    if (
      item.type === 'town_hall' ||
      item.type === 'elixir_collector' ||
      item.type === 'elixir_storage'
    ) {
      lootElixir = elixirPerHolder + (elixirRemainder > 0 ? elixirRemainder-- : 0);
      if (elixirRemainder < 0) elixirRemainder = 0;
    }
    // Fix remainder edge case so exact total is preserved
    if (
      idx === 0 &&
      lootGoldHolders.length === 0
    ) {
      lootGold = params.rewardGold;
    }

    return {
      id: `eb_${idx}_${item.type}`,
      type: item.type,
      level: item.level,
      gx: item.gx,
      gy: item.gy,
      size: def.size,
      hp: lvStats.hp,
      maxHp: lvStats.hp,
      destroyed: false,
      lootGold,
      lootElixir,
      attackCooldown: 0.4 + (idx % 3) * 0.15,
      turretAngle: Math.PI * 0.75,
      hitFlashTimer: 0,
      fireRecoilTimer: 0,
      windupTimer: 0,
    };
  });

  // Ensure exact loot totals
  const sumGold = buildings.reduce((s, b) => s + b.lootGold, 0);
  const sumElixir = buildings.reduce((s, b) => s + b.lootElixir, 0);
  if (buildings.length > 0 && sumGold !== params.rewardGold) {
    buildings[0].lootGold += params.rewardGold - sumGold;
  }
  if (buildings.length > 0 && sumElixir !== params.rewardElixir) {
    buildings[0].lootElixir += params.rewardElixir - sumElixir;
  }

  // Pick initial selected card
  const availReinforcements: Partial<Record<TroopType, number>> = {
    ...(params.playerVillage.clanReinforcements ?? {}),
  };
  let selectedCard: BattleState['selectedCard'] = null;
  for (const t of TROOP_ORDER) {
    if ((params.playerVillage.army[t] ?? 0) > 0) {
      selectedCard = { kind: 'troop', type: t };
      break;
    }
  }
  if (!selectedCard) {
    for (const t of TROOP_ORDER) {
      if ((availReinforcements[t] ?? 0) > 0) {
        selectedCard = { kind: 'reinforcement', type: t };
        break;
      }
    }
  }
  if (!selectedCard) {
    for (const s of SPELL_ORDER) {
      if ((params.playerVillage.spells[s] ?? 0) > 0) {
        selectedCard = { kind: 'spell', type: s };
        break;
      }
    }
  }

  return {
    targetName: params.targetName,
    targetTH: params.targetTH,
    isCampaign: params.isCampaign,
    campaignStageId: params.campaignStageId,
    phase: 'scouting',
    timeRemainingSec: 180,
    scoutTimeSec: 30,
    elapsedSec: 0,
    buildings,
    troops: [],
    projectiles: [],
    spells: [],
    availableTroops: { ...params.playerVillage.army },
    availableReinforcements: availReinforcements,
    availableSpells: { ...params.playerVillage.spells },
    troopsDeployed: {},
    reinforcementsDeployed: {},
    spellsUsed: {},
    selectedCard,
    lootGold: 0,
    lootElixir: 0,
    totalLootGold: params.rewardGold,
    totalLootElixir: params.rewardElixir,
    destructionPercent: 0,
    townHallDestroyed: false,
    stars: 0,
    hitstopTimer: 0,
    cameraTrauma: 0,
    endBeatTimer: 0,
  };
}

/**
 * Checks whether (gx, gy) is inside the outer grass field and outside every intact building's 1-tile red buffer.
 */
export function isValidDeployPoint(
  gx: number,
  gy: number,
  buildings: BattleBuilding[]
): boolean {
  if (gx < -1.5 || gy < -1.5 || gx > GRID_SIZE + 1.5 || gy > GRID_SIZE + 1.5) {
    return false;
  }
  for (const b of buildings) {
    if (b.destroyed || isDecorationBuilding(b.type)) continue;
    const pad = 0.85;
    if (
      gx >= b.gx - pad &&
      gx <= b.gx + b.size + pad &&
      gy >= b.gy - pad &&
      gy <= b.gy + b.size + pad
    ) {
      return false;
    }
  }
  return true;
}

export function calculateBattleStars(
  destructionPercent: number,
  townHallDestroyed: boolean
): number {
  let stars = 0;
  if (destructionPercent >= 50) stars += 1;
  if (townHallDestroyed) stars += 1;
  if (destructionPercent >= 100) stars += 1;
  return stars;
}

export function isDefenseBuilding(type: BuildingType): boolean {
  return (
    type === 'cannon' ||
    type === 'archer_tower' ||
    type === 'mortar' ||
    type === 'air_defense' ||
    type === 'wizard_tower'
  );
}

export function isDecorationBuilding(type: BuildingType): boolean {
  return type === 'flag' || type === 'statue' || type === 'flower_bed';
}

export function isResourceBuilding(type: BuildingType): boolean {
  return (
    type === 'gold_mine' ||
    type === 'elixir_collector' ||
    type === 'gold_storage' ||
    type === 'elixir_storage' ||
    type === 'town_hall'
  );
}

/**
 * Checks if a line segment from (x1, y1) to (x2, y2) intersects an intact wall.
 * Returns the nearest intersecting wall if found.
 */
function findBlockingWallAlongRay(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  buildings: BattleBuilding[]
): BattleBuilding | null {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.4) return null;

  const steps = Math.ceil(len * 2.5);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const px = x1 + dx * t;
    const py = y1 + dy * t;
    for (const b of buildings) {
      if (b.destroyed || b.type !== 'wall') continue;
      if (px >= b.gx - 0.15 && px <= b.gx + b.size + 0.15 && py >= b.gy - 0.15 && py <= b.gy + b.size + 0.15) {
        return b;
      }
    }
  }
  return null;
}

/**
 * Selects the optimal target building for a troop based on Clash of Clans targeting rules.
 */
export function selectTargetForTroop(
  troop: BattleTroop,
  buildings: BattleBuilding[]
): BattleBuilding | null {
  const def = TROOP_CATALOG[troop.type];
  const aliveNonWalls = buildings.filter(
    (b) => !b.destroyed && b.type !== 'wall' && !isDecorationBuilding(b.type)
  );
  const aliveWalls = buildings.filter((b) => !b.destroyed && b.type === 'wall');

  if (def.favoriteTarget === 'wall') {
    if (aliveWalls.length > 0) {
      let bestWall: BattleBuilding | null = null;
      let bestDist = Infinity;
      for (const w of aliveWalls) {
        const d = distanceToBuildingEdge(troop.x, troop.y, w.gx, w.gy, w.size);
        if (d < bestDist) {
          bestDist = d;
          bestWall = w;
        }
      }
      if (bestWall) return bestWall;
    }
  }

  let candidates: BattleBuilding[] = [];
  if (def.favoriteTarget === 'defense') {
    candidates = aliveNonWalls.filter((b) => isDefenseBuilding(b.type));
  } else if (def.favoriteTarget === 'resource') {
    candidates = aliveNonWalls.filter((b) => isResourceBuilding(b.type));
  }

  if (candidates.length === 0) {
    candidates = aliveNonWalls;
  }
  if (candidates.length === 0) {
    candidates = aliveWalls;
  }
  if (candidates.length === 0) return null;

  let best: BattleBuilding = candidates[0];
  let bestDist = Infinity;
  for (const b of candidates) {
    const d = distanceToBuildingEdge(troop.x, troop.y, b.gx, b.gy, b.size);
    if (d < bestDist) {
      bestDist = d;
      best = b;
    }
  }

  // If ground melee troop's path to its target is blocked by a wall, target the wall!
  if (!def.isAir && def.range < 2.0 && best.type !== 'wall') {
    const cx = best.gx + best.size / 2;
    const cy = best.gy + best.size / 2;
    const blockingWall = findBlockingWallAlongRay(troop.x, troop.y, cx, cy, buildings);
    if (blockingWall) {
      return blockingWall;
    }
  }

  return best;
}

export function deployCardAt(
  battle: BattleState,
  gx: number,
  gy: number,
  pools?: VFXPools
): { deployed: boolean; reason?: string } {
  if (battle.phase === 'ended') return { deployed: false };
  const card = battle.selectedCard;
  if (!card) return { deployed: false, reason: '请先在底部选择兵种或法术' };

  if (card.kind === 'troop' || card.kind === 'reinforcement') {
    const isReinforcement = card.kind === 'reinforcement';
    const avail = isReinforcement
      ? battle.availableReinforcements[card.type] ?? 0
      : battle.availableTroops[card.type] ?? 0;
    if (avail <= 0) {
      return {
        deployed: false,
        reason: isReinforcement ? '该援军兵种已全部派出' : '该兵种已全部派出',
      };
    }
    if (!isValidDeployPoint(gx, gy, battle.buildings)) {
      return { deployed: false, reason: '无法部署在红色禁区内' };
    }

    const def = TROOP_CATALOG[card.type];
    if (isReinforcement) {
      battle.availableReinforcements[card.type] = avail - 1;
      battle.reinforcementsDeployed[card.type] =
        (battle.reinforcementsDeployed[card.type] ?? 0) + 1;
    } else {
      battle.availableTroops[card.type] = avail - 1;
      battle.troopsDeployed[card.type] = (battle.troopsDeployed[card.type] ?? 0) + 1;
    }
    if (battle.phase === 'scouting') {
      battle.phase = 'fighting';
    }

    const baseHp = isReinforcement ? Math.round(def.hp * 1.15) : def.hp;
    const troop: BattleTroop = {
      id: `tr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: card.type,
      x: gx,
      y: gy,
      hp: baseHp,
      maxHp: baseHp,
      isAir: def.isAir,
      targetId: null,
      attackCooldown: 0.15,
      walkPhase: Math.random() * Math.PI * 2,
      facingX: 1,
      facingY: 0,
      hitFlashTimer: 0,
      attackAnimTimer: 0,
      koTimer: 0,
      dead: false,
      rageTimer: 0,
      healTimer: 0,
      isReinforcement,
    };
    battle.troops.push(troop);

    // Auto-switch card if depleted
    const remaining = isReinforcement
      ? battle.availableReinforcements[card.type] ?? 0
      : battle.availableTroops[card.type] ?? 0;
    if (remaining <= 0) {
      let nextCard: BattleState['selectedCard'] = null;
      for (const t of TROOP_ORDER) {
        if ((battle.availableTroops[t] ?? 0) > 0) {
          nextCard = { kind: 'troop', type: t };
          break;
        }
      }
      if (!nextCard) {
        for (const t of TROOP_ORDER) {
          if ((battle.availableReinforcements[t] ?? 0) > 0) {
            nextCard = { kind: 'reinforcement', type: t };
            break;
          }
        }
      }
      if (!nextCard) {
        for (const s of SPELL_ORDER) {
          if ((battle.availableSpells[s] ?? 0) > 0) {
            nextCard = { kind: 'spell', type: s };
            break;
          }
        }
      }
      battle.selectedCard = nextCard;
    }

    if (pools) {
      spawnParticles(
        pools,
        gx,
        gy,
        isReinforcement ? 10 : 7,
        isReinforcement ? '#38bdf8' : '#f8fafc',
        1.8,
        3.5,
        0.2
      );
    }
    sound.playDeployTroop();
    return { deployed: true };
  } else {
    const avail = battle.availableSpells[card.type] ?? 0;
    if (avail <= 0) return { deployed: false, reason: '该法术已用完' };
    if (gx < -1.5 || gy < -1.5 || gx > GRID_SIZE + 1.5 || gy > GRID_SIZE + 1.5) {
      return { deployed: false, reason: '超出战场范围' };
    }

    const sDef = SPELL_CATALOG[card.type];
    battle.availableSpells[card.type] = avail - 1;
    battle.spellsUsed[card.type] = (battle.spellsUsed[card.type] ?? 0) + 1;
    if (battle.phase === 'scouting') {
      battle.phase = 'fighting';
    }

    battle.spells.push({
      id: `sp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: card.type,
      x: gx,
      y: gy,
      radius: sDef.radius,
      remainingSec: sDef.durationSec,
      totalSec: sDef.durationSec,
      pulsePhase: 0,
    });

    if (pools) {
      spawnParticles(pools, gx, gy, 14, sDef.color, 3.0, 4.5, 0.3);
    }
    sound.playSpellCast(card.type === 'heal');
    return { deployed: true };
  }
}

function damageBuilding(
  battle: BattleState,
  b: BattleBuilding,
  amount: number,
  pools?: VFXPools,
  isHeavy = false
) {
  if (b.destroyed) return;
  b.hp = Math.max(0, b.hp - amount);
  b.hitFlashTimer = 0.06;

  const cx = b.gx + b.size / 2;
  const cy = b.gy + b.size / 2;

  if (pools && amount > 0) {
    spawnDamageNumber(pools, cx, cy, amount, {
      kind: 'building',
      buildingType: b.type,
      isHeavy,
    });
  }

  if (b.hp <= 0) {
    b.destroyed = true;
    battle.lootGold += b.lootGold;
    battle.lootElixir += b.lootElixir;
    if (b.type === 'town_hall') {
      battle.townHallDestroyed = true;
    }

    if (pools) {
      spawnParticles(pools, cx, cy, b.type === 'wall' ? 8 : 20, '#d97706', 3.4, 4.8, 0.5);
      spawnParticles(pools, cx, cy, 8, '#475569', 2.4, 5.5, 0.6);
      const lootAnchor = (BUILDING_DAMAGE_ANCHOR_PX[b.type] ?? 78) + 18;
      if (b.lootGold > 0) {
        spawnFloatingText(pools, cx, cy, `+${b.lootGold} 金`, '#fbbf24', {
          anchorPx: lootAnchor,
          riseSpeedPx: 28,
          jitterX: -14,
          scale: 1.05,
          kind: 'loot',
          maxLife: 1.0,
        });
      }
      if (b.lootElixir > 0) {
        spawnFloatingText(pools, cx, cy, `+${b.lootElixir} 水`, '#e879f9', {
          anchorPx: lootAnchor + 14,
          riseSpeedPx: 28,
          jitterX: 16,
          scale: 1.05,
          kind: 'loot',
          maxLife: 1.0,
        });
      }
    }

    if (b.type !== 'wall') {
      battle.hitstopTimer = Math.max(battle.hitstopTimer, 0.038);
      battle.cameraTrauma = Math.min(1, battle.cameraTrauma + (b.type === 'town_hall' ? 0.65 : 0.32));
      sound.playExplosion();
    } else {
      battle.cameraTrauma = Math.min(1, battle.cameraTrauma + 0.14);
    }
  }
}

function damageTroop(
  tr: BattleTroop,
  amount: number,
  pools?: VFXPools,
  isHeavy = false
) {
  if (tr.dead || amount <= 0) return;
  tr.hp -= amount;
  tr.hitFlashTimer = 0.08;
  if (tr.hp <= 0) {
    tr.hp = 0;
    tr.dead = true;
    tr.koTimer = 0.35;
  }
  if (pools) {
    spawnDamageNumber(pools, tr.x, tr.y, amount, {
      kind: 'troop',
      isAir: tr.isAir,
      isHeavy,
    });
  }
}

export function stepBattle(
  battle: BattleState,
  rawDt: number,
  pools?: VFXPools
): void {
  const dt = Math.min(Math.max(rawDt, 0), 0.05);
  if (battle.phase === 'ended') return;

  // Decay camera trauma & VFX pools even during hitstop
  battle.cameraTrauma = Math.max(0, battle.cameraTrauma - dt * 2.2);

  if (pools) {
    for (const p of pools.particles) {
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vz -= p.gravity * dt;
      p.z = Math.max(0, p.z + p.vz * dt);
      if (p.z === 0 && p.vz < 0) {
        p.vz *= -0.3;
      }
    }
    for (const t of pools.texts) {
      if (!t.active) continue;
      t.life += dt;
      if (t.life >= t.maxLife) {
        t.active = false;
        continue;
      }
      t.y += t.vy * dt;
      t.risePx += t.riseSpeedPx * dt;
    }
  }

  if (battle.phase === 'scouting') {
    battle.scoutTimeSec -= dt;
    if (battle.scoutTimeSec <= 0) {
      battle.phase = 'fighting';
    }
    return;
  }

  // Hitstop pause for heavy destruction impact
  if (battle.hitstopTimer > 0) {
    battle.hitstopTimer = Math.max(0, battle.hitstopTimer - dt);
    return;
  }

  battle.elapsedSec += dt;
  battle.timeRemainingSec = Math.max(0, battle.timeRemainingSec - dt);

  // 1. Update spells
  for (let i = battle.spells.length - 1; i >= 0; i--) {
    const sp = battle.spells[i];
    sp.remainingSec -= dt;
    sp.pulsePhase += dt * 4;
    if (sp.remainingSec <= 0) {
      battle.spells.splice(i, 1);
      continue;
    }
    const sDef = SPELL_CATALOG[sp.type];
    for (const tr of battle.troops) {
      if (tr.dead) continue;
      if (dist2D(tr.x, tr.y, sp.x, sp.y) <= sp.radius) {
        if (sp.type === 'heal' && sDef.healPerSec) {
          tr.hp = Math.min(tr.maxHp, tr.hp + sDef.healPerSec * dt);
          tr.healTimer = 0.25;
        } else if (sp.type === 'rage') {
          tr.rageTimer = 0.25;
        }
      }
    }
  }

  // 2. Update troops
  for (const tr of battle.troops) {
    if (tr.hitFlashTimer > 0) tr.hitFlashTimer = Math.max(0, tr.hitFlashTimer - dt);
    if (tr.attackAnimTimer > 0) tr.attackAnimTimer = Math.max(0, tr.attackAnimTimer - dt);
    if (tr.rageTimer > 0) tr.rageTimer = Math.max(0, tr.rageTimer - dt);
    if (tr.healTimer > 0) tr.healTimer = Math.max(0, tr.healTimer - dt);

    if (tr.dead) {
      tr.koTimer = Math.max(0, tr.koTimer - dt);
      continue;
    }

    const def = TROOP_CATALOG[tr.type];
    const speedMult = tr.rageTimer > 0 ? SPELL_CATALOG.rage.speedBoost ?? 1.6 : 1;
    const dmgMult =
      (tr.rageTimer > 0 ? SPELL_CATALOG.rage.damageBoost ?? 1.7 : 1) *
      (tr.isReinforcement ? 1.15 : 1);

    // Validate current target
    let target = tr.targetId
      ? battle.buildings.find((b) => b.id === tr.targetId && !b.destroyed) ?? null
      : null;

    if (!target) {
      target = selectTargetForTroop(tr, battle.buildings);
      tr.targetId = target ? target.id : null;
    }

    if (!target) continue;

    const tx = target.gx + target.size / 2;
    const ty = target.gy + target.size / 2;
    const edgeDist = distanceToBuildingEdge(tr.x, tr.y, target.gx, target.gy, target.size);

    // Direction vector
    const dx = tx - tr.x;
    const dy = ty - tr.y;
    const centerDist = Math.sqrt(dx * dx + dy * dy) || 1;
    tr.facingX = dx / centerDist;
    tr.facingY = dy / centerDist;

    if (edgeDist > def.range) {
      const stepDist = def.moveSpeed * speedMult * dt;
      const nx = tr.x + (dx / centerDist) * stepDist;
      const ny = tr.y + (dy / centerDist) * stepDist;

      // Ground unit wall collision check: if stepping into an intact wall, attack that wall instead
      if (!def.isAir) {
        const hitWall = battle.buildings.find(
          (b) =>
            !b.destroyed &&
            b.type === 'wall' &&
            nx >= b.gx - 0.1 &&
            nx <= b.gx + b.size + 0.1 &&
            ny >= b.gy - 0.1 &&
            ny <= b.gy + b.size + 0.1
        );
        if (hitWall) {
          tr.targetId = hitWall.id;
        } else {
          tr.x = nx;
          tr.y = ny;
          tr.walkPhase += stepDist * 4.5;
        }
      } else {
        tr.x = nx;
        tr.y = ny;
        tr.walkPhase += stepDist * 3.0;
      }
    } else {
      // Attack!
      tr.attackCooldown -= dt * speedMult;
      if (tr.attackCooldown <= 0) {
        tr.attackCooldown = def.attackSpeed;
        tr.attackAnimTimer = 0.22;

        let hitDmg = def.dps * def.attackSpeed * dmgMult;
        if (
          (def.favoriteTarget === 'resource' && isResourceBuilding(target.type)) ||
          (def.favoriteTarget === 'wall' && target.type === 'wall')
        ) {
          hitDmg *= def.favoriteMultiplier ?? 1;
        }

        if (tr.type === 'archer') {
          battle.projectiles.push({
            id: `pr_${Date.now()}_${Math.random()}`,
            kind: 'troop_arrow',
            startX: tr.x,
            startY: tr.y,
            x: tr.x,
            y: tr.y,
            targetX: tx,
            targetY: ty,
            targetEntityId: target.id,
            targetIsTroop: false,
            progress: 0,
            duration: 0.22,
            arcHeight: 0.8,
            damage: hitDmg,
            splashRadius: 0,
            hitsAir: false,
            hitsGround: true,
          });
          sound.playArrowShot();
        } else if (tr.type === 'wall_breaker') {
          // Wall breaker self-detonates with huge splash on walls
          for (const b of battle.buildings) {
            if (b.destroyed) continue;
            const d = distanceToBuildingEdge(tr.x, tr.y, b.gx, b.gy, b.size);
            if (d <= (def.splashRadius ?? 1.6)) {
              const mult = b.type === 'wall' ? (def.favoriteMultiplier ?? 6) : 1;
              damageBuilding(
                battle,
                b,
                def.dps * def.attackSpeed * mult * dmgMult,
                pools,
                b.type === 'wall'
              );
            }
          }
          tr.hp = 0;
          tr.dead = true;
          tr.koTimer = 0.3;
          if (pools) {
            spawnParticles(pools, tr.x, tr.y, 18, '#fb923c', 3.8, 5, 0.4);
          }
          sound.playExplosion();
        } else if (tr.type === 'balloon') {
          // Drops splash bomb below
          for (const b of battle.buildings) {
            if (b.destroyed) continue;
            const d = distanceToBuildingEdge(tr.x, tr.y, b.gx, b.gy, b.size);
            if (d <= (def.splashRadius ?? 1.3)) {
              damageBuilding(battle, b, hitDmg, pools, true);
            }
          }
          if (pools) {
            spawnParticles(pools, tx, ty, 12, '#f97316', 2.8, 4.2, 0.3);
          }
          sound.playCannonFire();
        } else {
          // Melee hit
          const isFavBonus =
            def.favoriteTarget === 'resource' && isResourceBuilding(target.type);
          damageBuilding(battle, target, hitDmg, pools, isFavBonus || tr.rageTimer > 0);
          if (pools) {
            spawnParticles(pools, tx, ty, 4, '#fde047', 1.6, 2.5, 0.3);
          }
        }
      }
    }
  }

  // 3. Update defense buildings
  for (const b of battle.buildings) {
    if (b.hitFlashTimer > 0) b.hitFlashTimer = Math.max(0, b.hitFlashTimer - dt);
    if (b.fireRecoilTimer > 0) b.fireRecoilTimer = Math.max(0, b.fireRecoilTimer - dt);
    if (b.destroyed) continue;
    if (!isDefenseBuilding(b.type)) continue;

    const def = BUILDING_CATALOG[b.type];
    const lvStats = def.levels[Math.min(b.level, def.levels.length) - 1] ?? def.levels[0];
    const range = lvStats.range ?? 8;
    const minRange = lvStats.minRange ?? 0;
    const bx = b.gx + b.size / 2;
    const by = b.gy + b.size / 2;

    // Find closest valid troop
    let bestTroop: BattleTroop | null = null;
    let bestDist = Infinity;
    for (const tr of battle.troops) {
      if (tr.dead) continue;
      if (tr.isAir && !lvStats.targetAir) continue;
      if (!tr.isAir && !lvStats.targetGround) continue;
      const d = dist2D(bx, by, tr.x, tr.y);
      if (d <= range && d >= minRange && d < bestDist) {
        bestDist = d;
        bestTroop = tr;
      }
    }

    if (bestTroop) {
      b.turretAngle = Math.atan2(bestTroop.y - by, bestTroop.x - bx);
      if (b.windupTimer > 0) {
        b.windupTimer -= dt;
        if (b.windupTimer <= 0) {
          // Fire!
          b.attackCooldown = lvStats.attackSpeed ?? 1.0;
          b.fireRecoilTimer = 0.16;
          const kind =
            b.type === 'cannon'
              ? 'cannonball'
              : b.type === 'archer_tower'
                ? 'arrow'
                : b.type === 'mortar'
                  ? 'mortar'
                  : b.type === 'air_defense'
                    ? 'rocket'
                    : 'fireball';
          const duration =
            kind === 'mortar'
              ? 0.9
              : kind === 'fireball'
                ? 0.35
                : kind === 'cannonball'
                  ? 0.25
                  : 0.2;

          battle.projectiles.push({
            id: `dp_${Date.now()}_${Math.random()}`,
            kind,
            startX: bx,
            startY: by,
            x: bx,
            y: by,
            targetX: bestTroop.x,
            targetY: bestTroop.y,
            targetEntityId: bestTroop.id,
            targetIsTroop: true,
            progress: 0,
            duration,
            arcHeight: kind === 'mortar' ? 4.5 : kind === 'arrow' ? 0.9 : 0.4,
            damage: lvStats.damagePerShot ?? 15,
            splashRadius: lvStats.splashRadius ?? 0,
            hitsAir: Boolean(lvStats.targetAir),
            hitsGround: Boolean(lvStats.targetGround),
          });

          if (kind === 'mortar') sound.playMortarFire();
          else if (kind === 'cannonball' || kind === 'rocket') sound.playCannonFire();
          else sound.playArrowShot();
        }
      } else {
        b.attackCooldown -= dt;
        if (b.attackCooldown <= 0) {
          b.windupTimer = 0.12;
          b.windupTargetId = bestTroop.id;
        }
      }
    } else {
      b.windupTimer = 0;
      b.attackCooldown = Math.max(0, b.attackCooldown - dt);
    }
  }

  // 4. Update projectiles
  for (let i = battle.projectiles.length - 1; i >= 0; i--) {
    const pr = battle.projectiles[i];
    // Non-mortar homing onto moving target
    if (pr.kind !== 'mortar' && pr.targetIsTroop) {
      const targetTr = battle.troops.find((t) => t.id === pr.targetEntityId && !t.dead);
      if (targetTr) {
        pr.targetX = targetTr.x;
        pr.targetY = targetTr.y;
      }
    }

    pr.progress += dt / pr.duration;
    pr.x = pr.startX + (pr.targetX - pr.startX) * Math.min(1, pr.progress);
    pr.y = pr.startY + (pr.targetY - pr.startY) * Math.min(1, pr.progress);

    if (pr.progress >= 1) {
      battle.projectiles.splice(i, 1);
      if (pr.targetIsTroop) {
        if (pr.splashRadius > 0) {
          for (const tr of battle.troops) {
            if (tr.dead) continue;
            if (tr.isAir && !pr.hitsAir) continue;
            if (!tr.isAir && !pr.hitsGround) continue;
            if (dist2D(pr.targetX, pr.targetY, tr.x, tr.y) <= pr.splashRadius) {
              damageTroop(tr, pr.damage, pools, pr.kind === 'mortar' || pr.kind === 'fireball');
            }
          }
          if (pools) {
            spawnParticles(
              pools,
              pr.targetX,
              pr.targetY,
              pr.kind === 'mortar' ? 16 : 10,
              pr.kind === 'fireball' ? '#a855f7' : '#fb923c',
              3.0,
              4.2,
              0.3
            );
          }
          if (pr.kind === 'mortar') {
            battle.cameraTrauma = Math.min(1, battle.cameraTrauma + 0.18);
          }
        } else {
          const targetTr = battle.troops.find((t) => t.id === pr.targetEntityId && !t.dead);
          if (targetTr) {
            damageTroop(targetTr, pr.damage, pools, pr.kind === 'rocket');
            if (pools) {
              spawnParticles(pools, targetTr.x, targetTr.y, 4, '#f87171', 1.4, 2.5, 0.3);
            }
          }
        }
      } else {
        const b = battle.buildings.find((x) => x.id === pr.targetEntityId);
        if (b && !b.destroyed) {
          damageBuilding(battle, b, pr.damage, pools);
        }
      }
    }
  }

  // 5. Recompute destruction % and stars
  const nonWallBuildings = battle.buildings.filter(
    (b) => b.type !== 'wall' && !isDecorationBuilding(b.type)
  );
  const destroyedCount = nonWallBuildings.filter((b) => b.destroyed).length;
  const pct =
    nonWallBuildings.length > 0
      ? Math.round((destroyedCount / nonWallBuildings.length) * 100)
      : 100;

  const prevStars = battle.stars;
  battle.destructionPercent = pct;
  battle.stars = calculateBattleStars(pct, battle.townHallDestroyed);
  if (battle.stars > prevStars) {
    sound.playStarEarned();
  }

  // 6. Check battle termination
  const allDestroyed = nonWallBuildings.length > 0 && destroyedCount === nonWallBuildings.length;
  const remainingTroopsToDeploy = Object.values(battle.availableTroops).reduce((a, b) => a + b, 0);
  const remainingReinforcementsToDeploy = Object.values(battle.availableReinforcements).reduce(
    (a, b) => a + (b ?? 0),
    0
  );
  const remainingSpellsToDeploy = Object.values(battle.availableSpells).reduce((a, b) => a + b, 0);
  const aliveTroopsOnField = battle.troops.some((t) => !t.dead);
  const activeProjectiles = battle.projectiles.length > 0;
  const noForceLeft =
    remainingTroopsToDeploy === 0 &&
    remainingReinforcementsToDeploy === 0 &&
    remainingSpellsToDeploy === 0 &&
    !aliveTroopsOnField &&
    !activeProjectiles;

  if (allDestroyed || battle.timeRemainingSec <= 0 || noForceLeft) {
    battle.endBeatTimer += dt;
    if (battle.endBeatTimer >= 0.55) {
      finalizeBattle(battle);
    }
  }
}

export function finalizeBattle(battle: BattleState): BattleResult {
  if (battle.result) return battle.result;
  battle.phase = 'ended';
  const victory = battle.stars >= 1;
  const trophyDelta = battle.isCampaign
    ? victory
      ? 12 + battle.stars * 4
      : 0
    : victory
      ? 10 + battle.stars * 7
      : -12;

  const result: BattleResult = {
    victory,
    stars: battle.stars,
    destructionPercent: battle.destructionPercent,
    townHallDestroyed: battle.townHallDestroyed,
    lootGold: battle.lootGold,
    lootElixir: battle.lootElixir,
    trophyDelta,
    troopsDeployed: { ...battle.troopsDeployed },
    reinforcementsDeployed: { ...battle.reinforcementsDeployed },
    spellsUsed: { ...battle.spellsUsed },
    durationSec: Math.round(battle.elapsedSec),
    targetName: battle.targetName,
    campaignStageId: battle.campaignStageId,
  };

  battle.result = result;
  if (victory) sound.playVictory();
  else sound.playDefeat();
  return result;
}
