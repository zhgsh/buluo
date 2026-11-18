import { preloadBuildingSprites } from '../game/buildingAssets';
import {
  BUILDING_CATALOG,
  CAMPAIGN_STAGES,
  TROOP_CATALOG,
  createInitialVillage,
  generateMultiplayerOpponent,
} from '../game/catalog';
import {
  createBattleState,
  createVFXPools,
  deployCardAt,
  finalizeBattle,
  stepBattle,
  type VFXPools,
} from '../game/battleLogic';
import { renderBattleCanvas, renderVillageCanvas } from '../game/canvasRenderer';
import {
  joinSimulatedAlliance,
  requestClanReinforcements,
  dismissClanReinforcement,
  type ClanDonationEvent,
  type ReinforcementPreference,
} from '../game/clanLogic';
import {
  claimDailyMissionReward,
  ensureDailyMissions,
  recordMissionProgress,
} from '../game/dailyMissions';
import {
  type CameraState,
  screenToWorld,
  worldToGrid,
} from '../game/isoMath';
import {
  applyBattleResultToVillage,
  clearVillageSave,
  loadSavedVillage,
  saveVillageToStorage,
} from '../game/saveStorage';
import { resolveBgmTrack, sound } from '../game/sound';
import { preloadTroopSprites } from '../game/troopAssets';
import type {
  BattleState,
  BuildingCategory,
  BuildingType,
  GameScreenState,
  PlayMode,
  SpellType,
  TroopType,
  VillageState,
} from '../game/types';
import {
  brewSpell,
  collectBuildingResource,
  dismissSpell,
  dismissTroop,
  finishUpgradeWithGems,
  moveBuilding,
  startPlaceNewBuilding,
  startUpgradeBuilding,
  tickVillage,
  trainTroop,
} from '../game/villageLogic';
import {
  findHitRegionAt,
  renderWechatUI,
  type HitRegion,
  type WechatModalType,
  type WechatUIActions,
  type WechatUIState,
} from './canvasUi';
import type { MiniGamePlatformAdapter } from './wxTypes';

const BGM_VOLUME_STEPS = [0, 0.3, 0.55, 0.85, 1];

export class WechatMiniGameApp {
  private readonly platform: MiniGamePlatformAdapter;
  private screen: GameScreenState = 'title';
  private mode: PlayMode = 'village';
  private village: VillageState;
  private hasSavedProgress: boolean;
  private battle: BattleState | null = null;
  private battleResultApplied = false;
  private pools: VFXPools = createVFXPools();
  private camera: CameraState = { x: -120, y: 10, zoom: 0.95 };

  private modal: WechatModalType = 'none';
  private shopCategory: BuildingCategory = 'resource';
  private attackTab: 'campaign' | 'multiplayer' = 'campaign';
  private multiplayerSeed = 0;
  private clanPreference: ReinforcementPreference = 'balanced';
  private recentDonations: ClanDonationEvent[] = [];
  private selectedBuildingId: string | null = null;
  private placingType: BuildingType | null = null;
  private movingBuildingId: string | null = null;

  private toastText: string | null = null;
  private toastUntilMs = 0;

  private hits: HitRegion[] = [];
  private rafId = 0;
  private running = false;
  private lastPerf = 0;
  private villageTickAcc = 0;
  private hoverGrid: { gx: number; gy: number } | null = null;

  // Touch gesture state
  private activeTouches = new Map<number, { x: number; y: number }>();
  private dragStart: { x: number; y: number; camX: number; camY: number; moved: boolean } | null = null;
  private pinchStart: { dist: number; zoom: number } | null = null;

  constructor(platform: MiniGamePlatformAdapter) {
    this.platform = platform;
    const loaded = loadSavedVillage(platform.nowMs());
    this.village = loaded.village;
    this.hasSavedProgress = loaded.hasSave;
  }

  public start(): void {
    if (this.running) return;
    this.running = true;
    preloadBuildingSprites();
    preloadTroopSprites();
    this.lastPerf = this.platform.nowPerf();
    this.syncBgmTrack();
    this.scheduleNextFrame();
  }

