import React from 'react';
import { Minus, Plus, RotateCcw, X } from 'lucide-react';
import {
  SPELL_CATALOG,
  SPELL_ORDER,
  TROOP_CATALOG,
  TROOP_ORDER,
} from '../game/catalog';
import { ElixirIcon, SpellBadgeIcon } from '../game/svgIcons';
import { TroopSpriteThumb } from './TroopSpriteThumb';
import type { SpellType, TroopType, VillageState } from '../game/types';
import {
  getResourceCaps,
  getUsedSpellSpace,
  getUsedTroopSpace,
  hasTrainingQueueEntries,
  repeatTrainingQueue,
} from '../game/villageLogic';

interface BarracksModalProps {
  village: VillageState;
  onClose: () => void;
  onTrainTroop: (type: TroopType) => void;
  onDismissTroop: (type: TroopType) => void;
  onBrewSpell: (type: SpellType) => void;
  onDismissSpell: (type: SpellType) => void;
  onRepeatLastQueue: () => void;
}

export const BarracksModal: React.FC<BarracksModalProps> = ({
  village,
  onClose,
  onTrainTroop,
  onDismissTroop,
  onBrewSpell,
  onDismissSpell,
  onRepeatLastQueue,
}) => {
  const caps = getResourceCaps(village);
  const usedTroops = getUsedTroopSpace(village.army);
  const usedSpells = getUsedSpellSpace(village.spells);
  const lastQueue = village.lastTrainingQueue;
  const hasSavedQueue = hasTrainingQueueEntries(lastQueue);
  const repeatPreview = hasSavedQueue ? repeatTrainingQueue(village, lastQueue) : null;
  const canRepeat = Boolean(repeatPreview?.ok);

  const queueSummaryItems: string[] = [];
  let queueTroopSpace = 0;
  let queueSpellSpace = 0;
  let queueElixirCost = 0;

  if (lastQueue) {
    for (const tType of TROOP_ORDER) {
      const count = lastQueue.army?.[tType] ?? 0;
      if (count > 0) {
        const def = TROOP_CATALOG[tType];
        queueSummaryItems.push(`${def.name}×${count}`);
        queueTroopSpace += def.housingSpace * count;
        queueElixirCost += def.trainCostElixir * count;
      }
    }
    for (const sType of SPELL_ORDER) {
      const count = lastQueue.spells?.[sType] ?? 0;
      if (count > 0) {
        const def = SPELL_CATALOG[sType];
        queueSummaryItems.push(`${def.name}×${count}`);
        queueSpellSpace += def.housingSpace * count;
        queueElixirCost += def.brewCostElixir * count;
      }
    }
  }

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
            className="clash-btn w-9 h-9 rounded-xl bg-red-700 border border-red-950 text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
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
              className={`clash-btn shrink-0 px-4 py-2 rounded-xl text-xs font-extrabold border-2 flex items-center justify-center gap-1.5 cursor-pointer ${
                canRepeat
                  ? 'bg-emerald-500 border-emerald-950 text-emerald-950 hover:bg-emerald-400'
                  : 'bg-[#26190f] border-[#422a15] text-amber-500/50 cursor-not-allowed'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              一键重复上次训练队列
            </button>
          </div>

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

                return (
                  <div
                    key={tType}
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
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-sm font-extrabold text-amber-100">
                            {def.name}
                          </span>
                          <span className="text-xs font-extrabold text-sky-300 tabular-nums">
                            ×{count}
                          </span>
                        </div>
                        <p className="text-[11px] text-amber-200/80 leading-tight mt-0.5">
                          {def.role}
                        </p>
                        <div className="text-[10px] text-amber-300/70 mt-1 tabular-nums">
                          占用 {def.housingSpace} 人口 · HP {def.hp} · 秒伤 {def.dps}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#5c3a1d]">
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
                          className={`clash-btn px-3 py-1 rounded-lg text-xs font-extrabold border flex items-center gap-1 cursor-pointer ${
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
