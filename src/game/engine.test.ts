import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILDING_CATALOG,
  createInitialVillage,
  GRID_SIZE,
  TROOP_CATALOG,
} from './catalog';
import { canPlaceBuilding, gridToWorld, worldToGrid } from './isoMath';
import {
  applyEditLayoutToVillage,
  collectBuildingResource,
  createEditModeState,
  getBuildingProductionInfo,
  getEditPlacedBuildings,
  getResourceCaps,
  getStashedBuildingGroups,
  getUsedClanSpace,
  getUsedSpellSpace,
  getUsedTroopSpace,
  getVillageProductionRates,
  hasTrainingQueueEntries,
  hideAllBuildingsInEdit,
  hideBuildingInEdit,
  placeOrMoveBuildingInEdit,
  repeatTrainingQueue,
  restoreAllBuildingsInEdit,
  startPlaceNewBuilding,
  tickVillage,
  trainTroop,
} from './villageLogic';
import {
  CLAN_REQUEST_COOLDOWN_MS,
  createInitialClanChatMessages,
  createSimulatedAllianceReply,
  dismissClanReinforcement,
  formatDonationChatEntries,
  getClanRequestCooldownState,
  joinSimulatedAlliance,
  requestClanReinforcements,
} from './clanLogic';
import {
  calculateBattleStars,
  createBattleState,
  createVFXPools,
  deployCardAt,
  isValidDeployPoint,
  selectTargetForTroop,
  stepBattle,
} from './battleLogic';
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
  let observedRisePx = 0;

  for (let i = 0; i < 120; i++) {
    stepBattle(battle, 0.05, pools);
    for (const t of pools.texts) {
      if (!t.active) continue;
      if (t.kind === 'damage_building' && /^-\d+$/.test(t.text)) {
        sawBuildingDamage = true;
      }
      if (t.kind === 'damage_troop' && /^-\d+$/.test(t.text)) {
        sawTroopDamage = true;
      }
      if (t.risePx > observedRisePx) {
        observedRisePx = t.risePx;
      }
    }
  }

  assert.equal(sawBuildingDamage, true);
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

