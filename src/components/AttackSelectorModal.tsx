import React, { useState } from 'react';
import { RefreshCw, Swords, X } from 'lucide-react';
import {
  CAMPAIGN_STAGES,
  generateMultiplayerOpponent,
} from '../game/catalog';
import { ElixirIcon, GoldIcon, StarIcon } from '../game/svgIcons';
import type { BuildingType, CampaignStage, VillageState } from '../game/types';
import { getUsedTroopSpace } from '../game/villageLogic';

interface AttackSelectorModalProps {
  village: VillageState;
  onClose: () => void;
  onStartCampaign: (stage: CampaignStage) => void;
  onStartMultiplayer: (opponent: {
    name: string;
    thLevel: number;
    rewardGold: number;
    rewardElixir: number;
    buildings: Array<{ type: BuildingType; level: number; gx: number; gy: number }>;
  }) => void;
}

export const AttackSelectorModal: React.FC<AttackSelectorModalProps> = ({
  village,
  onClose,
  onStartCampaign,
  onStartMultiplayer,
}) => {
  const [tab, setTab] = useState<'campaign' | 'multiplayer'>('campaign');
  const [seedOffset, setSeedOffset] = useState(0);
  const opponent = generateMultiplayerOpponent(village.townHallLevel, seedOffset);
  const troopSpace = getUsedTroopSpace(village.army);
  const hasArmy = troopSpace > 0;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/65 p-4">
      <div
        role="dialog"
        aria-label="选择进攻目标"
        className="w-full max-w-3xl rounded-2xl bg-[#2a1c11] border-4 border-[#8b5e34] shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
      >
        <div className="flex items-center justify-between px-6 py-4 bg-[#1c120a] border-b-2 border-[#6e4723]">
          <div>
            <h2 className="text-xl font-extrabold text-amber-100">发起进攻</h2>
            <p className="text-xs text-amber-300/80 mt-0.5 tabular-nums">
              当前出征部队：{troopSpace} 人口
              {!hasArmy && ' · 请先在兵营训练至少一名士兵'}
            </p>
          </div>
          <button
            type="button"
            aria-label="关闭进攻选择"
            onClick={onClose}
            className="clash-btn w-9 h-9 rounded-xl bg-red-700 border border-red-950 text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="flex items-center gap-2 px-6 pt-4">
          <button
            type="button"
            onClick={() => setTab('campaign')}
            className={`clash-btn px-4 py-2 rounded-xl text-sm font-extrabold border-2 cursor-pointer ${
              tab === 'campaign'
                ? 'bg-red-600 border-red-950 text-white'
                : 'bg-[#1c120a] border-[#5c3a1d] text-amber-200'
            }`}
          >
            哥布林单人战役
          </button>
          <button
            type="button"
            onClick={() => setTab('multiplayer')}
            className={`clash-btn px-4 py-2 rounded-xl text-sm font-extrabold border-2 cursor-pointer ${
              tab === 'multiplayer'
                ? 'bg-red-600 border-red-950 text-white'
                : 'bg-[#1c120a] border-[#5c3a1d] text-amber-200'
            }`}
          >
            联机搜索对手
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {tab === 'campaign' ? (
            <div className="space-y-3">
              {CAMPAIGN_STAGES.map((stage) => {
                const stars = village.campaignStars[stage.id] ?? 0;
                return (
                  <div
                    key={stage.id}
                    className="rounded-xl bg-[#3a2717] border-2 border-[#6e4723] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-base font-extrabold text-amber-100">
                          {stage.name}
                        </h3>
                        <span className="text-xs font-bold text-amber-300/80">
                          推荐 {stage.recommendedTH} 本
                        </span>
                      </div>
                      <p className="text-xs text-amber-200/75">{stage.subtitle}</p>
                      <div className="flex items-center gap-4 pt-1 text-xs font-extrabold tabular-nums">
                        <span className="flex items-center gap-1 text-amber-300">
                          <GoldIcon className="w-4 h-4" />
                          {stage.rewardGold}
                        </span>
                        <span className="flex items-center gap-1 text-fuchsia-300">
                          <ElixirIcon className="w-4 h-4" />
                          {stage.rewardElixir}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="flex items-center gap-1" aria-label={`已获得 ${stars} 星`}>
                        {[1, 2, 3].map((s) => (
                          <StarIcon key={s} filled={stars >= s} className="w-5 h-5" />
                        ))}
                      </div>
                      <button
                        type="button"
                        disabled={!hasArmy}
                        onClick={() => onStartCampaign(stage)}
                        className={`clash-btn px-4 py-2.5 rounded-xl text-sm font-extrabold border-2 flex items-center gap-2 cursor-pointer ${
                          hasArmy
                            ? 'bg-gradient-to-b from-red-500 to-red-700 border-red-950 text-white'
                            : 'bg-[#26190f] border-[#422a15] text-amber-500/50 cursor-not-allowed'
                        }`}
                      >
                        <Swords className="w-4 h-4" />
                        进攻
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl bg-[#3a2717] border-2 border-[#6e4723] p-6 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-bold text-amber-300/80">匹配敌方部落</div>
                  <h3 className="text-2xl font-extrabold text-amber-100 mt-1">
                    {opponent.name}
                  </h3>
                  <div className="text-sm text-amber-200/80 mt-1 tabular-nums">
                    敌方大本营 Lv.{opponent.thLevel} · 建筑总数 {opponent.buildings.length}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSeedOffset((s) => s + 1)}
                  className="clash-btn px-4 py-2 rounded-xl bg-amber-500 border-2 border-amber-950 text-amber-950 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  下一个对手
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-[#24170d] border border-[#5c3a1d] p-3.5 flex items-center gap-3">
                  <GoldIcon className="w-7 h-7" />
                  <div>
                    <div className="text-xs text-amber-300/80">可掠夺金币</div>
                    <div className="text-lg font-extrabold text-amber-200 tabular-nums">
                      {opponent.rewardGold}
                    </div>
                  </div>
                </div>
                <div className="rounded-xl bg-[#24170d] border border-[#5c3a1d] p-3.5 flex items-center gap-3">
                  <ElixirIcon className="w-7 h-7" />
                  <div>
                    <div className="text-xs text-fuchsia-300/80">可掠夺圣水</div>
                    <div className="text-lg font-extrabold text-fuchsia-200 tabular-nums">
                      {opponent.rewardElixir}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={!hasArmy}
                  onClick={() => onStartMultiplayer(opponent)}
                  className={`clash-btn px-6 py-3 rounded-xl text-base font-extrabold border-2 flex items-center gap-2 cursor-pointer ${
                    hasArmy
                      ? 'bg-gradient-to-b from-red-500 to-red-700 border-red-950 text-white'
                      : 'bg-[#26190f] border-[#422a15] text-amber-500/50 cursor-not-allowed'
                  }`}
                >
                  <Swords className="w-5 h-5" />
                  立即开战
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
