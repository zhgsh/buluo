import {
  BUILDING_CATALOG,
  CAMPAIGN_STAGES,
  SPELL_CATALOG,
  SPELL_ORDER,
  TROOP_CATALOG,
  TROOP_ORDER,
  generateMultiplayerOpponent,
} from '../game/catalog';
import { getBuildingSprite } from '../game/buildingAssets';
import {
  getAllianceByName,
  getClanRequestCooldownState,
  SIMULATED_ALLIANCES,
  type ClanDonationEvent,
  type ReinforcementPreference,
} from '../game/clanLogic';
import {
  ensureDailyMissions,
  getClaimableMissionCount,
} from '../game/dailyMissions';
import { getTroopSprite } from '../game/troopAssets';
import type {
  BattleState,
  BuildingCategory,
  BuildingType,
  GameScreenState,
  PlayMode,
  PlacedBuilding,
  SpellType,
  TroopType,
  VillageState,
} from '../game/types';
import {
  getBuildingCountByType,
  getBusyBuilderCount,
  getResourceCaps,
  getUsedClanSpace,
  getUsedSpellSpace,
  getUsedTroopSpace,
} from '../game/villageLogic';

export type WechatModalType =
  | 'none'
  | 'shop'
  | 'barracks'
  | 'clan_castle'
  | 'missions'
  | 'attack'
  | 'settings';

export interface HitRegion {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  onTap: () => void;
}

export interface WechatUIState {
  screen: GameScreenState;
  mode: PlayMode;
  hasSavedProgress: boolean;
  village: VillageState;
  battle: BattleState | null;
  nowMs: number;
  modal: WechatModalType;
  shopCategory: BuildingCategory;
  attackTab: 'campaign' | 'multiplayer';
  multiplayerSeed: number;
  clanPreference: ReinforcementPreference;
  recentDonations: ClanDonationEvent[];
  selectedBuildingId: string | null;
  placingType: BuildingType | null;
  movingBuildingId: string | null;
  muted: boolean;
  bgmVolume: number;
  toastText: string | null;
}

export interface WechatUIActions {
  onStartGame: () => void;
  onOpenModal: (modal: WechatModalType) => void;
  onCloseModal: () => void;
  onToggleMute: () => void;
  onCycleBgmVolume: () => void;
  onCollectAll: () => void;
  onZoomDelta: (delta: number) => void;
  onSetShopCategory: (cat: BuildingCategory) => void;
  onSelectShopBuilding: (type: BuildingType) => void;
  onCancelPlacementOrMove: () => void;
  onCollectBuilding: (id: string) => void;
  onUpgradeBuilding: (id: string) => void;
  onFinishWithGems: (id: string) => void;
  onStartMoveBuilding: (id: string) => void;
  onTrainTroop: (t: TroopType) => void;
  onDismissTroop: (t: TroopType) => void;
  onBrewSpell: (s: SpellType) => void;
  onDismissSpell: (s: SpellType) => void;
  onJoinAlliance: (name: string) => void;
  onSetClanPreference: (pref: ReinforcementPreference) => void;
  onRequestReinforcements: () => void;
  onDismissReinforcement: (t: TroopType) => void;
  onClaimMission: (missionId: string) => void;
  onSetAttackTab: (tab: 'campaign' | 'multiplayer') => void;
  onRerollOpponent: () => void;
  onStartCampaign: (stageId: number) => void;
  onStartMultiplayer: () => void;
  onSelectBattleCard: (card: NonNullable<BattleState['selectedCard']>) => void;
  onEndBattleEarly: () => void;
  onReturnHomeFromBattle: () => void;
  onSaveNow: () => void;
  onResetVillage: () => void;
}

export interface UILayoutMetrics {
  width: number;
  height: number;
  safeLeft: number;
  safeRight: number;
  safeTop: number;
  safeBottom: number;
}

export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function fillPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  bg = 'rgba(42, 28, 17, 0.94)',
  border = '#7c5329',
  radius = 12,
  borderWidth = 2
): void {
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.lineWidth = borderWidth;
  ctx.strokeStyle = border;
  ctx.stroke();
}

function drawButton(
  ctx: CanvasRenderingContext2D,
  hits: HitRegion[],
  opts: {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
    label: string;
    sublabel?: string;
    bgTop?: string;
    bgBot?: string;
    border?: string;
    textColor?: string;
    disabled?: boolean;
    badge?: string;
    progressRatio?: number;
    onTap: () => void;
  }
): void {
  const {
    id,
    x,
    y,
    w,
    h,
    label,
    sublabel,
    bgTop = '#4c321c',
    bgBot = '#2a1c11',
    border = '#8b5e34',
    textColor = '#fef3c7',
    disabled = false,
    badge,
    progressRatio,
    onTap,
  } = opts;

  ctx.save();
  roundRectPath(ctx, x, y, w, h, 10);
  if (disabled) {
    ctx.fillStyle = '#24170d';
  } else {
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, bgTop);
    grad.addColorStop(1, bgBot);
    ctx.fillStyle = grad;
  }
  ctx.fill();

  if (typeof progressRatio === 'number' && progressRatio > 0 && progressRatio < 1) {
    ctx.save();
    roundRectPath(ctx, x, y, w, h, 10);
    ctx.clip();
    ctx.fillStyle = 'rgba(56, 189, 248, 0.28)';
    ctx.fillRect(x, y, w * Math.max(0, Math.min(1, progressRatio)), h);
    ctx.restore();
  }

  ctx.lineWidth = 2;
  ctx.strokeStyle = disabled ? '#4a311b' : border;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = disabled ? 'rgba(252, 211, 77, 0.45)' : textColor;
  if (sublabel) {
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(label, x + w / 2, y + h * 0.38);
    ctx.font = 'bold 10px sans-serif';
    ctx.fillStyle = disabled ? 'rgba(252, 211, 77, 0.35)' : 'rgba(254, 243, 199, 0.85)';
    ctx.fillText(sublabel, x + w / 2, y + h * 0.7);
  } else {
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(label, x + w / 2, y + h / 2);
  }

  if (badge) {
    ctx.fillStyle = '#ef4444';
    roundRectPath(ctx, x + w - 22, y - 5, 22, 16, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText(badge, x + w - 11, y + 3);
  }
  ctx.restore();

  if (!disabled) {
    hits.push({ id, x, y, w, h, onTap });
  }
}

function drawGoldCoinIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r = 7): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#facc15';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#92400e';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx - r * 0.25, cy - r * 0.25, r * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = '#fef9c3';
  ctx.fill();
  ctx.restore();
}

function drawElixirDropIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r = 7): void {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.quadraticCurveTo(cx + r, cy + r * 0.1, cx + r * 0.72, cy + r * 0.65);
  ctx.quadraticCurveTo(cx, cy + r * 1.15, cx - r * 0.72, cy + r * 0.65);
  ctx.quadraticCurveTo(cx - r, cy + r * 0.1, cx, cy - r);
  ctx.closePath();
  ctx.fillStyle = '#e879f9';
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = '#701a75';
  ctx.stroke();
  ctx.restore();
}

function drawGemIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r = 7): void {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r * 0.85, cy);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r * 0.85, cy);
  ctx.closePath();
  ctx.fillStyle = '#34d399';
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = '#065f46';
  ctx.stroke();
  ctx.restore();
}

function renderTitleOverlay(
  ctx: CanvasRenderingContext2D,
  m: UILayoutMetrics,
  state: WechatUIState,
  actions: WechatUIActions,
  hits: HitRegion[]
): void {
  const cardW = Math.min(360, m.width - 48);
  const cardH = 220;
  const x = m.safeLeft + 24;
  const y = (m.height - cardH) / 2;

  fillPanel(ctx, x, y, cardW, cardH, 'rgba(28, 18, 10, 0.92)', '#d97706', 18, 3);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#fcd34d';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('微信小游戏版 · WECHAT MINI GAME', x + 22, y + 20);

  ctx.fillStyle = '#fef3c7';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('部落冲突', x + 22, y + 42);

  ctx.fillStyle = '#d6b48c';
  ctx.font = '12px sans-serif';
  ctx.fillText('建设等距村庄 · 联盟援军 · 实时攻防战役', x + 22, y + 80);
  ctx.fillText(
    state.hasSavedProgress
      ? `本地存档已就绪 · 大本营 Lv.${state.village.townHallLevel} · ${state.village.trophies} 杯`
      : '首次启动 · 点击下方按钮立即进入村庄',
    x + 22,
    y + 104
  );

  drawButton(ctx, hits, {
    id: 'title_start',
    x: x + 22,
    y: y + 146,
    w: cardW - 44,
    h: 50,
    label: state.hasSavedProgress ? '继续建设村庄' : '进入部落村庄',
    bgTop: '#f59e0b',
    bgBot: '#b45309',
    border: '#fde68a',
    textColor: '#1c120a',
    onTap: actions.onStartGame,
  });
}

