export type GameScreenState = 'title' | 'playing' | 'paused' | 'gameover';

export type PlayMode = 'village' | 'battle';

export type ResourceType = 'gold' | 'elixir' | 'gems';

export type BuildingCategory = 'resource' | 'army' | 'defense' | 'decoration';

export type BuildingType =
  | 'town_hall'
  | 'gold_mine'
  | 'elixir_collector'
  | 'gold_storage'
  | 'elixir_storage'
  | 'builders_hut'
  | 'army_camp'
  | 'barracks'
  | 'spell_factory'
  | 'clan_castle'
  | 'cannon'
  | 'archer_tower'
  | 'mortar'
  | 'air_defense'
  | 'wizard_tower'
  | 'wall'
  | 'flag'
  | 'statue'
  | 'flower_bed';

export type TroopType =
  | 'barbarian'
  | 'archer'
  | 'giant'
  | 'goblin'
  | 'wall_breaker'
  | 'balloon';

export type SpellType = 'heal' | 'rage';

export interface BuildingLevelStats {
  level: number;
  hp: number;
  cost: number;
  costType: 'gold' | 'elixir' | 'gems';
  buildTimeSec: number;
  thRequired: number;
  // Optional specialized stats
  productionPerHour?: number;
  storageCapacity?: number;
  troopCapacity?: number;
  spellCapacity?: number;
  clanCapacity?: number;
  dps?: number;
  damagePerShot?: number;
  attackSpeed?: number; // seconds between shots
  range?: number; // in grid tiles
  minRange?: number; // mortar blind spot
  splashRadius?: number;
  targetAir?: boolean;
  targetGround?: boolean;
}

export interface BuildingDefinition {
  type: BuildingType;
  name: string;
  category: BuildingCategory;
  size: number; // grid tiles (e.g., 3 means 3x3, 1 means 1x1)
  description: string;
  levels: BuildingLevelStats[];
  maxCountByTH: Record<number, number>;
}

export interface PlacedBuilding {
  id: string;
  type: BuildingType;
  level: number;
  gx: number; // top-left grid X
  gy: number; // top-left grid Y
  // Construction/upgrade state
  upgradingToLevel?: number;
  upgradeEndsAt?: number; // epoch ms
  upgradeTotalSec?: number;
  // Uncollected resource stored in mine/collector
  storedResource?: number;
  lastCollectedAt?: number;
}

export interface TrainingOrder {
  troopType: TroopType;
  count: number;
}

export interface TrainingQueueSnapshot {
  army: Partial<Record<TroopType, number>>;
  spells: Partial<Record<SpellType, number>>;
}

export type DailyMissionKind =
  | 'collect_elixir'
  | 'collect_gold'
  | 'train_troops'
  | 'upgrade_or_build'
  | 'battle_stars'
  | 'loot_resources';

export interface DailyMission {
  id: string;
  kind: DailyMissionKind;
  title: string;
  description: string;
  target: number;
  progress: number;
  rewardType: ResourceType;
  rewardAmount: number;
  claimed: boolean;
}

export interface DailyMissionsState {
  dateKey: string;
  missions: DailyMission[];
}

export interface VillageState {
  townHallLevel: number;
  gold: number;
  elixir: number;
  gems: number;
  trophies: number;
  xp: number;
  buildersTotal: number;
  buildings: PlacedBuilding[];
  army: Record<TroopType, number>;
  spells: Record<SpellType, number>;
  clanName?: string;
  clanReinforcements?: Partial<Record<TroopType, number>>;
  clanLastRequestAt?: number;
  lastTrainingQueue?: TrainingQueueSnapshot;
  clearedCampaignStages: number[]; // stage indices
  campaignStars: Record<number, number>; // stageId -> 0..3
  dailyMissions?: DailyMissionsState;
  lastTickAt: number;
}

export interface TroopDefinition {
  type: TroopType;
  name: string;
  role: string;
  housingSpace: number;
  hp: number;
  dps: number;
  attackSpeed: number;
  moveSpeed: number; // tiles per second
  range: number; // tiles (0.6 for melee)
  isAir: boolean;
  splashRadius?: number;
  favoriteTarget: 'any' | 'defense' | 'resource' | 'wall';
  favoriteMultiplier?: number;
  trainCostElixir: number;
  barracksLevelRequired: number;
  color: string;
  accentColor: string;
}

