/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AttackSelectorModal } from './components/AttackSelectorModal';
import { BarracksModal } from './components/BarracksModal';
import { BattleHUD } from './components/BattleHUD';
import { BattleResultModal } from './components/BattleResultModal';
import { ClanCastleModal } from './components/ClanCastleModal';
import { ClanChat } from './components/ClanChat';
import { DailyMissionsModal } from './components/DailyMissionsModal';
import { PauseModal } from './components/PauseModal';
import { SettingsModal } from './components/SettingsModal';
import { ShopModal } from './components/ShopModal';
import { TitleScreen } from './components/TitleScreen';
import { VillageEditBar } from './components/VillageEditBar';
import { VillageHUD } from './components/VillageHUD';
import { WechatPublishModal } from './components/WechatPublishModal';
import {
  createVFXPools,
  createBattleState,
  deployCardAt,
  finalizeBattle,
  stepBattle,
} from './game/battleLogic';
import { renderBattleCanvas, renderVillageCanvas } from './game/canvasRenderer';
import {
  BUILDING_CATALOG,
  GRID_SIZE,
  SPELL_ORDER,
  TROOP_CATALOG,
  TROOP_ORDER,
  createInitialVillage,
} from './game/catalog';
import {
  CameraState,
  screenToWorld,
  worldToGrid,
} from './game/isoMath';
import { resolveBgmTrack, sound } from './game/sound';
import type {
  BattleState,
  BuildingType,
  CampaignStage,
  GameScreenState,
  PlayMode,
  SpellType,
  TrainingQueueSnapshot,
  TroopType,
  VillageState,
} from './game/types';
import {
  type EditModeState,
  applyEditLayoutToVillage,
  brewSpell,
  cloneTrainingQueue,
  collectBuildingResource,
  createEditModeState,
  dismissSpell,
  dismissTroop,
  finishUpgradeWithGems,
  hideAllBuildingsInEdit,
  hideBuildingInEdit,
  moveBuilding,
  placeOrMoveBuildingInEdit,
  repeatTrainingQueue,
  restoreAllBuildingsInEdit,
  startPlaceNewBuilding,
  startUpgradeBuilding,
  tickVillage,
  trainTroop,
} from './game/villageLogic';

import {
  claimDailyMissionReward,
  ensureDailyMissions,
  getClaimableMissionCount,
  recordMissionProgress,
} from './game/dailyMissions';
import {
  type ClanChatEntry,
  type ClanDonationEvent,
  type ReinforcementPreference,
  createInitialClanChatMessages,
  createSimulatedAllianceReply,
  dismissClanReinforcement,
  formatDonationChatEntries,
  joinSimulatedAlliance,
  requestClanReinforcements,
} from './game/clanLogic';
import {
  applyBattleResultToVillage,
  clearVillageSave,
  loadSavedVillage,
  saveVillageToStorage,
} from './game/saveStorage';

