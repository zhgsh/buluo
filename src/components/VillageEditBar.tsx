import React from 'react';
import {
  Check,
  EyeOff,
  LayoutGrid,
  Minus,
  Plus,
  RotateCcw,
  X,
} from 'lucide-react';
import { BUILDING_CATALOG } from '../game/catalog';
import { ElixirIcon, GemIcon, GoldIcon } from '../game/svgIcons';
import type { BuildingType, VillageState } from '../game/types';
import {
  type EditModeState,
  getResourceCaps,
  getStashedBuildingGroups,
  getVillageProductionRates,
} from '../game/villageLogic';
import { BuildingSpriteThumb } from './BuildingSpriteThumb';

interface VillageEditBarProps {
  village: VillageState;
  editState: EditModeState;
  draggingId: string | null;
  toastMessage: string | null;
  onHideAll: () => void;
  onHideSelected: (buildingId: string) => void;
  onRestoreOriginal: () => void;
  onCancel: () => void;
  onSave: () => void;
  onSelectTrayType: (type: BuildingType) => void;
  onStartTrayDrag: (
    buildingId: string,
    type: BuildingType,
    e: React.PointerEvent<HTMLButtonElement>
  ) => void;
  onClearSelection: () => void;
  onZoom: (delta: number) => void;
}

