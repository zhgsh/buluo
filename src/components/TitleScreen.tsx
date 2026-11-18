import React, { useEffect } from 'react';
import { UploadCloud } from 'lucide-react';
import { ClashCrestLogo } from '../game/svgIcons';

interface TitleScreenProps {
  onStart: () => void;
  onOpenWechatPublish?: () => void;
  isPublishOpen?: boolean;
  hasSavedProgress: boolean;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStart,
  onOpenWechatPublish,
  isPublishOpen = false,
  hasSavedProgress,
}) => {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (isPublishOpen) return;
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLButtonElement
      ) {
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onStart();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isPublishOpen, onStart]);

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between pointer-events-none">
      {/* Subtle measured edge scrim on left/top so lockup stays crisp over live village pan */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 70% 55%, rgba(20, 35, 14, 0.12) 0%, rgba(16, 26, 12, 0.68) 72%, rgba(12, 18, 9, 0.85) 100%)',
        }}
      />

      {/* Top/Left Complementary Negative Space Lockup */}
      <div className="relative z-10 flex flex-col items-start justify-center flex-1 px-8 sm:px-16 max-w-2xl">
        <ClashCrestLogo className="w-72 sm:w-96 h-auto drop-shadow-[0_10px_22px_rgba(0,0,0,0.65)] mb-5" />

        <p className="text-amber-100/95 text-base sm:text-lg font-semibold max-w-md leading-relaxed mb-8 text-stroke-sm">
          建造坚不可摧的部落要塞，训练野蛮人、弓箭手与空中气球军团，在实时攻防战中夺取三星荣耀。
        </p>

        <div className="pointer-events-auto flex flex-wrap items-center gap-3.5">
          <button
            type="button"
            data-start="true"
            onClick={(e) => {
              e.currentTarget.blur();
              onStart();
            }}
            className="clash-btn px-8 py-4 rounded-xl bg-gradient-to-b from-amber-400 to-amber-600 border-2 border-amber-950 shadow-[0_6px_0_#451a03,0_12px_24px_rgba(0,0,0,0.5)] text-amber-950 font-extrabold text-xl tracking-wide cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300"
          >
            {hasSavedProgress ? '继续统领部落' : '开始领主之路'}
          </button>

          {onOpenWechatPublish && (
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenWechatPublish();
              }}
              className="clash-btn px-5 py-4 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-700 border-2 border-emerald-950 shadow-[0_6px_0_#064e3b,0_12px_24px_rgba(0,0,0,0.45)] text-white font-extrabold text-base tracking-wide flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300"
            >
              <UploadCloud className="w-5 h-5" />
              发布至微信小游戏
            </button>
          )}
        </div>
      </div>

      {/* Single flat control-hint line in bottom safe margin */}
      <div className="relative z-10 px-8 sm:px-16 pb-6">
        <p className="text-xs sm:text-sm font-semibold text-amber-200/85 tracking-wide text-stroke-sm">
          拖拽平移视角 · 滚轮缩放 · 左键点击建筑或部署部队 · Esc 暂停
        </p>
      </div>
    </div>
  );
};
