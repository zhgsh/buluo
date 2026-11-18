import type {
  BuildingDefinition,
  BuildingType,
  CampaignStage,
  PlacedBuilding,
  SpellDefinition,
  SpellType,
  TroopDefinition,
  TroopType,
  VillageState,
} from './types';

export const GRID_SIZE = 28; // 28x28 playable village grid

export const BUILDING_CATALOG: Record<BuildingType, BuildingDefinition> = {
  town_hall: {
    type: 'town_hall',
    name: '大本营',
    category: 'resource',
    size: 4,
    description: '部落的核心建筑，升级大本营可解锁更多建筑、兵种和更高等级上限。',
    maxCountByTH: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 },
    levels: [
      { level: 1, hp: 450, cost: 0, costType: 'gold', buildTimeSec: 0, thRequired: 1, storageCapacity: 1000 },
      { level: 2, hp: 800, cost: 1000, costType: 'gold', buildTimeSec: 6, thRequired: 1, storageCapacity: 1500 },
      { level: 3, hp: 1200, cost: 2500, costType: 'gold', buildTimeSec: 10, thRequired: 2, storageCapacity: 2500 },
      { level: 4, hp: 1650, cost: 6000, costType: 'gold', buildTimeSec: 14, thRequired: 3, storageCapacity: 4000 },
      { level: 5, hp: 2200, cost: 12000, costType: 'gold', buildTimeSec: 18, thRequired: 4, storageCapacity: 6000 },
    ],
  },
  gold_mine: {
    type: 'gold_mine',
    name: '金矿',
    category: 'resource',
    size: 3,
    description: '源源不断地开采金币，点击资源气泡即可收取。',
    maxCountByTH: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 },
    levels: [
      { level: 1, hp: 400, cost: 150, costType: 'elixir', buildTimeSec: 3, thRequired: 1, productionPerHour: 3600, storageCapacity: 600 },
      { level: 2, hp: 440, cost: 300, costType: 'elixir', buildTimeSec: 5, thRequired: 1, productionPerHour: 5400, storageCapacity: 1000 },
      { level: 3, hp: 480, cost: 700, costType: 'elixir', buildTimeSec: 7, thRequired: 2, productionPerHour: 7800, storageCapacity: 1600 },
      { level: 4, hp: 520, cost: 1400, costType: 'elixir', buildTimeSec: 9, thRequired: 3, productionPerHour: 10800, storageCapacity: 2500 },
      { level: 5, hp: 580, cost: 2800, costType: 'elixir', buildTimeSec: 12, thRequired: 4, productionPerHour: 14400, storageCapacity: 3800 },
    ],
  },
  elixir_collector: {
    type: 'elixir_collector',
    name: '圣水收集器',
    category: 'resource',
    size: 3,
    description: '从大地深处抽取紫色圣水，用于训练军队与升级矿场。',
    maxCountByTH: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 },
    levels: [
      { level: 1, hp: 400, cost: 150, costType: 'gold', buildTimeSec: 3, thRequired: 1, productionPerHour: 3600, storageCapacity: 600 },
      { level: 2, hp: 440, cost: 300, costType: 'gold', buildTimeSec: 5, thRequired: 1, productionPerHour: 5400, storageCapacity: 1000 },
      { level: 3, hp: 480, cost: 700, costType: 'gold', buildTimeSec: 7, thRequired: 2, productionPerHour: 7800, storageCapacity: 1600 },
      { level: 4, hp: 520, cost: 1400, costType: 'gold', buildTimeSec: 9, thRequired: 3, productionPerHour: 10800, storageCapacity: 2500 },
      { level: 5, hp: 580, cost: 2800, costType: 'gold', buildTimeSec: 12, thRequired: 4, productionPerHour: 14400, storageCapacity: 3800 },
    ],
  },
  gold_storage: {
    type: 'gold_storage',
    name: '储金罐',
    category: 'resource',
    size: 3,
    description: '安全存放你掠夺和开采的金币，提升金币库容上限。',
    maxCountByTH: { 1: 1, 2: 1, 3: 2, 4: 2, 5: 3 },
    levels: [
      { level: 1, hp: 450, cost: 300, costType: 'elixir', buildTimeSec: 4, thRequired: 1, storageCapacity: 2500 },
      { level: 2, hp: 600, cost: 750, costType: 'elixir', buildTimeSec: 6, thRequired: 2, storageCapacity: 5000 },
      { level: 3, hp: 800, cost: 1500, costType: 'elixir', buildTimeSec: 8, thRequired: 2, storageCapacity: 10000 },
      { level: 4, hp: 1050, cost: 3000, costType: 'elixir', buildTimeSec: 10, thRequired: 3, storageCapacity: 18000 },
      { level: 5, hp: 1300, cost: 6000, costType: 'elixir', buildTimeSec: 13, thRequired: 4, storageCapacity: 30000 },
    ],
  },
  elixir_storage: {
    type: 'elixir_storage',
    name: '圣水瓶',
    category: 'resource',
    size: 3,
    description: '存放珍贵的紫色圣水，升级后可储存更多圣水。',
    maxCountByTH: { 1: 1, 2: 1, 3: 2, 4: 2, 5: 3 },
    levels: [
      { level: 1, hp: 450, cost: 300, costType: 'gold', buildTimeSec: 4, thRequired: 1, storageCapacity: 2500 },
      { level: 2, hp: 600, cost: 750, costType: 'gold', buildTimeSec: 6, thRequired: 2, storageCapacity: 5000 },
      { level: 3, hp: 800, cost: 1500, costType: 'gold', buildTimeSec: 8, thRequired: 2, storageCapacity: 10000 },
      { level: 4, hp: 1050, cost: 3000, costType: 'gold', buildTimeSec: 10, thRequired: 3, storageCapacity: 18000 },
      { level: 5, hp: 1300, cost: 6000, costType: 'gold', buildTimeSec: 13, thRequired: 4, storageCapacity: 30000 },
    ],
  },
  builders_hut: {
    type: 'builders_hut',
    name: '建筑工人小屋',
    category: 'resource',
    size: 2,
    description: '每位建筑工人可同时建造或升级一座建筑，提高村庄发展效率。',
    maxCountByTH: { 1: 2, 2: 3, 3: 3, 4: 4, 5: 5 },
    levels: [
      { level: 1, hp: 250, cost: 150, costType: 'gems', buildTimeSec: 0, thRequired: 1 },
    ],
  },
  army_camp: {
    type: 'army_camp',
    name: '军营',
    category: 'army',
    size: 4,
    description: '驻扎训练完成的部队，升级军营可大幅扩充出征人口上限。',
    maxCountByTH: { 1: 1, 2: 1, 3: 2, 4: 2, 5: 3 },
    levels: [
      { level: 1, hp: 250, cost: 250, costType: 'elixir', buildTimeSec: 4, thRequired: 1, troopCapacity: 20 },
      { level: 2, hp: 300, cost: 750, costType: 'elixir', buildTimeSec: 6, thRequired: 2, troopCapacity: 30 },
      { level: 3, hp: 360, cost: 1500, costType: 'elixir', buildTimeSec: 8, thRequired: 3, troopCapacity: 40 },
      { level: 4, hp: 420, cost: 3500, costType: 'elixir', buildTimeSec: 11, thRequired: 4, troopCapacity: 50 },
      { level: 5, hp: 500, cost: 7000, costType: 'elixir', buildTimeSec: 14, thRequired: 5, troopCapacity: 60 },
    ],
  },
  barracks: {
    type: 'barracks',
    name: '兵营',
    category: 'army',
    size: 3,
    description: '训练野蛮人、弓箭手、巨人与气球兵，升级解锁更高阶兵种。',
    maxCountByTH: { 1: 1, 2: 1, 3: 2, 4: 2, 5: 3 },
    levels: [
      { level: 1, hp: 250, cost: 200, costType: 'elixir', buildTimeSec: 4, thRequired: 1 },
      { level: 2, hp: 310, cost: 600, costType: 'elixir', buildTimeSec: 6, thRequired: 1 },
      { level: 3, hp: 370, cost: 1200, costType: 'elixir', buildTimeSec: 8, thRequired: 2 },
      { level: 4, hp: 430, cost: 2500, costType: 'elixir', buildTimeSec: 10, thRequired: 3 },
      { level: 5, hp: 500, cost: 5000, costType: 'elixir', buildTimeSec: 13, thRequired: 4 },
    ],
  },
  spell_factory: {
    type: 'spell_factory',
    name: '法术工厂',
    category: 'army',
    size: 3,
    description: '炼制疗伤与狂暴法术药水，扭转战局的关键所在。',
    maxCountByTH: { 1: 0, 2: 1, 3: 1, 4: 1, 5: 1 },
    levels: [
      { level: 1, hp: 250, cost: 1000, costType: 'elixir', buildTimeSec: 6, thRequired: 2, spellCapacity: 2 },
      { level: 2, hp: 320, cost: 2200, costType: 'elixir', buildTimeSec: 9, thRequired: 3, spellCapacity: 3 },
      { level: 3, hp: 400, cost: 4500, costType: 'elixir', buildTimeSec: 12, thRequired: 4, spellCapacity: 4 },
    ],
  },
  clan_castle: {
    type: 'clan_castle',
    name: '部落城堡',
    category: 'army',
    size: 3,
    description: '加入部落联盟并向盟友请求增援部队，战斗中可作为强力援军部署出战。',
    maxCountByTH: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 },
    levels: [
      { level: 1, hp: 900, cost: 500, costType: 'gold', buildTimeSec: 4, thRequired: 1, clanCapacity: 10 },
      { level: 2, hp: 1300, cost: 1500, costType: 'gold', buildTimeSec: 7, thRequired: 2, clanCapacity: 15 },
      { level: 3, hp: 1800, cost: 3500, costType: 'gold', buildTimeSec: 10, thRequired: 3, clanCapacity: 20 },
      { level: 4, hp: 2300, cost: 7000, costType: 'gold', buildTimeSec: 13, thRequired: 4, clanCapacity: 25 },
      { level: 5, hp: 2900, cost: 12000, costType: 'gold', buildTimeSec: 16, thRequired: 5, clanCapacity: 30 },
    ],
  },
  cannon: {
    type: 'cannon',
    name: '加农炮',
    category: 'defense',
    size: 3,
    description: '强力的单体地面防御炮台，射速稳定，专克地面进攻部队。',
    maxCountByTH: { 1: 1, 2: 2, 3: 2, 4: 3, 5: 3 },
    levels: [
      { level: 1, hp: 420, cost: 250, costType: 'gold', buildTimeSec: 4, thRequired: 1, dps: 12, damagePerShot: 10, attackSpeed: 0.85, range: 8.5, targetGround: true, targetAir: false },
      { level: 2, hp: 490, cost: 600, costType: 'gold', buildTimeSec: 6, thRequired: 1, dps: 16, damagePerShot: 14, attackSpeed: 0.85, range: 8.5, targetGround: true, targetAir: false },
      { level: 3, hp: 560, cost: 1200, costType: 'gold', buildTimeSec: 8, thRequired: 2, dps: 21, damagePerShot: 18, attackSpeed: 0.85, range: 8.5, targetGround: true, targetAir: false },
      { level: 4, hp: 640, cost: 2400, costType: 'gold', buildTimeSec: 10, thRequired: 3, dps: 27, damagePerShot: 23, attackSpeed: 0.85, range: 8.5, targetGround: true, targetAir: false },
      { level: 5, hp: 740, cost: 4800, costType: 'gold', buildTimeSec: 13, thRequired: 4, dps: 34, damagePerShot: 29, attackSpeed: 0.85, range: 8.5, targetGround: true, targetAir: false },
    ],
  },
  archer_tower: {
    type: 'archer_tower',
    name: '箭塔',
    category: 'defense',
    size: 3,
    description: '哨塔上的弓箭手视野极广，可同时精准打击地面与空中目标。',
    maxCountByTH: { 1: 0, 2: 1, 3: 2, 4: 2, 5: 3 },
    levels: [
      { level: 1, hp: 380, cost: 500, costType: 'gold', buildTimeSec: 5, thRequired: 2, dps: 14, damagePerShot: 7, attackSpeed: 0.5, range: 10, targetGround: true, targetAir: true },
      { level: 2, hp: 440, cost: 1000, costType: 'gold', buildTimeSec: 7, thRequired: 2, dps: 18, damagePerShot: 9, attackSpeed: 0.5, range: 10, targetGround: true, targetAir: true },
      { level: 3, hp: 510, cost: 2000, costType: 'gold', buildTimeSec: 9, thRequired: 3, dps: 23, damagePerShot: 11.5, attackSpeed: 0.5, range: 10, targetGround: true, targetAir: true },
      { level: 4, hp: 580, cost: 4000, costType: 'gold', buildTimeSec: 11, thRequired: 4, dps: 29, damagePerShot: 14.5, attackSpeed: 0.5, range: 10, targetGround: true, targetAir: true },
      { level: 5, hp: 660, cost: 7000, costType: 'gold', buildTimeSec: 14, thRequired: 5, dps: 36, damagePerShot: 18, attackSpeed: 0.5, range: 10, targetGround: true, targetAir: true },
    ],
  },
  mortar: {
    type: 'mortar',
    name: '迫击炮',
    category: 'defense',
    size: 3,
    description: '发射高抛爆裂炮弹造成大范围溅射伤害，能瞬间瓦解人海战术（近身存在盲区）。',
    maxCountByTH: { 1: 0, 2: 0, 3: 1, 4: 1, 5: 2 },
    levels: [
      { level: 1, hp: 400, cost: 1600, costType: 'gold', buildTimeSec: 7, thRequired: 3, dps: 14, damagePerShot: 56, attackSpeed: 4.0, range: 11.5, minRange: 3.5, splashRadius: 2.0, targetGround: true, targetAir: false },
      { level: 2, hp: 460, cost: 3000, costType: 'gold', buildTimeSec: 10, thRequired: 3, dps: 18, damagePerShot: 72, attackSpeed: 4.0, range: 11.5, minRange: 3.5, splashRadius: 2.0, targetGround: true, targetAir: false },
      { level: 3, hp: 530, cost: 5500, costType: 'gold', buildTimeSec: 13, thRequired: 4, dps: 23, damagePerShot: 92, attackSpeed: 4.0, range: 11.5, minRange: 3.5, splashRadius: 2.1, targetGround: true, targetAir: false },
      { level: 4, hp: 610, cost: 9000, costType: 'gold', buildTimeSec: 15, thRequired: 5, dps: 28, damagePerShot: 112, attackSpeed: 4.0, range: 11.5, minRange: 3.5, splashRadius: 2.2, targetGround: true, targetAir: false },
    ],
  },
  air_defense: {
    type: 'air_defense',
    name: '防空火箭',
    category: 'defense',
    size: 3,
    description: '对空中单位极具毁灭性的防空炮台，气球兵的头号克星。',
    maxCountByTH: { 1: 0, 2: 0, 3: 1, 4: 1, 5: 2 },
    levels: [
      { level: 1, hp: 650, cost: 1800, costType: 'gold', buildTimeSec: 7, thRequired: 3, dps: 45, damagePerShot: 45, attackSpeed: 1.0, range: 10.5, targetGround: false, targetAir: true },
      { level: 2, hp: 740, cost: 3600, costType: 'gold', buildTimeSec: 10, thRequired: 4, dps: 62, damagePerShot: 62, attackSpeed: 1.0, range: 10.5, targetGround: false, targetAir: true },
      { level: 3, hp: 850, cost: 6800, costType: 'gold', buildTimeSec: 13, thRequired: 5, dps: 82, damagePerShot: 82, attackSpeed: 1.0, range: 10.5, targetGround: false, targetAir: true },
    ],
  },
  wizard_tower: {
    type: 'wizard_tower',
    name: '法师塔',
    category: 'defense',
    size: 3,
    description: '塔顶大法师释放奥术火球，对地面与空中部队同时造成范围伤害。',
    maxCountByTH: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 2 },
    levels: [
      { level: 1, hp: 600, cost: 3200, costType: 'gold', buildTimeSec: 9, thRequired: 4, dps: 22, damagePerShot: 28, attackSpeed: 1.3, range: 7.5, splashRadius: 1.4, targetGround: true, targetAir: true },
      { level: 2, hp: 680, cost: 6000, costType: 'gold', buildTimeSec: 12, thRequired: 4, dps: 28, damagePerShot: 36, attackSpeed: 1.3, range: 7.5, splashRadius: 1.4, targetGround: true, targetAir: true },
      { level: 3, hp: 770, cost: 9800, costType: 'gold', buildTimeSec: 15, thRequired: 5, dps: 35, damagePerShot: 45, attackSpeed: 1.3, range: 7.5, splashRadius: 1.5, targetGround: true, targetAir: true },
    ],
  },
  wall: {
    type: 'wall',
    name: '城墙',
    category: 'defense',
    size: 1,
    description: '坚固的防御壁垒，阻挡敌方地面部队前进，为防御塔争取输出时间。',
    maxCountByTH: { 1: 12, 2: 25, 3: 50, 4: 75, 5: 100 },
    levels: [
      { level: 1, hp: 300, cost: 50, costType: 'gold', buildTimeSec: 0, thRequired: 1 },
      { level: 2, hp: 500, cost: 150, costType: 'gold', buildTimeSec: 0, thRequired: 2 },
      { level: 3, hp: 750, cost: 400, costType: 'gold', buildTimeSec: 0, thRequired: 3 },
      { level: 4, hp: 1050, cost: 900, costType: 'gold', buildTimeSec: 0, thRequired: 4 },
      { level: 5, hp: 1400, cost: 1800, costType: 'gold', buildTimeSec: 0, thRequired: 5 },
    ],
  },
  flag: {
    type: 'flag',
    name: '部落战旗',
    category: 'decoration',
    size: 1,
    description: '迎风飘扬的红色部落战旗，装点领地彰显荣耀（纯美观装饰，无属性加成）。',
    maxCountByTH: { 1: 6, 2: 8, 3: 10, 4: 12, 5: 15 },
    levels: [
      { level: 1, hp: 0, cost: 100, costType: 'gold', buildTimeSec: 0, thRequired: 1 },
    ],
  },
  flower_bed: {
    type: 'flower_bed',
    name: '精致花坛',
    category: 'decoration',
    size: 1,
    description: '石砖砌成的缤纷花坛，美化村庄环境（纯美观装饰，无属性加成）。',
    maxCountByTH: { 1: 8, 2: 12, 3: 16, 4: 20, 5: 25 },
    levels: [
      { level: 1, hp: 0, cost: 150, costType: 'gold', buildTimeSec: 0, thRequired: 1 },
    ],
  },
  statue: {
    type: 'statue',
    name: '勇士雕像',
    category: 'decoration',
    size: 2,
    description: '雕工精美的野蛮人英雄石像，彰显首领威望（纯美观装饰，无属性加成）。',
    maxCountByTH: { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 },
    levels: [
      { level: 1, hp: 0, cost: 500, costType: 'gold', buildTimeSec: 0, thRequired: 1 },
    ],
  },
};

