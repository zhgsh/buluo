import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILDING_CATALOG,
  CAMPAIGN_STAGES,
  createInitialVillage,
  getTroopCombatDetails,
  getTroopLevelStats,
  GRID_SIZE,
  MAX_TROOP_LEVEL,
  TROOP_CATALOG,
} from './catalog';
import { evaluateAttackStrategy } from './strategyLogic';
import {
  canPlaceBuilding,
  createDefaultVillageCamera,
  gridToWorld,
  INITIAL_VILLAGE_CAMERA,
  resetVillageCamera,
  worldToGrid,
  worldToScreen,
} from './isoMath';
import {
  applyEditLayoutToVillage,
  collectBuildingResource,
  createEditModeState,
  deleteFavoriteArmyComposition,
  getBuildingProductionInfo,
  getEditPlacedBuildings,
  getResourceCaps,
  getStashedBuildingGroups,
  getTroopLevel,
  getTroopUpgradeInfo,
  getUsedClanSpace,
  getUsedSpellSpace,
  getUsedTroopSpace,
  getVillageProductionRates,
  hasTrainingQueueEntries,
  hideAllBuildingsInEdit,
  hideBuildingInEdit,
  MAX_FAVORITE_ARMIES,
  placeOrMoveBuildingInEdit,
  queueFavoriteArmyComposition,
  repeatTrainingQueue,
  restoreAllBuildingsInEdit,
  saveFavoriteArmyComposition,
  startPlaceNewBuilding,
  tickVillage,
  trainTroop,
  upgradeTroop,
} from './villageLogic';
import {
  CLAN_REQUEST_COOLDOWN_MS,
  createInitialClanChatMessages,
  createSimulatedAllianceReply,
  createSimulatedLayoutReply,
  createVillageLayoutShareEntry,
  dismissClanReinforcement,
  formatDonationChatEntries,
  getClanRequestCooldownState,
  joinSimulatedAlliance,
  requestClanReinforcements,
} from './clanLogic';
import {
  buildVillageThumbnailFilename,
  computeVillageLayoutStats,
  computeVillageThumbnailFraming,
  dataUrlToBlob,
  formatVillageLayoutSummary,
} from './villageThumbnailLogic';
import {
  buildBattleDeploymentCards,
  calculateBattleStars,
  createBattleState,
  createVFXPools,
  deployCardAt,
  finalizeBattle,
  isValidDeployPoint,
  projectFloatingDamageTexts,
  selectTargetForTroop,
  stepBattle,
} from './battleLogic';
import {
  appendBattleReplay,
  buildReplayFromBattle,
  createReplayPlayback,
  deleteBattleReplay,
  MAX_SAVED_REPLAYS,
  seekReplayPlayback,
  stepReplayPlayback,
} from './replayLogic';
import {
  claimDailyMissionReward,
  ensureDailyMissions,
  generateDailyMissions,
  getClaimableMissionCount,
  recordMissionProgress,
} from './dailyMissions';
import {
  applyBattleResultToVillage,
  clearVillageSave,
  loadSavedVillage,
  saveVillageToStorage,
  type StorageLike,
} from './saveStorage';
import * as esbuild from 'esbuild';
import { resolveBgmTrack, sound } from './sound';
import {
  buildWechatMiniGame,
  createWechatZipBuffer,
  inspectWechatBundle,
} from '../../scripts/build-wechat.mjs';
import {
  getWechatPublishCredentials,
  maskAppId,
  uploadWechatMiniGame,
  WechatUploadError,
} from '../../scripts/upload-wechat.mjs';

test('isometric coordinate transforms round-trip accurately', () => {
  const samples = [
    { gx: 0, gy: 0 },
    { gx: 14, gy: 14 },
    { gx: 27.5, gy: 3.25 },
  ];
  for (const s of samples) {
    const w = gridToWorld(s.gx, s.gy);
    const back = worldToGrid(w.x, w.y);
    assert.ok(Math.abs(back.gx - s.gx) < 1e-6);
    assert.ok(Math.abs(back.gy - s.gy) < 1e-6);
  }
});

test('building placement rejects overlap and out-of-bounds', () => {
  const village = createInitialVillage();
  // Town hall sits at (12,12) size 4x4
  assert.equal(canPlaceBuilding(12, 12, 3, village.buildings), false);
  assert.equal(canPlaceBuilding(27, 27, 3, village.buildings), false);
  assert.equal(canPlaceBuilding(-1, 5, 2, village.buildings), false);
  // Open corner (2, 2) size 3x3
  assert.equal(canPlaceBuilding(2, 2, 3, village.buildings), true);
  // Boundary edge
  assert.equal(canPlaceBuilding(GRID_SIZE - 3, GRID_SIZE - 3, 3, village.buildings), true);
});

test('village resource production, collection, building and training work end-to-end', () => {
  const base = createInitialVillage();
  const futureMs = base.lastTickAt + 60_000; // +60s
  const { next: ticked } = tickVillage(base, futureMs);
  const mineBefore = base.buildings.find((b) => b.id === 'b_gm1')!;
  const mineAfter = ticked.buildings.find((b) => b.id === 'b_gm1')!;
  assert.ok((mineAfter.storedResource ?? 0) > (mineBefore.storedResource ?? 0));

  const collected = collectBuildingResource(ticked, 'b_gm1');
  assert.equal(collected.resourceType, 'gold');
  assert.ok(collected.collectedAmount > 0);
  assert.equal(collected.next.gold, ticked.gold + collected.collectedAmount);

  const built = startPlaceNewBuilding(collected.next, 'cannon', 2, 2, futureMs);
  assert.equal(built.ok, true);
  if (built.ok) {
    assert.ok(built.next.buildings.some((b) => b.type === 'cannon' && b.gx === 2 && b.gy === 2));
  }

  const caps = getResourceCaps(collected.next);
  assert.ok(caps.maxTroopSpace >= 30);
  const trained = trainTroop(collected.next, 'barbarian');
  assert.equal(trained.ok, true);
  if (trained.ok) {
    assert.equal(trained.next.army.barbarian, collected.next.army.barbarian + 1);
  }
});

test('battle star calculation follows Clash of Clans 3-star rules', () => {
  assert.equal(calculateBattleStars(49, false), 0);
  assert.equal(calculateBattleStars(50, false), 1);
  assert.equal(calculateBattleStars(30, true), 1);
  assert.equal(calculateBattleStars(65, true), 2);
  assert.equal(calculateBattleStars(100, true), 3);
});

test('battle troop targeting prioritizes favorite targets and deployment respects red zone', () => {
  const village = createInitialVillage();
  const battle = createBattleState({
    targetName: 'Test Camp',
    targetTH: 2,
    isCampaign: true,
    campaignStageId: 1,
    rewardGold: 1000,
    rewardElixir: 1000,
    layout: [
      { type: 'town_hall', level: 1, gx: 12, gy: 12 },
      { type: 'cannon', level: 1, gx: 17, gy: 12 },
      { type: 'gold_mine', level: 1, gx: 7, gy: 12 },
    ],
    playerVillage: village,
  });

  // Cannot deploy directly on top of Town Hall
  assert.equal(isValidDeployPoint(13, 13, battle.buildings), false);
  // Valid grass outside red zone
  assert.equal(isValidDeployPoint(1, 1, battle.buildings), true);

  // Deploy Giant -> should prioritize Cannon
  battle.selectedCard = { kind: 'troop', type: 'giant' };
  const dep = deployCardAt(battle, 1, 1);
  assert.equal(dep.deployed, true);
  const giant = battle.troops[0];
  const target = selectTargetForTroop(giant, battle.buildings);
  assert.equal(target?.type, 'cannon');

  // Step battle several ticks and verify simulation advances cleanly
  for (let i = 0; i < 20; i++) {
    stepBattle(battle, 0.05);
  }
  assert.equal(battle.phase, 'fighting');
  assert.ok(battle.elapsedSec > 0.5);
});

