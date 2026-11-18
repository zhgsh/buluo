import React from 'react';
import {
  Pause,
  Volume2,
  VolumeX,
  Plus,
  Minus,
  Swords,
  Hammer,
  Users,
  ShoppingBag,
  Sparkles,
  Move,
  ArrowUpCircle,
  X,
  ClipboardList,
  Settings,
  Shield,
  MessageSquare,
  Gauge,
  LayoutGrid,
  Film,
  Camera,
  LocateFixed,
} from 'lucide-react';
import { BUILDING_CATALOG } from '../game/catalog';
import {
  BuilderIcon,
  ElixirIcon,
  GemIcon,
  GoldIcon,
  TrophyIcon,
} from '../game/svgIcons';
import type { BuildingType, PlacedBuilding, VillageState } from '../game/types';
import {
  getBuildingProductionInfo,
  getBusyBuilderCount,
  getResourceCaps,
  getUsedClanSpace,
  getUsedTroopSpace,
  getVillageProductionRates,
} from '../game/villageLogic';

interface VillageHUDProps {
  village: VillageState;
  nowMs: number;
  muted: boolean;
  selectedBuilding: PlacedBuilding | null;
  placingType: BuildingType | null;
  movingBuildingId: string | null;
  toastMessage: string | null;
  claimableMissions: number;
  clanChatOpen: boolean;
  unreadClanMessages: number;
  onToggleMute: () => void;
  onOpenSettings: () => void;
  onPause: () => void;
  onZoom: (delta: number) => void;
  onCenterView: () => void;
  onOpenShop: () => void;
  onOpenBarracks: () => void;
  onOpenClanCastle: () => void;
  onToggleClanChat: () => void;
  onOpenMissions: () => void;
  onOpenReplays: () => void;
  onOpenAttack: () => void;
  onCollectAll: () => void;
  onCollectBuilding: (id: string) => void;
  onUpgradeBuilding: (id: string) => void;
  onFinishWithGems: (id: string) => void;
  onStartMoveBuilding: (id: string) => void;
  onEnterEditMode: () => void;
  onGenerateThumbnail: () => void;
  onCancelPlacementOrMove: () => void;
  onDeselect: () => void;
}