function renderVillageTopAndDock(
  ctx: CanvasRenderingContext2D,
  m: UILayoutMetrics,
  state: WechatUIState,
  actions: WechatUIActions,
  hits: HitRegion[]
): void {
  const v = state.village;
  const caps = getResourceCaps(v);
  const usedTroops = getUsedTroopSpace(v.army);
  const usedClan = getUsedClanSpace(v.clanReinforcements);
  const busyBuilders = getBusyBuilderCount(v);
  const claimable = getClaimableMissionCount(v);

  const left = m.safeLeft + 10;
  const right = m.width - m.safeRight - 10;
  const top = m.safeTop + 10;

  // Top-left status pill
  fillPanel(ctx, left, top, 232, 40, 'rgba(42, 28, 17, 0.92)', '#7c5329', 10);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(`TH ${v.townHallLevel}`, left + 10, top + 20);
  ctx.fillStyle = '#fde68a';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(`🏆 ${v.trophies}`, left + 62, top + 20);
  ctx.fillStyle = '#e5e7eb';
  ctx.fillText(`工人 ${v.buildersTotal - busyBuilders}/${v.buildersTotal}`, left + 132, top + 20);

  // Top-right resources & audio buttons
  const resPanelW = 286;
  const btnGap = 6;
  const audioBtnSize = 36;
  const resX = right - resPanelW - (audioBtnSize + btnGap) * 2;
  if (resX > left + 236) {
    fillPanel(ctx, resX, top, resPanelW, 40, 'rgba(42, 28, 17, 0.92)', '#7c5329', 10);
    drawGoldCoinIcon(ctx, resX + 16, top + 20, 7);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`${Math.floor(v.gold)}`, resX + 28, top + 20);

    drawElixirDropIcon(ctx, resX + 112, top + 20, 7);
    ctx.fillStyle = '#f5d0fe';
    ctx.fillText(`${Math.floor(v.elixir)}`, resX + 124, top + 20);

    drawGemIcon(ctx, resX + 206, top + 20, 7);
    ctx.fillStyle = '#a7f3d0';
    ctx.fillText(`${v.gems}`, resX + 218, top + 20);
  }

  drawButton(ctx, hits, {
    id: 'hud_mute',
    x: right - audioBtnSize * 2 - btnGap,
    y: top + 2,
    w: audioBtnSize,
    h: audioBtnSize,
    label: state.muted ? '静音' : '声音',
    onTap: actions.onToggleMute,
  });

  drawButton(ctx, hits, {
    id: 'hud_settings',
    x: right - audioBtnSize,
    y: top + 2,
    w: audioBtnSize,
    h: audioBtnSize,
    label: '设置',
    onTap: () => actions.onOpenModal('settings'),
  });

  // Bottom dock (left actions + right shop/collect/zoom)
  const dockY = m.height - m.safeBottom - 54;
  const bw = Math.min(86, Math.floor((m.width - m.safeLeft - m.safeRight - 220) / 4));
  const gap = 6;

  drawButton(ctx, hits, {
    id: 'dock_attack',
    x: left,
    y: dockY,
    w: bw,
    h: 44,
    label: '进攻',
    sublabel: `${usedTroops}/${caps.maxTroopSpace}`,
    bgTop: '#ef4444',
    bgBot: '#991b1b',
    border: '#fca5a5',
    textColor: '#ffffff',
    onTap: () => actions.onOpenModal('attack'),
  });

  drawButton(ctx, hits, {
    id: 'dock_barracks',
    x: left + (bw + gap),
    y: dockY,
    w: bw,
    h: 44,
    label: '练兵',
    sublabel: `${usedTroops}/${caps.maxTroopSpace}`,
    bgTop: '#b45309',
    bgBot: '#78350f',
    border: '#fcd34d',
    onTap: () => actions.onOpenModal('barracks'),
  });

  drawButton(ctx, hits, {
    id: 'dock_clan',
    x: left + (bw + gap) * 2,
    y: dockY,
    w: bw,
    h: 44,
    label: '部落城堡',
    sublabel: caps.hasClanCastle ? `援军 ${usedClan}/${caps.maxClanSpace}` : '未建造',
    bgTop: '#0369a1',
    bgBot: '#0c4a6e',
    border: '#7dd3fc',
    onTap: () => actions.onOpenModal('clan_castle'),
  });

  drawButton(ctx, hits, {
    id: 'dock_missions',
    x: left + (bw + gap) * 3,
    y: dockY,
    w: bw,
    h: 44,
    label: '每日任务',
    sublabel: claimable > 0 ? `可领 ${claimable}` : '每日3项',
    badge: claimable > 0 ? String(claimable) : undefined,
    onTap: () => actions.onOpenModal('missions'),
  });

  // Right dock: zoom, collect all, shop
  drawButton(ctx, hits, {
    id: 'dock_shop',
    x: right - 76,
    y: dockY,
    w: 76,
    h: 44,
    label: '商店',
    sublabel: '建造设施',
    bgTop: '#d97706',
    bgBot: '#92400e',
    border: '#fde68a',
    onTap: () => actions.onOpenModal('shop'),
  });

  drawButton(ctx, hits, {
    id: 'dock_collect',
    x: right - 76 - 76 - 6,
    y: dockY,
    w: 76,
    h: 44,
    label: '一键收矿',
    bgTop: '#047857',
    bgBot: '#064e3b',
    border: '#6ee7b7',
    onTap: actions.onCollectAll,
  });

  drawButton(ctx, hits, {
    id: 'dock_zoom_out',
    x: right - 158 - 34,
    y: dockY,
    w: 32,
    h: 44,
    label: '-',
    onTap: () => actions.onZoomDelta(-0.15),
  });
  drawButton(ctx, hits, {
    id: 'dock_zoom_in',
    x: right - 158 - 70,
    y: dockY,
    w: 32,
    h: 44,
    label: '+',
    onTap: () => actions.onZoomDelta(0.15),
  });

  // Placement / move banner
  if (state.placingType || state.movingBuildingId) {
    const label = state.placingType
      ? `正在放置「${BUILDING_CATALOG[state.placingType].name}」· 点击草地确认`
      : '正在移动建筑 · 点击空地完成搬迁';
    const bannerW = Math.min(380, right - left - 20);
    const bx = (m.width - bannerW) / 2;
    const by = top + 48;
    fillPanel(ctx, bx, by, bannerW, 38, 'rgba(28, 18, 10, 0.94)', '#f59e0b', 10);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef3c7';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(label, bx + 12, by + 19);
    drawButton(ctx, hits, {
      id: 'cancel_place_move',
      x: bx + bannerW - 64,
      y: by + 5,
      w: 56,
      h: 28,
      label: '取消',
      bgTop: '#b91c1c',
      bgBot: '#7f1d1d',
      border: '#fca5a5',
      onTap: actions.onCancelPlacementOrMove,
    });
    return;
  }

  // Selected building floating inspector bar
  if (state.selectedBuildingId && state.modal === 'none') {
    const sel: PlacedBuilding | undefined = v.buildings.find(
      (b) => b.id === state.selectedBuildingId
    );
    if (sel) {
      const def = BUILDING_CATALOG[sel.type];
      const nextLv = def.levels[sel.level]; // index = level (next level)
      const isUpgrading = sel.upgradingToLevel !== undefined;
      const barW = Math.min(480, right - left);
      const bx = (m.width - barW) / 2;
      const by = dockY - 56;
      fillPanel(ctx, bx, by, barW, 48, 'rgba(28, 18, 10, 0.95)', '#d97706', 12);

      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fde68a';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(`${def.name} Lv.${sel.level}`, bx + 12, by + 24);

      let cursorX = bx + barW - 8;
      const addActionBtn = (id: string, label: string, sublabel: string | undefined, onTap: () => void, bgTop?: string, bgBot?: string) => {
        const w = 78;
        cursorX -= w;
        drawButton(ctx, hits, {
          id,
          x: cursorX,
          y: by + 6,
          w,
          h: 36,
          label,
          sublabel,
          bgTop,
          bgBot,
          onTap,
        });
        cursorX -= 6;
      };

      addActionBtn('sel_move', '移动', undefined, () => actions.onStartMoveBuilding(sel.id));

      if (isUpgrading) {
        addActionBtn('sel_gem', '立即完成', '宝石加速', () => actions.onFinishWithGems(sel.id), '#059669', '#064e3b');
      } else if (nextLv) {
        addActionBtn(
          'sel_upgrade',
          '升级',
          `${nextLv.cost}${nextLv.costType === 'gold' ? '金' : nextLv.costType === 'elixir' ? '水' : '钻'}`,
          () => actions.onUpgradeBuilding(sel.id),
          '#d97706',
          '#92400e'
        );
      }

      if (
        (sel.type === 'gold_mine' || sel.type === 'elixir_collector') &&
        (sel.storedResource ?? 0) >= 1 &&
        !isUpgrading
      ) {
        addActionBtn(
          'sel_collect',
          '收集',
          `${Math.floor(sel.storedResource ?? 0)}`,
          () => actions.onCollectBuilding(sel.id),
          '#047857',
          '#064e3b'
        );
      }

      if (sel.type === 'clan_castle') {
        addActionBtn('sel_clan', '援军', '管理联盟', () => actions.onOpenModal('clan_castle'), '#0284c7', '#075985');
      } else if (sel.type === 'barracks' || sel.type === 'spell_factory') {
        addActionBtn('sel_bar', '练兵', '训练配置', () => actions.onOpenModal('barracks'), '#b45309', '#78350f');
      }
    }
  }
}