test('daily missions generate 3 deterministic tasks, track progress, claim rewards, and roll over dates', () => {
  const dateA = '2026-11-12';
  const dateB = '2026-11-13';
  const dm1 = generateDailyMissions(dateA);
  const dm2 = generateDailyMissions(dateA);
  assert.equal(dm1.missions.length, 3);
  assert.deepEqual(dm1, dm2);
  assert.equal(new Set(dm1.missions.map((m) => m.kind)).size, 3);

  let v = ensureDailyMissions(createInitialVillage(), dateA);
  assert.equal(getClaimableMissionCount(v), 0);

  // Progress one of the generated missions
  const firstMission = v.dailyMissions!.missions[0];
  const badClaim = claimDailyMissionReward(v, firstMission.id, dateA);
  assert.equal(badClaim.ok, false);

  v = recordMissionProgress(v, firstMission.kind, firstMission.target + 50, dateA);
  const updatedFirst = v.dailyMissions!.missions.find((m) => m.id === firstMission.id)!;
  assert.equal(updatedFirst.progress, firstMission.target);
  assert.equal(getClaimableMissionCount(v), 1);

  const goldBefore = v.gold;
  const elixirBefore = v.elixir;
  const gemsBefore = v.gems;
  const claimed = claimDailyMissionReward(v, firstMission.id, dateA);
  assert.equal(claimed.ok, true);
  if (claimed.ok) {
    v = claimed.next;
    assert.equal(getClaimableMissionCount(v), 0);
    if (firstMission.rewardType === 'gold') {
      assert.ok(v.gold >= goldBefore);
    } else if (firstMission.rewardType === 'elixir') {
      assert.ok(v.elixir >= elixirBefore);
    } else {
      assert.equal(v.gems, gemsBefore + firstMission.rewardAmount);
    }
    // Cannot double-claim
    const doubleClaim = claimDailyMissionReward(v, firstMission.id, dateA);
    assert.equal(doubleClaim.ok, false);
  }

  // Date rollover resets to 3 fresh missions for new date
  const rolled = ensureDailyMissions(v, dateB);
  assert.equal(rolled.dailyMissions?.dateKey, dateB);
  assert.equal(rolled.dailyMissions?.missions.length, 3);
  assert.ok(rolled.dailyMissions?.missions.every((m) => m.progress === 0 && !m.claimed));
});

test('decorative items in BUILDING_CATALOG cost gold, have no functional stats, and place instantly', () => {
  const decoTypes = ['flag', 'flower_bed', 'statue'] as const;
  for (const t of decoTypes) {
    const def = BUILDING_CATALOG[t];
    assert.ok(def, `missing decoration ${t}`);
    assert.equal(def.category, 'decoration');
    assert.equal(def.levels.length, 1);
    const lv1 = def.levels[0];
    assert.equal(lv1.costType, 'gold');
    assert.ok(lv1.cost > 0);
    assert.equal(lv1.hp, 0);
    assert.equal(lv1.buildTimeSec, 0);
    assert.equal(lv1.productionPerHour, undefined);
    assert.equal(lv1.storageCapacity, undefined);
    assert.equal(lv1.troopCapacity, undefined);
    assert.equal(lv1.spellCapacity, undefined);
    assert.equal(lv1.dps, undefined);
    assert.equal(lv1.damagePerShot, undefined);
    assert.equal(lv1.range, undefined);
  }

  const base = createInitialVillage();
  const capsBefore = getResourceCaps(base);
  const goldBefore = base.gold;
  const placed = startPlaceNewBuilding(base, 'flag', 2, 2, base.lastTickAt);
  assert.equal(placed.ok, true);
  if (placed.ok) {
    assert.equal(placed.next.gold, goldBefore - BUILDING_CATALOG.flag.levels[0].cost);
    assert.deepEqual(getResourceCaps(placed.next), capsBefore);
    const flag = placed.next.buildings.find((b) => b.id === placed.buildingId);
    assert.ok(flag);
    assert.equal(flag.level, 1);
    assert.equal(flag.upgradingToLevel, undefined);
  }
});

test('saveStorage persists village moves, upgrades, campaign stars, and catches up offline progress on reopen', () => {
  const mem = new Map<string, string>();
  const mockStorage: StorageLike = {
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => {
      mem.set(k, v);
    },
    removeItem: (k) => {
      mem.delete(k);
    },
  };

  const fresh = loadSavedVillage(Date.now(), mockStorage);
  assert.equal(fresh.hasSave, false);
  const t0 = fresh.village.lastTickAt;

  // Place a decorative flag and win a campaign battle, then save before closing
  const placed = startPlaceNewBuilding(fresh.village, 'flag', 2, 2, t0);
  assert.equal(placed.ok, true);
  if (!placed.ok) return;

  const afterBattle = applyBattleResultToVillage(placed.next, {
    victory: true,
    stars: 3,
    destructionPercent: 100,
    townHallDestroyed: true,
    lootGold: 500,
    lootElixir: 400,
    trophyDelta: 24,
    troopsDeployed: { barbarian: 2 },
    spellsUsed: {},
    durationSec: 45,
    targetName: '第1关 · 哥布林前哨',
    campaignStageId: 1,
  });

  assert.equal(saveVillageToStorage(afterBattle, mockStorage), true);

  // Reopen 120s later: saved flag, gold/elixir/trophies, campaign stars, and offline mine gain persist
  const t1 = t0 + 120_000;
  const reloaded = loadSavedVillage(t1, mockStorage);
  assert.equal(reloaded.hasSave, true);
  assert.ok(reloaded.village.buildings.some((b) => b.type === 'flag' && b.gx === 2 && b.gy === 2));
  assert.equal(reloaded.village.campaignStars[1], 3);
  assert.equal(reloaded.village.trophies, afterBattle.trophies);
  assert.equal(reloaded.village.army.barbarian, fresh.village.army.barbarian - 2);
  const mineBefore = afterBattle.buildings.find((b) => b.id === 'b_gm1')!;
  const mineAfter = reloaded.village.buildings.find((b) => b.id === 'b_gm1')!;
  assert.ok((mineAfter.storedResource ?? 0) > (mineBefore.storedResource ?? 0));

  // Clear save resets hasSave back to false
  clearVillageSave(mockStorage);
  assert.equal(loadSavedVillage(t1, mockStorage).hasSave, false);
});

test('BGM track resolver and sound engine track/volume controls behave correctly', () => {
  assert.equal(resolveBgmTrack('title', 'village'), 'none');
  assert.equal(resolveBgmTrack('gameover', 'battle'), 'none');
  assert.equal(resolveBgmTrack('playing', 'village'), 'village');
  assert.equal(resolveBgmTrack('paused', 'village'), 'village');
  assert.equal(resolveBgmTrack('playing', 'battle'), 'battle');
  assert.equal(resolveBgmTrack('paused', 'battle'), 'battle');

  const prevVolume = sound.getBgmVolume();
  const prevTrack = sound.getBgmTrack();
  const prevMuted = sound.isMuted();

  sound.setBgmTrack('village');
  assert.equal(sound.getBgmTrack(), 'village');
  sound.setBgmTrack('battle');
  assert.equal(sound.getBgmTrack(), 'battle');
  sound.setBgmTrack('none');
  assert.equal(sound.getBgmTrack(), 'none');

  sound.setBgmVolume(1.5);
  assert.equal(sound.getBgmVolume(), 1);
  sound.setBgmVolume(-0.2);
  assert.equal(sound.getBgmVolume(), 0);
  sound.setBgmVolume(0.42);
  assert.equal(sound.getBgmVolume(), 0.42);

  sound.setMuted(true);
  assert.equal(sound.isMuted(), true);
  sound.setMuted(prevMuted);
  sound.setBgmVolume(prevVolume);
  sound.setBgmTrack(prevTrack);
});

test('floating damage numbers spawn in VFXPools when buildings and units take damage and expire cleanly', () => {
  const village = createInitialVillage();
  const pools = createVFXPools();
  const battle = createBattleState({
    targetName: 'Damage VFX Camp',
    targetTH: 2,
    isCampaign: true,
    campaignStageId: 1,
    rewardGold: 500,
    rewardElixir: 500,
    layout: [
      { type: 'town_hall', level: 1, gx: 12, gy: 12 },
      { type: 'cannon', level: 2, gx: 5, gy: 5 },
    ],
    playerVillage: village,
  });

  // Deploy Giant right next to Cannon so both cannon hits Giant and Giant hits Cannon
  battle.selectedCard = { kind: 'troop', type: 'giant' };
  const dep = deployCardAt(battle, 3.6, 5, pools);
  assert.equal(dep.deployed, true);

  let sawBuildingDamage = false;
  let sawTroopDamage = false;
  let sawYellowUnitDamage = false;
  let sawProjectedOverlayAboveTarget = false;
  let observedRisePx = 0;

  const cam = { x: 0, y: 0, zoom: 0.95 };
  const cannonCenterWorld = gridToWorld(6.5, 6.5);
  const cannonBaseScreenY = (cannonCenterWorld.y - cam.y) * cam.zoom + 900 / 2;

  for (let i = 0; i < 120; i++) {
    stepBattle(battle, 0.05, pools);
    for (const t of pools.texts) {
      if (!t.active) continue;
      if (t.kind === 'damage_building' && /^-\d+$/.test(t.text)) {
        sawBuildingDamage = true;
        if (t.color === '#fde047' || t.color === '#facc15') {
          sawYellowUnitDamage = true;
        }
      }
      if (t.kind === 'damage_troop' && /^-\d+$/.test(t.text)) {
        sawTroopDamage = true;
      }
      if (t.risePx > observedRisePx) {
        observedRisePx = t.risePx;
      }
    }

    const projected = projectFloatingDamageTexts(pools, 1440, 900, cam);
    for (const item of projected) {
      if (item.kind === 'damage_building' && item.screenY < cannonBaseScreenY) {
        sawProjectedOverlayAboveTarget = true;
      }
    }
  }

  assert.equal(sawBuildingDamage, true);
  assert.equal(sawYellowUnitDamage, true);
  assert.equal(sawProjectedOverlayAboveTarget, true);
  assert.equal(sawTroopDamage, true);
  assert.ok(observedRisePx > 0);
});