export const TROOP_CATALOG: Record<TroopType, TroopDefinition> = {
  barbarian: {
    type: 'barbarian',
    name: '野蛮人',
    role: '近战均衡 · 冲锋先锋',
    housingSpace: 1,
    hp: 95,
    dps: 18,
    attackSpeed: 1.0,
    moveSpeed: 2.3,
    range: 0.7,
    isAir: false,
    favoriteTarget: 'any',
    trainCostElixir: 25,
    barracksLevelRequired: 1,
    color: '#eab308',
    accentColor: '#b91c1c',
  },
  archer: {
    type: 'archer',
    name: '弓箭手',
    role: '远程输出 · 可越墙射击',
    housingSpace: 1,
    hp: 46,
    dps: 16,
    attackSpeed: 0.9,
    moveSpeed: 2.5,
    range: 3.6,
    isAir: false,
    favoriteTarget: 'any',
    trainCostElixir: 40,
    barracksLevelRequired: 1,
    color: '#ec4899',
    accentColor: '#15803d',
  },
  giant: {
    type: 'giant',
    name: '巨人',
    role: '重装坦克 · 优先攻击防御',
    housingSpace: 5,
    hp: 460,
    dps: 24,
    attackSpeed: 1.8,
    moveSpeed: 1.4,
    range: 0.85,
    isAir: false,
    favoriteTarget: 'defense',
    trainCostElixir: 200,
    barracksLevelRequired: 2,
    color: '#f97316',
    accentColor: '#7c2d12',
  },
  goblin: {
    type: 'goblin',
    name: '哥布林',
    role: '极速掠夺 · 资源建筑2倍伤',
    housingSpace: 1,
    hp: 42,
    dps: 16,
    attackSpeed: 0.85,
    moveSpeed: 3.6,
    range: 0.65,
    isAir: false,
    favoriteTarget: 'resource',
    favoriteMultiplier: 2,
    trainCostElixir: 30,
    barracksLevelRequired: 2,
    color: '#22c55e',
    accentColor: '#a16207',
  },
  wall_breaker: {
    type: 'wall_breaker',
    name: '炸弹人',
    role: '破墙爆破 · 对城墙巨额溅射',
    housingSpace: 2,
    hp: 54,
    dps: 220,
    attackSpeed: 0.5,
    moveSpeed: 3.0,
    range: 0.8,
    isAir: false,
    splashRadius: 1.6,
    favoriteTarget: 'wall',
    favoriteMultiplier: 6,
    trainCostElixir: 120,
    barracksLevelRequired: 3,
    color: '#e2e8f0',
    accentColor: '#1e293b',
  },
  balloon: {
    type: 'balloon',
    name: '气球兵',
    role: '空中轰炸 · 无视城墙优先防御',
    housingSpace: 5,
    hp: 260,
    dps: 46,
    attackSpeed: 2.2,
    moveSpeed: 1.55,
    range: 0.9,
    isAir: true,
    splashRadius: 1.3,
    favoriteTarget: 'defense',
    trainCostElixir: 300,
    barracksLevelRequired: 4,
    color: '#dc2626',
    accentColor: '#f8fafc',
  },
};