export const VillageHUD: React.FC<VillageHUDProps> = ({
  village,
  nowMs,
  muted,
  selectedBuilding,
  placingType,
  movingBuildingId,
  toastMessage,
  claimableMissions,
  clanChatOpen,
  unreadClanMessages,
  onToggleMute,
  onOpenSettings,
  onPause,
  onZoom,
  onCenterView,
  onOpenShop,
  onOpenBarracks,
  onOpenClanCastle,
  onToggleClanChat,
  onOpenMissions,
  onOpenReplays,
  onOpenAttack,
  onCollectAll,
  onCollectBuilding,
  onUpgradeBuilding,
  onFinishWithGems,
  onStartMoveBuilding,
  onEnterEditMode,
  onGenerateThumbnail,
  onCancelPlacementOrMove,
  onDeselect,
}) => {
  const caps = getResourceCaps(village);
  const busyBuilders = getBusyBuilderCount(village);
  const freeBuilders = Math.max(0, village.buildersTotal - busyBuilders);
  const usedTroops = getUsedTroopSpace(village.army);
  const usedClanSpace = getUsedClanSpace(village.clanReinforcements);

  const hasCollectible = village.buildings.some(
    (b) => (b.storedResource ?? 0) >= 12 && b.upgradingToLevel === undefined
  );

  // Selected building details
  const selectedDef = selectedBuilding ? BUILDING_CATALOG[selectedBuilding.type] : null;
  const selectedNextLv =
    selectedBuilding && selectedDef
      ? selectedDef.levels[selectedBuilding.level]
      : undefined;
  const isUpgrading = selectedBuilding?.upgradingToLevel !== undefined;
  const remUpgradeSec =
    isUpgrading && selectedBuilding?.upgradeEndsAt
      ? Math.max(0, Math.ceil((selectedBuilding.upgradeEndsAt - nowMs) / 1000))
      : 0;
  const gemInstantCost = Math.max(1, Math.ceil(remUpgradeSec / 4));
  const selectedProductionInfo = selectedBuilding
    ? getBuildingProductionInfo(selectedBuilding)
    : null;
  const villageProductionRates = selectedProductionInfo
    ? getVillageProductionRates(village)
    : null;

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 sm:p-4">
      {/* Top Perimeter Bar */}
      <div className="flex items-start justify-between gap-3">
        {/* Top-Left: Town Hall, Trophies, Builders */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[#2a1c11]/92 border-2 border-[#7c5329] shadow-[0_4px_0_#140c06]">
            <div className="w-8 h-8 rounded-lg bg-amber-600 border border-amber-300 flex items-center justify-center font-display font-black text-amber-950 text-sm tabular-nums">
              {village.townHallLevel}
            </div>
            <div className="leading-tight">
              <div className="text-[11px] font-bold text-amber-300/90">大本营</div>
              <div className="text-sm font-extrabold text-amber-50 tabular-nums">
                {village.townHallLevel} 级
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#2a1c11]/92 border-2 border-[#7c5329] shadow-[0_4px_0_#140c06]">
            <TrophyIcon className="w-5 h-5" />
            <div className="leading-tight">
              <div className="text-[10px] font-bold text-amber-300/80">奖杯</div>
              <div className="text-sm font-extrabold text-amber-100 tabular-nums">
                {Math.round(village.trophies)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#2a1c11]/92 border-2 border-[#7c5329] shadow-[0_4px_0_#140c06]">
            <BuilderIcon className="w-5 h-5" />
            <div className="leading-tight">
              <div className="text-[10px] font-bold text-amber-300/80">建筑工人</div>
              <div className="text-sm font-extrabold text-amber-100 tabular-nums">
                {freeBuilders}/{village.buildersTotal}
              </div>
            </div>
          </div>
        </div>

        {/* Top-Right: Gold, Elixir, Gems + Mute/Pause */}
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#2a1c11]/92 border-2 border-[#7c5329] shadow-[0_4px_0_#140c06]">
            <GoldIcon className="w-5 h-5 shrink-0" />
            <div className="min-w-[74px]">
              <div className="flex items-baseline justify-between gap-1.5">
                <span className="text-sm font-extrabold text-amber-200 tabular-nums">
                  {Math.round(village.gold)}
                </span>
                <span className="text-[10px] text-amber-300/70 tabular-nums">
                  /{caps.maxGold}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[#140c06] overflow-hidden mt-0.5">
                <div
                  className="h-full bg-amber-400"
                  style={{ width: `${Math.min(100, (village.gold / caps.maxGold) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#2a1c11]/92 border-2 border-[#7c5329] shadow-[0_4px_0_#140c06]">
            <ElixirIcon className="w-5 h-5 shrink-0" />
            <div className="min-w-[74px]">
              <div className="flex items-baseline justify-between gap-1.5">
                <span className="text-sm font-extrabold text-fuchsia-200 tabular-nums">
                  {Math.round(village.elixir)}
                </span>
                <span className="text-[10px] text-fuchsia-300/70 tabular-nums">
                  /{caps.maxElixir}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[#140c06] overflow-hidden mt-0.5">
                <div
                  className="h-full bg-fuchsia-500"
                  style={{ width: `${Math.min(100, (village.elixir / caps.maxElixir) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#2a1c11]/92 border-2 border-[#7c5329] shadow-[0_4px_0_#140c06]">
            <GemIcon className="w-5 h-5 shrink-0" />
            <span className="text-sm font-extrabold text-emerald-300 tabular-nums">
              {Math.round(village.gems)}
            </span>
          </div>

          <button
            type="button"
            tabIndex={-1}
            aria-label={muted ? '取消静音' : '静音'}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            className="clash-btn w-10 h-10 rounded-xl bg-[#2a1c11]/92 border-2 border-[#7c5329] shadow-[0_4px_0_#140c06] text-amber-100 flex items-center justify-center cursor-pointer"
          >
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label="打开设置"
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenSettings();
            }}
            className="clash-btn w-10 h-10 rounded-xl bg-[#2a1c11]/92 border-2 border-[#7c5329] shadow-[0_4px_0_#140c06] text-amber-100 flex items-center justify-center cursor-pointer"
          >
            <Settings className="w-5 h-5" />
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label="暂停游戏"
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            className="clash-btn w-10 h-10 rounded-xl bg-[#2a1c11]/92 border-2 border-[#7c5329] shadow-[0_4px_0_#140c06] text-amber-100 flex items-center justify-center cursor-pointer"
          >
            <Pause className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Transient Toast Banner */}
      {toastMessage && (
        <div className="self-center px-5 py-2 rounded-xl bg-[#1c130b]/95 border-2 border-amber-500 text-amber-100 text-sm font-bold shadow-lg">
          {toastMessage}
        </div>
      )}

      {/* Placement / Move Banner */}
      {(placingType || movingBuildingId) && (
        <div className="pointer-events-auto self-center flex items-center gap-4 px-5 py-2.5 rounded-xl bg-[#2a1c11]/95 border-2 border-emerald-500 shadow-xl">
          <span className="text-sm font-bold text-emerald-100">
            {placingType
              ? `点击绿色空地建造：${BUILDING_CATALOG[placingType].name}`
              : '点击绿色空地放置移动后的建筑'}
          </span>
          <button
            type="button"
            onClick={onCancelPlacementOrMove}
            className="clash-btn px-3 py-1 rounded-lg bg-red-700 border border-red-950 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            取消
          </button>
        </div>
      )}

      {/* Bottom Area: Selected Building Inspector (above dock) + Bottom Dock Row */}
      <div className="flex flex-col gap-2">
        {/* Selected Building Inspector + Resource Production Panel */}
        {selectedBuilding && selectedDef && !placingType && !movingBuildingId && (
          <div className="pointer-events-auto self-center flex flex-col items-center gap-2">
            {selectedProductionInfo && villageProductionRates && (
              <section
                aria-label="资源生产速率面板"
                data-testid="resource-production-panel"
                className="w-full max-w-md rounded-2xl bg-[#24170d]/95 border-2 border-[#8b5e34] shadow-[0_5px_0_#140c06] px-4 py-2.5 text-amber-50"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-200">
                    <Gauge className="w-4 h-4 text-amber-400" />
                    <span>资源生产速率</span>
                  </div>
                  <span className="text-[11px] font-bold text-amber-300/80 tabular-nums">
                    全村总产出：
                    {(selectedProductionInfo.resourceType === 'gold'
                      ? villageProductionRates.goldPerHour
                      : villageProductionRates.elixirPerHour
                    ).toLocaleString()}{' '}
                    {selectedProductionInfo.resourceLabel}/小时
                  </span>
                </div>

                <div className="mt-1.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    {selectedProductionInfo.resourceType === 'gold' ? (
                      <GoldIcon className="w-5 h-5 shrink-0" />
                    ) : (
                      <ElixirIcon className="w-5 h-5 shrink-0" />
                    )}
                    <div>
                      <div className="text-sm font-extrabold tabular-nums">
                        {selectedProductionInfo.isPausedByUpgrade ? (
                          <span className="text-amber-300">
                            0 {selectedProductionInfo.resourceLabel}/小时（升级中暂停）
                          </span>
                        ) : (
                          <span
                            className={
                              selectedProductionInfo.resourceType === 'gold'
                                ? 'text-amber-300'
                                : 'text-fuchsia-300'
                            }
                          >
                            +{selectedProductionInfo.perHour.toLocaleString()}{' '}
                            {selectedProductionInfo.resourceLabel}/小时
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-amber-200/75 tabular-nums">
                        {selectedProductionInfo.isPausedByUpgrade &&
                        selectedProductionInfo.nextLevelPerHour !== null
                          ? `完工后产出：+${selectedProductionInfo.nextLevelPerHour.toLocaleString()} ${selectedProductionInfo.resourceLabel}/小时`
                          : `约 ${Math.round(selectedProductionInfo.perHour / 60).toLocaleString()} ${selectedProductionInfo.resourceLabel}/分钟`}
                        {!selectedProductionInfo.isPausedByUpgrade &&
                          selectedProductionInfo.nextLevelPerHour !== null && (
                            <span className="ml-2 text-emerald-300">
                              · 升级后 +
                              {(
                                selectedProductionInfo.nextLevelPerHour -
                                selectedProductionInfo.perHour
                              ).toLocaleString()}
                              /小时
                            </span>
                          )}
                      </div>
                    </div>
                  </div>

                  {selectedProductionInfo.capacity > 0 && (
                    <div className="text-right shrink-0 min-w-[92px]">
                      <div className="text-[11px] font-bold text-amber-200/85 tabular-nums">
                        暂存 {selectedProductionInfo.stored}/{selectedProductionInfo.capacity}
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-[#140c06] overflow-hidden mt-1">
                        <div
                          className={`h-full ${
                            selectedProductionInfo.resourceType === 'gold'
                              ? 'bg-amber-400'
                              : 'bg-fuchsia-500'
                          }`}
                          style={{
                            width: `${Math.min(
                              100,
                              (selectedProductionInfo.stored /
                                selectedProductionInfo.capacity) *
                                100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            <div className="flex flex-wrap items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[#2a1c11]/95 border-2 border-amber-600 shadow-[0_5px_0_#140c06]">
              <div className="pr-2 border-r border-amber-800/80">
                <div className="text-sm font-extrabold text-amber-100">
                  {selectedDef.name}{' '}
                  <span className="text-amber-400 tabular-nums">
                    {selectedDef.category === 'decoration'
                      ? '装饰'
                      : selectedBuilding.level > 0
                        ? `Lv.${selectedBuilding.level}`
                        : '建造中'}
                  </span>
                </div>
                <div className="text-[11px] text-amber-200/75 flex items-center gap-1">
                  {selectedDef.category === 'decoration' ? (
                    '纯美观装饰 · 无属性加成'
                  ) : isUpgrading ? (
                    `升级至 Lv.${selectedBuilding.upgradingToLevel} · 剩余 ${remUpgradeSec}s`
                  ) : selectedNextLv ? (
                    <>
                      <span>下一级:</span>
                      {selectedNextLv.costType === 'gold' ? (
                        <GoldIcon className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <ElixirIcon className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span className="tabular-nums font-bold">{selectedNextLv.cost}</span>
                    </>
                  ) : (
                    '已满级'
                  )}
                </div>
              </div>

              {(selectedBuilding.storedResource ?? 0) >= 1 && !isUpgrading && (
                <button
                  type="button"
                  onClick={() => onCollectBuilding(selectedBuilding.id)}
                  className="clash-btn px-3 py-1.5 rounded-xl bg-amber-500 border border-amber-900 text-amber-950 text-xs font-extrabold flex items-center gap-1 cursor-pointer tabular-nums"
                >
                  {selectedBuilding.type === 'gold_mine' ? (
                    <GoldIcon className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <ElixirIcon className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>+{Math.floor(selectedBuilding.storedResource ?? 0)}</span>
                </button>
              )}

              {(selectedBuilding.type === 'barracks' ||
                selectedBuilding.type === 'army_camp' ||
                selectedBuilding.type === 'spell_factory') && (
                <button
                  type="button"
                  onClick={onOpenBarracks}
                  className="clash-btn px-3 py-1.5 rounded-xl bg-sky-600 border border-sky-900 text-white text-xs font-extrabold cursor-pointer"
                >
                  训练/配兵
                </button>
              )}

              {selectedBuilding.type === 'clan_castle' && !isUpgrading && selectedBuilding.level > 0 && (
                <button
                  type="button"
                  onClick={onOpenClanCastle}
                  className="clash-btn px-3 py-1.5 rounded-xl bg-indigo-600 border border-indigo-950 text-white text-xs font-extrabold cursor-pointer"
                >
                  请求援军
                </button>
              )}

              {isUpgrading ? (
                <button
                  type="button"
                  onClick={() => onFinishWithGems(selectedBuilding.id)}
                  className="clash-btn px-3 py-1.5 rounded-xl bg-emerald-600 border border-emerald-950 text-white text-xs font-extrabold flex items-center gap-1 cursor-pointer tabular-nums"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  立即完成 ({gemInstantCost} 宝石)
                </button>
              ) : (
                selectedNextLv && (
                  <button
                    type="button"
                    onClick={() => onUpgradeBuilding(selectedBuilding.id)}
                    className="clash-btn px-3 py-1.5 rounded-xl bg-amber-500 border border-amber-950 text-amber-950 text-xs font-extrabold flex items-center gap-1 cursor-pointer tabular-nums"
                  >
                    <ArrowUpCircle className="w-3.5 h-3.5" />
                    <span>升级</span>
                    {selectedNextLv.costType === 'gold' ? (
                      <GoldIcon className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <ElixirIcon className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>{selectedNextLv.cost}</span>
                  </button>
                )
              )}

              <button
                type="button"
                onClick={() => onStartMoveBuilding(selectedBuilding.id)}
                className="clash-btn px-3 py-1.5 rounded-xl bg-[#44301d] border border-amber-800 text-amber-100 text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Move className="w-3.5 h-3.5" />
                移动
              </button>

              <button
                type="button"
                aria-label="关闭建筑面板"
                onClick={onDeselect}
                className="clash-btn w-7 h-7 rounded-lg bg-[#1c130b] text-amber-300 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Bottom Dock Row */}
        <div className="flex items-end justify-between gap-2">
          {/* Bottom-Left: Attack + Train Army + Daily Missions + Clan Chat */}
          <div className="pointer-events-auto flex items-end gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenAttack();
              }}
              className="clash-btn px-4 py-2.5 rounded-2xl bg-gradient-to-b from-red-500 to-red-700 border-2 border-red-950 shadow-[0_5px_0_#450a0a] text-white flex items-center gap-2 cursor-pointer"
            >
              <Swords className="w-6 h-6 text-amber-200 shrink-0" />
              <div className="text-left leading-tight">
                <div className="text-base font-extrabold tracking-wide text-stroke-sm whitespace-nowrap">进攻</div>
                <div className="text-[11px] font-bold text-red-100 tabular-nums whitespace-nowrap">
                  兵力 {usedTroops}/{caps.maxTroopSpace}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenBarracks();
              }}
              className="clash-btn px-3.5 py-2.5 rounded-2xl bg-gradient-to-b from-sky-500 to-sky-700 border-2 border-sky-950 shadow-[0_5px_0_#082f49] text-white flex items-center gap-2 cursor-pointer"
            >
              <Users className="w-5 h-5 shrink-0" />
              <div className="text-left leading-tight">
                <div className="text-sm font-extrabold whitespace-nowrap">练兵</div>
                <div className="text-[11px] text-sky-100 tabular-nums whitespace-nowrap">
                  {usedTroops}/{caps.maxTroopSpace}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenMissions();
              }}
              className="relative clash-btn px-3.5 py-2.5 rounded-2xl bg-gradient-to-b from-amber-700 to-amber-900 border-2 border-amber-950 shadow-[0_5px_0_#1c1108] text-amber-50 flex items-center gap-2 cursor-pointer"
            >
              <ClipboardList className="w-5 h-5 text-amber-200 shrink-0" />
              <div className="text-left leading-tight">
                <div className="text-sm font-extrabold whitespace-nowrap">每日任务</div>
                <div
                  className={`text-[11px] font-bold tabular-nums whitespace-nowrap ${
                    claimableMissions > 0 ? 'text-emerald-300' : 'text-amber-200/80'
                  }`}
                >
                  {claimableMissions > 0 ? `可领 ${claimableMissions} 项` : '每日 3 项'}
                </div>
              </div>
              {claimableMissions > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-md bg-emerald-500 border border-emerald-950 text-emerald-950 text-[11px] font-black flex items-center justify-center tabular-nums">
                  {claimableMissions}
                </span>
              )}
            </button>

            <button
              type="button"
              aria-expanded={clanChatOpen}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleClanChat();
              }}
              className={`relative clash-btn px-3.5 py-2.5 rounded-2xl border-2 flex items-center gap-2 cursor-pointer ${
                clanChatOpen
                  ? 'bg-gradient-to-b from-teal-500 to-teal-700 border-teal-200 shadow-[0_5px_0_#134e4a] text-white'
                  : 'bg-gradient-to-b from-[#4a321e] to-[#2c1c0f] border-[#7c5329] shadow-[0_5px_0_#140c06] text-amber-50'
              }`}
            >
              <MessageSquare className="w-5 h-5 text-sky-300 shrink-0" />
              <div className="text-left leading-tight">
                <div className="text-sm font-extrabold whitespace-nowrap">联盟聊天</div>
                <div className="text-[11px] font-bold text-sky-200/90 tabular-nums whitespace-nowrap">
                  {clanChatOpen ? '已展开' : unreadClanMessages > 0 ? `${unreadClanMessages} 条新消息` : '查看动态'}
                </div>
              </div>
              {!clanChatOpen && unreadClanMessages > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-md bg-sky-500 border border-sky-950 text-sky-950 text-[11px] font-black flex items-center justify-center tabular-nums">
                  {unreadClanMessages > 9 ? '9+' : unreadClanMessages}
                </span>
              )}
            </button>
          </div>

          {/* Bottom-Right Fixed Semi-Transparent Dark Container (部落城堡 · 战报回放 · 阵型缩略图) */}
          <div
            role="toolbar"
            aria-label="部落与阵型快捷栏"
            data-testid="unified-utility-bar"
            className="fixed right-3 sm:right-4 bottom-[92px] sm:bottom-24 z-10 pointer-events-auto flex items-center gap-1 p-1.5 rounded-2xl bg-[#120c07]/75 backdrop-blur-md border border-[#8b5e34]/75 shadow-[0_8px_20px_rgba(0,0,0,0.45)]"
          >
            <button
              type="button"
              data-testid="open-clan-castle-btn"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenClanCastle();
              }}
              className="clash-btn px-2.5 py-1.5 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/75 border border-indigo-400/25 text-indigo-50 flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Shield className="w-4 h-4 text-sky-300 shrink-0" />
              <div className="text-left leading-tight">
                <div className="text-xs font-extrabold whitespace-nowrap">部落城堡</div>
                <div className="text-[10px] font-bold text-sky-300/90 tabular-nums whitespace-nowrap">
                  {caps.hasClanCastle
                    ? `援军 ${usedClanSpace}/${caps.maxClanSpace}`
                    : '未建成'}
                </div>
              </div>
            </button>

            <div className="w-px h-7 bg-amber-200/15 shrink-0" aria-hidden="true" />

            <button
              type="button"
              data-testid="open-replays-btn"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenReplays();
              }}
              className="clash-btn px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/12 border border-white/10 text-amber-50 flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Film className="w-4 h-4 text-amber-300 shrink-0" />
              <div className="text-left leading-tight">
                <div className="text-xs font-extrabold whitespace-nowrap">战报回放</div>
                <div className="text-[10px] font-bold text-amber-200/75 tabular-nums whitespace-nowrap">
                  {(village.battleReplays?.length ?? 0) > 0
                    ? `${village.battleReplays?.length} 场录像`
                    : '暂无录像'}
                </div>
              </div>
            </button>

            <div className="w-px h-7 bg-amber-200/15 shrink-0" aria-hidden="true" />

            <button
              type="button"
              data-testid="generate-thumbnail-btn"
              aria-label="生成村庄等距缩略图"
              onClick={(e) => {
                e.currentTarget.blur();
                onGenerateThumbnail();
              }}
              className="clash-btn px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/12 border border-white/10 text-amber-50 flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Camera className="w-4 h-4 text-amber-300 shrink-0" />
              <div className="text-left leading-tight">
                <div className="text-xs font-extrabold whitespace-nowrap">阵型缩略图</div>
                <div className="text-[10px] font-bold text-amber-200/75 whitespace-nowrap">等距快照</div>
              </div>
            </button>
          </div>

          {/* Bottom-Right: Collect All + Zoom/Center + Edit Mode + Shop */}
          <div className="pointer-events-auto flex items-end gap-2">
            {hasCollectible && (
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onCollectAll();
                }}
                className="clash-btn px-3 py-2.5 rounded-xl bg-amber-500 border-2 border-amber-950 shadow-[0_4px_0_#451a03] text-amber-950 text-xs font-extrabold whitespace-nowrap cursor-pointer"
              >
                一键收矿
              </button>
            )}

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="放大视角"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onZoom(0.15);
                  }}
                  className="clash-btn flex-1 h-8 rounded-lg bg-[#2a1c11]/92 border-2 border-[#7c5329] text-amber-100 flex items-center justify-center cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  aria-label="缩小视角"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onZoom(-0.15);
                  }}
                  className="clash-btn flex-1 h-8 rounded-lg bg-[#2a1c11]/92 border-2 border-[#7c5329] text-amber-100 flex items-center justify-center cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </button>
              </div>
              <button
                type="button"
                data-testid="center-view-btn"
                aria-label="视野居中"
                title="重置视野至村庄中心"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onCenterView();
                }}
                className="clash-btn h-8 px-2.5 rounded-lg bg-[#2a1c11]/92 border-2 border-[#7c5329] text-amber-100 flex items-center justify-center gap-1 text-xs font-extrabold whitespace-nowrap cursor-pointer"
              >
                <LocateFixed className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span>视野居中</span>
              </button>
            </div>

            <button
              type="button"
              data-testid="enter-edit-mode-btn"
              onClick={(e) => {
                e.currentTarget.blur();
                onEnterEditMode();
              }}
              className="clash-btn px-3.5 py-2.5 rounded-2xl bg-gradient-to-b from-[#4a321e] to-[#2c1c0f] border-2 border-[#8b5e34] shadow-[0_5px_0_#140c06] text-amber-100 flex items-center gap-2 cursor-pointer"
            >
              <LayoutGrid className="w-5 h-5 text-amber-300 shrink-0" />
              <div className="text-left leading-tight">
                <div className="text-sm font-extrabold whitespace-nowrap">编辑阵型</div>
                <div className="text-[11px] font-bold text-amber-200/80 whitespace-nowrap">全部收起/拖拽</div>
              </div>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenShop();
              }}
              className="clash-btn px-4 py-2.5 rounded-2xl bg-gradient-to-b from-amber-400 to-amber-600 border-2 border-amber-950 shadow-[0_5px_0_#451a03] text-amber-950 flex items-center gap-2 cursor-pointer"
            >
              <ShoppingBag className="w-6 h-6 shrink-0" />
              <div className="text-left leading-tight">
                <div className="text-base font-extrabold whitespace-nowrap">商店</div>
                <div className="text-[11px] font-bold text-amber-900 whitespace-nowrap">建造防御与设施</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