test('Clan Castle supports simulated alliance requests, cooldowns, battle reinforcement deployment (+15% stats), and save deduction', () => {
  let village = createInitialVillage();
  const caps = getResourceCaps(village);
  assert.equal(caps.hasClanCastle, true);
  assert.equal(caps.maxClanSpace, 10);
  assert.equal(getUsedClanSpace(village.clanReinforcements), 0);

  // Switch simulated alliance
  village = joinSimulatedAlliance(village, '北境圣盾盟');
  assert.equal(village.clanName, '北境圣盾盟');

  // Request balanced reinforcements at t0
  const t0 = village.lastTickAt;
  const req1 = requestClanReinforcements(village, 'balanced', t0);
  assert.equal(req1.ok, true);
  if (!req1.ok) return;
  village = req1.next;
  assert.equal(getUsedClanSpace(village.clanReinforcements), 10);
  assert.ok(req1.donations.length > 0);

  // Dismiss 1 troop to free space, then test cooldown blocking an immediate second request
  const firstType = req1.donations[0].troopType;
  village = dismissClanReinforcement(village, firstType);
  assert.ok(getUsedClanSpace(village.clanReinforcements) < 10);

  const cdHalf = getClanRequestCooldownState(village, t0 + 4000);
  assert.equal(cdHalf.active, true);
  assert.equal(cdHalf.remainingSec, 6);
  assert.equal(cdHalf.progressPercent, 40);

  const reqDuringCd = requestClanReinforcements(village, 'ranged', t0 + 1000);
  assert.equal(reqDuringCd.ok, false);

  // After cooldown expires, requesting again fills remaining space up to capacity
  const cdDone = getClanRequestCooldownState(village, t0 + CLAN_REQUEST_COOLDOWN_MS + 100);
  assert.equal(cdDone.active, false);
  assert.equal(cdDone.remainingSec, 0);
  assert.equal(cdDone.progressPercent, 100);
  const req2 = requestClanReinforcements(
    village,
    'ranged',
    t0 + CLAN_REQUEST_COOLDOWN_MS + 100
  );
  assert.equal(req2.ok, true);
  if (!req2.ok) return;
  village = req2.next;
  assert.equal(getUsedClanSpace(village.clanReinforcements), 10);

  // Enter battle and deploy a reinforcement troop
  const battle = createBattleState({
    targetName: 'Clan Reinforcement Test',
    targetTH: 2,
    isCampaign: true,
    campaignStageId: 1,
    rewardGold: 800,
    rewardElixir: 800,
    layout: [
      { type: 'town_hall', level: 1, gx: 12, gy: 12 },
      { type: 'gold_mine', level: 1, gx: 8, gy: 12 },
    ],
    playerVillage: village,
  });

  const availEntries = Object.entries(battle.availableReinforcements).filter(
    ([, c]) => (c ?? 0) > 0
  );
  assert.ok(availEntries.length > 0);
  const [reinfTypeKey, reinfCountBefore] = availEntries[0] as [keyof typeof TROOP_CATALOG, number];

  battle.selectedCard = { kind: 'reinforcement', type: reinfTypeKey };
  const dep = deployCardAt(battle, 1, 1);
  assert.equal(dep.deployed, true);
  assert.equal(battle.troops.length, 1);
  assert.equal(battle.troops[0].isReinforcement, true);
  assert.equal(
    battle.troops[0].maxHp,
    Math.round(TROOP_CATALOG[reinfTypeKey].hp * 1.15)
  );
  assert.equal(
    battle.availableReinforcements[reinfTypeKey] ?? 0,
    reinfCountBefore - 1
  );
  assert.equal(battle.reinforcementsDeployed[reinfTypeKey], 1);

  // Applying battle result deducts only deployed reinforcements from village garrison
  const afterBattle = applyBattleResultToVillage(village, {
    victory: true,
    stars: 3,
    destructionPercent: 100,
    townHallDestroyed: true,
    lootGold: 800,
    lootElixir: 800,
    trophyDelta: 20,
    troopsDeployed: {},
    reinforcementsDeployed: battle.reinforcementsDeployed,
    spellsUsed: {},
    durationSec: 30,
    targetName: 'Clan Reinforcement Test',
    campaignStageId: 1,
  });

  assert.equal(
    afterBattle.clanReinforcements?.[reinfTypeKey] ?? 0,
    reinfCountBefore - 1
  );

  // Verify ClanChat initial stream, donation formatting, and simulated member reply
  const initChat = createInitialClanChatMessages('北境圣盾盟', t0);
  assert.ok(initChat.some((m) => m.kind === 'system' && m.text.includes('北境圣盾盟')));
  assert.ok(initChat.some((m) => m.kind === 'donation' && m.troopType !== undefined));

  const donChat = formatDonationChatEntries(req1.donations, '北境圣盾盟', t0);
  assert.equal(donChat.length, req1.donations.length);
  assert.equal(donChat[0].kind, 'donation');
  assert.ok(donChat[0].text.includes('已捐赠'));

  const reply = createSimulatedAllianceReply('北境圣盾盟', '请求援军巨人', t0 + 500);
  assert.equal(reply.kind, 'chat');
  assert.ok(reply.text.length > 0);
});

test('WeChat Mini Game runtime supports wx storage adapter and touch-driven Village, Clan Castle, and Battle flows', () => {
  const noop = () => {};
  const mockCtx = new Proxy({} as Record<string, unknown>, {
    get: (_target, prop) => {
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
        return () => ({ addColorStop: noop });
      }
      if (prop === 'measureText') {
        return () => ({ width: 48 });
      }
      return noop;
    },
  }) as unknown as CanvasRenderingContext2D;

  // Verify saveStorage falls back cleanly to wx.getStorageSync / setStorageSync / removeStorageSync
  const prevWx = (globalThis as unknown as { wx?: unknown }).wx;
  const wxMem = new Map<string, string>();
  (globalThis as unknown as { wx?: unknown }).wx = {
    getStorageSync: (k: string) => wxMem.get(k) ?? '',
    setStorageSync: (k: string, v: string) => {
      wxMem.set(k, v);
    },
    removeStorageSync: (k: string) => {
      wxMem.delete(k);
    },
  };

  try {
    const initial = loadSavedVillage(Date.now(), undefined);
    assert.equal(initial.hasSave, false);
    assert.equal(saveVillageToStorage(initial.village, undefined), true);
    assert.equal(loadSavedVillage(Date.now(), undefined).hasSave, true);
    clearVillageSave(undefined);
    assert.equal(loadSavedVillage(Date.now(), undefined).hasSave, false);

    // Bundle miniGameApp.ts with esbuild (handling .png asset imports cleanly) and run touch simulation
    const built = esbuild.buildSync({
      entryPoints: ['src/wechat/miniGameApp.ts'],
      bundle: true,
      write: false,
      format: 'cjs',
      platform: 'node',
      loader: { '.png': 'text' },
    });
    const moduleObj = { exports: {} as { WechatMiniGameApp: typeof import('../wechat/miniGameApp').WechatMiniGameApp } };
    const fn = new Function('exports', 'require', 'module', built.outputFiles[0].text);
    fn(moduleObj.exports, () => ({}), moduleObj);
    const { WechatMiniGameApp } = moduleObj.exports;

    const now = 1_700_000_000_000;
    const app = new WechatMiniGameApp({
      width: 844,
      height: 390,
      dpr: 1,
      safeLeft: 0,
      safeRight: 0,
      safeTop: 0,
      safeBottom: 0,
      ctx: mockCtx,
      nowMs: () => now,
      nowPerf: () => 1000,
      scheduleFrame: () => 1,
      cancelFrame: noop,
    });

    // Render Title frame & tap start button
    app.stepAndRender(1016);
    assert.equal(app.getStateSummary().screen, 'title');
    app.handleTap(180, 255); // hits title_start button
    app.stepAndRender(1032);
    assert.equal(app.getStateSummary().screen, 'playing');
    assert.equal(app.getStateSummary().mode, 'village');

    // Open Clan Castle modal from bottom dock & request reinforcements
    app.handleTap(230, 355);
    app.stepAndRender(1048);
    assert.equal(app.getStateSummary().modal, 'clan_castle');

    // Tap Request button inside Clan Castle modal
    app.handleTap(620, 276);
    app.stepAndRender(1064);
    assert.ok(Object.keys(app.getStateSummary().village.clanReinforcements ?? {}).length > 0);
    assert.ok(wxMem.size > 0);

    // Close modal -> open Attack modal -> start Stage 1 -> end battle cleanly
    app.handleTap(710, 48);
    app.stepAndRender(1080);
    assert.equal(app.getStateSummary().modal, 'none');

    app.handleTap(50, 355);
    app.stepAndRender(1096);
    assert.equal(app.getStateSummary().modal, 'attack');

    app.handleTap(660, 155);
    app.stepAndRender(1112);
    assert.equal(app.getStateSummary().mode, 'battle');
    assert.ok(app.getStateSummary().battle !== null);

    app.handleTap(780, 28);
    app.stepAndRender(1128);
    assert.equal(app.getStateSummary().screen, 'gameover');

    app.handleTap(844 / 2, 390 / 2 + 65); // battle_return_home
    app.stepAndRender(1144);
    assert.equal(app.getStateSummary().mode, 'village');
    assert.equal(app.getStateSummary().screen, 'playing');
  } finally {
    (globalThis as unknown as { wx?: unknown }).wx = prevWx;
  }
});