export default function App() {
  const initialLoad = useRef(loadSavedVillage());
  const autostart =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('autostart') === '1';

  const [screen, setScreen] = useState<GameScreenState>(autostart ? 'playing' : 'title');
  const [mode, setMode] = useState<PlayMode>('village');
  const [village, setVillage] = useState<VillageState>(initialLoad.current.village);
  const [hasSavedProgress, setHasSavedProgress] = useState<boolean>(initialLoad.current.hasSave);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [muted, setMuted] = useState<boolean>(() => sound.isMuted());
  const [bgmVolume, setBgmVolume] = useState<number>(() => sound.getBgmVolume());

  // Modals & Village interaction states
  const [shopOpen, setShopOpen] = useState(false);
  const [barracksOpen, setBarracksOpen] = useState(false);
  const [clanCastleOpen, setClanCastleOpen] = useState(false);
  const [clanChatOpen, setClanChatOpen] = useState(false);
  const [clanChatMessages, setClanChatMessages] = useState<ClanChatEntry[]>(() =>
    createInitialClanChatMessages(initialLoad.current.village.clanName)
  );
  const [unreadClanMessages, setUnreadClanMessages] = useState<number>(2);
  const [recentDonations, setRecentDonations] = useState<ClanDonationEvent[]>([]);
  const [missionsOpen, setMissionsOpen] = useState(false);
  const [attackOpen, setAttackOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [wechatPublishOpen, setWechatPublishOpen] = useState(false);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [placingType, setPlacingType] = useState<BuildingType | null>(null);
  const [movingBuildingId, setMovingBuildingId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<EditModeState | null>(null);
  const [editDraggingId, setEditDraggingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Battle snapshot for React HUD (updated at discrete changes or ~10Hz)
  const [battleHudSnapshot, setBattleHudSnapshot] = useState<BattleState | null>(null);

  // Mutable simulation refs for 60fps Canvas loop
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const screenRef = useRef<GameScreenState>(screen);
  const modeRef = useRef<PlayMode>(mode);
  const villageRef = useRef<VillageState>(village);
  const battleRef = useRef<BattleState | null>(null);
  const battleResultAppliedRef = useRef<boolean>(false);
  const skipNextAutoSaveRef = useRef<boolean>(false);
  const poolsRef = useRef(createVFXPools());
  const barracksSessionQueueRef = useRef<TrainingQueueSnapshot>({ army: {}, spells: {} });
  const cameraRef = useRef<CameraState>({ x: 0, y: 0, zoom: 1.05 });
  const keysHeldRef = useRef<Set<string>>(new Set());
  const hoverGridRef = useRef<{ gx: number; gy: number } | null>(null);
  const selectedBuildingIdRef = useRef<string | null>(selectedBuildingId);
  const placingTypeRef = useRef<BuildingType | null>(placingType);
  const movingBuildingIdRef = useRef<string | null>(movingBuildingId);
  const editModeRef = useRef<EditModeState | null>(editMode);
  const editDraggingIdRef = useRef<string | null>(editDraggingId);
  const editDragRef = useRef<{
    active: boolean;
    buildingId: string;
    fromTray: boolean;
    type: BuildingType;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const clanChatOpenRef = useRef<boolean>(clanChatOpen);
  const clanReplyTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const dragStateRef = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    camStartX: number;
    camStartY: number;
  }>({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    camStartX: 0,
    camStartY: 0,
  });

  // Sync refs
  useEffect(() => {
    screenRef.current = screen;
    document.body.dataset.state = screen;
  }, [screen]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    villageRef.current = village;
  }, [village]);

  useEffect(() => {
    clanChatOpenRef.current = clanChatOpen;
    if (clanChatOpen) {
      setUnreadClanMessages(0);
    }
  }, [clanChatOpen]);

  useEffect(() => {
    return () => {
      if (clanReplyTimerRef.current !== null) {
        window.clearTimeout(clanReplyTimerRef.current);
      }
    };
  }, []);

  // Switch looping BGM track based on current game state (Village vs Battle)
  useEffect(() => {
    sound.setBgmTrack(resolveBgmTrack(screen, mode));
  }, [screen, mode]);

  // Unlock Web Audio on user interaction and pause/resume BGM on tab visibility change
  useEffect(() => {
    const onUnlock = () => {
      sound.unlockAudio();
    };
    const onVisibility = () => {
      sound.setPageHidden(document.visibilityState === 'hidden');
    };
    window.addEventListener('pointerdown', onUnlock, { passive: true });
    window.addEventListener('keydown', onUnlock, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pointerdown', onUnlock);
      window.removeEventListener('keydown', onUnlock);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const commitFinishedBattleResult = useCallback(() => {
    const battle = battleRef.current;
    if (!battle?.result || battleResultAppliedRef.current) return;
    battleResultAppliedRef.current = true;
    const updated = applyBattleResultToVillage(villageRef.current, battle.result);
    villageRef.current = updated;
    setVillage(updated);
    saveVillageToStorage(updated);
    setHasSavedProgress(true);
  }, []);

  const flushSaveNow = useCallback(() => {
    if (battleRef.current?.result && !battleResultAppliedRef.current) {
      commitFinishedBattleResult();
      return;
    }
    if (modeRef.current === 'village') {
      const { next: ticked } = tickVillage(villageRef.current, Date.now());
      const synced = ensureDailyMissions(ticked);
      villageRef.current = synced;
      saveVillageToStorage(synced);
    } else {
      saveVillageToStorage(villageRef.current);
    }
    setHasSavedProgress(true);
  }, [commitFinishedBattleResult]);

  // Persist complete village state whenever any field changes (buildings, moves, upgrades, stars, missions, resources)
  const lastSavedJsonRef = useRef<string>('');
  useEffect(() => {
    if (skipNextAutoSaveRef.current) {
      skipNextAutoSaveRef.current = false;
      lastSavedJsonRef.current = '';
      return;
    }
    const serialized = JSON.stringify(village);
    if (serialized !== lastSavedJsonRef.current) {
      lastSavedJsonRef.current = serialized;
      if (saveVillageToStorage(village)) {
        setHasSavedProgress(true);
      }
    }
  }, [village]);

  // Flush save synchronously when browser tab/window closes, hides, or navigates away
  useEffect(() => {
    const onBeforeUnload = () => {
      flushSaveNow();
    };
    const onPageHide = () => {
      flushSaveNow();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushSaveNow();
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [flushSaveNow]);

  useEffect(() => {
    selectedBuildingIdRef.current = selectedBuildingId;
  }, [selectedBuildingId]);

  useEffect(() => {
    placingTypeRef.current = placingType;
  }, [placingType]);

  useEffect(() => {
    movingBuildingIdRef.current = movingBuildingId;
  }, [movingBuildingId]);

  useEffect(() => {
    editModeRef.current = editMode;
  }, [editMode]);

  useEffect(() => {
    editDraggingIdRef.current = editDraggingId;
  }, [editDraggingId]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 2200);
  }, []);

  const syncBattleSnapshot = useCallback(() => {
    if (battleRef.current) {
      setBattleHudSnapshot({
        ...battleRef.current,
        availableTroops: { ...battleRef.current.availableTroops },
        availableReinforcements: { ...battleRef.current.availableReinforcements },
        availableSpells: { ...battleRef.current.availableSpells },
        troopsDeployed: { ...battleRef.current.troopsDeployed },
        reinforcementsDeployed: { ...battleRef.current.reinforcementsDeployed },
        spellsUsed: { ...battleRef.current.spellsUsed },
      });
    } else {
      setBattleHudSnapshot(null);
    }
  }, []);

  const handleStartFromTitle = useCallback(() => {
    sound.unlockAudio();
    sound.playClick();
    cameraRef.current = { x: 0, y: 0, zoom: 1.05 };
    keysHeldRef.current.clear();
    setScreen('playing');
    setMode('village');
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, []);

  const handleToggleMute = useCallback(() => {
    sound.unlockAudio();
    const m = sound.toggleMute();
    setMuted(m);
  }, []);

  const handleChangeBgmVolume = useCallback((volume: number) => {
    sound.unlockAudio();
    sound.setBgmVolume(volume);
    setBgmVolume(sound.getBgmVolume());
  }, []);

  const handlePauseToggle = useCallback(() => {
    if (wechatPublishOpen) {
      setWechatPublishOpen(false);
      return;
    }
    if (screenRef.current === 'title' || screenRef.current === 'gameover') return;
    if (settingsOpen) {
      setSettingsOpen(false);
      return;
    }
    if (shopOpen) {
      setShopOpen(false);
      return;
    }
    if (barracksOpen) {
      setBarracksOpen(false);
      return;
    }
    if (clanCastleOpen) {
      setClanCastleOpen(false);
      return;
    }
    if (clanChatOpen) {
      setClanChatOpen(false);
      return;
    }
    if (missionsOpen) {
      setMissionsOpen(false);
      return;
    }
    if (attackOpen) {
      setAttackOpen(false);
      return;
    }
    if (placingTypeRef.current || movingBuildingIdRef.current) {
      setPlacingType(null);
      setMovingBuildingId(null);
      return;
    }
    if (editModeRef.current) {
      if (editModeRef.current.activeTrayType || editModeRef.current.selectedId) {
        setEditMode((prev) =>
          prev ? { ...prev, activeTrayType: null, selectedId: null } : null
        );
        return;
      }
      editDragRef.current = null;
      setEditDraggingId(null);
      setEditMode(null);
      return;
    }
    setScreen((prev) => (prev === 'paused' ? 'playing' : 'paused'));
  }, [
    wechatPublishOpen,
    settingsOpen,
    shopOpen,
    barracksOpen,
    clanCastleOpen,
    clanChatOpen,
    missionsOpen,
    attackOpen,
  ]);

  // Global keyboard shortcuts & focus-loss hygiene
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isTextInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable);

      if (isTextInput) {
        if (e.key === 'Escape') {
          e.preventDefault();
          (e.target as HTMLElement).blur();
          if (clanChatOpenRef.current) setClanChatOpen(false);
        }
        return;
      }

      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        keysHeldRef.current.add(k);
      }

      if (e.key === 'Escape' && wechatPublishOpen) {
        e.preventDefault();
        setWechatPublishOpen(false);
        return;
      }

      if (e.key === 'Escape' || k === 'p') {
        if (screenRef.current === 'playing' || screenRef.current === 'paused') {
          e.preventDefault();
          handlePauseToggle();
        }
      } else if (k === 'm') {
        handleToggleMute();
      } else if (
        screenRef.current === 'playing' &&
        modeRef.current === 'battle' &&
        battleRef.current &&
        /^[1-9]$/.test(e.key)
      ) {
        const idx = Number(e.key) - 1;
        const cards: NonNullable<BattleState['selectedCard']>[] = [];
        for (const t of TROOP_ORDER) {
          if ((battleRef.current.availableTroops[t] ?? 0) > 0 || (battleRef.current.troopsDeployed[t] ?? 0) > 0) {
            cards.push({ kind: 'troop', type: t });
          }
        }
        for (const t of TROOP_ORDER) {
          if (
            (battleRef.current.availableReinforcements[t] ?? 0) > 0 ||
            (battleRef.current.reinforcementsDeployed[t] ?? 0) > 0
          ) {
            cards.push({ kind: 'reinforcement', type: t });
          }
        }
        for (const s of SPELL_ORDER) {
          if ((battleRef.current.availableSpells[s] ?? 0) > 0 || (battleRef.current.spellsUsed[s] ?? 0) > 0) {
            cards.push({ kind: 'spell', type: s });
          }
        }
        const chosen = cards[idx];
        if (chosen) {
          battleRef.current.selectedCard = chosen;
          syncBattleSnapshot();
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysHeldRef.current.delete(e.key.toLowerCase());
    };

    const clearInputs = () => {
      keysHeldRef.current.clear();
      dragStateRef.current.active = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearInputs);
    document.addEventListener('visibilitychange', clearInputs);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearInputs);
      document.removeEventListener('visibilitychange', clearInputs);
    };
  }, [handlePauseToggle, handleToggleMute, syncBattleSnapshot]);

  // Main 60fps simulation + Canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = container.clientWidth || window.innerWidth;
    let height = container.clientHeight || window.innerHeight;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      width = Math.max(320, rect.width);
      height = Math.max(240, rect.height);
      const maxDpr = navigator.webdriver ? 1 : 1.5;
      const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(container);

    let rafId = 0;
    let timeoutId: number | null = null;
    let cancelled = false;
    let lastTime = performance.now();
    let hudAccumulator = 0;

    const loop = (nowPerf: number) => {
      if (cancelled) return;
      const frameStart = performance.now();
      const rawDt = (nowPerf - lastTime) / 1000;
      lastTime = nowPerf;
      const dt = Math.min(Math.max(rawDt, 0), 0.05);
      const nowEpoch = Date.now();

      // Title screen slow scenic camera orbit (shifted left so village frames on right 2/3)
      if (screenRef.current === 'title') {
        const t = nowPerf * 0.00025;
        cameraRef.current.x = Math.sin(t) * 65 - 165;
        cameraRef.current.y = Math.cos(t * 0.8) * 45 + 15;
        cameraRef.current.zoom = 1.04;
      } else if (screenRef.current === 'playing') {
        // WASD / Arrow smooth camera pan
        const panSpeed = 380 / cameraRef.current.zoom;
        let dx = 0;
        let dy = 0;
        if (keysHeldRef.current.has('a') || keysHeldRef.current.has('arrowleft')) dx -= 1;
        if (keysHeldRef.current.has('d') || keysHeldRef.current.has('arrowright')) dx += 1;
        if (keysHeldRef.current.has('w') || keysHeldRef.current.has('arrowup')) dy -= 1;
        if (keysHeldRef.current.has('s') || keysHeldRef.current.has('arrowdown')) dy += 1;
        if (dx !== 0 || dy !== 0) {
          cameraRef.current.x = Math.max(-560, Math.min(560, cameraRef.current.x + dx * panSpeed * dt));
          cameraRef.current.y = Math.max(-340, Math.min(340, cameraRef.current.y + dy * panSpeed * dt));
        }

        // Advance simulation
        if (modeRef.current === 'battle' && battleRef.current) {
          const prevPhase = battleRef.current.phase;
          const prevStars = battleRef.current.stars;
          const prevPct = battleRef.current.destructionPercent;
          stepBattle(battleRef.current, dt, poolsRef.current);

          if (battleRef.current.phase === 'ended' && prevPhase !== 'ended') {
            commitFinishedBattleResult();
            setScreen('gameover');
            syncBattleSnapshot();
          } else if (
            battleRef.current.stars !== prevStars ||
            battleRef.current.destructionPercent !== prevPct
          ) {
            syncBattleSnapshot();
          }
        }
      }

      // Periodic React HUD refresh (1Hz for village clocks, discrete-second for battle)
      hudAccumulator += dt;
      if (hudAccumulator >= 1.0) {
        hudAccumulator = 0;
        if (screenRef.current === 'playing') {
          if (modeRef.current === 'village') {
            const { next: ticked, completedUpgrades } = tickVillage(villageRef.current, nowEpoch);
            const next = ensureDailyMissions(ticked);
            villageRef.current = next;
            setVillage(next);
            setNowMs(nowEpoch);
            if (completedUpgrades.length > 0) {
              sound.playUpgradeComplete();
              const first = completedUpgrades[0];
              showToast(`${BUILDING_CATALOG[first.type].name} 升级至 Lv.${first.level} 完成！`);
            }
          } else if (modeRef.current === 'battle' && battleRef.current) {
            syncBattleSnapshot();
          }
        }
      }

      // Render active scene
      if (modeRef.current === 'battle' && battleRef.current && screenRef.current !== 'title') {
        renderBattleCanvas(
          ctx,
          width,
          height,
          cameraRef.current,
          battleRef.current,
          poolsRef.current,
          nowEpoch,
          hoverGridRef.current
        );
      } else {
        renderVillageCanvas(
          ctx,
          width,
          height,
          cameraRef.current,
          villageRef.current,
          nowEpoch,
          {
            selectedBuildingId:
              screenRef.current === 'title' ? null : selectedBuildingIdRef.current,
            placingType: placingTypeRef.current,
            movingBuildingId: movingBuildingIdRef.current,
            hoverGrid: hoverGridRef.current,
            editMode:
              screenRef.current !== 'title' && editModeRef.current
                ? {
                    state: editModeRef.current,
                    draggingId: editDraggingIdRef.current,
                  }
                : null,
          }
        );
      }

      const frameCostMs = performance.now() - frameStart;
      if (navigator.webdriver) {
        timeoutId = window.setTimeout(() => {
          if (!cancelled) rafId = requestAnimationFrame(loop);
        }, 120);
      } else if (frameCostMs > 12) {
        timeoutId = window.setTimeout(() => {
          if (!cancelled) rafId = requestAnimationFrame(loop);
        }, 16);
      } else {
        rafId = requestAnimationFrame(loop);
      }
    };

    rafId = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      ro.disconnect();
    };
  }, [commitFinishedBattleResult, showToast, syncBattleSnapshot]);

  // Pointer helpers
  const clientToGrid = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const w = screenToWorld(sx, sy, rect.width, rect.height, cameraRef.current);
    return worldToGrid(w.x, w.y);
  }, []);

  const finalizeEditDrag = useCallback(
    (clientX: number, clientY: number) => {
      const drag = editDragRef.current;
      if (!drag?.active) return;
      editDragRef.current = null;
      setEditDraggingId(null);

      const curEdit = editModeRef.current;
      if (!curEdit) return;

      const trayEl = document.querySelector('[data-testid="edit-mode-tray"]');
      const trayRect = trayEl?.getBoundingClientRect();
      const droppedOnTray = Boolean(
        trayRect &&
          clientX >= trayRect.left &&
          clientX <= trayRect.right &&
          clientY >= trayRect.top &&
          clientY <= trayRect.bottom
      );

      if (drag.fromTray) {
        if (!drag.moved || droppedOnTray) {
          setEditMode((prev) =>
            prev ? { ...prev, activeTrayType: drag.type, selectedId: null } : null
          );
          return;
        }
        const grid = clientToGrid(clientX, clientY);
        if (!grid) return;
        const size = BUILDING_CATALOG[drag.type].size;
        const gx = Math.floor(grid.gx - size / 2 + 0.5);
        const gy = Math.floor(grid.gy - size / 2 + 0.5);
        const res = placeOrMoveBuildingInEdit(curEdit, drag.buildingId, gx, gy);
        if (res.ok) {
          setEditMode(res.next);
          sound.playBuildPlace();
        } else {
          showToast(res.reason);
        }
        return;
      }

      // Dragged an already-placed building on the canvas
      if (!drag.moved) {
        sound.playClick();
        setEditMode((prev) =>
          prev
            ? {
                ...prev,
                selectedId: prev.selectedId === drag.buildingId ? null : drag.buildingId,
                activeTrayType: null,
              }
            : null
        );
        return;
      }

      if (droppedOnTray) {
        sound.playClick();
        setEditMode(hideBuildingInEdit(curEdit, drag.buildingId));
        showToast('已将建筑暂时收起至待放置栏');
        return;
      }

      const grid = clientToGrid(clientX, clientY);
      if (!grid) return;
      const size = BUILDING_CATALOG[drag.type].size;
      const gx = Math.floor(grid.gx - size / 2 + 0.5);
      const gy = Math.floor(grid.gy - size / 2 + 0.5);
      const res = placeOrMoveBuildingInEdit(curEdit, drag.buildingId, gx, gy);
      if (res.ok) {
        setEditMode(res.next);
        sound.playBuildPlace();
      } else {
        showToast(res.reason);
      }
    },
    [clientToGrid, showToast]
  );

  // Global drag tracking when dragging a building in Edit Mode (from grid or tray)
  const isEditModeActive = Boolean(editMode);
  useEffect(() => {
    if (!isEditModeActive) return;

    const onWindowPointerMove = (e: PointerEvent) => {
      const drag = editDragRef.current;
      if (!drag?.active) return;
      hoverGridRef.current = clientToGrid(e.clientX, e.clientY);
      if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 5) {
        drag.moved = true;
        setEditDraggingId(drag.buildingId);
      }
    };

    const onWindowPointerUp = (e: PointerEvent) => {
      if (editDragRef.current?.active) {
        finalizeEditDrag(e.clientX, e.clientY);
      }
    };

    window.addEventListener('pointermove', onWindowPointerMove);
    window.addEventListener('pointerup', onWindowPointerUp);
    window.addEventListener('pointercancel', onWindowPointerUp);
    return () => {
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', onWindowPointerUp);
      window.removeEventListener('pointercancel', onWindowPointerUp);
    };
  }, [clientToGrid, finalizeEditDrag, isEditModeActive]);

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (screen !== 'playing') return;

    // In Village Edit Mode, pressing on a placed building starts immediate drag-and-drop
    if (mode === 'village' && editModeRef.current) {
      const grid = clientToGrid(e.clientX, e.clientY);
      if (grid) {
        const sorted = editModeRef.current.entries
          .filter((entry) => entry.placed)
          .sort(
            (a, b) =>
              b.gx +
              b.gy +
              BUILDING_CATALOG[b.type].size -
              (a.gx + a.gy + BUILDING_CATALOG[a.type].size)
          );
        const hit = sorted.find((entry) => {
          const s = BUILDING_CATALOG[entry.type].size;
          return (
            grid.gx >= entry.gx &&
            grid.gx <= entry.gx + s &&
            grid.gy >= entry.gy &&
            grid.gy <= entry.gy + s
          );
        });
        if (hit) {
          editDragRef.current = {
            active: true,
            buildingId: hit.id,
            fromTray: false,
            type: hit.type,
            startX: e.clientX,
            startY: e.clientY,
            moved: false,
          };
          return;
        }
      }
    }

    dragStateRef.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      camStartX: cameraRef.current.x,
      camStartY: cameraRef.current.y,
    };
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const grid = clientToGrid(e.clientX, e.clientY);
    hoverGridRef.current = grid;

    if (editDragRef.current?.active) return;

    if (!dragStateRef.current.active) return;
    const dx = e.clientX - dragStateRef.current.startX;
    const dy = e.clientY - dragStateRef.current.startY;
    if (Math.hypot(dx, dy) > 6) {
      dragStateRef.current.moved = true;
      cameraRef.current.x = Math.max(
        -560,
        Math.min(560, dragStateRef.current.camStartX - dx / cameraRef.current.zoom)
      );
      cameraRef.current.y = Math.max(
        -340,
        Math.min(340, dragStateRef.current.camStartY - dy / cameraRef.current.zoom)
      );
    }
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (editDragRef.current?.active) {
      dragStateRef.current.active = false;
      finalizeEditDrag(e.clientX, e.clientY);
      return;
    }

    const wasMoved = dragStateRef.current.moved;
    dragStateRef.current.active = false;
    if (wasMoved || screen !== 'playing') return;

    const grid = clientToGrid(e.clientX, e.clientY);
    if (!grid) return;

    if (mode === 'battle' && battleRef.current) {
      const res = deployCardAt(battleRef.current, grid.gx, grid.gy, poolsRef.current);
      if (!res.deployed && res.reason) {
        showToast(res.reason);
      }
      syncBattleSnapshot();
      return;
    }

    // Edit Mode tap-to-place from tray or tap-to-move selected building
    if (editModeRef.current) {
      const curEdit = editModeRef.current;
      if (curEdit.activeTrayType) {
        const nextStashed = curEdit.entries.find(
          (entry) => !entry.placed && entry.type === curEdit.activeTrayType
        );
        if (nextStashed) {
          const size = BUILDING_CATALOG[nextStashed.type].size;
          const gx = Math.floor(grid.gx - size / 2 + 0.5);
          const gy = Math.floor(grid.gy - size / 2 + 0.5);
          const res = placeOrMoveBuildingInEdit(curEdit, nextStashed.id, gx, gy);
          if (res.ok) {
            setEditMode(res.next);
            sound.playBuildPlace();
          } else {
            showToast(res.reason);
          }
        }
        return;
      }

      if (curEdit.selectedId) {
        const sel = curEdit.entries.find(
          (entry) => entry.placed && entry.id === curEdit.selectedId
        );
        if (sel) {
          const size = BUILDING_CATALOG[sel.type].size;
          const gx = Math.floor(grid.gx - size / 2 + 0.5);
          const gy = Math.floor(grid.gy - size / 2 + 0.5);
          const res = placeOrMoveBuildingInEdit(curEdit, sel.id, gx, gy);
          if (res.ok) {
            setEditMode(res.next);
            sound.playBuildPlace();
          } else {
            showToast(res.reason);
          }
        }
        return;
      }

      setEditMode((prev) => (prev ? { ...prev, selectedId: null } : null));
      return;
    }

    // Village mode click
    const nowEpoch = Date.now();
    if (placingType) {
      const size = BUILDING_CATALOG[placingType].size;
      const gx = Math.floor(grid.gx - size / 2 + 0.5);
      const gy = Math.floor(grid.gy - size / 2 + 0.5);
      const res = startPlaceNewBuilding(villageRef.current, placingType, gx, gy, nowEpoch);
      if (res.ok) {
        const nextWithMission = recordMissionProgress(res.next, 'upgrade_or_build', 1);
        villageRef.current = nextWithMission;
        setVillage(nextWithMission);
        setSelectedBuildingId(res.buildingId);
        // Keep placing walls continuously for smooth CoC wall building!
        if (placingType !== 'wall') {
          setPlacingType(null);
        }
        sound.playBuildPlace();
      } else {
        showToast(res.reason);
      }
      return;
    }

    if (movingBuildingId) {
      const b = villageRef.current.buildings.find((x) => x.id === movingBuildingId);
      if (b) {
        const size = BUILDING_CATALOG[b.type].size;
        const gx = Math.floor(grid.gx - size / 2 + 0.5);
        const gy = Math.floor(grid.gy - size / 2 + 0.5);
        const res = moveBuilding(villageRef.current, movingBuildingId, gx, gy);
        if (res.ok) {
          villageRef.current = res.next;
          setVillage(res.next);
          setMovingBuildingId(null);
          sound.playBuildPlace();
        } else {
          showToast(res.reason);
        }
      }
      return;
    }

    // Hit test buildings (front-most first by gx + gy)
    const sorted = [...villageRef.current.buildings].sort(
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
      // Quick collect if clicking a ready mine/collector
      if (
        (hit.type === 'gold_mine' || hit.type === 'elixir_collector') &&
        (hit.storedResource ?? 0) >= 12 &&
        hit.upgradingToLevel === undefined
      ) {
        const col = collectBuildingResource(villageRef.current, hit.id);
        if (col.collectedAmount > 0) {
          const kind = col.resourceType === 'gold' ? 'collect_gold' : 'collect_elixir';
          const nextWithMission = recordMissionProgress(col.next, kind, col.collectedAmount);
          villageRef.current = nextWithMission;
          setVillage(nextWithMission);
          if (col.resourceType === 'gold') sound.playCollectGold();
          else sound.playCollectElixir();
          showToast(
            `收集 +${col.collectedAmount} ${col.resourceType === 'gold' ? '金币' : '圣水'}`
          );
          setSelectedBuildingId(hit.id);
          return;
        }
      }
      sound.playClick();
      setSelectedBuildingId(hit.id);
    } else {
      setSelectedBuildingId(null);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    cameraRef.current.zoom = Math.max(0.55, Math.min(1.75, cameraRef.current.zoom + delta));
  };

  // Village action handlers
  const handleCollectAll = () => {
    let current = villageRef.current;
    let totalGold = 0;
    let totalElixir = 0;
    for (const b of current.buildings) {
      if ((b.storedResource ?? 0) >= 1 && b.upgradingToLevel === undefined) {
        const res = collectBuildingResource(current, b.id);
        current = res.next;
        if (res.resourceType === 'gold') totalGold += res.collectedAmount;
        if (res.resourceType === 'elixir') totalElixir += res.collectedAmount;
      }
    }
    if (totalGold > 0 || totalElixir > 0) {
      if (totalGold > 0) {
        current = recordMissionProgress(current, 'collect_gold', totalGold);
      }
      if (totalElixir > 0) {
        current = recordMissionProgress(current, 'collect_elixir', totalElixir);
      }
      villageRef.current = current;
      setVillage(current);
      if (totalGold >= totalElixir) sound.playCollectGold();
      else sound.playCollectElixir();
      const parts = [];
      if (totalGold > 0) parts.push(`+${totalGold} 金币`);
      if (totalElixir > 0) parts.push(`+${totalElixir} 圣水`);
      showToast(`已收集 ${parts.join(' · ')}`);
    } else {
      showToast('仓库已满或暂无可收集资源');
    }
  };

  const handleCollectBuilding = (id: string) => {
    const res = collectBuildingResource(villageRef.current, id);
    if (res.collectedAmount > 0) {
      const kind = res.resourceType === 'gold' ? 'collect_gold' : 'collect_elixir';
      const nextWithMission = recordMissionProgress(res.next, kind, res.collectedAmount);
      villageRef.current = nextWithMission;
      setVillage(nextWithMission);
      if (res.resourceType === 'gold') sound.playCollectGold();
      else sound.playCollectElixir();
      showToast(`收集 +${res.collectedAmount} ${res.resourceType === 'gold' ? '金币' : '圣水'}`);
    } else {
      showToast('仓库已满，请升级储金罐或圣水瓶');
    }
  };

  const handleUpgradeBuilding = (id: string) => {
    const res = startUpgradeBuilding(villageRef.current, id, Date.now());
    if (res.ok) {
      const nextWithMission = recordMissionProgress(res.next, 'upgrade_or_build', 1);
      villageRef.current = nextWithMission;
      setVillage(nextWithMission);
      sound.playBuildPlace();
    } else {
      showToast(res.reason);
    }
  };

  const handleFinishWithGems = (id: string) => {
    const res = finishUpgradeWithGems(villageRef.current, id, Date.now());
    if (res.ok) {
      villageRef.current = res.next;
      setVillage(res.next);
      sound.playUpgradeComplete();
    } else {
      showToast(res.reason);
    }
  };

  // Start Campaign or Multiplayer Battle
  const launchBattle = (params: {
    targetName: string;
    targetTH: number;
    isCampaign: boolean;
    campaignStageId?: number;
    rewardGold: number;
    rewardElixir: number;
    buildings: Array<{ type: BuildingType; level: number; gx: number; gy: number }>;
  }) => {
    sound.unlockAudio();
    sound.playClick();
    poolsRef.current = createVFXPools();
    const bState = createBattleState({
      targetName: params.targetName,
      targetTH: params.targetTH,
      isCampaign: params.isCampaign,
      campaignStageId: params.campaignStageId,
      rewardGold: params.rewardGold,
      rewardElixir: params.rewardElixir,
      layout: params.buildings,
      playerVillage: villageRef.current,
    });
    battleRef.current = bState;
    battleResultAppliedRef.current = false;
    cameraRef.current = { x: 0, y: 0, zoom: 0.95 };
    setAttackOpen(false);
    setClanCastleOpen(false);
    setClanChatOpen(false);
    setMissionsOpen(false);
    setSettingsOpen(false);
    setWechatPublishOpen(false);
    setSelectedBuildingId(null);
    setPlacingType(null);
    setMovingBuildingId(null);
    setEditMode(null);
    setEditDraggingId(null);
    editDragRef.current = null;
    setMode('battle');
    setScreen('playing');
    syncBattleSnapshot();
  };

  const appendClanChatEntries = useCallback((entries: ClanChatEntry[], notifyUnread = true) => {
    if (entries.length === 0) return;
    setClanChatMessages((prev) => [...prev.slice(-40), ...entries]);
    if (notifyUnread && !clanChatOpenRef.current) {
      setUnreadClanMessages((prev) => prev + entries.length);
    }
  }, []);

  const handleRequestClanReinforcements = useCallback(
    (preference: ReinforcementPreference) => {
      const now = Date.now();
      const res = requestClanReinforcements(villageRef.current, preference, now);
      setNowMs(now);
      if (res.ok) {
        villageRef.current = res.next;
        setVillage(res.next);
        setRecentDonations(res.donations);
        const donationEntries = formatDonationChatEntries(
          res.donations,
          res.next.clanName,
          now
        );
        appendClanChatEntries(donationEntries);
        const addedSpace = res.donations.reduce(
          (sum, d) => sum + TROOP_CATALOG[d.troopType].housingSpace * d.count,
          0
        );
        sound.playUpgradeComplete();
        showToast(`联盟增援已抵达！共进驻 +${addedSpace} 人口精锐部队`);
      } else {
        showToast(res.reason);
      }
    },
    [appendClanChatEntries, showToast]
  );

  const handleSendClanMessage = useCallback(
    (text: string) => {
      const now = Date.now();
      const ownMsg: ClanChatEntry = {
        id: `own_${now}_${Math.random().toString(36).slice(2, 6)}`,
        kind: 'chat',
        senderName: '我（部落首领）',
        text,
        timestampMs: now,
        isOwn: true,
      };
      appendClanChatEntries([ownMsg], false);
      sound.playClick();

      if (clanReplyTimerRef.current !== null) {
        window.clearTimeout(clanReplyTimerRef.current);
      }
      const allianceSnapshot = villageRef.current.clanName;
      clanReplyTimerRef.current = window.setTimeout(() => {
        const reply = createSimulatedAllianceReply(allianceSnapshot, text, Date.now());
        appendClanChatEntries([reply], true);
      }, 650);
    },
    [appendClanChatEntries]
  );

  const handleEndBattleEarly = () => {
    if (!battleRef.current) return;
    finalizeBattle(battleRef.current);
    commitFinishedBattleResult();
    setScreen('gameover');
    syncBattleSnapshot();
  };

  const handleReturnHomeFromBattle = () => {
    commitFinishedBattleResult();

    battleRef.current = null;
    battleResultAppliedRef.current = false;
    setBattleHudSnapshot(null);
    cameraRef.current = { x: 0, y: 0, zoom: 1.05 };
    setMode('village');
    setScreen('playing');
  };

  const selectedBuilding =
    village.buildings.find((b) => b.id === selectedBuildingId) ?? null;

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#1c2e16]">
      {/* Isolated Canvas Container (never unmounted) */}
      <div
        ref={containerRef}
        data-testid="game-viewport"
        className="absolute inset-0 w-full h-full"
      >
        <canvas
          ref={canvasRef}
          data-testid="game-canvas"
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
          onPointerLeave={() => {
            dragStateRef.current.active = false;
            hoverGridRef.current = null;
          }}
          onWheel={handleWheel}
          className="block w-full h-full cursor-grab active:cursor-grabbing touch-none"
        />
      </div>

      {/* Title Screen */}
      {screen === 'title' && (
        <TitleScreen
          onStart={handleStartFromTitle}
          onOpenWechatPublish={() => {
            sound.unlockAudio();
            sound.playClick();
            setWechatPublishOpen(true);
          }}
          isPublishOpen={wechatPublishOpen}
          hasSavedProgress={hasSavedProgress}
        />
      )}

      {/* Home Village HUD (hidden while Village Edit Mode is open) */}
      {screen !== 'title' && mode === 'village' && !editMode && (
        <VillageHUD
          village={village}
          nowMs={nowMs}
          muted={muted}
          selectedBuilding={selectedBuilding}
          placingType={placingType}
          movingBuildingId={movingBuildingId}
          toastMessage={toastMessage}
          claimableMissions={getClaimableMissionCount(village)}
          clanChatOpen={clanChatOpen}
          unreadClanMessages={unreadClanMessages}
          onToggleMute={handleToggleMute}
          onOpenSettings={() => {
            sound.unlockAudio();
            sound.playClick();
            setSettingsOpen(true);
          }}
          onPause={() => setScreen('paused')}
          onZoom={(delta) => {
            cameraRef.current.zoom = Math.max(
              0.55,
              Math.min(1.75, cameraRef.current.zoom + delta)
            );
          }}
          onOpenShop={() => {
            sound.playClick();
            setShopOpen(true);
          }}
          onOpenBarracks={() => {
            sound.playClick();
            barracksSessionQueueRef.current = { army: {}, spells: {} };
            setBarracksOpen(true);
          }}
          onOpenClanCastle={() => {
            sound.playClick();
            setClanCastleOpen(true);
          }}
          onToggleClanChat={() => {
            sound.playClick();
            setClanChatOpen((prev) => !prev);
          }}
          onOpenMissions={() => {
            sound.playClick();
            setMissionsOpen(true);
          }}
          onOpenAttack={() => {
            sound.playClick();
            setAttackOpen(true);
          }}
          onCollectAll={handleCollectAll}
          onCollectBuilding={handleCollectBuilding}
          onUpgradeBuilding={handleUpgradeBuilding}
          onFinishWithGems={handleFinishWithGems}
          onStartMoveBuilding={(id) => {
            setMovingBuildingId(id);
            setSelectedBuildingId(null);
          }}
          onEnterEditMode={() => {
            sound.playClick();
            setShopOpen(false);
            setBarracksOpen(false);
            setClanCastleOpen(false);
            setClanChatOpen(false);
            setMissionsOpen(false);
            setAttackOpen(false);
            setSettingsOpen(false);
            setSelectedBuildingId(null);
            setPlacingType(null);
            setMovingBuildingId(null);
            setEditDraggingId(null);
            editDragRef.current = null;
            setEditMode(createEditModeState(villageRef.current));
          }}
          onCancelPlacementOrMove={() => {
            setPlacingType(null);
            setMovingBuildingId(null);
          }}
          onDeselect={() => setSelectedBuildingId(null)}
        />
      )}

      {/* Village Edit Mode Overlay */}
      {screen !== 'title' && mode === 'village' && editMode && (
        <VillageEditBar
          village={village}
          editState={editMode}
          draggingId={editDraggingId}
          toastMessage={toastMessage}
          onHideAll={() => {
            sound.playClick();
            setEditDraggingId(null);
            editDragRef.current = null;
            setEditMode((prev) => (prev ? hideAllBuildingsInEdit(prev) : null));
            showToast('已暂时隐藏全部建筑，请从下方栏位拖拽放置到网格');
          }}
          onHideSelected={(id) => {
            sound.playClick();
            setEditMode((prev) => (prev ? hideBuildingInEdit(prev, id) : null));
          }}
          onRestoreOriginal={() => {
            sound.playClick();
            setEditDraggingId(null);
            editDragRef.current = null;
            setEditMode(restoreAllBuildingsInEdit(villageRef.current));
            showToast('已还原为编辑前的村庄阵型');
          }}
          onCancel={() => {
            sound.playClick();
            setEditDraggingId(null);
            editDragRef.current = null;
            setEditMode(null);
          }}
          onSave={() => {
            if (!editModeRef.current) return;
            const res = applyEditLayoutToVillage(villageRef.current, editModeRef.current);
            if (!res.ok) {
              showToast(res.reason);
              return;
            }
            villageRef.current = res.next;
            setVillage(res.next);
            setEditDraggingId(null);
            editDragRef.current = null;
            setEditMode(null);
            sound.playUpgradeComplete();
            showToast('村庄阵型已保存，资源生产状态未受影响');
          }}
          onSelectTrayType={(type) => {
            sound.playClick();
            setEditMode((prev) =>
              prev ? { ...prev, activeTrayType: type, selectedId: null } : null
            );
          }}
          onStartTrayDrag={(buildingId, type, e) => {
            editDragRef.current = {
              active: true,
              buildingId,
              fromTray: true,
              type,
              startX: e.clientX,
              startY: e.clientY,
              moved: false,
            };
            setEditMode((prev) =>
              prev ? { ...prev, activeTrayType: type, selectedId: null } : null
            );
          }}
          onClearSelection={() =>
            setEditMode((prev) => (prev ? { ...prev, selectedId: null } : null))
          }
          onZoom={(delta) => {
            cameraRef.current.zoom = Math.max(
              0.55,
              Math.min(1.75, cameraRef.current.zoom + delta)
            );
          }}
        />
      )}

      {/* Active Battle HUD */}
      {screen !== 'title' && mode === 'battle' && battleHudSnapshot && (
        <BattleHUD
          battle={battleHudSnapshot}
          muted={muted}
          toastMessage={toastMessage}
          onSelectCard={(card) => {
            if (battleRef.current) {
              battleRef.current.selectedCard = card;
              syncBattleSnapshot();
            }
          }}
          onEndBattle={handleEndBattleEarly}
          onToggleMute={handleToggleMute}
          onOpenSettings={() => {
            sound.unlockAudio();
            sound.playClick();
            setSettingsOpen(true);
          }}
          onPause={() => setScreen('paused')}
        />
      )}

      {/* Shop Modal */}
      {shopOpen && mode === 'village' && (
        <ShopModal
          village={village}
          onClose={() => setShopOpen(false)}
          onSelectBuilding={(type) => {
            sound.playClick();
            setShopOpen(false);
            setSelectedBuildingId(null);
            setMovingBuildingId(null);
            setPlacingType(type);
          }}
        />
      )}

      {/* Barracks Modal */}
      {barracksOpen && mode === 'village' && (
        <BarracksModal
          village={village}
          onClose={() => {
            barracksSessionQueueRef.current = { army: {}, spells: {} };
            setBarracksOpen(false);
          }}
          onTrainTroop={(tType: TroopType) => {
            const res = trainTroop(villageRef.current, tType);
            if (res.ok) {
              barracksSessionQueueRef.current = {
                ...barracksSessionQueueRef.current,
                army: {
                  ...barracksSessionQueueRef.current.army,
                  [tType]: (barracksSessionQueueRef.current.army[tType] ?? 0) + 1,
                },
              };
              const nextWithMission = recordMissionProgress(
                {
                  ...res.next,
                  lastTrainingQueue: cloneTrainingQueue(barracksSessionQueueRef.current),
                },
                'train_troops',
                1
              );
              villageRef.current = nextWithMission;
              setVillage(nextWithMission);
              sound.playClick();
            } else {
              showToast(res.reason);
            }
          }}
          onDismissTroop={(tType: TroopType) => {
            const next = dismissTroop(villageRef.current, tType);
            villageRef.current = next;
            setVillage(next);
            sound.playClick();
          }}
          onBrewSpell={(sType: SpellType) => {
            const res = brewSpell(villageRef.current, sType);
            if (res.ok) {
              barracksSessionQueueRef.current = {
                ...barracksSessionQueueRef.current,
                spells: {
                  ...barracksSessionQueueRef.current.spells,
                  [sType]: (barracksSessionQueueRef.current.spells[sType] ?? 0) + 1,
                },
              };
              const nextVillage: VillageState = {
                ...res.next,
                lastTrainingQueue: cloneTrainingQueue(barracksSessionQueueRef.current),
              };
              villageRef.current = nextVillage;
              setVillage(nextVillage);
              sound.playSpellCast(sType === 'heal');
            } else {
              showToast(res.reason);
            }
          }}
          onDismissSpell={(sType: SpellType) => {
            const next = dismissSpell(villageRef.current, sType);
            villageRef.current = next;
            setVillage(next);
            sound.playClick();
          }}
          onRepeatLastQueue={() => {
            const res = repeatTrainingQueue(
              villageRef.current,
              villageRef.current.lastTrainingQueue
            );
            if (res.ok) {
              let nextVillage = res.next;
              if (res.trainedTroopsCount > 0) {
                nextVillage = recordMissionProgress(
                  nextVillage,
                  'train_troops',
                  res.trainedTroopsCount
                );
              }
              villageRef.current = nextVillage;
              setVillage(nextVillage);
              sound.playUpgradeComplete();
              const parts: string[] = [];
              if (res.trainedTroopsCount > 0) parts.push(`+${res.trainedTroopsCount} 士兵`);
              if (res.brewedSpellsCount > 0) parts.push(`+${res.brewedSpellsCount} 法术`);
              showToast(`已一键重复训练：${parts.join('、')}`);
            } else {
              showToast(res.reason);
            }
          }}
        />
      )}

      {/* Floating Clan Chat Overlay */}
      {screen !== 'title' && mode === 'village' && clanChatOpen && (
        <ClanChat
          village={village}
          nowMs={nowMs}
          messages={clanChatMessages}
          onClose={() => setClanChatOpen(false)}
          onSendMessage={handleSendClanMessage}
          onQuickRequestReinforcements={() => handleRequestClanReinforcements('balanced')}
          onOpenClanCastle={() => {
            sound.playClick();
            setClanCastleOpen(true);
          }}
        />
      )}

      {/* Clan Castle Modal */}
      {clanCastleOpen && mode === 'village' && (
        <ClanCastleModal
          village={village}
          nowMs={nowMs}
          recentDonations={recentDonations}
          onClose={() => setClanCastleOpen(false)}
          onJoinAlliance={(allianceName) => {
            if (clanReplyTimerRef.current !== null) {
              window.clearTimeout(clanReplyTimerRef.current);
              clanReplyTimerRef.current = null;
            }
            const next = joinSimulatedAlliance(villageRef.current, allianceName);
            villageRef.current = next;
            setVillage(next);
            setRecentDonations([]);
            setClanChatMessages(createInitialClanChatMessages(allianceName, Date.now()));
            if (!clanChatOpenRef.current) setUnreadClanMessages(2);
            sound.playClick();
            showToast(`已加入联盟「${allianceName}」`);
          }}
          onRequestReinforcements={handleRequestClanReinforcements}
          onDismissReinforcement={(tType) => {
            const next = dismissClanReinforcement(villageRef.current, tType);
            villageRef.current = next;
            setVillage(next);
            sound.playClick();
          }}
          onOpenShop={() => setShopOpen(true)}
        />
      )}

      {/* Attack Selector Modal */}
      {attackOpen && mode === 'village' && (
        <AttackSelectorModal
          village={village}
          onClose={() => setAttackOpen(false)}
          onStartCampaign={(stage: CampaignStage) =>
            launchBattle({
              targetName: stage.name,
              targetTH: stage.recommendedTH,
              isCampaign: true,
              campaignStageId: stage.id,
              rewardGold: stage.rewardGold,
              rewardElixir: stage.rewardElixir,
              buildings: stage.buildings,
            })
          }
          onStartMultiplayer={(opp) =>
            launchBattle({
              targetName: opp.name,
              targetTH: opp.thLevel,
              isCampaign: false,
              rewardGold: opp.rewardGold,
              rewardElixir: opp.rewardElixir,
              buildings: opp.buildings,
            })
          }
        />
      )}

      {/* Daily Missions Modal */}
      {missionsOpen && mode === 'village' && (
        <DailyMissionsModal
          dailyMissions={ensureDailyMissions(village).dailyMissions!}
          onClose={() => setMissionsOpen(false)}
          onClaim={(missionId) => {
            const res = claimDailyMissionReward(villageRef.current, missionId);
            if (res.ok) {
              villageRef.current = res.next;
              setVillage(res.next);
              if (res.rewardType === 'gold') sound.playCollectGold();
              else if (res.rewardType === 'elixir') sound.playCollectElixir();
              else sound.playUpgradeComplete();
              const label =
                res.rewardType === 'gold'
                  ? '金币'
                  : res.rewardType === 'elixir'
                    ? '圣水'
                    : '宝石';
              showToast(`领取每日任务奖励：+${res.rewardAmount} ${label}`);
            } else {
              showToast(res.reason);
            }
          }}
        />
      )}

      {/* Battle Result Modal */}
      {screen === 'gameover' && mode === 'battle' && battleHudSnapshot?.result && (
        <BattleResultModal
          result={battleHudSnapshot.result}
          onReturnHome={handleReturnHomeFromBattle}
        />
      )}

      {/* Settings Modal */}
      {settingsOpen && screen !== 'title' && (
        <SettingsModal
          muted={muted}
          bgmVolume={bgmVolume}
          activeTrack={resolveBgmTrack(screen, mode)}
          onToggleMute={handleToggleMute}
          onChangeBgmVolume={handleChangeBgmVolume}
          onOpenWechatPublish={() => {
            sound.playClick();
            setSettingsOpen(false);
            setWechatPublishOpen(true);
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {/* WeChat Mini Game One-Click Publish Modal */}
      {wechatPublishOpen && (
        <WechatPublishModal
          onClose={() => setWechatPublishOpen(false)}
          onNotify={showToast}
        />
      )}

      {/* Pause Modal */}
      {screen === 'paused' && (
        <PauseModal
          mode={mode}
          muted={muted}
          bgmVolume={bgmVolume}
          onToggleMute={handleToggleMute}
          onChangeBgmVolume={handleChangeBgmVolume}
          onResume={() => setScreen('playing')}
          onSaveNow={() => {
            flushSaveNow();
            sound.playClick();
            showToast('当前记录已保存至本地存档');
          }}
          onResetVillage={() => {
            const fresh = ensureDailyMissions(createInitialVillage());
            skipNextAutoSaveRef.current = true;
            clearVillageSave();
            villageRef.current = fresh;
            setVillage(fresh);
            setHasSavedProgress(false);
            setSelectedBuildingId(null);
            setPlacingType(null);
            setMovingBuildingId(null);
            setEditMode(null);
            setEditDraggingId(null);
            editDragRef.current = null;
            setClanCastleOpen(false);
            setClanChatOpen(false);
            setClanChatMessages(createInitialClanChatMessages(fresh.clanName));
            setUnreadClanMessages(2);
            setRecentDonations([]);
            setMissionsOpen(false);
            setSettingsOpen(false);
            setScreen('playing');
            showToast('村庄已重置为初始状态');
          }}
          onQuitToTitle={() => {
            flushSaveNow();
            battleRef.current = null;
            battleResultAppliedRef.current = false;
            setBattleHudSnapshot(null);
            setEditMode(null);
            setEditDraggingId(null);
            editDragRef.current = null;
            setClanCastleOpen(false);
            setClanChatOpen(false);
            setSettingsOpen(false);
            setMode('village');
            setScreen('title');
          }}
        />
      )}
    </main>
  );
}