  public stop(): void {
    this.running = false;
    if (this.rafId) {
      this.platform.cancelFrame(this.rafId);
      this.rafId = 0;
    }
  }

  public getStateSummary() {
    return {
      screen: this.screen,
      mode: this.mode,
      modal: this.modal,
      village: this.village,
      battle: this.battle,
      hitsCount: this.hits.length,
    };
  }

  public handleAppShow(): void {
    sound.setPageHidden(false);
    const now = this.platform.nowMs();
    if (this.mode === 'village') {
      const { next } = tickVillage(this.village, now);
      this.village = ensureDailyMissions(next);
    }
    this.syncBgmTrack();
  }

  public handleAppHide(): void {
    sound.setPageHidden(true);
    this.flushSave();
  }

  public handleTouchStart(points: Array<{ id: number; x: number; y: number }>): void {
    sound.unlockAudio();
    for (const p of points) {
      this.activeTouches.set(p.id, { x: p.x, y: p.y });
    }
    if (this.activeTouches.size === 1) {
      const first = points[0];
      this.dragStart = {
        x: first.x,
        y: first.y,
        camX: this.camera.x,
        camY: this.camera.y,
        moved: false,
      };
      this.pinchStart = null;
    } else if (this.activeTouches.size >= 2) {
      const vals = Array.from(this.activeTouches.values());
      const dist = Math.hypot(vals[0].x - vals[1].x, vals[0].y - vals[1].y);
      this.pinchStart = { dist: Math.max(10, dist), zoom: this.camera.zoom };
      this.dragStart = null;
    }
  }

  public handleTouchMove(points: Array<{ id: number; x: number; y: number }>): void {
    for (const p of points) {
      if (this.activeTouches.has(p.id)) {
        this.activeTouches.set(p.id, { x: p.x, y: p.y });
      }
    }
    if (this.activeTouches.size >= 2 && this.pinchStart) {
      const vals = Array.from(this.activeTouches.values());
      const dist = Math.hypot(vals[0].x - vals[1].x, vals[0].y - vals[1].y);
      const ratio = dist / this.pinchStart.dist;
      this.camera.zoom = Math.max(0.55, Math.min(1.75, this.pinchStart.zoom * ratio));
      return;
    }
    if (this.activeTouches.size === 1 && this.dragStart && this.modal === 'none' && this.screen === 'playing') {
      const vals = Array.from(this.activeTouches.values());
      const dx = vals[0].x - this.dragStart.x;
      const dy = vals[0].y - this.dragStart.y;
      if (Math.hypot(dx, dy) > 8) {
        this.dragStart.moved = true;
        this.camera.x = Math.max(-560, Math.min(560, this.dragStart.camX - dx / this.camera.zoom));
        this.camera.y = Math.max(-340, Math.min(340, this.dragStart.camY - dy / this.camera.zoom));
      }
      const w = screenToWorld(vals[0].x, vals[0].y, this.platform.width, this.platform.height, this.camera);
      this.hoverGrid = worldToGrid(w.x, w.y);
    }
  }

  public handleTouchEnd(changed: Array<{ id: number; x: number; y: number }>): void {
    const singleTapCandidate =
      this.activeTouches.size === 1 && this.dragStart && !this.dragStart.moved && changed.length > 0;
    const tapPoint = changed[0];

    for (const p of changed) {
      this.activeTouches.delete(p.id);
    }
    if (this.activeTouches.size < 2) {
      this.pinchStart = null;
    }
    if (this.activeTouches.size === 0) {
      this.dragStart = null;
      this.hoverGrid = null;
    }

    if (singleTapCandidate && tapPoint) {
      this.handleTap(tapPoint.x, tapPoint.y);
    }
  }