test('repeatTrainingQueue refills troops and spells within camp/elixir limits and saves post-battle queue', () => {
  const base = createInitialVillage();

  // Fails cleanly when no lastTrainingQueue exists
  assert.equal(hasTrainingQueueEntries(base.lastTrainingQueue), false);
  const emptyRes = repeatTrainingQueue(base, base.lastTrainingQueue);
  assert.equal(emptyRes.ok, false);

  // Give enough elixir, build Spell Factory, and clear initial army so we can test refill behavior
  const emptyArmy = {
    ...base.army,
    barbarian: 0,
    archer: 0,
    goblin: 0,
    giant: 0,
    wall_breaker: 0,
    wizard: 0,
    balloon: 0,
  };
  const withSpellFactory = {
    ...base,
    gold: 5000,
    elixir: 5000,
    army: emptyArmy,
    spells: { ...base.spells, heal: 0, rage: 0 },
    buildings: [
      ...base.buildings,
      {
        id: 'b_sf_test',
        type: 'spell_factory' as const,
        level: 1,
        gx: 3,
        gy: 3,
        storedResource: 0,
        lastCollectedAt: Date.now(),
      },
    ],
  };

  // Queue asks for 2 Barbarians (2), 8 Archers (8), 5 Giants (25) + 1 Heal Spell (2)
  // TROOP_ORDER trains 2 Barbarians + 8 Archers (10 space) + 4 Giants (20 space) = 30/30 cap
  const queueRes = repeatTrainingQueue(withSpellFactory, {
    army: { giant: 5, archer: 8, barbarian: 2 },
    spells: { heal: 1 },
  });
  assert.equal(queueRes.ok, true);
  if (queueRes.ok) {
    assert.equal(queueRes.next.army.barbarian, 2); // 2 space
    assert.equal(queueRes.next.army.archer, 8); // +8 space = 10
    assert.equal(queueRes.next.army.giant, 4); // +20 space = 30/30
    assert.equal(getUsedTroopSpace(queueRes.next.army), 30);
    assert.equal(queueRes.trainedTroopsCount, 14);
    assert.equal(queueRes.brewedSpellsCount, 1);
    assert.equal(queueRes.next.spells.heal, 1);
    assert.equal(getUsedSpellSpace(queueRes.next.spells), 1);
  }

  // Test oversized unit skipped in favor of smaller queued troop when limited space remains
  const tightVillage = {
    ...withSpellFactory,
    army: { ...emptyArmy, barbarian: 28 },
  };
  const tightRes = repeatTrainingQueue(tightVillage, {
    army: { giant: 1, archer: 2 },
    spells: {},
  });
  assert.equal(tightRes.ok, true);
  if (tightRes.ok) {
    assert.equal(tightRes.next.army.giant, 0);
    assert.equal(tightRes.next.army.archer, 2);
    assert.equal(getUsedTroopSpace(tightRes.next.army), 30);
  }

  // Applying a battle result automatically records deployed troops/spells as lastTrainingQueue
  const afterBattle = applyBattleResultToVillage(withSpellFactory, {
    victory: true,
    stars: 2,
    destructionPercent: 75,
    townHallDestroyed: true,
    lootGold: 300,
    lootElixir: 300,
    trophyDelta: 15,
    troopsDeployed: { barbarian: 6, archer: 4 },
    spellsUsed: { heal: 1 },
    durationSec: 40,
    targetName: 'Repeat Queue Raid',
    campaignStageId: 1,
  });
  assert.equal(hasTrainingQueueEntries(afterBattle.lastTrainingQueue), true);
  assert.equal(afterBattle.lastTrainingQueue?.army.barbarian, 6);
  assert.equal(afterBattle.lastTrainingQueue?.army.archer, 4);
  assert.equal(afterBattle.lastTrainingQueue?.spells.heal, 1);

  const postBattleRefill = repeatTrainingQueue(afterBattle);
  assert.equal(postBattleRefill.ok, true);
  if (postBattleRefill.ok) {
    assert.equal(postBattleRefill.trainedTroopsCount, 10);
    assert.equal(postBattleRefill.brewedSpellsCount, 1);
  }
});

test('getBuildingProductionInfo and getVillageProductionRates report hourly resource outputs accurately', () => {
  const village = createInitialVillage();
  const mine = village.buildings.find((b) => b.type === 'gold_mine');
  const collector = village.buildings.find((b) => b.type === 'elixir_collector');
  const townHall = village.buildings.find((b) => b.type === 'town_hall');
  assert.ok(mine && collector && townHall);

  // Non-producing building returns null
  assert.equal(getBuildingProductionInfo(townHall), null);

  const mineInfo = getBuildingProductionInfo(mine);
  assert.ok(mineInfo);
  assert.equal(mineInfo.resourceType, 'gold');
  assert.equal(mineInfo.resourceLabel, '金币');
  assert.equal(mineInfo.perHour, BUILDING_CATALOG.gold_mine.levels[mine.level - 1].productionPerHour);
  assert.equal(mineInfo.isPausedByUpgrade, false);

  const collectorInfo = getBuildingProductionInfo(collector);
  assert.ok(collectorInfo);
  assert.equal(collectorInfo.resourceType, 'elixir');
  assert.equal(collectorInfo.resourceLabel, '圣水');
  assert.equal(
    collectorInfo.perHour,
    BUILDING_CATALOG.elixir_collector.levels[collector.level - 1].productionPerHour
  );

  // Total village production rate matches active mines & collectors
  const totalsBefore = getVillageProductionRates(village);
  assert.equal(
    totalsBefore.goldPerHour,
    village.buildings
      .filter((b) => b.type === 'gold_mine')
      .reduce((acc, b) => acc + (BUILDING_CATALOG.gold_mine.levels[b.level - 1].productionPerHour ?? 0), 0)
  );
  assert.equal(
    totalsBefore.elixirPerHour,
    village.buildings
      .filter((b) => b.type === 'elixir_collector')
      .reduce((acc, b) => acc + (BUILDING_CATALOG.elixir_collector.levels[b.level - 1].productionPerHour ?? 0), 0)
  );

  // Upgrading mine pauses active production and previews target level rate
  const upgradingMine = {
    ...mine,
    upgradingToLevel: mine.level + 1,
    upgradeEndsAt: Date.now() + 5000,
    upgradeTotalSec: 5,
  };
  const upgradingInfo = getBuildingProductionInfo(upgradingMine);
  assert.ok(upgradingInfo);
  assert.equal(upgradingInfo.isPausedByUpgrade, true);
  assert.equal(upgradingInfo.perHour, 0);
  assert.equal(
    upgradingInfo.nextLevelPerHour,
    BUILDING_CATALOG.gold_mine.levels[mine.level].productionPerHour
  );
});

