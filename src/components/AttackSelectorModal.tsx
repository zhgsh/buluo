import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Crosshair,
  Lightbulb,
  RefreshCw,
  ShieldCheck,
  Swords,
  X,
} from 'lucide-react';
import {
  CAMPAIGN_STAGES,
  generateMultiplayerOpponent,
} from '../game/catalog';
import {
  evaluateAttackStrategy,
  type StrategyReadiness,
} from '../game/strategyLogic';
import { ElixirIcon, GoldIcon, StarIcon } from '../game/svgIcons';
import type { BuildingType, CampaignStage, VillageState } from '../game/types';
import { getUsedTroopSpace } from '../game/villageLogic';
import { TroopSpriteThumb } from './TroopSpriteThumb';

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

const READINESS_STYLES: Record<
  StrategyReadiness,
  { border: string; badge: string; text: string }
> = {
  favorable: {
    border: 'border-emerald-600/80 bg-[#1a2b1c]/85',
    badge: 'text-emerald-300',
    text: 'text-emerald-200',
  },
  balanced: {
    border: 'border-amber-500/80 bg-[#271d10]/90',
    badge: 'text-amber-300',
    text: 'text-amber-100',
  },
  risky: {
    border: 'border-orange-500/85 bg-[#2d180e]/90',
    badge: 'text-orange-300',
    text: 'text-orange-100',
  },
  unready: {
    border: 'border-red-600/85 bg-[#2b1212]/90',
    badge: 'text-red-300',
    text: 'text-red-100',
  },
};