  public handleTap(x: number, y: number): void {
    sound.unlockAudio();
    const uiHit = findHitRegionAt(this.hits, x, y);
    if (uiHit) {
      uiHit.onTap();
      return;
    }

    if (this.screen !== 'playing' || this.modal !== 'none') return;

    const w = screenToWorld(x, y, this.platform.width, this.platform.height, this.camera);
    const grid = worldToGrid(w.x, w.y);

    if (this.mode === 'battle' && this.battle) {
      const res = deployCardAt(this.battle, grid.gx, grid.gy, this.pools);
      if (!res.deployed && res.reason) {
        this.showToast(res.reason);
      }
      return;
    }

    const now = this.platform.nowMs();
    if (this.placingType) {
      const size = BUILDING_CATALOG[this.placingType].size;
      const gx = Math.floor(grid.gx - size / 2 + 0.5);
      const gy = Math.floor(grid.gy - size / 2 + 0.5);
      const res = startPlaceNewBuilding(this.village, this.placingType, gx, gy, now);
      if (res.ok) {
        this.village = recordMissionProgress(res.next, 'upgrade_or_build', 1);
        this.selectedBuildingId = res.buildingId;
        if (this.placingType !== 'wall') {
          this.placingType = null;
        }
        sound.playBuildPlace();
        this.flushSave();
      } else {
        this.showToast(res.reason);
      }
      return;
    }

    if (this.movingBuildingId) {
      const b = this.village.buildings.find((item) => item.id === this.movingBuildingId);
      if (b) {
        const size = BUILDING_CATALOG[b.type].size;
        const gx = Math.floor(grid.gx - size / 2 + 0.5);
        const gy = Math.floor(grid.gy - size / 2 + 0.5);
        const res = moveBuilding(this.village, this.movingBuildingId, gx, gy);
        if (res.ok) {
          this.village = res.next;
          this.movingBuildingId = null;
          sound.playBuildPlace();
          this.flushSave();
        } else {
          this.showToast(res.reason);
        }
      }
      return;
    }

    // Hit test buildings front-to-back
    const sorted = [...this.village.buildings].sort(
      (a, b) =>
        b.gx +
        b.gy +
        BUILDING_CATALOG[b.type].size -
        (a.gx + a.gy + BUILDING_CATALOG[a.type].size)
    );
    const hit = sorted.find((b) => {
      const s = BUILDING_CATALOG[b.type].size;
      return grid.gx >= b.gx && grid.gx <= b.gx + s && grid.gy >= b.gy && grid.gy <= b.gy + s;
    });

    if (hit) {
      if (
        (hit.type === 'gold_mine' || hit.type === 'elixir_collector') &&
        (hit.storedResource ?? 0) >= 12 &&
        hit.upgradingToLevel === undefined
      ) {
        const col = collectBuildingResource(this.village, hit.id);
        if (col.collectedAmount > 0) {
          const kind = col.resourceType === 'gold' ? 'collect_gold' : 'collect_elixir';
          this.village = recordMissionProgress(col.next, kind, col.collectedAmount);
          if (col.resourceType === 'gold') sound.playCollectGold();
          else sound.playCollectElixir();
          this.showToast(`收集 +${col.collectedAmount} ${col.resourceType === 'gold' ? '金币' : '圣水'}`);
          this.flushSave();
          return;
        }
      }
      sound.playClick();
      this.selectedBuildingId = hit.id;
    } else {
      this.selectedBuildingId = null;
    }
  }