test('WeChat Mini Game build produces valid bundle within 4MB main package limit and valid zip archive', async () => {
  const bundle = await buildWechatMiniGame({ quiet: true });
  assert.equal(bundle.ready, true);
  assert.equal(bundle.withinMainLimit, true);
  assert.equal(bundle.deviceOrientation, 'landscape');
  assert.ok(bundle.spriteCount >= 24);

  const filePaths = new Set(bundle.files.map((f: { path: string }) => f.path));
  assert.ok(filePaths.has('game.js'));
  assert.ok(filePaths.has('game.json'));
  assert.ok(filePaths.has('project.config.json'));

  const inspected = inspectWechatBundle();
  assert.equal(inspected.ready, true);
  assert.equal(inspected.totalBytes, bundle.totalBytes);

  const zipBuf = await createWechatZipBuffer();
  assert.ok(zipBuf.byteLength > 10000);
  // Standard ZIP PK\x03\x04 magic signature
  assert.equal(zipBuf[0], 0x50);
  assert.equal(zipBuf[1], 0x4b);
});

test('WeChat upload credential validator masks AppIDs and rejects missing or tourist credentials cleanly', async () => {
  assert.equal(maskAppId(''), '');
  assert.equal(maskAppId('touristappid'), 'touristappid');
  assert.equal(maskAppId('wx1234567890abcdef'), 'wx12****cdef');

  const emptyCreds = getWechatPublishCredentials({
    WECHAT_APPID: '',
    WECHAT_PRIVATE_KEY: '',
    WECHAT_PRIVATE_KEY_PATH: '',
  });
  assert.equal(emptyCreds.configured, false);
  assert.deepEqual(emptyCreds.missingFields, ['WECHAT_APPID', 'WECHAT_PRIVATE_KEY']);

  const touristCreds = getWechatPublishCredentials({
    WECHAT_APPID: 'touristappid',
    WECHAT_PRIVATE_KEY: '-----BEGIN RSA PRIVATE KEY-----\nABC\n-----END RSA PRIVATE KEY-----',
  });
  assert.equal(touristCreds.configured, false);
  assert.equal(touristCreds.validAppIdFormat, false);

  const validCreds = getWechatPublishCredentials({
    WECHAT_APPID: 'wx1234567890abcdef',
    WECHAT_PRIVATE_KEY: '-----BEGIN RSA PRIVATE KEY-----\\nABC\\n-----END RSA PRIVATE KEY-----',
  });
  assert.equal(validCreds.configured, true);
  assert.equal(validCreds.validAppIdFormat, true);
  assert.ok(validCreds.privateKey?.includes('\nABC\n'));

  await assert.rejects(
    () =>
      uploadWechatMiniGame({
        env: {
          WECHAT_APPID: '',
          WECHAT_PRIVATE_KEY: '',
          WECHAT_PRIVATE_KEY_PATH: '',
        },
      }),
    (err: unknown) =>
      err instanceof WechatUploadError &&
      err.code === 'MISSING_CREDENTIALS' &&
      Array.isArray(err.extra?.missingFields)
  );
});

test('Village Edit Mode hides all buildings, validates drag-drop placement, and preserves resource generation during editing', () => {
  const baseTime = 1_700_000_000_000;
  let village = createInitialVillage();
  village = {
    ...village,
    lastTickAt: baseTime,
  };

  const goldMineBefore = village.buildings.find((b) => b.type === 'gold_mine');
  assert.ok(goldMineBefore);
  const initialStored = goldMineBefore.storedResource ?? 0;

  // Enter Edit Mode and hide all buildings
  let editState = createEditModeState(village);
  assert.equal(getEditPlacedBuildings(editState).length, village.buildings.length);

  editState = hideAllBuildingsInEdit(editState);
  assert.equal(getEditPlacedBuildings(editState).length, 0);
  const stashedTotal = getStashedBuildingGroups(editState).reduce((s, g) => s + g.count, 0);
  assert.equal(stashedTotal, village.buildings.length);

  // Attempting to save while buildings remain hidden must be rejected cleanly
  const prematureSave = applyEditLayoutToVillage(village, editState);
  assert.equal(prematureSave.ok, false);

  // While all buildings are hidden in Edit Mode, resource generation keeps ticking uninterrupted
  const { next: tickedDuringEdit } = tickVillage(village, baseTime + 600_000); // +10 min
  const mineAfterTick = tickedDuringEdit.buildings.find((b) => b.id === goldMineBefore.id);
  assert.ok(mineAfterTick);
  assert.ok(
    (mineAfterTick.storedResource ?? 0) > initialStored,
    'Gold mine storedResource must continue accumulating while buildings are hidden in Edit Mode'
  );

  // Place all buildings sequentially at non-overlapping grid cells (pack row-by-row)
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;

  for (const entry of [...editState.entries]) {
    const size = BUILDING_CATALOG[entry.type].size;
    if (cursorX + size > GRID_SIZE) {
      cursorX = 0;
      cursorY += rowHeight;
      rowHeight = 0;
    }
    const res = placeOrMoveBuildingInEdit(editState, entry.id, cursorX, cursorY);
    assert.equal(res.ok, true, `Should place ${entry.type} at (${cursorX}, ${cursorY})`);
    if (res.ok) {
      editState = res.next;
    }
    cursorX += size;
    rowHeight = Math.max(rowHeight, size);
  }

  // Test overlap rejection & hide single building round-trip
  const townHallEntry = editState.entries.find((e) => e.type === 'town_hall')!;
  const cannonEntry = editState.entries.find((e) => e.type === 'cannon')!;
  const overlapAttempt = placeOrMoveBuildingInEdit(
    editState,
    cannonEntry.id,
    townHallEntry.gx,
    townHallEntry.gy
  );
  assert.equal(overlapAttempt.ok, false);

  const singleHidden = hideBuildingInEdit(editState, cannonEntry.id);
  assert.equal(getEditPlacedBuildings(singleHidden).length, village.buildings.length - 1);
  const restored = restoreAllBuildingsInEdit(tickedDuringEdit);
  assert.equal(getEditPlacedBuildings(restored).length, village.buildings.length);

  // Save the newly arranged layout onto tickedDuringEdit
  const saved = applyEditLayoutToVillage(tickedDuringEdit, editState);
  assert.equal(saved.ok, true);
  if (saved.ok) {
    const movedMine = saved.next.buildings.find((b) => b.id === goldMineBefore.id);
    assert.ok(movedMine);
    // Position updated
    const editedMine = editState.entries.find((e) => e.id === goldMineBefore.id)!;
    assert.equal(movedMine.gx, editedMine.gx);
    assert.equal(movedMine.gy, editedMine.gy);
    // Resource generation state preserved 100%
    assert.equal(movedMine.storedResource, mineAfterTick.storedResource);
    assert.equal(saved.next.lastTickAt, tickedDuringEdit.lastTickAt);
  }
});

