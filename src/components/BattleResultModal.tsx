import React from 'react';
import { TROOP_CATALOG } from '../game/catalog';
import { ElixirIcon, GoldIcon, StarIcon, TrophyIcon } from '../game/svgIcons';
import type { BattleResult, TroopType } from '../game/types';

interface BattleResultModalProps {
  result: BattleResult;
  onReturnHome: () => void;
}

export const BattleResultModal: React.FC<BattleResultModalProps> = ({
  result,
  onReturnHome,
}) => {
  const deployedEntries = Object.entries(result.troopsDeployed).filter(
    ([, count]) => (count ?? 0) > 0
  );

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
      <div
        role="dialog"
        aria-label={result.victory ? '战斗胜利' : '战斗结束'}
        className="w-full max-w-md rounded-2xl bg-[#2a1c11] border-4 border-amber-500 shadow-2xl overflow-hidden text-center"
      >
        <div
          className={`px-6 py-5 border-b-2 ${
            result.victory
              ? 'bg-gradient-to-b from-amber-500 to-amber-700 border-amber-950'
              : 'bg-gradient-to-b from-red-700 to-red-900 border-red-950'
          }`}
        >
          <div className="flex items-center justify-center gap-2 mb-2">
            {[1, 2, 3].map((s) => (
              <StarIcon
                key={s}
                filled={result.stars >= s}
                className={s === 2 ? 'w-11 h-11 -mt-2' : 'w-9 h-9'}
              />
            ))}
          </div>
          <h2 className="text-2xl font-extrabold text-white text-stroke-dark">
            {result.victory ? '大获全胜！' : '进攻失利'}
          </h2>
          <p className="text-xs font-bold text-amber-100 mt-1">
            {result.targetName} · 用时 {result.durationSec}s
          </p>
        </div>

        <div className="p-6 space-y-4">
          {/* Core Metrics */}
          <div className="grid grid-cols-3 gap-2.5 tabular-nums">
            <div className="rounded-xl bg-[#1c120a] border border-[#5c3a1d] p-3">
              <div className="text-[11px] text-amber-300/80">摧毁度</div>
              <div className="text-lg font-extrabold text-amber-100 mt-0.5">
                {result.destructionPercent}%
              </div>
            </div>
            <div className="rounded-xl bg-[#1c120a] border border-[#5c3a1d] p-3">
              <div className="text-[11px] text-amber-300/80">大本营</div>
              <div
                className={`text-sm font-extrabold mt-1 ${
                  result.townHallDestroyed ? 'text-emerald-400' : 'text-amber-400/70'
                }`}
              >
                {result.townHallDestroyed ? '已摧毁' : '未摧毁'}
              </div>
            </div>
            <div className="rounded-xl bg-[#1c120a] border border-[#5c3a1d] p-3">
              <div className="text-[11px] text-amber-300/80 flex items-center justify-center gap-1">
                <TrophyIcon className="w-3.5 h-3.5" />
                奖杯
              </div>
              <div
                className={`text-lg font-extrabold mt-0.5 ${
                  result.trophyDelta >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {result.trophyDelta >= 0 ? `+${result.trophyDelta}` : result.trophyDelta}
              </div>
            </div>
          </div>

          {/* Loot Earned */}
          <div className="rounded-xl bg-[#3a2717] border-2 border-[#6e4723] p-3.5 flex items-center justify-around tabular-nums">
            <div className="flex items-center gap-2">
              <GoldIcon className="w-6 h-6" />
              <div className="text-left">
                <div className="text-[10px] text-amber-300/80">掠夺金币</div>
                <div className="text-base font-extrabold text-amber-200">
                  +{result.lootGold}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ElixirIcon className="w-6 h-6" />
              <div className="text-left">
                <div className="text-[10px] text-fuchsia-300/80">掠夺圣水</div>
                <div className="text-base font-extrabold text-fuchsia-200">
                  +{result.lootElixir}
                </div>
              </div>
            </div>
          </div>

          {/* Troops Deployed Summary */}
          {deployedEntries.length > 0 && (
            <div className="text-xs text-amber-200/80">
              出战部队：
              {deployedEntries
                .map(([k, v]) => `${TROOP_CATALOG[k as TroopType].name} ×${v}`)
                .join(' · ')}
            </div>
          )}

          <button
            type="button"
            data-start="true"
            onClick={onReturnHome}
            className="clash-btn w-full py-3 rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-600 border-2 border-emerald-950 shadow-[0_4px_0_#064e3b] text-emerald-950 font-extrabold text-base cursor-pointer"
          >
            返回村庄
          </button>
        </div>
      </div>
    </div>
  );
};
