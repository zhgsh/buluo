import React from 'react';
import {
  ArrowLeft,
  FastForward,
  Pause,
  Play,
  RotateCcw,
  Settings,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { formatReplayEventLabel, type ReplayPlaybackState } from '../game/replayLogic';
import { ElixirIcon, GoldIcon, StarIcon } from '../game/svgIcons';

interface BattleReplayHUDProps {
  playback: ReplayPlaybackState;
  muted: boolean;
  toastMessage: string | null;
  onTogglePlayPause: () => void;
  onChangeSpeed: (speed: 1 | 2 | 4) => void;
  onRestart: () => void;
  onSeek: (targetSec: number) => void;
  onExitReplay: () => void;
  onToggleMute: () => void;
  onOpenSettings: () => void;
}

function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem < 10 ? '0' : ''}${rem}`;
}

export const BattleReplayHUD: React.FC<BattleReplayHUDProps> = ({
  playback,
  muted,
  toastMessage,
  onTogglePlayPause,
  onChangeSpeed,
  onRestart,
  onSeek,
  onExitReplay,
  onToggleMute,
  onOpenSettings,
}) => {
  const { replay, battle, cursor, speed, paused, finished, totalDurationSec, recentEvent } =
    playback;
  const elapsedClamped = Math.min(totalDurationSec, battle.elapsedSec);
  const nextEvent = replay.events[cursor] ?? null;

  return (
    <div
      data-testid="battle-replay-hud"
      className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-3 sm:p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="pointer-events-auto flex items-center gap-3 px-3.5 py-2 rounded-xl bg-[#2a1c11]/94 border-2 border-[#8b5e34] shadow-[0_4px_0_#140c06]">
          <div className="leading-tight">
            <div className="text-xs font-extrabold text-amber-100">
              {replay.targetName} · 战报回放
            </div>
            <div className="text-[11px] font-bold text-amber-300/80 tabular-nums mt-0.5">
              操作进度 {cursor}/{replay.events.length}
              {recentEvent
                ? ` · ${formatReplayEventLabel(recentEvent)} @ ${recentEvent.timeSec.toFixed(1)}s`
                : nextEvent
                  ? ` · 下一手 ${nextEvent.timeSec.toFixed(1)}s`
                  : ''}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center px-5 py-2 rounded-2xl bg-[#2a1c11]/94 border-2 border-amber-500 shadow-[0_4px_0_#140c06]">
          <div className="flex items-center gap-1.5">
            {[1, 2, 3].map((s) => (
              <StarIcon key={s} filled={battle.stars >= s} className="w-6 h-6" />
            ))}
          </div>
          <div className="text-base font-extrabold text-amber-100 tabular-nums mt-0.5">
            摧毁度 {battle.destructionPercent}%
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <div className="flex items-center gap-3 px-3.5 py-2 rounded-xl bg-[#2a1c11]/94 border-2 border-[#7c5329] shadow-[0_4px_0_#140c06] tabular-nums">
            <span className="flex items-center gap-1 text-sm font-extrabold text-amber-200">
              <GoldIcon className="w-4 h-4" />
              {battle.lootGold}
            </span>
            <span className="flex items-center gap-1 text-sm font-extrabold text-fuchsia-200">
              <ElixirIcon className="w-4 h-4" />
              {battle.lootElixir}
            </span>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onExitReplay();
            }}
            className="clash-btn h-10 px-3.5 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-700 border-2 border-emerald-950 shadow-[0_4px_0_#064e3b] text-white text-xs font-extrabold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            返回村庄
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label={muted ? '取消静音' : '静音'}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            className="clash-btn w-10 h-10 rounded-xl bg-[#2a1c11]/94 border-2 border-[#7c5329] text-amber-100 flex items-center justify-center cursor-pointer"
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
            className="clash-btn w-10 h-10 rounded-xl bg-[#2a1c11]/94 border-2 border-[#7c5329] text-amber-100 flex items-center justify-center cursor-pointer"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {toastMessage && (
        <div className="self-center px-5 py-2 rounded-xl bg-[#1c130b]/95 border-2 border-amber-500 text-amber-100 text-sm font-bold shadow-lg">
          {toastMessage}
        </div>
      )}

      {finished && (
        <div
          data-testid="replay-finished-banner"
          className="pointer-events-auto self-center w-full max-w-md rounded-2xl bg-[#2a1c11]/96 border-3 border-amber-500 shadow-2xl px-6 py-4 text-center space-y-3"
        >
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3].map((s) => (
              <StarIcon key={s} filled={battle.stars >= s} className="w-8 h-8" />
            ))}
          </div>
          <div>
            <div className="text-lg font-extrabold text-amber-100">
              回放结束 · {battle.stars > 0 ? '进攻胜利' : '进攻失利'}
            </div>
            <div className="text-xs font-bold text-amber-200/80 tabular-nums mt-0.5">
              摧毁度 {battle.destructionPercent}% · 金币 +{battle.lootGold} · 圣水 +
              {battle.lootElixir} · 用时 {Math.round(battle.elapsedSec)}s
            </div>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={onRestart}
              className="clash-btn h-10 px-4 rounded-xl bg-gradient-to-b from-amber-400 to-amber-600 border-2 border-amber-950 text-amber-950 text-xs font-extrabold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              重新播放
            </button>
            <button
              type="button"
              onClick={onExitReplay}
              className="clash-btn h-10 px-4 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-700 border-2 border-emerald-950 text-white text-xs font-extrabold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              返回村庄
            </button>
          </div>
        </div>
      )}

      <div className="pointer-events-auto self-center w-full max-w-3xl rounded-2xl bg-[#22160d]/95 border-2 border-[#7c5329] shadow-[0_6px_0_#140c06] px-4 py-3 space-y-2.5">
        <div className="flex items-center gap-3">
          <span className="text-xs font-extrabold text-amber-200 tabular-nums w-10 shrink-0">
            {formatClock(elapsedClamped)}
          </span>

          <div className="relative flex-1 flex items-center">
            <input
              type="range"
              aria-label="回放时间轴"
              min={0}
              max={totalDurationSec}
              step={0.1}
              value={Math.min(totalDurationSec, elapsedClamped)}
              onChange={(e) => onSeek(Number(e.target.value))}
              className="w-full accent-amber-400 cursor-pointer"
            />
          </div>

          <span className="text-xs font-bold text-amber-300/75 tabular-nums w-10 text-right shrink-0">
            {formatClock(totalDurationSec)}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={paused || finished ? '播放回放' : '暂停回放'}
              onClick={(e) => {
                e.currentTarget.blur();
                if (finished) {
                  onRestart();
                } else {
                  onTogglePlayPause();
                }
              }}
              className="clash-btn h-10 px-4 rounded-xl bg-gradient-to-b from-amber-400 to-amber-600 border-2 border-amber-950 text-amber-950 text-xs font-extrabold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              {paused || finished ? (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  {finished ? '重播' : '播放'}
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4 fill-current" />
                  暂停
                </>
              )}
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onRestart();
              }}
              className="clash-btn h-10 px-3 rounded-xl bg-[#3b2716] border border-[#7c5329] text-amber-100 text-xs font-extrabold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              从头播放
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-amber-200/75 flex items-center gap-1 mr-1">
              <FastForward className="w-3.5 h-3.5" />
              倍速
            </span>
            {([1, 2, 4] as const).map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => onChangeSpeed(spd)}
                className={`clash-btn h-10 min-w-[44px] px-3 rounded-xl border text-xs font-extrabold tabular-nums cursor-pointer ${
                  speed === spd
                    ? 'bg-amber-500 border-amber-950 text-amber-950'
                    : 'bg-[#3b2716] border-[#6e4723] text-amber-100'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
