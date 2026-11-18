import React, { useState } from 'react';
import { Camera, Download, RefreshCw, Share2, X } from 'lucide-react';
import type { VillageState } from '../game/types';
import {
  buildVillageThumbnailFilename,
  dataUrlToBlob,
} from '../game/villageThumbnailLogic';
import type { GeneratedVillageThumbnail } from '../game/villageThumbnailRenderer';

interface VillageThumbnailModalProps {
  village: VillageState;
  thumbnail: GeneratedVillageThumbnail;
  onRegenerate: () => void;
  onSavedLocal?: (filename: string) => void;
  onShareToClan: (note: string) => void;
  onClose: () => void;
}

export const VillageThumbnailModal: React.FC<VillageThumbnailModalProps> = ({
  village,
  thumbnail,
  onRegenerate,
  onSavedLocal,
  onShareToClan,
  onClose,
}) => {
  const [note, setNote] = useState('');
  const downloadFilename = buildVillageThumbnailFilename(village);

  const handleSaveToLocal = () => {
    const blob = dataUrlToBlob(thumbnail.dataUrl);
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = objectUrl;
    link.download = downloadFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    onSavedLocal?.(downloadFilename);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4">
      <div
        role="dialog"
        aria-label="村庄等距缩略图与分享"
        className="w-full max-w-2xl rounded-2xl bg-[#2a1c11] border-4 border-[#8b5e34] shadow-2xl overflow-hidden text-amber-100 flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-[#1c120a] border-b-2 border-[#6e4723] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/60 flex items-center justify-center shrink-0">
              <Camera className="w-5 h-5 text-amber-300" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-extrabold text-amber-100 truncate">
                村庄等距缩略图
              </h2>
              <p className="text-xs text-amber-200/75 truncate tabular-nums">
                {thumbnail.summary} · {thumbnail.stats.clanName}
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="关闭缩略图窗口"
            onClick={onClose}
            className="clash-btn w-10 h-10 rounded-xl bg-red-700 border border-red-950 text-white flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          <div className="rounded-xl overflow-hidden border-2 border-[#6e4723] bg-[#1b3312] shadow-inner">
            <img
              src={thumbnail.dataUrl}
              alt="当前村庄等距视角布局缩略图"
              data-testid="village-thumbnail-preview"
              referrerPolicy="no-referrer"
              className="w-full h-auto block object-contain aspect-[5/3]"
            />
          </div>

          {/* Unboxed tabular metadata strip */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-amber-200/85 tabular-nums">
            <span>
              分辨率：{thumbnail.width}×{thumbnail.height} PNG
            </span>
            <span>
              资源建筑 {thumbnail.stats.resourcesCount} · 装饰 {thumbnail.stats.decorationsCount} · 奖杯 {thumbnail.stats.trophies}
            </span>
          </div>

          {/* Optional note for Clan Chat share */}
          <div className="space-y-1.5">
            <label htmlFor="thumbnail-share-note" className="block text-xs font-bold text-amber-200/90">
              部落分享附言（可选）
            </label>
            <input
              id="thumbnail-share-note"
              type="text"
              maxLength={80}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={`分享了当前 ${village.townHallLevel} 级大本营阵型，欢迎盟友点评！`}
              aria-label="分享附言"
              className="w-full h-10 px-3 rounded-xl bg-[#1c120a] border border-[#6e4723] focus:border-amber-400 focus:outline-none text-sm text-amber-100 placeholder:text-amber-200/40"
            />
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onRegenerate}
              className="clash-btn h-10 px-4 rounded-xl bg-[#3a2614] border-2 border-[#7c5329] text-amber-100 text-xs sm:text-sm font-extrabold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <RefreshCw className="w-4 h-4 text-amber-300" />
              刷新截图
            </button>

            <button
              type="button"
              data-testid="save-thumbnail-local-btn"
              onClick={handleSaveToLocal}
              className="clash-btn h-10 px-4 rounded-xl bg-sky-600 border-2 border-sky-950 text-white text-xs sm:text-sm font-extrabold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4" />
              保存图片到本地
            </button>

            <button
              type="button"
              data-testid="share-thumbnail-to-clan-btn"
              onClick={() => onShareToClan(note)}
              className="clash-btn h-10 px-5 rounded-xl bg-gradient-to-b from-amber-400 to-amber-600 border-2 border-amber-950 shadow-[0_3px_0_#451a03] text-amber-950 text-xs sm:text-sm font-extrabold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Share2 className="w-4 h-4" />
              分享至部落聊天
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