export const SPELL_CATALOG: Record<SpellType, SpellDefinition> = {
  heal: {
    type: 'heal',
    name: '疗伤法术',
    role: '持续恢复光环内友军生命值',
    housingSpace: 1,
    radius: 3.8,
    durationSec: 8,
    healPerSec: 42,
    brewCostElixir: 350,
    color: '#facc15',
  },
  rage: {
    type: 'rage',
    name: '狂暴法术',
    role: '光环内友军移速+60% · 伤害+70%',
    housingSpace: 1,
    radius: 4.0,
    durationSec: 8,
    speedBoost: 1.6,
    damageBoost: 1.7,
    brewCostElixir: 450,
    color: '#a855f7',
  },
};

export const TROOP_ORDER: TroopType[] = [
  'barbarian',
  'archer',
  'giant',
  'goblin',
  'wall_breaker',
  'balloon',
];

export const SPELL_ORDER: SpellType[] = ['heal', 'rage'];

export const MAX_TROOP_LEVEL = 5;

export function getTroopLevelStats(
  type: TroopType,
  rawLevel = 1
): {
  level: number;
  hp: number;
  dps: number;
  damagePerHit: number;
} {
  const def = TROOP_CATALOG[type];
  const level = Math.max(1, Math.min(MAX_TROOP_LEVEL, Math.floor(rawLevel || 1)));
  const multiplier = 1 + (level - 1) * 0.2;
  const hp = Math.round(def.hp * multiplier);
  const dps = Math.round(def.dps * multiplier);
  const damagePerHit = Math.round(dps * def.attackSpeed);
  return { level, hp, dps, damagePerHit };
}