export const VillageEditBar: React.FC<VillageEditBarProps> = ({
  village,
  editState,
  draggingId,
  toastMessage,
  onHideAll,
  onHideSelected,
  onRestoreOriginal,
  onCancel,
  onSave,
  onSelectTrayType,
  onStartTrayDrag,
  onClearSelection,
  onZoom,
}) => {
  const caps = getResourceCaps(village);
  const rates = getVillageProductionRates(village);
  const stashedGroups = getStashedBuildingGroups(editState);

  const totalCount = editState.entries.length;
  const placedCount = editState.entries.filter((e) => e.placed).length;
  const stashedCount = totalCount - placedCount;
  const allHidden = placedCount === 0;
  const canSave = stashedCount === 0;

  const selectedEntry = editState.selectedId
    ? editState.entries.find((e) => e.placed && e.id === editState.selectedId) ?? null
    : null;
  const selectedDef = selectedEntry ? BUILDING_CATALOG[selectedEntry.type] : null;

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 sm:p-4">
      {/* Top Bar: Edit Controls + Live Unaffected Resource Readout */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div
          data-testid="edit-mode-toolbar"
          className="pointer-events-auto flex flex-wrap items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[#2a1c11]/95 border-2 border-amber-500 shadow-[0_5px_0_#140c06] text-amber-50"
        >
          <div className="flex items-center gap-2 pr-3 border-r border-[#6e4723]">
            <LayoutGrid className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="leading-tight">
              <div className="text-sm font-extrabold text-amber-100 whitespace-nowrap">
                阵型编辑模式
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-amber-200/80 tabular-nums whitespace-nowrap">
                <span>
                  已放置 {placedCount}/{totalCount}
                </span>
                <span aria-hidden="true">·</span>
                <span className={stashedCount > 0 ? 'text-amber-300 font-bold' : 'text-emerald-300 font-bold'}>
                  {stashedCount > 0 ? `暂存 ${stashedCount} 座` : '全部已就位'}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            data-testid="edit-hide-all-btn"
            disabled={allHidden}
            onClick={(e) => {
              e.currentTarget.blur();
              onHideAll();
            }}
            className="clash-btn min-h-[40px] px-3.5 py-2 rounded-xl bg-[#44301d] border border-amber-700 text-amber-100 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer whitespace-nowrap disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <EyeOff className="w-4 h-4 text-amber-300 shrink-0" />
            <span>全部隐藏</span>
          </button>

          <button
            type="button"
            data-testid="edit-restore-btn"
            onClick={(e) => {
              e.currentTarget.blur();
              onRestoreOriginal();
            }}
            className="clash-btn min-h-[40px] px-3.5 py-2 rounded-xl bg-[#3a2614] border border-[#7c5329] text-amber-100 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-4 h-4 text-sky-300 shrink-0" />
            <span>恢复原位</span>
          </button>

          <button
            type="button"
            data-testid="edit-cancel-btn"
            onClick={(e) => {
              e.currentTarget.blur();
              onCancel();
            }}
            className="clash-btn min-h-[40px] px-3.5 py-2 rounded-xl bg-red-700 border border-red-950 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <X className="w-4 h-4 shrink-0" />
            <span>取消</span>
          </button>

          <button
            type="button"
            data-testid="edit-save-btn"
            onClick={(e) => {
              e.currentTarget.blur();
              onSave();
            }}
            className={`clash-btn min-h-[40px] px-4 py-2 rounded-xl border-2 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer whitespace-nowrap tabular-nums ${
              canSave
                ? 'bg-gradient-to-b from-emerald-400 to-emerald-600 border-emerald-950 text-emerald-950 shadow-[0_3px_0_#064e3b]'
                : 'bg-[#3a2614] border-[#6e4723] text-amber-300/75'
            }`}
          >
            <Check className="w-4 h-4 shrink-0" />
            <span>{canSave ? '保存阵型' : `还差 ${stashedCount} 座`}</span>
          </button>
        </div>

        {/* Top-Right: Live Resource Production Continuity & Zoom */}
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="hidden md:flex items-center gap-3 px-3.5 py-2 rounded-xl bg-[#2a1c11]/92 border-2 border-[#7c5329] shadow-[0_4px_0_#140c06] text-xs tabular-nums">
            <div className="flex items-center gap-1.5">
              <GoldIcon className="w-4 h-4 shrink-0" />
              <span className="font-extrabold text-amber-200">{Math.round(village.gold)}</span>
              <span className="text-[11px] text-amber-300/70">/{caps.maxGold}</span>
              <span className="text-[11px] text-emerald-300/90">+{rates.goldPerHour}/h</span>
            </div>
            <span className="text-[#6e4723]" aria-hidden="true">|</span>
            <div className="flex items-center gap-1.5">
              <ElixirIcon className="w-4 h-4 shrink-0" />
              <span className="font-extrabold text-fuchsia-200">{Math.round(village.elixir)}</span>
              <span className="text-[11px] text-fuchsia-300/70">/{caps.maxElixir}</span>
              <span className="text-[11px] text-emerald-300/90">+{rates.elixirPerHour}/h</span>
            </div>
            <span className="text-[#6e4723]" aria-hidden="true">|</span>
            <div className="flex items-center gap-1">
              <GemIcon className="w-4 h-4 shrink-0" />
              <span className="font-extrabold text-emerald-300">{Math.round(village.gems)}</span>
            </div>
          </div>

          <button
            type="button"
            aria-label="放大视角"
            onClick={() => onZoom(0.15)}
            className="clash-btn w-10 h-10 rounded-xl bg-[#2a1c11]/92 border-2 border-[#7c5329] text-amber-100 flex items-center justify-center cursor-pointer"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            aria-label="缩小视角"
            onClick={() => onZoom(-0.15)}
            className="clash-btn w-10 h-10 rounded-xl bg-[#2a1c11]/92 border-2 border-[#7c5329] text-amber-100 flex items-center justify-center cursor-pointer"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Transient Toast Banner */}
      {toastMessage && (
        <div className="self-center px-5 py-2 rounded-xl bg-[#1c130b]/95 border-2 border-amber-500 text-amber-100 text-sm font-bold shadow-lg">
          {toastMessage}
        </div>
      )}

      {/* Bottom Dock: Selected Building Action + Stashed Buildings Drag-Drop Tray */}
      <div className="flex flex-col items-center gap-2">
        {selectedEntry && selectedDef && !draggingId && (
          <div className="pointer-events-auto flex items-center gap-3 px-4 py-2 rounded-xl bg-[#2a1c11]/95 border-2 border-amber-500 shadow-[0_4px_0_#140c06]">
            <div className="text-xs font-extrabold text-amber-100">
              {selectedDef.name}
              {selectedDef.category !== 'decoration' && selectedEntry.level > 0 && (
                <span className="ml-1.5 text-amber-300 tabular-nums">
                  Lv.{selectedEntry.level}
                </span>
              )}
            </div>
            <span className="text-[11px] text-amber-200/75 hidden sm:inline">
              可直接按住拖拽至新网格，或点击空地移动
            </span>
            <button
              type="button"
              data-testid="edit-hide-selected-btn"
              onClick={() => onHideSelected(selectedEntry.id)}
              className="clash-btn min-h-[36px] px-3 py-1 rounded-lg bg-[#44301d] border border-amber-700 text-amber-100 text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <EyeOff className="w-3.5 h-3.5 text-amber-300" />
              <span>收起</span>
            </button>
            <button
              type="button"
              aria-label="取消选中建筑"
              onClick={onClearSelection}
              className="clash-btn w-8 h-8 rounded-lg bg-[#1c130b] text-amber-300 flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div
          data-testid="edit-mode-tray"
          className="pointer-events-auto w-full max-w-5xl rounded-2xl bg-[#24170d]/95 border-2 border-[#8b5e34] shadow-[0_6px_0_#140c06] px-4 py-3"
        >
          {stashedGroups.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-xs text-amber-200/85">
                <span className="font-bold">
                  待放置建筑（按住卡片拖拽到地图网格，或点击选中后轻触网格放置）
                </span>
                <span className="tabular-nums text-amber-300 font-bold shrink-0">
                  剩余 {stashedCount} 座未放置 · 编辑期间矿井持续产出
                </span>
              </div>

              <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
                {stashedGroups.map((group) => {
                  const def = BUILDING_CATALOG[group.type];
                  const isActive = editState.activeTrayType === group.type;
                  return (
                    <button
                      key={group.type}
                      type="button"
                      data-testid={`edit-tray-item-${group.type}`}
                      onPointerDown={(e) => onStartTrayDrag(group.nextId, group.type, e)}
                      onClick={() => onSelectTrayType(group.type)}
                      className={`shrink-0 min-w-[92px] px-2.5 py-2 rounded-xl border-2 flex flex-col items-center gap-1 cursor-grab active:cursor-grabbing touch-none select-none transition-colors ${
                        isActive
                          ? 'bg-[#4b3119] border-amber-400 shadow-[0_3px_0_#451a03]'
                          : 'bg-[#1c120a] border-[#6e4723] hover:border-amber-600'
                      }`}
                    >
                      <BuildingSpriteThumb
                        type={group.type}
                        alt={def.name}
                        className="w-10 h-10 pointer-events-none"
                      />
                      <span className="text-[11px] font-extrabold text-amber-100 whitespace-nowrap leading-tight">
                        {def.name}
                      </span>
                      <div className="flex items-center gap-1.5 text-[10px] text-amber-300/85 tabular-nums leading-tight">
                        <span>{def.size}×{def.size}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-extrabold text-emerald-300">×{group.count}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-amber-200/90">
              <span>
                所有建筑均已就位：可直接按住地图上的任意建筑拖拽换位，或点击上方「全部隐藏」收起全部建筑从头摆放。
              </span>
              <span className="text-emerald-300 font-bold tabular-nums shrink-0">
                资源产出正常运行中（金矿 +{rates.goldPerHour}/h · 圣水 +{rates.elixirPerHour}/h）
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
