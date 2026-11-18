import React from 'react';
import { Music, UploadCloud, Volume2, VolumeX, X } from 'lucide-react';
import type { BgmTrack } from '../game/sound';

interface SettingsModalProps {
  muted: boolean;
  bgmVolume: number;
  activeTrack: BgmTrack;
  onToggleMute: () => void;
  onChangeBgmVolume: (volume: number) => void;
  onOpenWechatPublish?: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  muted,
  bgmVolume,
  activeTrack,
  onToggleMute,
  onChangeBgmVolume,
  onOpenWechatPublish,
  onClose,
}) => {
  const volumePercent = Math.round(bgmVolume * 100);
  const trackLabel =
    activeTrack === 'battle'
      ? '战斗战鼓'
      : activeTrack === 'village'
        ? '村庄牧歌'
        : '待机';

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
      <div
        role="dialog"
        aria-label="游戏设置"
        className="w-full max-w-sm rounded-2xl bg-[#2a1c11] border-4 border-[#8b5e34] shadow-2xl overflow-hidden text-amber-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-[#1c120a] border-b-2 border-[#6e4723]">
          <div className="flex items-center gap-2">
            <Music className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-extrabold text-amber-100">游戏设置</h2>
          </div>
          <button
            type="button"
            aria-label="关闭设置"
            onClick={onClose}
            className="clash-btn w-8 h-8 rounded-lg bg-[#3a2614] border border-[#6e4723] text-amber-200 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Audio Controls */}
        <div className="p-5 space-y-5">
          <div className="rounded-xl bg-[#1c120a]/80 border-2 border-[#6e4723] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-amber-300" />
                <span className="text-sm font-extrabold text-amber-100">背景音乐音量</span>
              </div>
              <span className="text-sm font-black text-amber-300 tabular-nums">
                {volumePercent}%
              </span>
            </div>

            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={volumePercent}
              aria-label="背景音乐音量"
              onChange={(e) => onChangeBgmVolume(Number(e.target.value) / 100)}
              className="w-full h-2.5 rounded-lg appearance-none bg-[#3a2614] accent-amber-400 cursor-pointer"
            />

            <div className="flex items-center justify-between text-[11px] text-amber-200/75">
              <span>当前音轨：{trackLabel}</span>
              <span>{muted ? '已全局静音' : volumePercent === 0 ? '音乐已调至 0%' : '循环播放中'}</span>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-[#1c120a]/80 border-2 border-[#6e4723] px-4 py-3">
            <div className="flex items-center gap-2">
              {muted ? (
                <VolumeX className="w-4 h-4 text-red-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              )}
              <span className="text-sm font-extrabold text-amber-100">全局声音开关</span>
            </div>
            <button
              type="button"
              onClick={onToggleMute}
              className={`clash-btn px-3.5 py-1.5 rounded-lg border text-xs font-extrabold cursor-pointer ${
                muted
                  ? 'bg-red-700 border-red-950 text-white'
                  : 'bg-emerald-600 border-emerald-950 text-white'
              }`}
            >
              {muted ? '已静音（点击开启）' : '已开启（点击静音）'}
            </button>
          </div>

          {onOpenWechatPublish && (
            <div className="flex items-center justify-between rounded-xl bg-[#1c120a]/80 border-2 border-[#6e4723] px-4 py-3">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-extrabold text-amber-100">微信小游戏平台</span>
              </div>
              <button
                type="button"
                onClick={onOpenWechatPublish}
                className="clash-btn px-3.5 py-1.5 rounded-lg bg-emerald-600 border border-emerald-950 text-white text-xs font-extrabold cursor-pointer"
              >
                一键上传发布
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="clash-btn w-full py-2.5 rounded-xl bg-gradient-to-b from-amber-400 to-amber-600 border-2 border-amber-950 text-amber-950 font-extrabold text-sm cursor-pointer"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};