  public stepAndRender(nowPerf: number): void {
    const rawDt = (nowPerf - this.lastPerf) / 1000;
    this.lastPerf = nowPerf;
    const dt = Math.min(Math.max(rawDt, 0), 0.05);
    const nowEpoch = this.platform.nowMs();

    if (this.toastText && nowEpoch >= this.toastUntilMs) {
      this.toastText = null;
    }

    if (this.screen === 'title') {
      const t = nowPerf * 0.00025;
      this.camera.x = Math.sin(t) * 60 - 150;
      this.camera.y = Math.cos(t * 0.8) * 40 + 12;
      this.camera.zoom = 0.95;
    } else if (this.screen === 'playing' && this.mode === 'battle' && this.battle) {
      const prevPhase = this.battle.phase;
      stepBattle(this.battle, dt, this.pools);
      if (this.battle.phase === 'ended' && prevPhase !== 'ended') {
        this.commitFinishedBattleResult();
        this.screen = 'gameover';
        this.syncBgmTrack();
      }
    }

    this.villageTickAcc += dt;
    if (this.villageTickAcc >= 1.0) {
      this.villageTickAcc = 0;
      if (this.screen === 'playing' && this.mode === 'village') {
        const { next, completedUpgrades } = tickVillage(this.village, nowEpoch);
        this.village = ensureDailyMissions(next);
        if (completedUpgrades.length > 0) {
          sound.playUpgradeComplete();
          const first = completedUpgrades[0];
          this.showToast(`${BUILDING_CATALOG[first.type].name} 升级至 Lv.${first.level} 完成`);
          this.flushSave();
        }
      }
    }

    const { ctx, width, height, dpr } = this.platform;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (this.mode === 'battle' && this.battle && this.screen !== 'title') {
      renderBattleCanvas(ctx, width, height, this.camera, this.battle, this.pools, nowEpoch, this.hoverGrid);
    } else {
      renderVillageCanvas(ctx, width, height, this.camera, this.village, nowEpoch, {
        selectedBuildingId: this.screen === 'title' ? null : this.selectedBuildingId,
        placingType: this.placingType,
        movingBuildingId: this.movingBuildingId,
        hoverGrid: this.hoverGrid,
      });
    }

    const uiState: WechatUIState = {
      screen: this.screen,
      mode: this.mode,
      hasSavedProgress: this.hasSavedProgress,
      village: this.village,
      battle: this.battle,
      nowMs: nowEpoch,
      modal: this.modal,
      shopCategory: this.shopCategory,
      attackTab: this.attackTab,
      multiplayerSeed: this.multiplayerSeed,
      clanPreference: this.clanPreference,
      recentDonations: this.recentDonations,
      selectedBuildingId: this.selectedBuildingId,
      placingType: this.placingType,
      movingBuildingId: this.movingBuildingId,
      muted: sound.isMuted(),
      bgmVolume: sound.getBgmVolume(),
      toastText: this.toastText,
    };

    this.hits = renderWechatUI(
      ctx,
      {
        width,
        height,
        safeLeft: this.platform.safeLeft,
        safeRight: this.platform.safeRight,
        safeTop: this.platform.safeTop,
        safeBottom: this.platform.safeBottom,
      },
      uiState,
      this.getActions()
    );
  }

  private scheduleNextFrame(): void {
    if (!this.running) return;
    this.rafId = this.platform.scheduleFrame((t) => {
      if (!this.running) return;
      this.stepAndRender(t);
      this.scheduleNextFrame();
    });
  }

  private showToast(msg: string): void {
    this.toastText = msg;
    this.toastUntilMs = this.platform.nowMs() + 2200;
    this.platform.onShowToast?.(msg);
  }

  private syncBgmTrack(): void {
    sound.setBgmTrack(resolveBgmTrack(this.screen, this.mode));
  }

  private flushSave(): void {
    if (this.battle?.result && !this.battleResultApplied) {
      this.commitFinishedBattleResult();
      return;
    }
    if (this.mode === 'village') {
      const { next } = tickVillage(this.village, this.platform.nowMs());
      this.village = ensureDailyMissions(next);
    }
    if (saveVillageToStorage(this.village)) {
      this.hasSavedProgress = true;
    }
  }

  private commitFinishedBattleResult(): void {
    if (!this.battle?.result || this.battleResultApplied) return;
    this.battleResultApplied = true;
    this.village = applyBattleResultToVillage(this.village, this.battle.result);
    if (saveVillageToStorage(this.village)) {
      this.hasSavedProgress = true;
    }
  }

  private launchBattle(params: {
    targetName: string;
    targetTH: number;
    isCampaign: boolean;
    campaignStageId?: number;
    rewardGold: number;
    rewardElixir: number;
    buildings: Array<{ type: BuildingType; level: number; gx: number; gy: number }>;
  }): void {
    sound.playClick();
    this.pools = createVFXPools();
    this.battle = createBattleState({
      ...params,
      layout: params.buildings,
      playerVillage: this.village,
    });
    this.battleResultApplied = false;
    this.camera = { x: 0, y: 0, zoom: 0.9 };
    this.modal = 'none';
    this.selectedBuildingId = null;
    this.placingType = null;
    this.movingBuildingId = null;
    this.mode = 'battle';
    this.screen = 'playing';
    this.syncBgmTrack();
  }