export function getTroopUpgradeRequirement(
  type: TroopType,
  currentLevel: number
): {
  nextLevel: number;
  elixirCost: number;
  requiredTownHall: number;
  requiredBarracks: number;
} | null {
  const clamped = Math.max(1, Math.floor(currentLevel || 1));
  if (clamped >= MAX_TROOP_LEVEL) return null;
  const def = TROOP_CATALOG[type];
  const nextLevel = clamped + 1;
  const baseElixir = def.trainCostElixir * 10 + def.barracksLevelRequired * 150;
  const elixirCost = Math.round((baseElixir * clamped) / 50) * 50;
  const requiredTownHall = Math.min(5, Math.max(1, nextLevel));
  const requiredBarracks = Math.max(def.barracksLevelRequired, Math.min(5, nextLevel));
  return {
    nextLevel,
    elixirCost,
    requiredTownHall,
    requiredBarracks,
  };
}

export interface TroopCombatDetails {
  damageType: string;
  damageRadius: string;
  targetPreference: string;
  attackRange: string;
  attackSpeed: string;
  moveSpeed: string;
  unitDomain: string;
  damagePerHit: number;
}

export function getTroopCombatDetails(
  type: TroopType,
  rawLevel = 1
): TroopCombatDetails {
  const def = TROOP_CATALOG[type];
  const stats = getTroopLevelStats(type, rawLevel);

  const damageType =
    def.splashRadius && def.splashRadius > 0
      ? '范围溅射'
      : def.range >= 2.0
        ? '单体远程'
        : '单体近战';

  const damageRadius =
    def.splashRadius && def.splashRadius > 0
      ? `${def.splashRadius} 格溅射`
      : '单体（无溅射）';

  const mult = def.favoriteMultiplier ?? 1;
  const targetPreference =
    def.favoriteTarget === 'defense'
      ? '防御建筑'
      : def.favoriteTarget === 'resource'
        ? `资源建筑（${mult}× 伤害）`
        : def.favoriteTarget === 'wall'
          ? `城墙（${mult}× 伤害）`
          : '任意目标';

  return {
    damageType,
    damageRadius,
    targetPreference,
    attackRange: `${def.range} 格`,
    attackSpeed: `${def.attackSpeed} 秒/次`,
    moveSpeed: `${def.moveSpeed} 格/秒`,
    unitDomain: def.isAir ? '空中单位' : '地面单位',
    damagePerHit: stats.damagePerHit,
  };
}