export const AttackSelectorModal: React.FC<AttackSelectorModalProps> = ({
  village,
  onClose,
  onStartCampaign,
  onStartMultiplayer,
}) => {
  const [tab, setTab] = useState<'campaign' | 'multiplayer'>('campaign');
  const [seedOffset, setSeedOffset] = useState(0);
  const [selectedStageId, setSelectedStageId] = useState<number>(() => {
    const nextStage = CAMPAIGN_STAGES.find((s) => (village.campaignStars[s.id] ?? 0) < 3);
    return nextStage?.id ?? CAMPAIGN_STAGES[0].id;
  });

  const opponent = useMemo(
    () => generateMultiplayerOpponent(village.townHallLevel, seedOffset),
    [village.townHallLevel, seedOffset]
  );

  const selectedStage =
    CAMPAIGN_STAGES.find((s) => s.id === selectedStageId) ?? CAMPAIGN_STAGES[0];

  const activeTarget = useMemo(
    () =>
      tab === 'campaign'
        ? {
            name: selectedStage.name,
            thLevel: selectedStage.recommendedTH,
            buildings: selectedStage.buildings,
          }
        : {
            name: opponent.name,
            thLevel: opponent.thLevel,
            buildings: opponent.buildings,
          },
    [tab, selectedStage, opponent]
  );

  const strategy = useMemo(
    () => evaluateAttackStrategy(village, activeTarget),
    [village, activeTarget]
  );

  const troopSpace = getUsedTroopSpace(village.army);
  const hasArmy = troopSpace > 0;
  const readinessStyle = READINESS_STYLES[strategy.readiness];
  const defenseItems: string[] = [`${strategy.targetTH} 级大本营`];
  if (strategy.defenseSummary.cannonCount > 0) {
    defenseItems.push(`加农炮 ×${strategy.defenseSummary.cannonCount}`);
  }
  if (strategy.defenseSummary.archerTowerCount > 0) {
    defenseItems.push(`箭塔 ×${strategy.defenseSummary.archerTowerCount}`);
  }
  if (strategy.defenseSummary.mortarCount > 0) {
    defenseItems.push(`迫击炮 ×${strategy.defenseSummary.mortarCount}`);
  }
  if (strategy.defenseSummary.airDefenseCount > 0) {
    defenseItems.push(`防空 ×${strategy.defenseSummary.airDefenseCount}`);
  }
  if (strategy.defenseSummary.wizardTowerCount > 0) {
    defenseItems.push(`法师塔 ×${strategy.defenseSummary.wizardTowerCount}`);
  }
  if (strategy.defenseSummary.wallCount > 0) {
    defenseItems.push(`城墙 ×${strategy.defenseSummary.wallCount}`);
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/65 p-4">
      <div
        role="dialog"
        aria-label="选择进攻目标"
        className="w-full max-w-3xl rounded-2xl bg-[#2a1c11] border-4 border-[#8b5e34] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between px-6 py-4 bg-[#1c120a] border-b-2 border-[#6e4723] shrink-0">
          <div>
            <h2 className="text-xl font-extrabold text-amber-100">发起进攻</h2>
            <p className="text-xs text-amber-300/80 mt-0.5 tabular-nums">
              当前出征部队：{troopSpace}/{strategy.armySummary.maxSpace} 人口
              {strategy.armySummary.reinforcementSpace > 0 &&
                ` · 援军 ${strategy.armySummary.reinforcementSpace} 人口`}
              {!hasArmy && ' · 请先在兵营训练至少一名士兵'}
            </p>
          </div>
          <button
            type="button"
            aria-label="关闭进攻选择"
            onClick={onClose}
            className="clash-btn w-10 h-10 rounded-xl bg-red-700 border border-red-950 text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="flex items-center gap-2 px-6 pt-3.5 shrink-0">
          <button
            type="button"
            onClick={() => setTab('campaign')}
            className={`clash-btn h-10 px-4 rounded-xl text-sm font-extrabold border-2 cursor-pointer ${
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
            className={`clash-btn h-10 px-4 rounded-xl text-sm font-extrabold border-2 cursor-pointer ${
              tab === 'multiplayer'
                ? 'bg-red-600 border-red-950 text-white'
                : 'bg-[#1c120a] border-[#5c3a1d] text-amber-200'
            }`}
          >
            联机搜索对手
          </button>
        </div>

        <div className="p-6 pt-4 overflow-y-auto space-y-4">
          {/* Attack Strategy Hint Panel */}
          <section
            data-testid="attack-strategy-panel"
            aria-label="进攻战术建议"
            className={`rounded-2xl border-2 p-4 space-y-3 ${readinessStyle.border}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Crosshair className={`w-4 h-4 shrink-0 ${readinessStyle.badge}`} />
                <h3 className="text-sm font-extrabold text-amber-100">
                  战术分析 · {strategy.targetName}
                </h3>
              </div>
              <div
                data-testid="strategy-readiness"
                className={`flex items-center gap-2 text-xs font-extrabold tabular-nums ${readinessStyle.badge}`}
              >
                {strategy.readiness === 'favorable' ? (
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                ) : strategy.readiness === 'risky' || strategy.readiness === 'unready' ? (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                ) : null}
                <span>{strategy.readinessLabel}</span>
                {strategy.readiness !== 'unready' && (
                  <span className="text-amber-200/80">· 契合度 {strategy.matchupScore} 分</span>
                )}
              </div>
            </div>

            <div className="text-[11px] font-bold text-amber-200/80 tabular-nums">
              敌防侦察：{defenseItems.join(' · ')}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {strategy.recommendedTroops.slice(0, 3).map((rec, idx) => {
                const totalHeld = rec.ownedCount + rec.reinforcementCount;
                return (
                  <div
                    key={rec.troopType}
                    data-testid={`strategy-rec-${rec.troopType}`}
                    className="rounded-xl bg-[#160f09]/85 border border-[#5c3a1d] p-2.5 flex items-start gap-2.5"
                  >
                    <TroopSpriteThumb
                      type={rec.troopType}
                      alt={rec.name}
                      className="w-9 h-9 shrink-0 mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-extrabold text-amber-100 truncate">
                          {idx + 1}. {rec.name}
                        </span>
                        <span className="text-[11px] font-extrabold text-emerald-300 tabular-nums shrink-0">
                          {rec.effectivenessScore}%
                        </span>
                      </div>
                      <div className="text-[10px] font-bold text-amber-300/85 tabular-nums mt-0.5">
                        {totalHeld > 0
                          ? `当前已带 ${totalHeld} 名`
                          : rec.unlocked
                            ? '当前未携带 · 可在兵营训练'
                            : `需 ${rec.barracksRequired} 级兵营解锁`}
                      </div>
                      <p className="text-[11px] text-amber-200/75 leading-snug mt-1">
                        {rec.reason}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-start gap-2 pt-0.5 text-xs font-bold text-amber-100/95">
              <Lightbulb className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div data-testid="strategy-action-tip">{strategy.actionTip}</div>
                {strategy.warnings.length > 1 && (
                  <div className="text-[11px] font-normal text-amber-200/75">
                    其他提示：{strategy.warnings.slice(1).join('；')}
                  </div>
                )}
              </div>
            </div>
          </section>

          {tab === 'campaign' ? (
            <div className="space-y-3">
              {CAMPAIGN_STAGES.map((stage) => {
                const stars = village.campaignStars[stage.id] ?? 0;
                const isSelected = stage.id === selectedStage.id;
                return (
                  <div
                    key={stage.id}
                    data-testid={`campaign-stage-${stage.id}`}
                    onClick={() => setSelectedStageId(stage.id)}
                    className={`rounded-xl border-2 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#462f1c] border-amber-400 shadow-[0_0_0_1px_rgba(251,191,36,0.35)]'
                        : 'bg-[#3a2717] border-[#6e4723] hover:border-amber-600/80'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-base font-extrabold text-amber-100">
                          {stage.name}
                        </h3>
                        <span className="text-xs font-bold text-amber-300/80 tabular-nums">
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
                        onClick={(e) => {
                          e.stopPropagation();
                          onStartCampaign(stage);
                        }}
                        className={`clash-btn h-10 px-4 rounded-xl text-sm font-extrabold border-2 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
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
                  className="clash-btn h-10 px-4 rounded-xl bg-amber-500 border-2 border-amber-950 text-amber-950 text-xs font-extrabold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
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
                  className={`clash-btn px-6 py-3 rounded-xl text-base font-extrabold border-2 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
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