  private getActions(): WechatUIActions {
    return {
      onStartGame: () => {
        sound.playClick();
        this.camera = { x: 0, y: 0, zoom: 0.95 };
        this.screen = 'playing';
        this.mode = 'village';
        this.syncBgmTrack();
      },
      onOpenModal: (modal) => {
        sound.playClick();
        this.modal = modal;
      },
      onCloseModal: () => {
        sound.playClick();
        this.modal = 'none';
      },
      onToggleMute: () => {
        sound.toggleMute();
      },
      onCycleBgmVolume: () => {
        const cur = sound.getBgmVolume();
        const nextIdx = (BGM_VOLUME_STEPS.findIndex((v) => Math.abs(v - cur) < 0.08) + 1) % BGM_VOLUME_STEPS.length;
        sound.setBgmVolume(BGM_VOLUME_STEPS[nextIdx]);
        sound.playClick();
      },
      onCollectAll: () => {
        let cur = this.village;
        let gold = 0;
        let elixir = 0;
        for (const b of cur.buildings) {
          if ((b.storedResource ?? 0) >= 1 && b.upgradingToLevel === undefined) {
            const res = collectBuildingResource(cur, b.id);
            cur = res.next;
            if (res.resourceType === 'gold') gold += res.collectedAmount;
            if (res.resourceType === 'elixir') elixir += res.collectedAmount;
          }
        }
        if (gold > 0 || elixir > 0) {
          if (gold > 0) cur = recordMissionProgress(cur, 'collect_gold', gold);
          if (elixir > 0) cur = recordMissionProgress(cur, 'collect_elixir', elixir);
          this.village = cur;
          if (gold >= elixir) sound.playCollectGold();
          else sound.playCollectElixir();
          this.showToast(`已收矿 +${gold}金 +${elixir}水`);
          this.flushSave();
        } else {
          this.showToast('仓库已满或暂无可收集资源');
        }
      },
      onZoomDelta: (delta) => {
        this.camera.zoom = Math.max(0.55, Math.min(1.75, this.camera.zoom + delta));
      },
      onSetShopCategory: (cat) => {
        sound.playClick();
        this.shopCategory = cat;
      },
      onSelectShopBuilding: (type) => {
        sound.playClick();
        this.modal = 'none';
        this.selectedBuildingId = null;
        this.movingBuildingId = null;
        this.placingType = type;
      },
      onCancelPlacementOrMove: () => {
        this.placingType = null;
        this.movingBuildingId = null;
      },
      onCollectBuilding: (id) => {
        const res = collectBuildingResource(this.village, id);
        if (res.collectedAmount > 0) {
          const kind = res.resourceType === 'gold' ? 'collect_gold' : 'collect_elixir';
          this.village = recordMissionProgress(res.next, kind, res.collectedAmount);
          if (res.resourceType === 'gold') sound.playCollectGold();
          else sound.playCollectElixir();
          this.showToast(`收集 +${res.collectedAmount}`);
          this.flushSave();
        } else {
          this.showToast('仓库已满');
        }
      },
      onUpgradeBuilding: (id) => {
        const res = startUpgradeBuilding(this.village, id, this.platform.nowMs());
        if (res.ok) {
          this.village = recordMissionProgress(res.next, 'upgrade_or_build', 1);
          sound.playBuildPlace();
          this.flushSave();
        } else {
          this.showToast(res.reason);
        }
      },
      onFinishWithGems: (id) => {
        const res = finishUpgradeWithGems(this.village, id, this.platform.nowMs());
        if (res.ok) {
          this.village = res.next;
          sound.playUpgradeComplete();
          this.flushSave();
        } else {
          this.showToast(res.reason);
        }
      },
      onStartMoveBuilding: (id) => {
        this.movingBuildingId = id;
        this.selectedBuildingId = null;
      },
      onTrainTroop: (t) => {
        const res = trainTroop(this.village, t);
        if (res.ok) {
          this.village = recordMissionProgress(res.next, 'train_troops', 1);
          sound.playClick();
          this.flushSave();
        } else {
          this.showToast(res.reason);
        }
      },
      onDismissTroop: (t) => {
        this.village = dismissTroop(this.village, t);
        sound.playClick();
        this.flushSave();
      },
      onBrewSpell: (s) => {
        const res = brewSpell(this.village, s);
        if (res.ok) {
          this.village = res.next;
          sound.playSpellCast(s === 'heal');
          this.flushSave();
        } else {
          this.showToast(res.reason);
        }
      },
      onDismissSpell: (s) => {
        this.village = dismissSpell(this.village, s);
        sound.playClick();
        this.flushSave();
      },
      onJoinAlliance: (name) => {
        this.village = joinSimulatedAlliance(this.village, name);
        this.recentDonations = [];
        sound.playClick();
        this.showToast(`已加入「${name}」`);
        this.flushSave();
      },
      onSetClanPreference: (pref) => {
        sound.playClick();
        this.clanPreference = pref;
      },
      onRequestReinforcements: () => {
        const now = this.platform.nowMs();
        const res = requestClanReinforcements(this.village, this.clanPreference, now);
        if (res.ok) {
          this.village = res.next;
          this.recentDonations = res.donations;
          const added = res.donations.reduce(
            (sum, d) => sum + TROOP_CATALOG[d.troopType].housingSpace * d.count,
            0
          );
          sound.playUpgradeComplete();
          this.showToast(`联盟增援已抵达 (+${added} 人口)`);
          this.flushSave();
        } else {
          this.showToast(res.reason);
        }
      },
      onDismissReinforcement: (t) => {
        this.village = dismissClanReinforcement(this.village, t);
        sound.playClick();
        this.flushSave();
      },
      onClaimMission: (missionId) => {
        const res = claimDailyMissionReward(this.village, missionId);
        if (res.ok) {
          this.village = res.next;
          sound.playUpgradeComplete();
          this.showToast(`领取奖励 +${res.rewardAmount}`);
          this.flushSave();
        } else {
          this.showToast(res.reason);
        }
      },
      onSetAttackTab: (tab) => {
        sound.playClick();
        this.attackTab = tab;
      },
      onRerollOpponent: () => {
        sound.playClick();
        this.multiplayerSeed += 1;
      },
      onStartCampaign: (stageId) => {
        const stage = CAMPAIGN_STAGES.find((s) => s.id === stageId);
        if (!stage) return;
        this.launchBattle({
          targetName: stage.name,
          targetTH: stage.recommendedTH,
          isCampaign: true,
          campaignStageId: stage.id,
          rewardGold: stage.rewardGold,
          rewardElixir: stage.rewardElixir,
          buildings: stage.buildings,
        });
      },
      onStartMultiplayer: () => {
        const opp = generateMultiplayerOpponent(this.village.townHallLevel, this.multiplayerSeed);
        this.launchBattle({
          targetName: opp.name,
          targetTH: opp.thLevel,
          isCampaign: false,
          rewardGold: opp.rewardGold,
          rewardElixir: opp.rewardElixir,
          buildings: opp.buildings,
        });
      },
      onSelectBattleCard: (card) => {
        if (!this.battle) return;
        this.battle.selectedCard = card;
        sound.playClick();
      },
      onEndBattleEarly: () => {
        if (!this.battle) return;
        finalizeBattle(this.battle);
        this.commitFinishedBattleResult();
        this.screen = 'gameover';
        this.syncBgmTrack();
      },
      onReturnHomeFromBattle: () => {
        this.commitFinishedBattleResult();
        this.battle = null;
        this.battleResultApplied = false;
        this.camera = { x: 0, y: 0, zoom: 0.95 };
        this.mode = 'village';
        this.screen = 'playing';
        this.syncBgmTrack();
      },
      onSaveNow: () => {
        this.flushSave();
        sound.playClick();
        this.showToast('当前记录已保存至微信本地缓存');
      },
      onResetVillage: () => {
        clearVillageSave();
        this.village = ensureDailyMissions(createInitialVillage());
        this.hasSavedProgress = false;
        this.recentDonations = [];
        this.selectedBuildingId = null;
        this.placingType = null;
        this.movingBuildingId = null;
        this.modal = 'none';
        sound.playClick();
        this.showToast('村庄已重置为初始状态');
      },
    };
  }
}