function wallLine(gx1: number, gy1: number, gx2: number, gy2: number, level = 1) {
  const res: Array<{ type: BuildingType; level: number; gx: number; gy: number }> = [];
  const dx = Math.sign(gx2 - gx1);
  const dy = Math.sign(gy2 - gy1);
  let x = gx1;
  let y = gy1;
  while (true) {
    res.push({ type: 'wall', level, gx: x, gy: y });
    if (x === gx2 && y === gy2) break;
    x += dx;
    y += dy;
  }
  return res;
}

function wallBox(gx: number, gy: number, w: number, h: number, level = 1) {
  const res: Array<{ type: BuildingType; level: number; gx: number; gy: number }> = [];
  for (let x = gx; x < gx + w; x++) {
    res.push({ type: 'wall', level, gx: x, gy });
    res.push({ type: 'wall', level, gx: x, gy: gy + h - 1 });
  }
  for (let y = gy + 1; y < gy + h - 1; y++) {
    res.push({ type: 'wall', level, gx, gy: y });
    res.push({ type: 'wall', level, gx: gx + w - 1, gy: y });
  }
  return res;
}

export const CAMPAIGN_STAGES: CampaignStage[] = [
  {
    id: 1,
    name: '第1关 · 哥布林前哨',
    subtitle: '木栅稀疏的侦察营地，适合野蛮人与弓箭手练兵',
    recommendedTH: 1,
    rewardGold: 1200,
    rewardElixir: 1200,
    buildings: [
      { type: 'town_hall', level: 1, gx: 12, gy: 12 },
      { type: 'cannon', level: 1, gx: 16, gy: 12 },
      { type: 'gold_mine', level: 2, gx: 9, gy: 10 },
      { type: 'elixir_collector', level: 2, gx: 9, gy: 14 },
      { type: 'gold_storage', level: 1, gx: 12, gy: 17 },
      ...wallLine(15, 11, 15, 15, 1),
    ],
  },
  {
    id: 2,
    name: '第2关 · 双炮峡谷',
    subtitle: '两座加农炮交叉火力封锁正面，尝试派巨人抗伤',
    recommendedTH: 2,
    rewardGold: 2200,
    rewardElixir: 2000,
    buildings: [
      { type: 'town_hall', level: 2, gx: 12, gy: 12 },
      { type: 'cannon', level: 2, gx: 9, gy: 12 },
      { type: 'cannon', level: 2, gx: 16, gy: 12 },
      { type: 'archer_tower', level: 1, gx: 12, gy: 8 },
      { type: 'gold_storage', level: 2, gx: 12, gy: 16 },
      { type: 'elixir_storage', level: 2, gx: 8, gy: 16 },
      { type: 'gold_mine', level: 2, gx: 17, gy: 16 },
      ...wallBox(8, 11, 12, 8, 1),
    ],
  },
  {
    id: 3,
    name: '第3关 · 石墙堡垒',
    subtitle: '严密城墙护卫着箭塔与资源库，炸弹人能快速打开缺口',
    recommendedTH: 3,
    rewardGold: 3600,
    rewardElixir: 3600,
    buildings: [
      { type: 'town_hall', level: 3, gx: 12, gy: 12 },
      { type: 'archer_tower', level: 2, gx: 9, gy: 12 },
      { type: 'archer_tower', level: 2, gx: 16, gy: 12 },
      { type: 'cannon', level: 3, gx: 12, gy: 9 },
      { type: 'cannon', level: 2, gx: 12, gy: 16 },
      { type: 'gold_storage', level: 2, gx: 9, gy: 9 },
      { type: 'elixir_storage', level: 2, gx: 16, gy: 9 },
      { type: 'gold_mine', level: 3, gx: 6, gy: 18 },
      { type: 'elixir_collector', level: 3, gx: 19, gy: 18 },
      ...wallBox(8, 8, 12, 12, 2),
    ],
  },
  {
    id: 4,
    name: '第4关 · 迫击炮高地',
    subtitle: '中央迫击炮轰击成群士兵，分散下兵或使用疗伤法术突围',
    recommendedTH: 4,
    rewardGold: 5500,
    rewardElixir: 5500,
    buildings: [
      { type: 'town_hall', level: 4, gx: 12, gy: 11 },
      { type: 'mortar', level: 2, gx: 12, gy: 15 },
      { type: 'air_defense', level: 1, gx: 9, gy: 12 },
      { type: 'archer_tower', level: 3, gx: 16, gy: 10 },
      { type: 'cannon', level: 3, gx: 16, gy: 15 },
      { type: 'cannon', level: 3, gx: 8, gy: 16 },
      { type: 'gold_storage', level: 3, gx: 9, gy: 8 },
      { type: 'elixir_storage', level: 3, gx: 16, gy: 6 },
      { type: 'gold_mine', level: 3, gx: 5, gy: 12 },
      { type: 'elixir_collector', level: 3, gx: 20, gy: 12 },
      ...wallBox(8, 10, 12, 9, 3),
    ],
  },
  {
    id: 5,
    name: '第5关 · 熔炉核心要塞',
    subtitle: '法师塔、迫击炮与防空火箭协同布防的终极哥布林王城',
    recommendedTH: 5,
    rewardGold: 9500,
    rewardElixir: 9500,
    buildings: [
      { type: 'town_hall', level: 5, gx: 12, gy: 12 },
      { type: 'mortar', level: 3, gx: 9, gy: 12 },
      { type: 'wizard_tower', level: 2, gx: 16, gy: 12 },
      { type: 'air_defense', level: 2, gx: 12, gy: 8 },
      { type: 'archer_tower', level: 4, gx: 12, gy: 17 },
      { type: 'archer_tower', level: 3, gx: 8, gy: 8 },
      { type: 'cannon', level: 4, gx: 17, gy: 8 },
      { type: 'cannon', level: 4, gx: 17, gy: 17 },
      { type: 'gold_storage', level: 4, gx: 8, gy: 17 },
      { type: 'elixir_storage', level: 4, gx: 5, gy: 12 },
      { type: 'gold_mine', level: 4, gx: 21, gy: 12 },
      { type: 'elixir_collector', level: 4, gx: 12, gy: 4 },
      ...wallBox(7, 7, 14, 14, 4),
    ],
  },
];

