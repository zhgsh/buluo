import React from 'react';
import { Check, ClipboardList, X } from 'lucide-react';
import { ElixirIcon, GemIcon, GoldIcon } from '../game/svgIcons';
import type { DailyMissionsState } from '../game/types';

interface DailyMissionsModalProps {
  dailyMissions: DailyMissionsState;
  onClose: () => void;
  onClaim: (missionId: string) => void;
}

export const DailyMissionsModal: React.FC<DailyMissionsModalProps> = ({
  dailyMissions,
  onClose,
  onClaim,
}) => {
  const completedCount = dailyMissions.missions.filter(
    (m) => m.progress >= m.target
  ).length;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/65 p-4">
      <div
        role="dialog"
        aria-label="每日任务"
        className="w-full max-w-xl rounded-2xl bg-[#2a1c11] border-4 border-[#8b5e34] shadow-2xl overflow-hidden flex flex-col max-h-[86vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#1c120a] border-b-2 border-[#6e4723]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 border-2 border-amber-950 flex items-center justify-center text-amber-950">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-amber-100">每日任务</h2>
              <p className="text-xs text-amber-300/80 mt-0.5 tabular-nums">
                {dailyMissions.dateKey} · 今日完成 {completedCount}/{dailyMissions.missions.length}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="关闭每日任务"
            onClick={onClose}
            className="clash-btn w-9 h-9 rounded-xl bg-red-700 border border-red-950 text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mission List */}
        <div className="p-6 space-y-3.5 overflow-y-auto">
          {dailyMissions.missions.map((mission) => {
            const pct = Math.min(100, Math.round((mission.progress / mission.target) * 100));
            const isComplete = mission.progress >= mission.target;

            return (
              <div
                key={mission.id}
                className="rounded-xl bg-[#3a2717] border-2 border-[#6e4723] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-extrabold text-amber-100">
                      {mission.title}
                    </h3>
                    <span className="text-xs font-extrabold text-amber-300 tabular-nums shrink-0">
                      {mission.progress} / {mission.target}
                    </span>
                  </div>

                  <p className="text-xs text-amber-200/80 leading-snug">
                    {mission.description}
                  </p>

                  {/* Progress Bar */}
                  <div className="w-full h-2.5 rounded-full bg-[#140c06] border border-[#5c3a1d] overflow-hidden">
                    <div
                      className={`h-full transition-[width] duration-200 ${
                        isComplete ? 'bg-emerald-400' : 'bg-amber-400'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Reward + Claim Button */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2.5 shrink-0 sm:min-w-[112px]">
                  <div className="flex items-center gap-1.5 text-sm font-extrabold tabular-nums">
                    {mission.rewardType === 'gold' ? (
                      <GoldIcon className="w-5 h-5" />
                    ) : mission.rewardType === 'elixir' ? (
                      <ElixirIcon className="w-5 h-5" />
                    ) : (
                      <GemIcon className="w-5 h-5" />
                    )}
                    <span
                      className={
                        mission.rewardType === 'gold'
                          ? 'text-amber-200'
                          : mission.rewardType === 'elixir'
                            ? 'text-fuchsia-200'
                            : 'text-emerald-300'
                      }
                    >
                      +{mission.rewardAmount}
                    </span>
                  </div>

                  {mission.claimed ? (
                    <span className="px-3.5 py-1.5 rounded-lg bg-[#24170d] border border-[#5c3a1d] text-emerald-400 text-xs font-extrabold inline-flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      已领取
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={!isComplete}
                      onClick={() => onClaim(mission.id)}
                      className={`clash-btn px-4 py-1.5 rounded-lg text-xs font-extrabold border-2 cursor-pointer whitespace-nowrap ${
                        isComplete
                          ? 'bg-gradient-to-b from-emerald-400 to-emerald-600 border-emerald-950 text-emerald-950 shadow-[0_3px_0_#064e3b]'
                          : 'bg-[#26190f] border-[#422a15] text-amber-400/50 cursor-not-allowed'
                      }`}
                    >
                      {isComplete ? '领取奖励' : '进行中'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