test('battle replay logs deployment coordinates and timestamps, persists with saveStorage, and reproduces outcome deterministically', () => {
  const baseVillage = createInitialVillage();
  const armedVillage = {
    ...baseVillage,
    army: {
      ...baseVillage.army,
      barbarian: 8,
      archer: 6,
      giant: 2,
    },
    clanReinforcements: { barbarian: 2 },
    spells: { ...baseVillage.spells, rage: 1, heal: 0 },
  };
  const livePools = createVFXPools();
  const battle = createBattleState({
    targetName: 'Replay Verification Base',
    targetTH: 3,
    isCampaign: false,
    rewardGold: 1200,
    rewardElixir: 900,
    layout: [
      { type: 'town_hall', level: 2, gx: 12, gy: 12 },
      { type: 'cannon', level: 2, gx: 10, gy: 12 },
      { type: 'gold_mine', level: 2, gx: 16, gy: 12 },
    ],
    playerVillage: armedVillage,
  });

  // Drop 1: Giant at t=0
  battle.selectedCard = { kind: 'troop', type: 'giant' };
  assert.equal(deployCardAt(battle, 7.5, 13.0, livePools).deployed, true);

  // Step 1.5s, then drop Barbarians + Reinforcement + Rage Spell
  for (let i = 0; i < 60; i++) stepBattle(battle, 0.025, livePools);
  battle.selectedCard = { kind: 'troop', type: 'barbarian' };
  assert.equal(deployCardAt(battle, 8.0, 12.0, livePools).deployed, true);
  assert.equal(deployCardAt(battle, 8.25, 13.5, livePools).deployed, true);

  for (let i = 0; i < 40; i++) stepBattle(battle, 0.025, livePools);
  battle.selectedCard = { kind: 'reinforcement', type: 'barbarian' };
  assert.equal(deployCardAt(battle, 8.5, 11.5, livePools).deployed, true);
  battle.selectedCard = { kind: 'spell', type: 'rage' };
  assert.equal(deployCardAt(battle, 10.5, 12.5, livePools).deployed, true);

  // Run combat to completion
  let guard = 0;
  while (battle.phase !== 'ended' && guard < 4000) {
    stepBattle(battle, 0.025, livePools);
    guard += 1;
  }
  assert.equal(battle.phase, 'ended');
  assert.ok(battle.result);

  // Verify interaction log captured every deployment accurately
  assert.equal(battle.replayEvents.length, 5);
  assert.equal(battle.replayEvents[0].kind, 'troop');
  assert.equal(battle.replayEvents[0].type, 'giant');
  assert.equal(battle.replayEvents[0].timeSec, 0);
  assert.equal(battle.replayEvents[0].gx, 7.5);
  assert.equal(battle.replayEvents[0].gy, 13);
  assert.equal(battle.replayEvents[3].kind, 'reinforcement');
  assert.equal(battle.replayEvents[4].kind, 'spell');
  assert.equal(battle.replayEvents[4].type, 'rage');
  assert.ok(battle.replayEvents[4].timeSec > battle.replayEvents[0].timeSec);

  const replay = buildReplayFromBattle(battle, 1_700_000_000_000);

  // Persist replay via saveStorage and verify reload + delete + cap enforcement
  const mem = new Map<string, string>();
  const mockStorage: StorageLike = {
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => {
      mem.set(k, v);
    },
    removeItem: (k) => {
      mem.delete(k);
    },
  };

  const afterBattle = applyBattleResultToVillage(armedVillage, battle.result, undefined, replay);
  assert.equal(afterBattle.battleReplays?.length, 1);
  assert.equal(saveVillageToStorage(afterBattle, mockStorage), true);

  const reloaded = loadSavedVillage(armedVillage.lastTickAt + 5000, mockStorage);
  assert.equal(reloaded.village.battleReplays?.length, 1);
  const loadedReplay = reloaded.village.battleReplays![0];
  assert.equal(loadedReplay.events.length, 5);
  assert.equal(loadedReplay.targetName, 'Replay Verification Base');

  // Snapshot live village before playback to prove watching replay never mutates live village
  const goldBeforeWatch = reloaded.village.gold;
  const elixirBeforeWatch = reloaded.village.elixir;
  const armyBeforeWatch = { ...reloaded.village.army };

  // Reconstruct playback at 2x speed and simulate to finish
  const playback = createReplayPlayback(loadedReplay, 2);
  const replayPools = createVFXPools();
  let replaySteps = 0;
  while (!playback.finished && replaySteps < 4000) {
    stepReplayPlayback(playback, 0.025, replayPools);
    replaySteps += 1;
  }

  assert.equal(playback.finished, true);
  assert.equal(playback.cursor, loadedReplay.events.length);
  assert.equal(playback.battle.stars, battle.result.stars);
  assert.equal(playback.battle.destructionPercent, battle.result.destructionPercent);
  assert.equal(playback.battle.townHallDestroyed, battle.result.townHallDestroyed);
  assert.equal(playback.battle.lootGold, battle.result.lootGold);
  assert.equal(playback.battle.lootElixir, battle.result.lootElixir);
  assert.deepEqual(playback.battle.troopsDeployed, battle.result.troopsDeployed);
  assert.deepEqual(playback.battle.reinforcementsDeployed, battle.result.reinforcementsDeployed);
  assert.deepEqual(playback.battle.spellsUsed, battle.result.spellsUsed);

  // Timeline seek reproduces intermediate and final timestamps cleanly
  const midSeek = seekReplayPlayback(loadedReplay, 2.0, 4, true);
  assert.ok(midSeek.battle.elapsedSec >= 1.99);
  assert.ok(midSeek.cursor >= 3);
  assert.equal(midSeek.paused, true);
  assert.equal(midSeek.speed, 4);

  const endSeek = seekReplayPlayback(loadedReplay, loadedReplay.exactDurationSec + 5, 1, false);
  assert.equal(endSeek.finished, true);
  assert.equal(endSeek.battle.stars, battle.result.stars);

  // Confirm live village remains completely untouched
  assert.equal(reloaded.village.gold, goldBeforeWatch);
  assert.equal(reloaded.village.elixir, elixirBeforeWatch);
  assert.deepEqual(reloaded.village.army, armyBeforeWatch);

  // Verify bounded replay list & deletion
  let cappedList = afterBattle.battleReplays;
  for (let i = 0; i < MAX_SAVED_REPLAYS + 4; i++) {
    cappedList = appendBattleReplay(cappedList, {
      ...replay,
      id: `rep_extra_${i}`,
    });
  }
  assert.equal(cappedList.length, MAX_SAVED_REPLAYS);
  const afterDelete = deleteBattleReplay(afterBattle.battleReplays, replay.id);
  assert.equal(afterDelete.length, 0);
});

test('early-ended battle replay terminates at recorded stop timestamp matching original metrics', () => {
  const baseVillage = createInitialVillage();
  const battle = createBattleState({
    targetName: 'Early Retreat Base',
    targetTH: 2,
    isCampaign: true,
    campaignStageId: 1,
    rewardGold: 600,
    rewardElixir: 600,
    layout: [
      { type: 'town_hall', level: 2, gx: 12, gy: 12 },
      { type: 'gold_mine', level: 1, gx: 7, gy: 12 },
    ],
    playerVillage: baseVillage,
  });

  battle.selectedCard = { kind: 'troop', type: 'barbarian' };
  deployCardAt(battle, 5.5, 12.0);
  for (let i = 0; i < 40; i++) stepBattle(battle, 0.025); // +1.0s
  finalizeBattle(battle, true);

  const replay = buildReplayFromBattle(battle, 1_700_000_005_000);
  assert.equal(replay.endedEarly, true);

  const pb = createReplayPlayback(replay, 1);
  let steps = 0;
  while (!pb.finished && steps < 400) {
    stepReplayPlayback(pb, 0.025);
    steps += 1;
  }
  assert.equal(pb.finished, true);
  assert.ok(Math.abs(pb.battle.elapsedSec - replay.exactDurationSec) < 0.05);
  assert.equal(pb.battle.stars, replay.result.stars);
  assert.equal(pb.battle.destructionPercent, replay.result.destructionPercent);
});

