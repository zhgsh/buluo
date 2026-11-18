import React from 'react';
import { Film, Play, Trash2, X } from 'lucide-react';
import { SPELL_CATALOG, TROOP_CATALOG } from '../game/catalog';
import { ElixirIcon, GoldIcon, StarIcon, TrophyIcon } from '../game/svgIcons';
import type { BattleReplay, SpellType, TroopType } from '../game/types';

interface ReplayListModalProps {
  replays: BattleReplay[];
  onClose: () => void;
  onWatchReplay: (replay: BattleReplay) => void;
  onDeleteReplay: (replayId: string) => void;
}

function formatRecordedAt(epochMs: number): string {
  const d = new Date(epochMs);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hh}:${mm}`;
}

function formatTroopSummary(replay: BattleReplay): string {
  const parts: string[] = [];
  for (const [key, count] of Object.entries(replay.result.troopsDeployed)) {
    if ((count ?? 0) > 0) {
      parts.push(`${TROOP_CATALOG[key as TroopType]?.name ?? key} ×${count}`);
    }
  }
  if (replay.result.reinforcementsDeployed) {
    for (const [key, count] of Object.entries(replay.result.reinforcementsDeployed)) {
      if ((count ?? 0) > 0) {
        parts.push(`援军·${TROOP_CATALOG[key as TroopType]?.name ?? key} ×${count}`);
      }
    }
  }
  for (const [key, count] of Object.entries(replay.result.spellsUsed)) {
    if ((count ?? 0) > 0) {
      parts.push(`${SPELL_CATALOG[key as SpellType]?.name ?? key} ×${count}`);
    }
  }
  return parts.length > 0 ? parts.join(' · ') : '未部署部队';
}

export const ReplayListModal: React.FC<ReplayListModalProps> = ({
  replays,
  onClose,
  onWatchReplay,
  onDeleteReplay,
}) => {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/65 p-4">
      <div
        role="dialog"
        aria-label="战斗回放"
        data-testid="replay-list-modal"
        className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl bg-[#2a1c11] border-4 border-[#8b5e34] shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#3b2818] border-b-2 border-[#6e4723]">
          <div className="flex items-center gap-2.5">
            <Film className="w-6 h-6 text-amber-300" />
            <div>
              <h2 className="text-lg font-extrabold text-amber-100">战斗回放中心</h2>
              <p className="text-xs text-amber-200/75 tabular-nums">
                记录每一次布阵投放坐标与时间轴 · 共 {replays.length} 场战报
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="关闭战斗回放"
            onClick={onClose}
            className="clash-btn w-10 h-10 rounded-xl bg-[#23160c] border border-[#6e4723] text-amber-200 flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {replays.length === 0 ? (
            <div className="rounded-2xl bg-[#1e140c] border-2 border-[#4d3219] p-8 text-center">
              <Film className="w-10 h-10 text-amber-400/50 mx-auto mb-2.5" />
              <div className="text-base font-extrabold text-amber-100">
                暂无战斗回放记录
              </div>
              <p className="text-xs text-amber-200/70 mt-1">
                发起哥布林战役或多人掠夺后，系统将自动记录兵种投放坐标与时间轴以供重温
              </p>
            </div>
          ) : (
            replays.map((replay) => {
              const summary = formatTroopSummary(replay);
              return (
                <div
                  key={replay.id}
                  data-testid={`replay-item-${replay.id}`}
                  className="rounded-xl bg-[#1e140c] border-2 border-[#5c3a1d] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-0.5 shrink-0">
                        {[1, 2, 3].map((s) => (
                          <StarIcon
                            key={s}
                            filled={replay.result.stars >= s}
                            className="w-4 h-4"
                          />
                        ))}
                      </div>
                      <span className="text-sm font-extrabold text-amber-100 truncate">
                        {replay.targetName}
                      </span>
                      <span className="text-xs font-bold text-amber-300/75 tabular-nums">
                        {replay.targetTH} 级大本营 · {replay.isCampaign ? '单人战役' : '联机掠夺'} ·{' '}
                        {formatRecordedAt(replay.recordedAtMs)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold tabular-nums">
                      <span
                        className={
                          replay.result.victory ? 'text-emerald-400' : 'text-red-400'
                        }
                      >
                        {replay.result.victory ? '胜利' : '失利'} · 摧毁度{' '}
                        {replay.result.destructionPercent}%
                      </span>
                      <span className="text-amber-200/80">
                        耗时 {replay.result.durationSec}s · 投放操作 {replay.events.length} 次
                      </span>
                      <span className="flex items-center gap-1 text-amber-300">
                        <GoldIcon className="w-3.5 h-3.5" />+{replay.result.lootGold}
                      </span>
                      <span className="flex items-center gap-1 text-fuchsia-300">
                        <ElixirIcon className="w-3.5 h-3.5" />+{replay.result.lootElixir}
                      </span>
                      <span
                        className={`flex items-center gap-1 ${
                          replay.result.trophyDelta >= 0
                            ? 'text-emerald-300'
                            : 'text-red-300'
                        }`}
                      >
                        <TrophyIcon className="w-3.5 h-3.5" />
                        {replay.result.trophyDelta >= 0
                          ? `+${replay.result.trophyDelta}`
                          : replay.result.trophyDelta}
                      </span>
                    </div>

                    <div className="text-[11px] text-amber-200/75 truncate">{summary}</div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      aria-label={`删除 ${replay.targetName} 回放`}
                      onClick={() => onDeleteReplay(replay.id)}
                      className="clash-btn w-10 h-10 rounded-xl bg-[#2a1c11] border border-[#5c3a1d] text-amber-300/80 hover:text-red-300 flex items-center justify-center cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onWatchReplay(replay)}
                      className="clash-btn h-10 px-4 rounded-xl bg-gradient-to-b from-amber-400 to-amber-600 border-2 border-amber-950 shadow-[0_3px_0_#451a03] text-amber-950 text-xs font-extrabold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      观看回放
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