export interface SpellDefinition {
  type: SpellType;
  name: string;
  role: string;
  housingSpace: number;
  radius: number;
  durationSec: number;
  healPerSec?: number;
  speedBoost?: number;
  damageBoost?: number;
  brewCostElixir: number;
  color: string;
}

export interface CampaignStage {
  id: number;
  name: string;
  subtitle: string;
  recommendedTH: number;
  rewardGold: number;
  rewardElixir: number;
  buildings: Array<{
    type: BuildingType;
    level: number;
    gx: number;
    gy: number;
  }>;
}

export interface BattleBuilding {
  id: string;
  type: BuildingType;
  level: number;
  gx: number;
  gy: number;
  size: number;
  hp: number;
  maxHp: number;
  destroyed: boolean;
  lootGold: number;
  lootElixir: number;
  // Combat visuals & cooldowns
  attackCooldown: number;
  turretAngle: number;
  hitFlashTimer: number;
  fireRecoilTimer: number;
  windupTimer: number;
  windupTargetId?: string;
}

export interface BattleTroop {
  id: string;
  type: TroopType;
  x: number; // grid float X
  y: number; // grid float Y
  hp: number;
  maxHp: number;
  isAir: boolean;
  targetId: string | null;
  attackCooldown: number;
  walkPhase: number;
  facingX: number;
  facingY: number;
  hitFlashTimer: number;
  attackAnimTimer: number;
  koTimer: number; // >0 while dissolving/falling after hp<=0
  dead: boolean;
  rageTimer: number;
  healTimer: number;
  isReinforcement?: boolean;
}

export interface BattleProjectile {
  id: string;
  kind: 'cannonball' | 'arrow' | 'mortar' | 'rocket' | 'fireball' | 'troop_arrow' | 'bomb';
  startX: number;
  startY: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  targetEntityId: string;
  targetIsTroop: boolean;
  progress: number;
  duration: number;
  arcHeight: number;
  damage: number;
  splashRadius: number;
  hitsAir: boolean;
  hitsGround: boolean;
}

export interface ActiveSpellZone {
  id: string;
  type: SpellType;
  x: number;
  y: number;
  radius: number;
  remainingSec: number;
  totalSec: number;
  pulsePhase: number;
}

export interface FloatingText {
  active: boolean;
  x: number;
  y: number;
  vy: number;
  anchorPx: number;
  risePx: number;
  riseSpeedPx: number;
  jitterX: number;
  scale: number;
  kind: 'loot' | 'damage_building' | 'damage_troop';
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  gravity: number;
}

export interface BattleResult {
  victory: boolean;
  stars: number;
  destructionPercent: number;
  townHallDestroyed: boolean;
  lootGold: number;
  lootElixir: number;
  trophyDelta: number;
  troopsDeployed: Partial<Record<TroopType, number>>;
  reinforcementsDeployed?: Partial<Record<TroopType, number>>;
  spellsUsed: Partial<Record<SpellType, number>>;
  durationSec: number;
  targetName: string;
  campaignStageId?: number;
}

export interface BattleState {
  targetName: string;
  targetTH: number;
  isCampaign: boolean;
  campaignStageId?: number;
  phase: 'scouting' | 'fighting' | 'ended';
  timeRemainingSec: number;
  scoutTimeSec: number;
  elapsedSec: number;
  buildings: BattleBuilding[];
  troops: BattleTroop[];
  projectiles: BattleProjectile[];
  spells: ActiveSpellZone[];
  availableTroops: Record<TroopType, number>;
  availableReinforcements: Partial<Record<TroopType, number>>;
  availableSpells: Record<SpellType, number>;
  troopsDeployed: Partial<Record<TroopType, number>>;
  reinforcementsDeployed: Partial<Record<TroopType, number>>;
  spellsUsed: Partial<Record<SpellType, number>>;
  selectedCard:
    | { kind: 'troop'; type: TroopType }
    | { kind: 'reinforcement'; type: TroopType }
    | { kind: 'spell'; type: SpellType }
    | null;
  lootGold: number;
  lootElixir: number;
  totalLootGold: number;
  totalLootElixir: number;
  destructionPercent: number;
  townHallDestroyed: boolean;
  stars: number;
  hitstopTimer: number;
  cameraTrauma: number;
  endBeatTimer: number;
  result?: BattleResult;
}