test('evaluateAttackStrategy evaluates player army composition against target level and recommends effective troops', () => {
  const base = createInitialVillage();

  // Empty army returns unready
  const emptyVillage = {
    ...base,
    army: {
      barbarian: 0,
      archer: 0,
      giant: 0,
      goblin: 0,
      wall_breaker: 0,
      balloon: 0,
    },
  };
  const stage1 = CAMPAIGN_STAGES[0];
  const emptyEval = evaluateAttackStrategy(emptyVillage, {
    name: stage1.name,
    thLevel: stage1.recommendedTH,
    buildings: stage1.buildings,
  });
  assert.equal(emptyEval.readiness, 'unready');
  assert.equal(emptyEval.matchupScore, 0);
  assert.ok(emptyEval.recommendedTroops.length >= 3);

  // Initial TH2 army (8 Barbarian, 6 Archer, 2 Giant) vs Stage 1 (TH1, 0 Air Defense) -> favorable & Balloon top ground bypass
  const stage1Eval = evaluateAttackStrategy(base, {
    name: stage1.name,
    thLevel: stage1.recommendedTH,
    buildings: stage1.buildings,
  });
  assert.equal(stage1Eval.readiness, 'favorable');
  assert.ok(stage1Eval.matchupScore >= 72);
  const balloonRec1 = stage1Eval.recommendedTroops.find((r) => r.troopType === 'balloon')!;
  const wallBreakerRec1 = stage1Eval.recommendedTroops.find((r) => r.troopType === 'wall_breaker')!;
  assert.ok(balloonRec1.effectivenessScore > 85);
  assert.ok(wallBreakerRec1.effectivenessScore < 50);

  // Dense walled Stage 3 (wallBox >= 40 walls) -> Wall Breaker recommended heavily
  const stage3 = CAMPAIGN_STAGES[2];
  const stage3Eval = evaluateAttackStrategy(base, {
    name: stage3.name,
    thLevel: stage3.recommendedTH,
    buildings: stage3.buildings,
  });
  const wallBreakerRec3 = stage3Eval.recommendedTroops.find((r) => r.troopType === 'wall_breaker')!;
  assert.ok(wallBreakerRec3.effectivenessScore >= 85);
  assert.ok(stage3Eval.defenseSummary.wallCount >= 16);

  // TH2 initial army vs Stage 5 (TH5 with Mortar, Wizard Tower, Air Defense) -> risky matchup & warns about higher TH + missing tanks/spells if stripped
  const stage5 = CAMPAIGN_STAGES[4];
  const glassCannonArmy = {
    ...base,
    army: {
      barbarian: 20,
      archer: 0,
      giant: 0,
      goblin: 10,
      wall_breaker: 0,
      balloon: 0,
    },
    spells: { heal: 0, rage: 0 },
  };
  const stage5GlassEval = evaluateAttackStrategy(glassCannonArmy, {
    name: stage5.name,
    thLevel: stage5.recommendedTH,
    buildings: stage5.buildings,
  });
  assert.equal(stage5GlassEval.readiness, 'risky');
  assert.ok(stage5GlassEval.warnings.some((w) => w.includes('巨人') || w.includes('高于我方')));

  // Balanced Giant + Archer + Wall Breaker army improves matchup score significantly on Stage 3
  const balancedArmy = {
    ...base,
    townHallLevel: 3,
    army: {
      barbarian: 4,
      archer: 10,
      giant: 3,
      goblin: 0,
      wall_breaker: 2,
      balloon: 0,
    },
    spells: { heal: 1, rage: 1 },
  };
  const stage3BalancedEval = evaluateAttackStrategy(balancedArmy, {
    name: stage3.name,
    thLevel: stage3.recommendedTH,
    buildings: stage3.buildings,
  });
  assert.ok(stage3BalancedEval.matchupScore > stage3Eval.matchupScore);
});

test('Favorite Army Compositions save, persist, queue in one tap, enforce caps, and delete cleanly', () => {
  const base = createInitialVillage();

  // Reject blank name or empty army
  const blankNameRes = saveFavoriteArmyComposition(base, '   ');
  assert.equal(blankNameRes.ok, false);
  const emptyArmyRes = saveFavoriteArmyComposition(base, 'Empty', { army: {}, spells: {} });
  assert.equal(emptyArmyRes.ok, false);

  // Save 'Giant-Healer' preset cleanly
  const savedRes = saveFavoriteArmyComposition(
    { ...base, elixir: 5000 },
    'Giant-Healer',
    { army: { giant: 2, archer: 10, barbarian: 4 }, spells: { heal: 1 } },
    1_700_000_000_000
  );
  assert.equal(savedRes.ok, true);
  if (!savedRes.ok) return;

  assert.equal(savedRes.next.favoriteArmies?.length, 1);
  assert.equal(savedRes.favorite.name, 'Giant-Healer');

  // Persist through saveStorage
  const mem = new Map<string, string>();
  const mockStorage: StorageLike = {
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => {
      mem.set(k, v);
    },
    removeItem: (k) => {
      mem.delete(k);
    },
  };
  assert.equal(saveVillageToStorage(savedRes.next, mockStorage), true);
  const reloaded = loadSavedVillage(savedRes.next.lastTickAt + 2000, mockStorage).village;
  assert.equal(reloaded.favoriteArmies?.length, 1);
  assert.equal(reloaded.favoriteArmies![0].name, 'Giant-Healer');

  // Clear current army/spells (simulating post-battle empty camp) and one-tap queue
  const postBattleEmpty = {
    ...reloaded,
    elixir: 5000,
    army: {
      barbarian: 0,
      archer: 0,
      giant: 0,
      goblin: 0,
      wall_breaker: 0,
      balloon: 0,
    },
    spells: { heal: 0, rage: 0 },
  };
  const queued = queueFavoriteArmyComposition(
    postBattleEmpty,
    reloaded.favoriteArmies![0].id
  );
  assert.equal(queued.ok, true);
  if (queued.ok) {
    assert.equal(queued.favorite.name, 'Giant-Healer');
    assert.equal(queued.next.army.giant, 2);
    assert.equal(queued.next.army.archer, 10);
    assert.equal(queued.next.army.barbarian, 4);
    assert.equal(queued.next.spells.heal, 1);
    assert.equal(queued.trainedTroopsCount, 16);
    assert.equal(queued.brewedSpellsCount, 1);
    assert.equal(getUsedTroopSpace(queued.next.army), 24);
  }

  // Replacing same name deduplicates cleanly, and max favorites cap holds at MAX_FAVORITE_ARMIES
  let multi = savedRes.next;
  for (let i = 0; i < MAX_FAVORITE_ARMIES + 3; i++) {
    const r = saveFavoriteArmyComposition(
      multi,
      `Preset-${i}`,
      { army: { barbarian: 5 }, spells: {} },
      1_700_000_001_000 + i
    );
    assert.equal(r.ok, true);
    if (r.ok) multi = r.next;
  }
  assert.equal(multi.favoriteArmies?.length, MAX_FAVORITE_ARMIES);

  // Delete favorite removes target entry
  const targetId = multi.favoriteArmies![0].id;
  const afterDelete = deleteFavoriteArmyComposition(multi, targetId);
  assert.equal(afterDelete.favoriteArmies?.length, MAX_FAVORITE_ARMIES - 1);
  assert.equal(afterDelete.favoriteArmies?.some((f) => f.id === targetId), false);
});

test('Village isometric thumbnail framing, layout stats, and clan chat sharing behave accurately', () => {
  const village = createInitialVillage();

  // Isometric 28x28 clearing diamond fits cleanly inside thumbnail framing with positive zoom
  const framing = computeVillageThumbnailFraming(800, 480);
  assert.equal(framing.width, 800);
  assert.equal(framing.height, 480);
  assert.ok(framing.camera.zoom > 0.3 && framing.camera.zoom < 1.0);
  assert.equal(framing.camera.x, 0);

  // Corner tiles must project inside the 800x480 thumbnail bounds
  const corners = [
    gridToWorld(0, 0),
    gridToWorld(GRID_SIZE, 0),
    gridToWorld(GRID_SIZE, GRID_SIZE),
    gridToWorld(0, GRID_SIZE),
  ];
  for (const w of corners) {
    const sx = (w.x - framing.camera.x) * framing.camera.zoom + framing.width / 2;
    const sy = (w.y - framing.camera.y) * framing.camera.zoom + framing.height / 2;
    assert.ok(sx >= 0 && sx <= framing.width, `corner sx=${sx} within [0, ${framing.width}]`);
    assert.ok(sy >= 0 && sy <= framing.height, `corner sy=${sy} within [0, ${framing.height}]`);
  }

  // Layout stats match initial village + reflect added walls/defenses
  const stats = computeVillageLayoutStats(village);
  assert.equal(stats.townHallLevel, village.townHallLevel);
  assert.equal(stats.totalBuildings, village.buildings.length);
  assert.ok(stats.defensesCount >= 2);
  assert.ok(stats.wallsCount >= 8);
  const summary = formatVillageLayoutSummary(stats);
  assert.ok(summary.includes(`大本营 Lv.${village.townHallLevel}`));
  assert.ok(buildVillageThumbnailFilename(village).endsWith('.png'));

  // Sharing layout thumbnail into clan chat attaches thumbnailDataUrl and triggers contextual feedback
  const fakeDataUrl = 'data:image/png;base64,iVBORw0KGgo=';
  const blob = dataUrlToBlob(fakeDataUrl);
  assert.equal(blob.type, 'image/png');
  assert.equal(blob.size, 8);
  const shareEntry = createVillageLayoutShareEntry(
    village,
    fakeDataUrl,
    summary,
    '新摆的护本阵型，大家看看',
    1_700_000_005_000
  );
  assert.equal(shareEntry.isOwn, true);
  assert.equal(shareEntry.thumbnailDataUrl, fakeDataUrl);
  assert.equal(shareEntry.layoutSummary, summary);
  assert.equal(shareEntry.text, '新摆的护本阵型，大家看看');

  const reply = createSimulatedLayoutReply(village.clanName, village, 1_700_000_006_000);
  assert.equal(reply.kind, 'chat');
  assert.ok(reply.text.length > 10);
});