export function createInitialVillage(): VillageState {
  const now = Date.now();
  const rawBuildings: Array<Omit<PlacedBuilding, 'id'> & { id?: string }> = [
    { id: 'b_th', type: 'town_hall', level: 2, gx: 12, gy: 12 },
    { id: 'b_gm1', type: 'gold_mine', level: 2, gx: 7, gy: 11, storedResource: 220, lastCollectedAt: now },
    { id: 'b_ec1', type: 'elixir_collector', level: 2, gx: 7, gy: 15, storedResource: 220, lastCollectedAt: now },
    { id: 'b_gs1', type: 'gold_storage', level: 1, gx: 16, gy: 10 },
    { id: 'b_es1', type: 'elixir_storage', level: 1, gx: 16, gy: 14 },
    { id: 'b_bh1', type: 'builders_hut', level: 1, gx: 6, gy: 7 },
    { id: 'b_bh2', type: 'builders_hut', level: 1, gx: 20, gy: 7 },
    { id: 'b_ac1', type: 'army_camp', level: 2, gx: 11, gy: 18 },
    { id: 'b_bar1', type: 'barracks', level: 2, gx: 16, gy: 18 },
    { id: 'b_sf1', type: 'spell_factory', level: 1, gx: 7, gy: 19 },
    { id: 'b_cc1', type: 'clan_castle', level: 1, gx: 20, gy: 12 },
    { id: 'b_can1', type: 'cannon', level: 2, gx: 10, gy: 8 },
    { id: 'b_at1', type: 'archer_tower', level: 1, gx: 15, gy: 7 },
    // Protective corner walls
    ...wallLine(10, 11, 14, 11, 1).filter((_, idx) => idx !== 2),
    ...wallLine(11, 12, 11, 15, 1),
  ];

  // Deduplicate wall positions just in case
  const seen = new Set<string>();
  const uniqueBuildings: PlacedBuilding[] = [];
  let wallCounter = 1;
  for (const b of rawBuildings) {
    const def = BUILDING_CATALOG[b.type];
    let conflict = false;
    for (let dx = 0; dx < def.size; dx++) {
      for (let dy = 0; dy < def.size; dy++) {
        if (seen.has(`${b.gx + dx},${b.gy + dy}`)) conflict = true;
      }
    }
    if (conflict) continue;
    for (let dx = 0; dx < def.size; dx++) {
      for (let dy = 0; dy < def.size; dy++) {
        seen.add(`${b.gx + dx},${b.gy + dy}`);
      }
    }
    uniqueBuildings.push({
      ...b,
      id: b.id ?? `b_w_${wallCounter++}`,
    });
  }

  return {
    townHallLevel: 2,
    gold: 1800,
    elixir: 1800,
    gems: 500,
    trophies: 120,
    xp: 45,
    buildersTotal: 2,
    buildings: uniqueBuildings,
    army: {
      barbarian: 8,
      archer: 6,
      giant: 2,
      goblin: 0,
      wall_breaker: 0,
      balloon: 0,
    },
    troopLevels: {
      barbarian: 1,
      archer: 1,
      giant: 1,
      goblin: 1,
      wall_breaker: 1,
      balloon: 1,
    },
    spells: {
      heal: 1,
      rage: 1,
    },
    clanName: '龙焰守护者',
    clanReinforcements: {},
    clearedCampaignStages: [],
    campaignStars: {},
    lastTickAt: now,
  };
}

