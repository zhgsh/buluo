import React, { useState } from 'react';
import {
  ArrowUpCircle,
  Bookmark,
  BookmarkPlus,
  ChevronDown,
  ChevronUp,
  Info,
  Minus,
  Plus,
  RotateCcw,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import {
  getTroopCombatDetails,
  SPELL_CATALOG,
  SPELL_ORDER,
  TROOP_CATALOG,
  TROOP_ORDER,
} from '../game/catalog';
import { ElixirIcon, SpellBadgeIcon } from '../game/svgIcons';
import { TroopSpriteThumb } from './TroopSpriteThumb';
import type {
  SpellType,
  TrainingQueueSnapshot,
  TroopType,
  VillageState,
} from '../game/types';
import {
  getResourceCaps,
  getTroopUpgradeInfo,
  getUsedSpellSpace,
  getUsedTroopSpace,
  hasTrainingQueueEntries,
  MAX_FAVORITE_ARMIES,
  repeatTrainingQueue,
  suggestFavoriteArmyName,
} from '../game/villageLogic';

interface BarracksModalProps {
  village: VillageState;
  onClose: () => void;
  onTrainTroop: (type: TroopType) => void;
  onDismissTroop: (type: TroopType) => void;
  onUpgradeTroop: (type: TroopType) => void;
  onBrewSpell: (type: SpellType) => void;
  onDismissSpell: (type: SpellType) => void;
  onRepeatLastQueue: () => void;
  onSaveFavoriteArmy: (name: string, composition?: TrainingQueueSnapshot) => void;
  onQueueFavoriteArmy: (favoriteId: string) => void;
  onDeleteFavoriteArmy: (favoriteId: string) => void;
}

function summarizeComposition(comp: {
  army?: Partial<Record<TroopType, number>>;
  spells?: Partial<Record<SpellType, number>>;
}) {
  const summaryItems: string[] = [];
  let troopSpace = 0;
  let spellSpace = 0;
  let elixirCost = 0;

  for (const tType of TROOP_ORDER) {
    const count = comp.army?.[tType] ?? 0;
    if (count > 0) {
      const def = TROOP_CATALOG[tType];
      summaryItems.push(`${def.name}×${count}`);
      troopSpace += def.housingSpace * count;
      elixirCost += def.trainCostElixir * count;
    }
  }
  for (const sType of SPELL_ORDER) {
    const count = comp.spells?.[sType] ?? 0;
    if (count > 0) {
      const def = SPELL_CATALOG[sType];
      summaryItems.push(`${def.name}×${count}`);
      spellSpace += def.housingSpace * count;
      elixirCost += def.brewCostElixir * count;
    }
  }
  return { summaryItems, troopSpace, spellSpace, elixirCost };
}

export const BarracksModal: React.FC<BarracksModalProps> = ({
  village,
  onClose,
  onTrainTroop,
  onDismissTroop,
  onUpgradeTroop,
  onBrewSpell,
  onDismissSpell,
  onRepeatLastQueue,
  onSaveFavoriteArmy,
  onQueueFavoriteArmy,
  onDeleteFavoriteArmy,
}) => {
  const [favoriteNameInput, setFavoriteNameInput] = useState('');
  const [expandedTroops, setExpandedTroops] = useState<Partial<Record<TroopType, boolean>>>({});
  const toggleTroopDetails = (tType: TroopType) => {
    setExpandedTroops((prev) => ({ ...prev, [tType]: !prev[tType] }));
  };
  const caps = getResourceCaps(village);
  const usedTroops = getUsedTroopSpace(village.army);
  const usedSpells = getUsedSpellSpace(village.spells);
  const lastQueue = village.lastTrainingQueue;
  const hasSavedQueue = hasTrainingQueueEntries(lastQueue);
  const repeatPreview = hasSavedQueue ? repeatTrainingQueue(village, lastQueue) : null;
  const canRepeat = Boolean(repeatPreview?.ok);
  const hasCurrentArmyOrSpells = usedTroops > 0 || usedSpells > 0;
  const suggestedName = suggestFavoriteArmyName(village.army, village.spells);
  const favoriteArmies = village.favoriteArmies ?? [];

  const {
    summaryItems: queueSummaryItems,
    troopSpace: queueTroopSpace,
    spellSpace: queueSpellSpace,
    elixirCost: queueElixirCost,
  } = lastQueue
    ? summarizeComposition(lastQueue)
    : { summaryItems: [], troopSpace: 0, spellSpace: 0, elixirCost: 0 };

  const handleSaveCurrentFavorite = () => {
    const finalName = favoriteNameInput.trim() || suggestedName;
    onSaveFavoriteArmy(finalName);
    setFavoriteNameInput('');
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/65 p-4">
      <div
        role="dialog"
        aria-label="训练部队与法术"
        className="w-full max-w-3xl rounded-2xl bg-[#2a1c11] border-4 border-[#8b5e34] shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
      >
        <div className="flex items-center justify-between px-6 py-4 bg-[#1c120a] border-b-2 border-[#6e4723]">
          <div>
            <h2 className="text-xl font-extrabold text-amber-100">训练军队与法术</h2>
            <div className="flex items-center gap-4 text-xs text-amber-300/85 mt-0.5 tabular-nums">
              <span>
                军营人口：{usedTroops} / {caps.maxTroopSpace}
              </span>
              <span>·</span>
              <span>
                法术容量：{usedSpells} / {caps.maxSpellSpace}
              </span>
              <span>·</span>
              <span>圣水：{Math.round(village.elixir)}</span>
            </div>
          </div>
          <button
            type="button"
            aria-label="关闭训练营"
            onClick={onClose}
            className="clash-btn w-10 h-10 rounded-xl bg-red-700 border border-red-950 text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {/* Quick Repeat Last Queue Banner */}
          <div className="rounded-xl bg-[#1c120a]/85 border-2 border-[#7b5028] px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-extrabold text-amber-200 tracking-wide">
                  上次训练队列
                </span>
                {hasSavedQueue && (
                  <span className="text-[11px] text-amber-300/80 tabular-nums">
                    {queueTroopSpace > 0 ? `${queueTroopSpace} 人口` : ''}
                    {queueTroopSpace > 0 && queueSpellSpace > 0 ? ' · ' : ''}
                    {queueSpellSpace > 0 ? `${queueSpellSpace} 法术` : ''}
                    {' · 约 '}
                    {queueElixirCost} 圣水
                  </span>
                )}
              </div>
              {hasSavedQueue ? (
                <p
                  data-testid="last-training-queue-summary"
                  className="text-xs font-bold text-amber-100/90 mt-1 break-words"
                >
                  {queueSummaryItems.join(' · ')}
                  {repeatPreview && !repeatPreview.ok && (
                    <span className="ml-2 text-amber-400/80">
                      （{repeatPreview.reason}）
                    </span>
                  )}
                </p>
              ) : (
                <p
                  data-testid="last-training-queue-summary"
                  className="text-xs text-amber-300/65 mt-1"
                >
                  暂无上次训练记录（手动训练或出征后自动保存）
                </p>
              )}
            </div>

            <button
              type="button"
              disabled={!canRepeat}
              onClick={onRepeatLastQueue}
              className={`clash-btn shrink-0 h-10 px-4 rounded-xl text-xs font-extrabold border-2 flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                canRepeat
                  ? 'bg-emerald-500 border-emerald-950 text-emerald-950 hover:bg-emerald-400'
                  : 'bg-[#26190f] border-[#422a15] text-amber-500/50 cursor-not-allowed'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              一键重复上次训练队列
            </button>
          </div>

          {/* Favorite Army Compositions */}
          <section
            data-testid="favorite-armies-section"
            aria-label="常用配兵方案"
            className="rounded-xl bg-[#1c120a]/90 border-2 border-[#6e4723] p-4 space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-amber-300 shrink-0" />
                <div>
                  <h3 className="text-xs font-extrabold text-amber-100 tabular-nums">
                    常用配兵方案 · {favoriteArmies.length}/{MAX_FAVORITE_ARMIES}
                  </h3>
                  <p className="text-[11px] text-amber-300/75">
                    将当前军营与法术组合收藏为模板，战后一键补兵
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={24}
                  value={favoriteNameInput}
                  onChange={(e) => setFavoriteNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && hasCurrentArmyOrSpells) {
                      e.preventDefault();
                      handleSaveCurrentFavorite();
                    }
                  }}
                  placeholder={`名称（默认：${suggestedName}）`}
                  aria-label="常用配兵方案名称"
                  className="h-10 w-44 sm:w-48 px-3 rounded-xl bg-[#120b06] border border-[#6e4723] text-xs font-bold text-amber-100 placeholder:text-amber-300/45 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  data-testid="save-favorite-army-btn"
                  disabled={!hasCurrentArmyOrSpells}
                  onClick={handleSaveCurrentFavorite}
                  className={`clash-btn h-10 px-3.5 rounded-xl text-xs font-extrabold border-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    hasCurrentArmyOrSpells
                      ? 'bg-amber-500 border-amber-950 text-amber-950 hover:bg-amber-400'
                      : 'bg-[#26190f] border-[#422a15] text-amber-500/50 cursor-not-allowed'
                  }`}
                >
                  <BookmarkPlus className="w-4 h-4" />
                  保存当前配兵
                </button>
              </div>
            </div>

            {favoriteArmies.length === 0 ? (
              <div className="rounded-xl bg-[#24170d] border border-[#4d3219] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <span className="text-xs text-amber-200/75">
                  暂未保存配兵方案，可直接保存当前部队，或导入经典战术预设：
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onSaveFavoriteArmy('Giant-Healer', {
                        army: { giant: 2, archer: 10, barbarian: 6 },
                        spells: { heal: 1 },
                      })
                    }
                    className="clash-btn h-9 px-3 rounded-lg bg-[#3a2717] border border-amber-600/70 text-amber-200 text-xs font-bold whitespace-nowrap cursor-pointer hover:border-amber-400"
                  >
                    + 导入 Giant-Healer
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onSaveFavoriteArmy('野蛮弓箭速推', {
                        army: { barbarian: 12, archer: 10 },
                        spells: {},
                      })
                    }
                    className="clash-btn h-9 px-3 rounded-lg bg-[#3a2717] border border-amber-600/70 text-amber-200 text-xs font-bold whitespace-nowrap cursor-pointer hover:border-amber-400"
                  >
                    + 导入 野蛮弓箭速推
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {favoriteArmies.map((fav) => {
                  const stats = summarizeComposition(fav);
                  const preview = repeatTrainingQueue(village, {
                    army: fav.army,
                    spells: fav.spells,
                  });
                  const canQueue = Boolean(preview.ok);
                  return (
                    <div
                      key={fav.id}
                      data-testid={`favorite-army-${fav.id}`}
                      className="rounded-xl bg-[#2a1c11] border border-[#6e4723] p-3 flex items-center justify-between gap-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-amber-100 truncate">
                            {fav.name}
                          </span>
                          <span className="text-[10px] font-bold text-amber-300/75 tabular-nums shrink-0">
                            {stats.troopSpace > 0 ? `${stats.troopSpace} 人口` : ''}
                            {stats.troopSpace > 0 && stats.spellSpace > 0 ? ' · ' : ''}
                            {stats.spellSpace > 0 ? `${stats.spellSpace} 法术` : ''}
                            {' · '}
                            {stats.elixirCost} 水
                          </span>
                        </div>
                        <p className="text-[11px] text-amber-200/80 mt-0.5 truncate">
                          {stats.summaryItems.join(' · ')}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          aria-label={`删除配兵方案 ${fav.name}`}
                          onClick={() => onDeleteFavoriteArmy(fav.id)}
                          className="clash-btn w-9 h-9 rounded-lg bg-[#1c120a] border border-[#5c3a1d] text-amber-300/80 hover:text-red-300 flex items-center justify-center cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={!canQueue}
                          title={!preview.ok ? preview.reason : '一键按此方案训练'}
                          onClick={() => onQueueFavoriteArmy(fav.id)}
                          className={`clash-btn h-9 px-3 rounded-lg text-xs font-extrabold border flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                            canQueue
                              ? 'bg-emerald-500 border-emerald-950 text-emerald-950 hover:bg-emerald-400'
                              : 'bg-[#22170e] border-[#422a15] text-amber-500/45 cursor-not-allowed'
                          }`}
                        >
                          <Zap className="w-3.5 h-3.5" />
                          一键训练
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Troops */}
          <section>
            <h3 className="text-sm font-extrabold text-amber-200 mb-3">
              兵种训练（兵营最高 {caps.maxBarracksLevel} 级）
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {TROOP_ORDER.map((tType) => {
                const def = TROOP_CATALOG[tType];
                const count = village.army[tType] ?? 0;
                const locked = caps.maxBarracksLevel < def.barracksLevelRequired;
                const spaceFull = usedTroops + def.housingSpace > caps.maxTroopSpace;
                const lowElixir = village.elixir < def.trainCostElixir;
                const upgradeInfo = getTroopUpgradeInfo(village, tType);
                const combatDetails = getTroopCombatDetails(tType, upgradeInfo.currentLevel);
                const isDetailsOpen = !locked && Boolean(expandedTroops[tType]);
                const hpGain = upgradeInfo.nextStats
                  ? upgradeInfo.nextStats.hp - upgradeInfo.currentStats.hp
                  : 0;
                const dpsGain = upgradeInfo.nextStats
                  ? upgradeInfo.nextStats.dps - upgradeInfo.currentStats.dps
                  : 0;

                return (
                  <div
                    key={tType}
                    data-testid={`troop-card-${tType}`}
                    className="rounded-xl bg-[#3a2717] border-2 border-[#6e4723] p-3 flex flex-col justify-between gap-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-[#1c120a] border border-[#6e4723] p-1 flex items-center justify-center shrink-0">
                        <TroopSpriteThumb
                          type={tType}
                          alt={def.name}
                          className="w-full h-full"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-sm font-extrabold text-amber-100 truncate">
                              {def.name}
                            </span>
                            <span
                              data-testid={`troop-level-${tType}`}
                              className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-[#1c120a] border border-amber-500/50 text-amber-300 tabular-nums shrink-0"
                            >
                              Lv.{upgradeInfo.currentLevel}
                            </span>
                          </div>
                          <span className="text-xs font-extrabold text-sky-300 tabular-nums shrink-0">
                            ×{count}
                          </span>
                        </div>
                        <p className="text-[11px] text-amber-200/80 leading-tight mt-0.5">
                          {def.role}
                        </p>
                        <div
                          data-testid={`troop-stats-${tType}`}
                          className="text-[10px] text-amber-300/75 mt-1 tabular-nums"
                        >
                          占用 {def.housingSpace} 人口 · HP {upgradeInfo.currentStats.hp} · 秒伤{' '}
                          {upgradeInfo.currentStats.dps}
                        </div>
                      </div>
                    </div>

                    {/* Unlocked Troop Detailed Combat Stats Toggle & Expandable Panel */}
                    {!locked && (
                      <div className="space-y-1.5">
                        <button
                          type="button"
                          data-testid={`troop-details-toggle-${tType}`}
                          aria-expanded={isDetailsOpen}
                          onClick={() => toggleTroopDetails(tType)}
                          className="w-full rounded-lg bg-[#2a1b0f] hover:bg-[#322012] border border-[#5c3a1d] px-2.5 py-1 flex items-center justify-between text-[11px] font-bold text-amber-200/90 cursor-pointer transition-colors"
                        >
                          <span className="flex items-center gap-1.5">
                            <Info className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                            <span>详细战斗数值</span>
                          </span>
                          <span className="flex items-center gap-1 text-[10px] text-amber-300/80">
                            <span>{isDetailsOpen ? '收起' : '展开'}</span>
                            {isDetailsOpen ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </span>
                        </button>

                        {isDetailsOpen && (
                          <div
                            data-testid={`troop-details-panel-${tType}`}
                            className="rounded-lg bg-[#1c120a]/95 border border-amber-700/50 p-2.5 grid grid-cols-2 gap-x-2.5 gap-y-1.5 text-[10px] tabular-nums"
                          >
                            <div>
                              <span className="text-amber-300/65">伤害类型：</span>
                              <span className="font-bold text-amber-100">
                                {combatDetails.damageType}
                              </span>
                            </div>
                            <div>
                              <span className="text-amber-300/65">伤害半径：</span>
                              <span className="font-bold text-amber-100">
                                {combatDetails.damageRadius}
                              </span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-amber-300/65">目标偏好：</span>
                              <span className="font-bold text-sky-200">
                                {combatDetails.targetPreference}
                              </span>
                            </div>
                            <div>
                              <span className="text-amber-300/65">攻击距离：</span>
                              <span className="font-bold text-amber-100">
                                {combatDetails.attackRange}
                              </span>
                            </div>
                            <div>
                              <span className="text-amber-300/65">攻速/移速：</span>
                              <span className="font-bold text-amber-100">
                                {def.attackSpeed}s / {def.moveSpeed}
                              </span>
                            </div>
                            <div>
                              <span className="text-amber-300/65">单次伤害：</span>
                              <span className="font-bold text-amber-100">
                                {combatDetails.damagePerHit}
                              </span>
                            </div>
                            <div>
                              <span className="text-amber-300/65">兵种定位：</span>
                              <span className="font-bold text-amber-100">
                                {combatDetails.unitDomain}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="space-y-2 pt-2 border-t border-[#5c3a1d]">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 text-xs font-extrabold tabular-nums">
                          <ElixirIcon className="w-4 h-4" />
                          <span className={lowElixir ? 'text-red-400' : 'text-fuchsia-200'}>
                            {def.trainCostElixir}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {count > 0 && (
                            <button
                              type="button"
                              aria-label={`遣散一名${def.name}`}
                              onClick={() => onDismissTroop(tType)}
                              className="clash-btn w-7 h-7 rounded-lg bg-red-800 border border-red-950 text-white flex items-center justify-center cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={locked || spaceFull || lowElixir}
                            onClick={() => onTrainTroop(tType)}
                            className={`clash-btn px-3 py-1 rounded-lg text-xs font-extrabold border flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                              locked || spaceFull || lowElixir
                                ? 'bg-[#26190f] border-[#422a15] text-amber-500/50 cursor-not-allowed'
                                : 'bg-sky-500 border-sky-950 text-sky-950'
                            }`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            {locked
                              ? `需${def.barracksLevelRequired}级兵营`
                              : spaceFull
                                ? '已满'
                                : '训练'}
                          </button>
                        </div>
                      </div>

                      {/* Troop Level Upgrade Row with Post-Upgrade Preview */}
                      <div className="rounded-lg bg-[#24170d] border border-[#4d3219] px-2.5 py-1.5 flex items-center justify-between gap-2">
                        {locked ? (
                          <span className="text-[10px] font-bold text-amber-400/60">
                            需 {def.barracksLevelRequired} 级兵营解锁后可升级
                          </span>
                        ) : upgradeInfo.isMaxLevel ? (
                          <span className="text-[10px] font-extrabold text-emerald-300 tabular-nums">
                            已满级 Lv.{upgradeInfo.currentLevel}（属性已达上限）
                          </span>
                        ) : (
                          <>
                            <div
                              data-testid={`troop-upgrade-preview-${tType}`}
                              className="min-w-0 leading-tight"
                            >
                              <div className="text-[10px] font-extrabold text-emerald-300 tabular-nums">
                                升至 Lv.{upgradeInfo.nextLevel}：HP {upgradeInfo.nextStats?.hp}
                                <span className="text-amber-300/85"> (+{hpGain})</span> · 秒伤{' '}
                                {upgradeInfo.nextStats?.dps}
                                <span className="text-amber-300/85"> (+{dpsGain})</span>
                              </div>
                              <div className="text-[10px] font-bold text-amber-300/75 tabular-nums mt-0.5">
                                {upgradeInfo.canUpgrade
                                  ? `单次伤害 ${upgradeInfo.currentStats.damagePerHit} → ${upgradeInfo.nextStats?.damagePerHit}`
                                  : `升级条件：${upgradeInfo.blockReason}`}
                              </div>
                            </div>
                            {upgradeInfo.canUpgrade && (
                              <button
                                type="button"
                                data-testid={`upgrade-troop-${tType}`}
                                onClick={() => onUpgradeTroop(tType)}
                                className="clash-btn shrink-0 px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 border border-amber-950 text-amber-950 text-[11px] font-extrabold flex items-center gap-1 whitespace-nowrap cursor-pointer tabular-nums"
                              >
                                <ArrowUpCircle className="w-3.5 h-3.5" />
                                <span>升级</span>
                                <span className="opacity-85">· {upgradeInfo.elixirCost}水</span>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Spells */}
          <section>
            <h3 className="text-sm font-extrabold text-amber-200 mb-3">
              法术工厂（{caps.hasSpellFactory ? '已解锁' : '需建造法术工厂'}）
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SPELL_ORDER.map((sType) => {
                const def = SPELL_CATALOG[sType];
                const count = village.spells[sType] ?? 0;
                const locked = !caps.hasSpellFactory;
                const spaceFull = usedSpells + def.housingSpace > caps.maxSpellSpace;
                const lowElixir = village.elixir < def.brewCostElixir;

                return (
                  <div
                    key={sType}
                    className="rounded-xl bg-[#3a2717] border-2 border-[#6e4723] p-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <SpellBadgeIcon type={sType} className="w-11 h-11 shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-extrabold text-amber-100">
                            {def.name}
                          </span>
                          <span className="text-xs font-extrabold text-fuchsia-300 tabular-nums">
                            ×{count}
                          </span>
                        </div>
                        <p className="text-[11px] text-amber-200/80 mt-0.5">{def.role}</p>
                        <div className="flex items-center gap-1 text-xs font-extrabold text-fuchsia-200 mt-1 tabular-nums">
                          <ElixirIcon className="w-3.5 h-3.5" />
                          <span>{def.brewCostElixir}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {count > 0 && (
                        <button
                          type="button"
                          aria-label={`移除一个${def.name}`}
                          onClick={() => onDismissSpell(sType)}
                          className="clash-btn w-8 h-8 rounded-lg bg-red-800 border border-red-950 text-white flex items-center justify-center cursor-pointer"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={locked || spaceFull || lowElixir}
                        onClick={() => onBrewSpell(sType)}
                        className={`clash-btn px-3.5 py-1.5 rounded-lg text-xs font-extrabold border cursor-pointer ${
                          locked || spaceFull || lowElixir
                            ? 'bg-[#26190f] border-[#422a15] text-amber-500/50 cursor-not-allowed'
                            : 'bg-fuchsia-500 border-fuchsia-950 text-fuchsia-950'
                        }`}
                      >
                        {locked ? '未建造' : spaceFull ? '已满' : '炼制'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