function renderModalShell(
  ctx: CanvasRenderingContext2D,
  m: UILayoutMetrics,
  title: string,
  subtitle: string,
  onClose: () => void,
  hits: HitRegion[]
): { x: number; y: number; w: number; h: number; bodyY: number } {
  // Backdrop blocks clicks beneath
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(0, 0, m.width, m.height);
  hits.push({ id: 'modal_backdrop', x: 0, y: 0, w: m.width, h: m.height, onTap: onClose });

  const w = Math.min(640, m.width - m.safeLeft - m.safeRight - 28);
  const h = Math.min(340, m.height - m.safeTop - m.safeBottom - 24);
  const x = (m.width - w) / 2;
  const y = (m.height - h) / 2;

  fillPanel(ctx, x, y, w, h, '#2a1c11', '#8b5e34', 16, 3);
  // Eat clicks inside panel body
  hits.push({ id: 'modal_body_guard', x, y, w, h, onTap: () => {} });

  fillPanel(ctx, x + 2, y + 2, w - 4, 48, '#1c120a', '#6e4723', 14, 1);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fef3c7';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(title, x + 16, y + 20);
  ctx.fillStyle = 'rgba(252, 211, 77, 0.8)';
  ctx.font = '11px sans-serif';
  ctx.fillText(subtitle, x + 16, y + 38);

  drawButton(ctx, hits, {
    id: 'modal_close',
    x: x + w - 44,
    y: y + 9,
    w: 32,
    h: 32,
    label: '✕',
    bgTop: '#b91c1c',
    bgBot: '#7f1d1d',
    border: '#fca5a5',
    onTap: onClose,
  });

  return { x, y, w, h, bodyY: y + 56 };
}