test('buildBattleDeploymentCards orders troops, reinforcements, and spells with accurate selection and depleted states', () => {
  const stage = CAMPAIGN_STAGES[0];
  const village = createInitialVillage();
  village.clanReinforcements = { balloon: 1 };
  const battle = createBattleState({
    targetName: stage.name,
    targetTH: stage.recommendedTH,
    isCampaign: true,
    campaignStageId: stage.id,
    rewardGold: stage.rewardGold,
    rewardElixir: stage.rewardElixir,
    layout: stage.buildings,
    playerVillage: village,
  });

  // Deplete archers after deploying one so the slot remains visible as depleted
  battle.availableTroops.archer = 0;
  battle.troopsDeployed.archer = 1;
  battle.selectedCard = { kind: 'spell', type: 'heal' };

  const cards = buildBattleDeploymentCards(battle);
  assert.deepEqual(
    cards.map((c) => `${c.card.kind}:${c.card.type}:${c.keyLabel}`),
    [
      'troop:barbarian:1',
      'troop:archer:2',
      'troop:giant:3',
      'reinforcement:balloon:4',
      'spell:heal:5',
      'spell:rage:6',
    ]
  );

  const archerCard = cards.find((c) => c.card.kind === 'troop' && c.card.type === 'archer')!;
  assert.equal(archerCard.depleted, true);
  assert.equal(archerCard.count, 0);
  assert.equal(archerCard.isSelected, false);

  const reinforcementCard = cards.find((c) => c.card.kind === 'reinforcement')!;
  assert.equal(reinforcementCard.isReinforcement, true);
  assert.equal(reinforcementCard.count, 1);

  const healCard = cards.find((c) => c.card.kind === 'spell' && c.card.type === 'heal')!;
  assert.equal(healCard.isSelected, true);
  assert.equal(healCard.depleted, false);
});

test('Troop level display, upgrade eligibility, stat scaling, and battle/replay propagation work accurately', () => {
  const village = createInitialVillage();

  // Starter village has TH Lv.2, Barracks Lv.2, Elixir 1800 -> Barbarian can upgrade Lv.1 -> Lv.2
  assert.equal(getTroopLevel(village, 'barbarian'), 1);
  const barbInfo = getTroopUpgradeInfo(village, 'barbarian');
  assert.equal(barbInfo.unlocked, true);
  assert.equal(barbInfo.canUpgrade, true);
  assert.equal(barbInfo.currentStats.hp, TROOP_CATALOG.barbarian.hp);
  assert.equal(barbInfo.currentStats.dps, TROOP_CATALOG.barbarian.dps);

  // Locked troop (wall_breaker requires Barracks Lv.3) cannot upgrade
  const wbInfo = getTroopUpgradeInfo(village, 'wall_breaker');
  assert.equal(wbInfo.unlocked, false);
  assert.equal(wbInfo.canUpgrade, false);
  const lockedUpgrade = upgradeTroop(village, 'wall_breaker');
  assert.equal(lockedUpgrade.ok, false);

  // Giant (2300 elixir cost vs 1800 starting elixir) reports insufficient elixir
  const giantInfo = getTroopUpgradeInfo(village, 'giant');
  assert.equal(giantInfo.unlocked, true);
  assert.equal(giantInfo.canUpgrade, false);
  assert.equal(giantInfo.meetsElixir, false);

  // Upgrade Barbarian Lv.1 -> Lv.2
  const upgRes = upgradeTroop(village, 'barbarian');
  assert.equal(upgRes.ok, true);
  if (!upgRes.ok) return;
  assert.equal(upgRes.previousLevel, 1);
  assert.equal(upgRes.newLevel, 2);
  assert.equal(getTroopLevel(upgRes.next, 'barbarian'), 2);
  assert.equal(upgRes.next.elixir, village.elixir - barbInfo.elixirCost);
  assert.ok(upgRes.hpGain > 0);
  assert.ok(upgRes.dpsGain > 0);

  const lv2Stats = getTroopLevelStats('barbarian', 2);
  assert.equal(lv2Stats.hp, Math.round(TROOP_CATALOG.barbarian.hp * 1.2));
  assert.equal(lv2Stats.dps, Math.round(TROOP_CATALOG.barbarian.dps * 1.2));

  // Cannot upgrade Barbarian to Lv.3 while TH & Barracks are Lv.2
  const lv3Block = getTroopUpgradeInfo(upgRes.next, 'barbarian');
  assert.equal(lv3Block.canUpgrade, false);
  assert.equal(lv3Block.meetsTownHall, false);

  // Max level cap prevents further upgrade
  const maxedVillage = {
    ...upgRes.next,
    townHallLevel: 5,
    elixir: 99999,
    troopLevels: { ...upgRes.next.troopLevels, barbarian: MAX_TROOP_LEVEL },
  };
  const maxInfo = getTroopUpgradeInfo(maxedVillage, 'barbarian');
  assert.equal(maxInfo.isMaxLevel, true);
  assert.equal(maxInfo.canUpgrade, false);
  assert.equal(upgradeTroop(maxedVillage, 'barbarian').ok, false);

  // Battle spawns upgraded Barbarian with Lv.2 HP & saves initialTroopLevels in replay
  const stage = CAMPAIGN_STAGES[0];
  const battle = createBattleState({
    targetName: stage.name,
    targetTH: stage.recommendedTH,
    isCampaign: true,
    campaignStageId: stage.id,
    rewardGold: stage.rewardGold,
    rewardElixir: stage.rewardElixir,
    layout: stage.buildings,
    playerVillage: upgRes.next,
  });
  battle.selectedCard = { kind: 'troop', type: 'barbarian' };
  const dep = deployCardAt(battle, 2, 2);
  assert.equal(dep.deployed, true);
  assert.equal(battle.troops[0].level, 2);
  assert.equal(battle.troops[0].maxHp, lv2Stats.hp);

  const replay = buildReplayFromBattle(battle, 1_700_000_010_000);
  assert.equal(replay.initialTroopLevels?.barbarian, 2);
  const playback = createReplayPlayback(replay, 1);
  assert.equal(playback.battle.troopLevels.barbarian, 2);

  // Detailed combat info reports damage type, splash radius, and target preference accurately
  const barbDetails = getTroopCombatDetails('barbarian', 2);
  assert.equal(barbDetails.damageType, '单体近战');
  assert.equal(barbDetails.damageRadius, '单体（无溅射）');
  assert.equal(barbDetails.targetPreference, '任意目标');
  assert.equal(barbDetails.damagePerHit, lv2Stats.damagePerHit);

  const archerDetails = getTroopCombatDetails('archer', 1);
  assert.equal(archerDetails.damageType, '单体远程');

  const giantDetails = getTroopCombatDetails('giant', 1);
  assert.equal(giantDetails.targetPreference, '防御建筑');

  const balloonDetails = getTroopCombatDetails('balloon', 1);
  assert.equal(balloonDetails.damageType, '范围溅射');
  assert.equal(balloonDetails.damageRadius, '1.3 格溅射');
  assert.equal(balloonDetails.unitDomain, '空中单位');
});

test('resetVillageCamera resets panned and zoomed coordinates to (0, 0) with initial zoom and re-centers Town Hall', () => {
  const cam = createDefaultVillageCamera();
  assert.deepEqual(cam, INITIAL_VILLAGE_CAMERA);
  assert.equal(cam.x, 0);
  assert.equal(cam.y, 0);
  assert.equal(cam.zoom, 1.05);

  // Simulate player panning far away and zooming out
  cam.x = 340;
  cam.y = -210;
  cam.zoom = 0.6;

  // Town Hall center at grid (14, 14) should be off-center while panned
  const thCenterWorld = gridToWorld(14, 14);
  const offCenterScreen = worldToScreen(thCenterWorld.x, thCenterWorld.y, 1440, 900, cam);
  assert.notEqual(Math.round(offCenterScreen.x), 720);
  assert.notEqual(Math.round(offCenterScreen.y), 450);

  // Resetting camera restores (0, 0) and initial zoom 1.05
  const resetResult = resetVillageCamera(cam);
  assert.equal(resetResult, cam);
  assert.equal(cam.x, 0);
  assert.equal(cam.y, 0);
  assert.equal(cam.zoom, 1.05);

  // Town Hall center projects directly to viewport center (720, 450)
  const centeredScreen = worldToScreen(thCenterWorld.x, thCenterWorld.y, 1440, 900, cam);
  assert.equal(centeredScreen.x, 720);
  assert.equal(centeredScreen.y, 450);
});
