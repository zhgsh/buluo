import React from 'react';
import { Music, Volume2, VolumeX } from 'lucide-react';

interface PauseModalProps {
  mode: 'village' | 'battle';
  muted: boolean;
  bgmVolume: number;
  onToggleMute: () => void;
  onChangeBgmVolume: (volume: number) => void;
  onResume: () => void;
  onSaveNow?: () => void;
  onResetVillage: () => void;
  onQuitToTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  mode,
  muted,
  bgmVolume,
  onToggleMute,
  onChangeBgmVolume,
  onResume,
  onSaveNow,
  onResetVillage,
  onQuitToTitle,
}) => {
  const volumePercent = Math.round(bgmVolume * 100);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
      <div
        role="dialog"
        aria-label="游戏暂停"
        className="w-full max-w-sm rounded-2xl bg-[#2a1c11] border-4 border-[#8b5e34] shadow-2xl p-6 text-center space-y-4"
      >
        <h2 className="text-2xl font-extrabold text-amber-100">
          {mode === 'battle' ? '战斗暂停' : '部落暂停'}
        </h2>
        <p className="text-xs text-amber-200/80">
          村庄记录与关闭前进度会自动保存至本地浏览器存档。
        </p>

        {/* BGM Volume & Sound Settings */}
        <div className="rounded-xl bg-[#1c120a]/80 border-2 border-[#6e4723] p-3.5 text-left space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-100">
              <Music className="w-4 h-4 text-amber-300" />
              <span>背景音乐音量</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-amber-300 tabular-nums">
                {volumePercent}%
              </span>
              <button
                type="button"
                aria-label={muted ? '取消静音' : '静音'}
                onClick={onToggleMute}
                className="clash-btn w-7 h-7 rounded-lg bg-[#3a2614] border border-[#6e4723] text-amber-100 flex items-center justify-center cursor-pointer"
              >
                {muted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-300" />}
              </button>
            </div>
          </div>

          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={volumePercent}
            aria-label="背景音乐音量"
            onChange={(e) => onChangeBgmVolume(Number(e.target.value) / 100)}
            className="w-full h-2 rounded-lg appearance-none bg-[#3a2614] accent-amber-400 cursor-pointer"
          />
        </div>

        <div className="space-y-2.5 pt-1">
          <button
            type="button"
            onClick={onResume}
            className="clash-btn w-full py-3 rounded-xl bg-gradient-to-b from-amber-400 to-amber-600 border-2 border-amber-950 text-amber-950 font-extrabold text-base cursor-pointer"
          >
            继续游戏
          </button>

          {onSaveNow && (
            <button
              type="button"
              onClick={onSaveNow}
              className="clash-btn w-full py-2.5 rounded-xl bg-emerald-600 border-2 border-emerald-950 text-white font-bold text-sm cursor-pointer"
            >
              保存当前存档
            </button>
          )}

          {mode === 'village' && (
            <button
              type="button"
              onClick={onResetVillage}
              className="clash-btn w-full py-2.5 rounded-xl bg-[#44301d] border-2 border-[#6e4723] text-amber-200 font-bold text-sm cursor-pointer"
            >
              重置初始村庄
            </button>
          )}

          <button
            type="button"
            onClick={onQuitToTitle}
            className="clash-btn w-full py-2.5 rounded-xl bg-red-800 border-2 border-red-950 text-white font-bold text-sm cursor-pointer"
          >
            返回主界面
          </button>
        </div>
      </div>
    </div>
  );
};
