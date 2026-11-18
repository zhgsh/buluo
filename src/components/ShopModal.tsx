import React, { useState } from 'react';
import { X } from 'lucide-react';
import { BUILDING_CATALOG } from '../game/catalog';
import { ElixirIcon, GemIcon, GoldIcon } from '../game/svgIcons';
import type { BuildingCategory, BuildingType, VillageState } from '../game/types';
import { BuildingSpriteThumb } from './BuildingSpriteThumb';
import { getBuildingCountByType, getBusyBuilderCount } from '../game/villageLogic';

interface ShopModalProps {
  village: VillageState;
  onClose: () => void;
  onSelectBuilding: (type: BuildingType) => void;
}

const CATEGORIES: Array<{ id: BuildingCategory; label: string }> = [
  { id: 'defense', label: '防御设施' },
  { id: 'resource', label: '资源设施' },
  { id: 'army', label: '军事建筑' },
  { id: 'decoration', label: '装饰' },
];

export const ShopModal: React.FC<ShopModalProps> = ({
  village,
  onClose,
  onSelectBuilding,
}) => {
  const [category, setCategory] = useState<BuildingCategory>('defense');
  const busyBuilders = getBusyBuilderCount(village);
  const hasFreeBuilder = busyBuilders < village.buildersTotal;

  const items = Object.values(BUILDING_CATALOG).filter(
    (b) => b.category === category && b.type !== 'town_hall'
  );

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/65 p-4">
      <div
        role="dialog"
        aria-label="部落商店"
        className="w-full max-w-3xl rounded-2xl bg-[#2a1c11] border-4 border-[#8b5e34] shadow-2xl overflow-hidden flex flex-col max-h-[86vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#1c120a] border-b-2 border-[#6e4723]">
          <div>
            <h2 className="text-xl font-extrabold text-amber-100">部落商店</h2>
            <p className="text-xs text-amber-300/80 mt-0.5">
              {hasFreeBuilder
                ? `空闲建筑工人：${village.buildersTotal - busyBuilders}/${village.buildersTotal}`
                : '建筑工人全部忙碌中（城墙、装饰与工人小屋无需等待）'}
            </p>
          </div>
          <button
            type="button"
            aria-label="关闭商店"
            onClick={onClose}
            className="clash-btn w-9 h-9 rounded-xl bg-red-700 border border-red-950 text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-2 px-6 pt-4">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`clash-btn px-4 py-2 rounded-xl text-sm font-extrabold border-2 cursor-pointer ${
                category === c.id
                  ? 'bg-amber-500 border-amber-950 text-amber-950'
                  : 'bg-[#1c120a] border-[#5c3a1d] text-amber-200 hover:text-white'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Grid of buildable structures */}
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 overflow-y-auto">
          {items.map((def) => {
            const count = getBuildingCountByType(village, def.type);
            const maxAllowed = def.maxCountByTH[village.townHallLevel] ?? 0;
            const lv1 = def.levels[0];
            const thLocked = lv1.thRequired > village.townHallLevel;
            const maxed = count >= maxAllowed;
            const canAfford =
              (lv1.costType === 'gold' && village.gold >= lv1.cost) ||
              (lv1.costType === 'elixir' && village.elixir >= lv1.cost) ||
              (lv1.costType === 'gems' && village.gems >= lv1.cost);
            const needsBuilder = lv1.buildTimeSec > 0;
            const disabled = thLocked || maxed || !canAfford || (needsBuilder && !hasFreeBuilder);

            return (
              <div
                key={def.type}
                className="rounded-xl bg-[#3a2717] border-2 border-[#6e4723] p-3.5 flex flex-col justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 rounded-xl bg-[#1c120a] border border-[#6e4723] p-1 flex items-center justify-center shrink-0">
                    <BuildingSpriteThumb
                      type={def.type}
                      alt={def.name}
                      className="w-full h-full"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-extrabold text-amber-100 truncate">
                        {def.name}
                      </h3>
                      <span className="text-xs font-bold text-amber-300 tabular-nums shrink-0">
                        {count}/{maxAllowed}
                      </span>
                    </div>
                    <p className="text-xs text-amber-200/75 mt-1 leading-snug line-clamp-2">
                      {def.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#5c3a1d]">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold tabular-nums">
                    {lv1.costType === 'gold' ? (
                      <GoldIcon className="w-4 h-4" />
                    ) : lv1.costType === 'elixir' ? (
                      <ElixirIcon className="w-4 h-4" />
                    ) : (
                      <GemIcon className="w-4 h-4" />
                    )}
                    <span className={canAfford ? 'text-amber-100' : 'text-red-400'}>
                      {lv1.cost}
                    </span>
                    <span className="text-amber-300/60 font-semibold ml-1">
                      {lv1.buildTimeSec > 0 ? `${lv1.buildTimeSec}s` : '瞬建'}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onSelectBuilding(def.type)}
                    className={`clash-btn px-3 py-1.5 rounded-lg text-xs font-extrabold border cursor-pointer ${
                      disabled
                        ? 'bg-[#26190f] border-[#422a15] text-amber-500/50 cursor-not-allowed'
                        : 'bg-emerald-500 border-emerald-950 text-emerald-950'
                    }`}
                  >
                    {thLocked
                      ? `需 ${lv1.thRequired} 本`
                      : maxed
                        ? '已达上限'
                        : !canAfford
                          ? '资源不足'
                          : needsBuilder && !hasFreeBuilder
                            ? '无空闲工人'
                            : '建造'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