const OPPONENT_NAMES = [
  '铁锤部落 · 格罗姆',
  '北境哨站 · 奥丁之盾',
  '翡翠矿区 · 维京商团',
  '炎爪要塞 · 狂战酋长',
  '星辉堡垒 · 凛冬守望',
  '黑岩氏族 · 碎骨者',
];

export function generateMultiplayerOpponent(playerTH: number, seedOffset = 0): {
  name: string;
  thLevel: number;
  rewardGold: number;
  rewardElixir: number;
  buildings: Array<{ type: BuildingType; level: number; gx: number; gy: number }>;
} {
  const thLevel = Math.max(1, Math.min(5, playerTH));
  const seed = Math.floor(Date.now() / 1000) + seedOffset * 73;
  const name = OPPONENT_NAMES[Math.abs(seed) % OPPONENT_NAMES.length];

  const buildings: Array<{ type: BuildingType; level: number; gx: number; gy: number }> = [
    { type: 'town_hall', level: thLevel, gx: 12, gy: 12 },
    { type: 'cannon', level: Math.min(5, thLevel), gx: 9, gy: 12 },
    { type: 'cannon', level: Math.min(5, thLevel), gx: 16, gy: 12 },
    { type: 'gold_storage', level: Math.min(5, thLevel), gx: 12, gy: 8 },
    { type: 'elixir_storage', level: Math.min(5, thLevel), gx: 12, gy: 16 },
    { type: 'gold_mine', level: Math.min(5, thLevel), gx: 6, gy: 10 },
    { type: 'elixir_collector', level: Math.min(5, thLevel), gx: 19, gy: 10 },
    { type: 'gold_mine', level: Math.min(5, thLevel), gx: 6, gy: 16 },
    { type: 'elixir_collector', level: Math.min(5, thLevel), gx: 19, gy: 16 },
  ];

  if (thLevel >= 2) {
    buildings.push({ type: 'archer_tower', level: Math.min(5, thLevel), gx: 9, gy: 9 });
    buildings.push({ type: 'archer_tower', level: Math.min(5, thLevel), gx: 16, gy: 16 });
  }
  if (thLevel >= 3) {
    buildings.push({ type: 'mortar', level: Math.min(4, thLevel - 1), gx: 16, gy: 9 });
    buildings.push({ type: 'air_defense', level: Math.min(3, thLevel - 1), gx: 9, gy: 16 });
  }
  if (thLevel >= 4) {
    buildings.push({ type: 'wizard_tower', level: Math.min(3, thLevel - 2), gx: 12, gy: 5 });
  }
  if (thLevel >= 5) {
    buildings.push({ type: 'mortar', level: 3, gx: 12, gy: 20 });
  }

  // Add outer wall ring avoiding overlap
  const occupied = new Set<string>();
  for (const b of buildings) {
    const s = BUILDING_CATALOG[b.type].size;
    for (let dx = 0; dx < s; dx++) {
      for (let dy = 0; dy < s; dy++) {
        occupied.add(`${b.gx + dx},${b.gy + dy}`);
      }
    }
  }
  const ring = wallBox(8, 8, 12, 12, Math.min(4, thLevel));
  for (const w of ring) {
    const key = `${w.gx},${w.gy}`;
    if (!occupied.has(key)) {
      occupied.add(key);
      buildings.push(w);
    }
  }

  return {
    name,
    thLevel,
    rewardGold: 1600 + thLevel * 1200 + (Math.abs(seed * 17) % 600),
    rewardElixir: 1500 + thLevel * 1150 + (Math.abs(seed * 31) % 600),
    buildings,
  };
}