function renderActiveModal(
  ctx: CanvasRenderingContext2D,
  m: UILayoutMetrics,
  state: WechatUIState,
  actions: WechatUIActions,
  hits: HitRegion[]
): void {
  const v = state.village;
  if (state.modal === 'clan_castle') {
    const caps = getResourceCaps(v);
    const used = getUsedClanSpace(v.clanReinforcements);
    const cooldown = getClanRequestCooldownState(v, state.nowMs);
    const alliance = getAllianceByName(v.clanName);
    const box = renderModalShell(
      ctx,
      m,
      '部落城堡 · 模拟联盟',
      caps.hasClanCastle
        ? `所属联盟：${alliance.name} · 援军容量 ${used}/${caps.maxClanSpace}`
        : '尚未建成部落城堡，请先前往商店建造',
      actions.onCloseModal,
      hits
    );

    if (!caps.hasClanCastle) {
      drawButton(ctx, hits, {
        id: 'cc_goto_shop',
        x: box.x + box.w / 2 - 80,
        y: box.bodyY + 80,
        w: 160,
        h: 44,
        label: '前往商店建造',
        bgTop: '#f59e0b',
        bgBot: '#b45309',
        textColor: '#1c120a',
        onTap: () => {
          actions.onSetShopCategory('army');
          actions.onOpenModal('shop');
        },
      });
      return;
    }

    // Alliance pills row
    const alW = Math.floor((box.w - 40) / SIMULATED_ALLIANCES.length);
    SIMULATED_ALLIANCES.forEach((al, idx) => {
      const selected = al.name === alliance.name;
      drawButton(ctx, hits, {
        id: `cc_al_${al.id}`,
        x: box.x + 14 + idx * (alW + 6),
        y: box.bodyY + 4,
        w: alW,
        h: 36,
        label: al.name,
        sublabel: selected ? '已加入' : '点击切换',
        bgTop: selected ? '#0369a1' : '#3a2717',
        bgBot: selected ? '#0c4a6e' : '#1c120a',
        border: selected ? '#38bdf8' : '#6e4723',
        onTap: () => actions.onJoinAlliance(al.name),
      });
    });

    // Stationed troops strip
    const stripY = box.bodyY + 48;
    fillPanel(ctx, box.x + 14, stripY, box.w - 28, 74, '#1c120a', '#6e4723', 10, 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(`当前驻扎援军 (${used}/${caps.maxClanSpace} 人口 · 参战 +15% 战力)`, box.x + 24, stripY + 8);

    const stationed = TROOP_ORDER.filter((t) => (v.clanReinforcements?.[t] ?? 0) > 0);
    if (stationed.length === 0) {
      ctx.fillStyle = 'rgba(254, 243, 199, 0.55)';
      ctx.font = '11px sans-serif';
      ctx.fillText('暂无援军，选择下方兵种偏好并点击请求联盟增援', box.x + 24, stripY + 34);
    } else {
      stationed.forEach((t, idx) => {
        const count = v.clanReinforcements?.[t] ?? 0;
        const cx = box.x + 22 + idx * 116;
        if (cx + 110 <= box.x + box.w - 20) {
          drawButton(ctx, hits, {
            id: `cc_dismiss_${t}`,
            x: cx,
            y: stripY + 28,
            w: 110,
            h: 36,
            label: `${TROOP_CATALOG[t].name} ×${count}`,
            sublabel: '点击遣散1名',
            bgTop: '#1e3a5f',
            bgBot: '#13253d',
            border: '#38bdf8',
            onTap: () => actions.onDismissReinforcement(t),
          });
        }
      });
    }

    // Preference selector row
    const prefs: Array<{ id: ReinforcementPreference; label: string }> = [
      { id: 'balanced', label: '均衡援军' },
      { id: 'tank', label: '前排坦克' },
      { id: 'ranged', label: '空中/远程' },
    ];
    const prefY = stripY + 84;
    const prefW = Math.floor((box.w - 40) / 3);
    prefs.forEach((p, idx) => {
      const active = state.clanPreference === p.id;
      drawButton(ctx, hits, {
        id: `cc_pref_${p.id}`,
        x: box.x + 14 + idx * (prefW + 6),
        y: prefY,
        w: prefW,
        h: 34,
        label: p.label,
        bgTop: active ? '#d97706' : '#3a2717',
        bgBot: active ? '#92400e' : '#1c120a',
        border: active ? '#fde68a' : '#5c3a1d',
        onTap: () => actions.onSetClanPreference(p.id),
      });
    });

    // Cooldown Timer + Progress Bar + Request Button
    const footY = prefY + 46;
    const isFull = used >= caps.maxClanSpace;
    const timerStr = cooldown.active
      ? `下一次请求剩余时间：00:${String(cooldown.remainingSec).padStart(2, '0')} (${cooldown.remainingSec}s)`
      : '增援冷却状态：已就绪 · 可立即请求';
    const barW = box.w - 196;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = cooldown.active ? '#7dd3fc' : '#6ee7b7';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(timerStr, box.x + 14, footY);

    fillPanel(ctx, box.x + 14, footY + 18, barW, 14, '#1c120a', '#5c3a1d', 7, 1);
    const fillW = Math.max(0, (barW - 4) * (cooldown.progressPercent / 100));
    if (fillW > 0) {
      roundRectPath(ctx, box.x + 16, footY + 20, fillW, 10, 5);
      ctx.fillStyle = cooldown.active ? '#38bdf8' : '#34d399';
      ctx.fill();
    }

    drawButton(ctx, hits, {
      id: 'cc_request',
      x: box.x + box.w - 170,
      y: footY - 2,
      w: 156,
      h: 40,
      label: isFull
        ? cooldown.active
          ? `已满 (${cooldown.remainingSec}s)`
          : '援军已满'
        : cooldown.active
          ? `冷却中 (${cooldown.remainingSec}s)`
          : '请求联盟增援',
      disabled: isFull || cooldown.active,
      progressRatio: cooldown.active ? cooldown.progressPercent / 100 : undefined,
      bgTop: '#38bdf8',
      bgBot: '#0284c7',
      border: '#bae6fd',
      textColor: '#082f49',
      onTap: actions.onRequestReinforcements,
    });
    return;
  }

  if (state.modal === 'barracks') {
    const caps = getResourceCaps(v);
    const usedTroops = getUsedTroopSpace(v.army);
    const usedSpells = getUsedSpellSpace(v.spells);
    const box = renderModalShell(
      ctx,
      m,
      '兵营与法术工厂',
      `部队人口 ${usedTroops}/${caps.maxTroopSpace} · 法术容量 ${usedSpells}/${caps.maxSpellSpace}`,
      actions.onCloseModal,
      hits
    );

    const cardW = Math.floor((box.w - 42) / 3);
    TROOP_ORDER.forEach((t, idx) => {
      const def = TROOP_CATALOG[t];
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const cx = box.x + 14 + col * (cardW + 7);
      const cy = box.bodyY + 4 + row * 86;
      const locked = caps.maxBarracksLevel < def.barracksLevelRequired;
      const count = v.army[t] ?? 0;

      fillPanel(ctx, cx, cy, cardW, 78, '#3a2717', '#6e4723', 10, 1.5);
      const sp = getTroopSprite(t);
      if (sp) {
        ctx.drawImage(sp.canvas, cx + 6, cy + 8, 34, 34);
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#fef3c7';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(`${def.name} ×${count}`, cx + 44, cy + 8);
      ctx.fillStyle = '#f5d0fe';
      ctx.font = '10px sans-serif';
      ctx.fillText(
        locked ? `需兵营 Lv.${def.barracksLevelRequired}` : `${def.trainCostElixir}水 · ${def.housingSpace}口`,
        cx + 44,
        cy + 25
      );

      drawButton(ctx, hits, {
        id: `bar_train_${t}`,
        x: cx + 8,
        y: cy + 44,
        w: cardW - 48,
        h: 26,
        label: locked ? '未解锁' : '+1 训练',
        disabled: locked || v.elixir < def.trainCostElixir || usedTroops + def.housingSpace > caps.maxTroopSpace,
        bgTop: '#9333ea',
        bgBot: '#6b21a8',
        border: '#e9d5ff',
        onTap: () => actions.onTrainTroop(t),
      });
      drawButton(ctx, hits, {
        id: `bar_dismiss_${t}`,
        x: cx + cardW - 36,
        y: cy + 44,
        w: 28,
        h: 26,
        label: '-1',
        disabled: count <= 0,
        bgTop: '#991b1b',
        bgBot: '#7f1d1d',
        onTap: () => actions.onDismissTroop(t),
      });
    });

    // Spells row at bottom
    const spellY = box.bodyY + 182;
    const spellW = Math.floor((box.w - 36) / 2);
    SPELL_ORDER.forEach((s, idx) => {
      const def = SPELL_CATALOG[s];
      const sx = box.x + 14 + idx * (spellW + 8);
      const count = v.spells[s] ?? 0;
      fillPanel(ctx, sx, spellY, spellW, 74, '#1c120a', '#6e4723', 10, 1.5);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#fef3c7';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(`${def.name} ×${count}`, sx + 10, spellY + 8);
      ctx.fillStyle = '#d8b4fe';
      ctx.font = '10px sans-serif';
      ctx.fillText(`${def.brewCostElixir}圣水 · ${def.role}`, sx + 10, spellY + 24);

      drawButton(ctx, hits, {
        id: `bar_brew_${s}`,
        x: sx + 10,
        y: spellY + 42,
        w: spellW - 56,
        h: 24,
        label: caps.hasSpellFactory ? '+1 配制' : '需建造法术工厂',
        disabled: !caps.hasSpellFactory || v.elixir < def.brewCostElixir || usedSpells + def.housingSpace > caps.maxSpellSpace,
        bgTop: '#7e22ce',
        bgBot: '#581c87',
        onTap: () => actions.onBrewSpell(s),
      });
      drawButton(ctx, hits, {
        id: `bar_unbrew_${s}`,
        x: sx + spellW - 40,
        y: spellY + 42,
        w: 30,
        h: 24,
        label: '-1',
        disabled: count <= 0,
        bgTop: '#991b1b',
        bgBot: '#7f1d1d',
        onTap: () => actions.onDismissSpell(s),
      });
    });
    return;
  }

  if (state.modal === 'shop') {
    const box = renderModalShell(
      ctx,
      m,
      '建筑商店',
      `当前大本营 Lv.${v.townHallLevel} · 选择建筑并在草地上点击建造`,
      actions.onCloseModal,
      hits
    );

    const cats: Array<{ id: BuildingCategory; label: string }> = [
      { id: 'resource', label: '资源设施' },
      { id: 'army', label: '军事建筑' },
      { id: 'defense', label: '防御建筑' },
      { id: 'decoration', label: '村庄装饰' },
    ];
    const tabW = Math.floor((box.w - 46) / 4);
    cats.forEach((c, idx) => {
      const active = state.shopCategory === c.id;
      drawButton(ctx, hits, {
        id: `shop_cat_${c.id}`,
        x: box.x + 14 + idx * (tabW + 6),
        y: box.bodyY + 2,
        w: tabW,
        h: 30,
        label: c.label,
        bgTop: active ? '#d97706' : '#3a2717',
        bgBot: active ? '#92400e' : '#1c120a',
        border: active ? '#fde68a' : '#5c3a1d',
        onTap: () => actions.onSetShopCategory(c.id),
      });
    });

    const items = (Object.keys(BUILDING_CATALOG) as BuildingType[]).filter(
      (t) => t !== 'town_hall' && BUILDING_CATALOG[t].category === state.shopCategory
    );
    const cols = 3;
    const cardW = Math.floor((box.w - 42) / cols);
    items.slice(0, 6).forEach((t, idx) => {
      const def = BUILDING_CATALOG[t];
      const lv1 = def.levels[0];
      const curCount = getBuildingCountByType(v, t);
      const maxCount = def.maxCountByTH[v.townHallLevel] ?? 0;
      const limitReached = curCount >= maxCount;
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const cx = box.x + 14 + col * (cardW + 7);
      const cy = box.bodyY + 40 + row * 112;

      fillPanel(ctx, cx, cy, cardW, 104, '#3a2717', '#6e4723', 10, 1.5);
      const sp = getBuildingSprite(t);
      if (sp) {
        ctx.drawImage(sp.canvas, cx + 8, cy + 8, 42, 42);
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#fef3c7';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(def.name, cx + 54, cy + 10);
      ctx.fillStyle = '#fcd34d';
      ctx.font = '10px sans-serif';
      ctx.fillText(`数量 ${curCount}/${maxCount}`, cx + 54, cy + 28);
      ctx.fillStyle = '#e5e7eb';
      ctx.fillText(
        `${lv1.cost}${lv1.costType === 'gold' ? '金' : lv1.costType === 'elixir' ? '水' : '钻'}`,
        cx + 54,
        cy + 44
      );

      drawButton(ctx, hits, {
        id: `shop_buy_${t}`,
        x: cx + 10,
        y: cy + 68,
        w: cardW - 20,
        h: 28,
        label: limitReached ? '已达上限' : '建造放置',
        disabled: limitReached,
        bgTop: '#f59e0b',
        bgBot: '#b45309',
        textColor: '#1c120a',
        onTap: () => actions.onSelectShopBuilding(t),
      });
    });
    return;
  }

  if (state.modal === 'missions') {
    const synced = ensureDailyMissions(v);
    const dm = synced.dailyMissions!;
    const box = renderModalShell(
      ctx,
      m,
      '每日任务',
      `日期 ${dm.dateKey} · 完成每日目标领取资源与宝石`,
      actions.onCloseModal,
      hits
    );

    dm.missions.forEach((ms, idx) => {
      const ry = box.bodyY + 8 + idx * 82;
      fillPanel(ctx, box.x + 14, ry, box.w - 28, 72, '#3a2717', '#6e4723', 10, 1.5);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#fef3c7';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(ms.title, box.x + 26, ry + 10);
      ctx.fillStyle = 'rgba(254, 243, 199, 0.78)';
      ctx.font = '11px sans-serif';
      ctx.fillText(
        `${ms.description} (${Math.min(ms.progress, ms.target)}/${ms.target})`,
        box.x + 26,
        ry + 28
      );

      const barW = box.w - 190;
      fillPanel(ctx, box.x + 26, ry + 48, barW, 10, '#1c120a', '#5c3a1d', 5, 1);
      const pct = Math.min(1, ms.progress / Math.max(1, ms.target));
      if (pct > 0) {
        roundRectPath(ctx, box.x + 27, ry + 49, Math.max(4, (barW - 2) * pct), 8, 4);
        ctx.fillStyle = ms.progress >= ms.target ? '#34d399' : '#f59e0b';
        ctx.fill();
      }

      const ready = ms.progress >= ms.target && !ms.claimed;
      drawButton(ctx, hits, {
        id: `mission_claim_${ms.id}`,
        x: box.x + box.w - 134,
        y: ry + 16,
        w: 108,
        h: 40,
        label: ms.claimed ? '已领取' : ready ? '领取奖励' : '进行中',
        sublabel: `+${ms.rewardAmount}${ms.rewardType === 'gold' ? '金' : ms.rewardType === 'elixir' ? '水' : '钻'}`,
        disabled: !ready,
        bgTop: '#10b981',
        bgBot: '#047857',
        textColor: '#ffffff',
        onTap: () => actions.onClaimMission(ms.id),
      });
    });
    return;
  }

  if (state.modal === 'attack') {
    const troopSpace = getUsedTroopSpace(v.army);
    const hasArmy = troopSpace > 0;
    const box = renderModalShell(
      ctx,
      m,
      '发起进攻',
      `当前出征部队：${troopSpace} 人口${hasArmy ? '' : '（请先训练至少 1 名士兵）'}`,
      actions.onCloseModal,
      hits
    );

    const tabW = Math.floor((box.w - 36) / 2);
    drawButton(ctx, hits, {
      id: 'atk_tab_camp',
      x: box.x + 14,
      y: box.bodyY + 2,
      w: tabW,
      h: 32,
      label: '哥布林单人战役',
      bgTop: state.attackTab === 'campaign' ? '#dc2626' : '#1c120a',
      bgBot: state.attackTab === 'campaign' ? '#991b1b' : '#1c120a',
      border: '#fca5a5',
      onTap: () => actions.onSetAttackTab('campaign'),
    });
    drawButton(ctx, hits, {
      id: 'atk_tab_mp',
      x: box.x + 22 + tabW,
      y: box.bodyY + 2,
      w: tabW,
      h: 32,
      label: '联机搜索对手',
      bgTop: state.attackTab === 'multiplayer' ? '#dc2626' : '#1c120a',
      bgBot: state.attackTab === 'multiplayer' ? '#991b1b' : '#1c120a',
      border: '#fca5a5',
      onTap: () => actions.onSetAttackTab('multiplayer'),
    });

    if (state.attackTab === 'campaign') {
      CAMPAIGN_STAGES.slice(0, 3).forEach((stage, idx) => {
        const sy = box.bodyY + 44 + idx * 76;
        const stars = v.campaignStars[stage.id] ?? 0;
        fillPanel(ctx, box.x + 14, sy, box.w - 28, 68, '#3a2717', '#6e4723', 10, 1.5);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#fef3c7';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText(`${stage.name} (推荐${stage.recommendedTH}本)`, box.x + 26, sy + 10);
        ctx.fillStyle = '#fcd34d';
        ctx.font = '11px sans-serif';
        ctx.fillText(
          `战利品 ${stage.rewardGold}金 · ${stage.rewardElixir}水 · 历史 ★${stars}/3`,
          box.x + 26,
          sy + 32
        );

        drawButton(ctx, hits, {
          id: `atk_stage_${stage.id}`,
          x: box.x + box.w - 116,
          y: sy + 14,
          w: 90,
          h: 40,
          label: '进攻',
          disabled: !hasArmy,
          bgTop: '#ef4444',
          bgBot: '#991b1b',
          border: '#fca5a5',
          onTap: () => actions.onStartCampaign(stage.id),
        });
      });
    } else {
      const opp = generateMultiplayerOpponent(v.townHallLevel, state.multiplayerSeed);
      const oy = box.bodyY + 52;
      fillPanel(ctx, box.x + 14, oy, box.w - 28, 160, '#3a2717', '#6e4723', 12, 2);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#fcd34d';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('匹配敌方部落', box.x + 28, oy + 18);
      ctx.fillStyle = '#fef3c7';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(opp.name, box.x + 28, oy + 40);
      ctx.fillStyle = '#e5e7eb';
      ctx.font = '12px sans-serif';
      ctx.fillText(
        `敌方大本 Lv.${opp.thLevel} · 建筑 ${opp.buildings.length} · 可掠夺 ${opp.rewardGold}金 / ${opp.rewardElixir}水`,
        box.x + 28,
        oy + 74
      );

      drawButton(ctx, hits, {
        id: 'atk_reroll',
        x: box.x + 28,
        y: oy + 106,
        w: 140,
        h: 40,
        label: '下一个对手',
        bgTop: '#f59e0b',
        bgBot: '#b45309',
        textColor: '#1c120a',
        onTap: actions.onRerollOpponent,
      });

      drawButton(ctx, hits, {
        id: 'atk_mp_go',
        x: box.x + box.w - 168,
        y: oy + 106,
        w: 140,
        h: 40,
        label: '立即开战',
        disabled: !hasArmy,
        bgTop: '#ef4444',
        bgBot: '#991b1b',
        border: '#fca5a5',
        onTap: actions.onStartMultiplayer,
      });
    }
    return;
  }

  if (state.modal === 'settings') {
    const box = renderModalShell(
      ctx,
      m,
      '游戏设置与存档',
      '微信小游戏本地存档 · 音频与背景音乐音量',
      actions.onCloseModal,
      hits
    );

    drawButton(ctx, hits, {
      id: 'set_mute',
      x: box.x + 24,
      y: box.bodyY + 24,
      w: box.w - 48,
      h: 44,
      label: state.muted ? '当前：已静音（点击开启声音）' : '当前：音效已开启（点击静音）',
      onTap: actions.onToggleMute,
    });

    drawButton(ctx, hits, {
      id: 'set_bgm',
      x: box.x + 24,
      y: box.bodyY + 82,
      w: box.w - 48,
      h: 44,
      label: `背景音乐音量：${Math.round(state.bgmVolume * 100)}%（点击切换档位）`,
      onTap: actions.onCycleBgmVolume,
    });

    drawButton(ctx, hits, {
      id: 'set_save',
      x: box.x + 24,
      y: box.bodyY + 140,
      w: (box.w - 60) / 2,
      h: 44,
      label: '立即保存进度',
      bgTop: '#047857',
      bgBot: '#064e3b',
      border: '#6ee7b7',
      onTap: actions.onSaveNow,
    });

    drawButton(ctx, hits, {
      id: 'set_reset',
      x: box.x + 36 + (box.w - 60) / 2,
      y: box.bodyY + 140,
      w: (box.w - 60) / 2,
      h: 44,
      label: '重置村庄初始状态',
      bgTop: '#991b1b',
      bgBot: '#7f1d1d',
      border: '#fca5a5',
      onTap: actions.onResetVillage,
    });
  }
}

function renderBattleHUD(
  ctx: CanvasRenderingContext2D,
  m: UILayoutMetrics,
  state: WechatUIState,
  actions: WechatUIActions,
  hits: HitRegion[]
): void {
  const b = state.battle;
  if (!b) return;
  const left = m.safeLeft + 10;
  const right = m.width - m.safeRight - 10;
  const top = m.safeTop + 10;

  // Top-left target + destruction
  fillPanel(ctx, left, top, 230, 44, 'rgba(42, 28, 17, 0.92)', '#7c5329', 10);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fef3c7';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(`${b.targetName} (TH${b.targetTH})`, left + 10, top + 14);
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(
    `★ ${b.stars}/3 · 摧毁 ${b.destructionPercent}% · ${Math.ceil(b.timeRemainingSec)}s`,
    left + 10,
    top + 32
  );

  // Top-right loot + end battle
  fillPanel(ctx, right - 266, top, 176, 40, 'rgba(42, 28, 17, 0.92)', '#7c5329', 10);
  drawGoldCoinIcon(ctx, right - 250, top + 20, 7);
  ctx.fillStyle = '#fde68a';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(`${b.lootGold}`, right - 238, top + 20);
  drawElixirDropIcon(ctx, right - 170, top + 20, 7);
  ctx.fillStyle = '#f5d0fe';
  ctx.fillText(`${b.lootElixir}`, right - 158, top + 20);

  drawButton(ctx, hits, {
    id: 'battle_end',
    x: right - 82,
    y: top + 2,
    w: 82,
    h: 36,
    label: '结束战斗',
    bgTop: '#dc2626',
    bgBot: '#991b1b',
    border: '#fca5a5',
    onTap: actions.onEndBattleEarly,
  });

  // Bottom deployment dock
  const cards: Array<{ card: NonNullable<BattleState['selectedCard']>; label: string; count: number; isReinf?: boolean }> = [];
  for (const t of TROOP_ORDER) {
    const avail = b.availableTroops[t] ?? 0;
    const dep = b.troopsDeployed[t] ?? 0;
    if (avail > 0 || dep > 0) {
      cards.push({ card: { kind: 'troop', type: t }, label: TROOP_CATALOG[t].name, count: avail });
    }
  }
  for (const t of TROOP_ORDER) {
    const avail = b.availableReinforcements[t] ?? 0;
    const dep = b.reinforcementsDeployed[t] ?? 0;
    if (avail > 0 || dep > 0) {
      cards.push({
        card: { kind: 'reinforcement', type: t },
        label: `援·${TROOP_CATALOG[t].name}`,
        count: avail,
        isReinf: true,
      });
    }
  }
  for (const s of SPELL_ORDER) {
    const avail = b.availableSpells[s] ?? 0;
    const used = b.spellsUsed[s] ?? 0;
    if (avail > 0 || used > 0) {
      cards.push({ card: { kind: 'spell', type: s }, label: SPELL_CATALOG[s].name, count: avail });
    }
  }

  const cardW = Math.min(82, Math.floor((m.width - 40) / Math.max(1, cards.length)));
  const dockW = cards.length * (cardW + 6) + 12;
  const dockX = (m.width - dockW) / 2;
  const dockY = m.height - m.safeBottom - 62;
  fillPanel(ctx, dockX, dockY, dockW, 54, 'rgba(28, 18, 10, 0.92)', '#7c5329', 12);

  cards.forEach((c, idx) => {
    const isSelected =
      b.selectedCard?.kind === c.card.kind && b.selectedCard?.type === c.card.type;
    drawButton(ctx, hits, {
      id: `bcard_${c.card.kind}_${c.card.type}`,
      x: dockX + 8 + idx * (cardW + 6),
      y: dockY + 6,
      w: cardW,
      h: 42,
      label: c.label,
      sublabel: `×${c.count}`,
      disabled: c.count <= 0,
      bgTop: isSelected ? (c.isReinf ? '#38bdf8' : '#f59e0b') : c.isReinf ? '#173049' : '#3a2717',
      bgBot: isSelected ? (c.isReinf ? '#0284c7' : '#b45309') : c.isReinf ? '#0f2235' : '#1c120a',
      border: isSelected ? '#fef08a' : c.isReinf ? '#38bdf8' : '#6e4723',
      textColor: isSelected ? '#1c120a' : '#fef3c7',
      onTap: () => actions.onSelectBattleCard(c.card),
    });
  });

  // Battle result overlay
  if (state.screen === 'gameover' && b.result) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(0, 0, m.width, m.height);
    const rw = Math.min(400, m.width - 48);
    const rh = 240;
    const rx = (m.width - rw) / 2;
    const ry = (m.height - rh) / 2;
    fillPanel(ctx, rx, ry, rw, rh, '#2a1c11', b.result.victory ? '#f59e0b' : '#ef4444', 18, 3);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = b.result.victory ? '#fcd34d' : '#fca5a5';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(b.result.victory ? '战斗胜利！' : '惜败撤退', rx + rw / 2, ry + 40);

    ctx.fillStyle = '#fef3c7';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(
      `★ ${b.result.stars}/3 星 · 摧毁度 ${b.result.destructionPercent}%`,
      rx + rw / 2,
      ry + 84
    );
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(
      `掠夺 +${b.result.lootGold} 金币 · +${b.result.lootElixir} 圣水 · 奖杯 ${b.result.trophyDelta >= 0 ? '+' : ''}${b.result.trophyDelta}`,
      rx + rw / 2,
      ry + 122
    );

    drawButton(ctx, hits, {
      id: 'battle_return_home',
      x: rx + rw / 2 - 90,
      y: ry + 166,
      w: 180,
      h: 46,
      label: '返回村庄',
      bgTop: '#f59e0b',
      bgBot: '#b45309',
      border: '#fde68a',
      textColor: '#1c120a',
      onTap: actions.onReturnHomeFromBattle,
    });
  }
}

export function renderWechatUI(
  ctx: CanvasRenderingContext2D,
  metrics: UILayoutMetrics,
  state: WechatUIState,
  actions: WechatUIActions
): HitRegion[] {
  const hits: HitRegion[] = [];

  if (state.screen === 'title') {
    renderTitleOverlay(ctx, metrics, state, actions, hits);
  } else if (state.mode === 'battle') {
    renderBattleHUD(ctx, metrics, state, actions, hits);
  } else {
    renderVillageTopAndDock(ctx, metrics, state, actions, hits);
    if (state.modal !== 'none') {
      renderActiveModal(ctx, metrics, state, actions, hits);
    }
  }

  if (state.toastText) {
    const tw = Math.min(340, metrics.width - 40);
    const tx = (metrics.width - tw) / 2;
    const ty = metrics.safeTop + 58;
    fillPanel(ctx, tx, ty, tw, 34, 'rgba(28, 19, 11, 0.94)', '#f59e0b', 10, 1.5);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef3c7';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(state.toastText, metrics.width / 2, ty + 17);
  }

  return hits;
}

export function findHitRegionAt(
  hits: HitRegion[],
  x: number,
  y: number
): HitRegion | null {
  // Top-most rendered element wins
  for (let i = hits.length - 1; i >= 0; i--) {
    const r = hits[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      return r;
    }
  }
  return null;
}
