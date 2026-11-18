import React, { useEffect } from 'react';
import { Flag, Pause, Settings, Sparkles, Volume2, VolumeX } from 'lucide-react';
import {
  buildBattleDeploymentCards,
  type FloatingDamageOverlayItem,
} from '../game/battleLogic';
import { SPELL_CATALOG, TROOP_CATALOG } from '../game/catalog';
import { ElixirIcon, GoldIcon, StarIcon } from '../game/svgIcons';
import {
  getBattleCardSpriteMapping,
  preloadSpellSprites,
  preloadTroopSprites,
} from '../game/troopAssets';
import type { BattleState } from '../game/types';
import { SpellSpriteThumb } from './SpellSpriteThumb';
import { TroopSpriteThumb } from './TroopSpriteThumb';

interface BattleHUDProps {
  battle: BattleState;
  muted: boolean;
  toastMessage: string | null;
  floatingDamages?: FloatingDamageOverlayItem[];
  showFloatingDamage?: boolean;
  onToggleFloatingDamage?: () => void;
  onSelectCard: (card: BattleState['selectedCard']) => void;
  onEndBattle: () => void;
  onToggleMute: () => void;
  onOpenSettings: () => void;
  onPause: () => void;
}

function formatClock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem < 10 ? '0' : ''}${rem}`;
}

export const BattleHUD: React.FC<BattleHUDProps> = ({
  battle,
  muted,
  toastMessage,
  floatingDamages = [],
  showFloatingDamage = true,
  onToggleFloatingDamage,
  onSelectCard,
  onEndBattle,
  onToggleMute,
  onOpenSettings,
  onPause,
}) => {
  useEffect(() => {
    preloadTroopSprites();
    preloadSpellSprites();
  }, []);

  const availableCards = buildBattleDeploymentCards(battle);

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 sm:p-4">
      {/* Real-time Floating Damage Numbers Layer */}
      {showFloatingDamage && (
        <div
          data-testid="battle-floating-damage-layer"
          aria-hidden="true"
          className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
        >
          {floatingDamages.map((item) => (
            <span
              key={item.id}
              data-testid="floating-damage-item"
              data-kind={item.kind}
              style={{
                left: `${item.screenX}px`,
                top: `${item.screenY}px`,
                opacity: item.alpha,
                color: item.color,
                transform: `translate(-50%, -50%) scale(${item.scale})`,
                textShadow:
                  '0 2px 0 #140c06, -1.5px -1.5px 0 #140c06, 1.5px -1.5px 0 #140c06, -1.5px 1.5px 0 #140c06, 1.5px 1.5px 0 #140c06, 0 0 10px rgba(250, 204, 21, 0.6)',
              }}
              className="absolute font-black text-base tracking-tight tabular-nums whitespace-nowrap select-none will-change-transform"
            >
              {item.text}
            </span>
          ))}
        </div>
      )}

      {/* Top Row: Target & Timer | Stars & Destruction | Loot & Controls */}
      <div className="relative z-10 flex items-start justify-between gap-3">
        {/* Top-Left: Target Name & Clock */}
        <div className="pointer-events-auto flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[#2a1c11]/92 border-2 border-[#7c5329] shadow-[0_4px_0_#140c06]">
          <div className="leading-tight">
            <div className="text-xs font-extrabold text-amber-200">{battle.targetName}</div>
            <div className="text-[11px] font-bold text-amber-300/80 tabular-nums">
              {battle.phase === 'scouting'
                ? `侦察准备 ${Math.ceil(battle.scoutTimeSec)}s`
                : `战斗剩余 ${formatClock(battle.timeRemainingSec)}`}
            </div>
          </div>
        </div>

        {/* Top-Center: Destruction % & 3 Stars */}
        <div className="flex flex-col items-center px-5 py-2 rounded-2xl bg-[#2a1c11]/92 border-2 border-amber-600 shadow-[0_4px_0_#140c06]">
          <div className="flex items-center gap-1.5">
            {[1, 2, 3].map((s) => (
              <StarIcon key={s} filled={battle.stars >= s} className="w-6 h-6" />
            ))}
          </div>
          <div className="text-base font-extrabold text-amber-100 tabular-nums mt-0.5">
            摧毁度 {battle.destructionPercent}%
          </div>
        </div>

        {/* Top-Right: Looted Gold/Elixir + End Battle + Audio/Pause */}
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="flex items-center gap-3 px-3.5 py-2 rounded-xl bg-[#2a1c11]/92 border-2 border-[#7c5329] shadow-[0_4px_0_#140c06] tabular-nums">
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
              onEndBattle();
            }}
            className="clash-btn px-3.5 py-2 rounded-xl bg-red-700 border-2 border-red-950 shadow-[0_4px_0_#450a0a] text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
          >
            <Flag className="w-4 h-4" />
            结束战斗
          </button>

          {onToggleFloatingDamage && (
            <button
              type="button"
              tabIndex={-1}
              data-testid="toggle-damage-numbers-btn"
              aria-pressed={showFloatingDamage}
              aria-label={showFloatingDamage ? '关闭实时伤害数字' : '开启实时伤害数字'}
              title={showFloatingDamage ? '伤害飘字：开' : '伤害飘字：关'}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleFloatingDamage();
              }}
              className={`clash-btn h-10 px-2.5 rounded-xl border-2 text-xs font-extrabold flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                showFloatingDamage
                  ? 'bg-[#3a2717]/95 border-amber-400 text-yellow-300'
                  : 'bg-[#2a1c11]/92 border-[#7c5329] text-amber-200/60'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>飘字</span>
            </button>
          )}

          <button
            type="button"
            tabIndex={-1}
            aria-label={muted ? '取消静音' : '静音'}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            className="clash-btn w-10 h-10 rounded-xl bg-[#2a1c11]/92 border-2 border-[#7c5329] text-amber-100 flex items-center justify-center cursor-pointer"
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
            className="clash-btn w-10 h-10 rounded-xl bg-[#2a1c11]/92 border-2 border-[#7c5329] text-amber-100 flex items-center justify-center cursor-pointer"
          >
            <Settings className="w-5 h-5" />
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label="暂停战斗"
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            className="clash-btn w-10 h-10 rounded-xl bg-[#2a1c11]/92 border-2 border-[#7c5329] text-amber-100 flex items-center justify-center cursor-pointer"
          >
            <Pause className="w-5 h-5" />
          </button>
        </div>
      </div>

      {toastMessage && (
        <div className="relative z-10 self-center px-5 py-2 rounded-xl bg-[#1c130b]/95 border-2 border-red-500 text-amber-100 text-sm font-bold shadow-lg">
          {toastMessage}
        </div>
      )}

      {/* Bottom Deployment Dock */}
      <div className="relative z-10 flex flex-col items-center gap-2">
        {battle.selectedCard && (
          <div className="px-3.5 py-1 rounded-lg bg-[#1c130b]/92 border border-amber-700/70 text-[11px] font-bold text-amber-200">
            {battle.selectedCard.kind === 'troop'
              ? `${TROOP_CATALOG[battle.selectedCard.type].name} · ${TROOP_CATALOG[battle.selectedCard.type].role}（点击红色禁区外草地部署）`
              : battle.selectedCard.kind === 'reinforcement'
                ? `援军 · ${TROOP_CATALOG[battle.selectedCard.type].name}（部落联盟支援 +15% 战力 · 点击草地部署）`
                : `${SPELL_CATALOG[battle.selectedCard.type].name} · ${SPELL_CATALOG[battle.selectedCard.type].role}（点击战场任意位置释放）`}
          </div>
        )}

        <div className="pointer-events-auto flex items-end gap-2.5 px-3.5 pt-3 pb-2.5 rounded-2xl bg-[#2a1c11]/95 border-2 border-[#7c5329] shadow-[0_6px_0_#140c06] overflow-x-auto max-w-full">
          {availableCards.map((item) => {
            const { card, depleted, isSelected, isReinforcement } = item;
            const isSpell = card.kind === 'spell';
            const spriteMapping = getBattleCardSpriteMapping(card);
            const slotKey = `${card.kind}-${card.type}`;

            return (
              <div
                key={slotKey}
                data-testid={`battle-card-slot-${slotKey}`}
                data-selected={isSelected ? 'true' : 'false'}
                data-depleted={depleted ? 'true' : 'false'}
                className="flex flex-col items-center gap-1.5 shrink-0"
              >
                {/* Individual Sprite Icon Framed Above Deployment Button */}
                <div
                  data-testid={`battle-card-icon-${slotKey}`}
                  onClick={() => {
                    if (!depleted) onSelectCard(card);
                  }}
                  aria-hidden="true"
                  className={`relative w-14 h-14 sm:w-[60px] sm:h-[60px] rounded-xl border-2 overflow-hidden flex items-center justify-center transition-all duration-150 ${
                    spriteMapping.frameBgClass
                  } ${
                    depleted
                      ? 'border-[#3d2612] grayscale opacity-40 cursor-not-allowed'
                      : isSelected
                        ? `${spriteMapping.selectedBorderClass} ${spriteMapping.selectedHaloClass} -translate-y-1.5 scale-105 cursor-pointer`
                        : isReinforcement
                          ? 'border-sky-500/80 hover:border-sky-300 hover:-translate-y-0.5 shadow-[0_3px_0_#0c1e33] cursor-pointer'
                          : isSpell
                            ? 'border-purple-500/70 hover:border-fuchsia-300 hover:-translate-y-0.5 shadow-[0_3px_0_#1e0e2b] cursor-pointer'
                            : 'border-[#6e4723] hover:border-amber-400 hover:-translate-y-0.5 shadow-[0_3px_0_#140c06] cursor-pointer'
                  }`}
                >
                  <span className="absolute top-0.5 left-1 z-10 text-[10px] font-extrabold text-amber-200/90 tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
                    [{item.keyLabel}]
                  </span>

                  <span
                    className={`absolute top-0.5 right-1 z-10 text-[11px] font-extrabold tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] ${
                      depleted ? 'text-stone-400' : 'text-white'
                    }`}
                  >
                    ×{item.count}
                  </span>

                  {card.kind === 'spell' ? (
                    <SpellSpriteThumb
                      type={card.type}
                      alt={item.name}
                      className="w-11 h-11 sm:w-12 sm:h-12 pt-1.5"
                      imgClassName={spriteMapping.scaleClass}
                      objectPosition={spriteMapping.objectPosition}
                    />
                  ) : (
                    <TroopSpriteThumb
                      type={card.type}
                      alt={item.name}
                      className="w-11 h-11 sm:w-12 sm:h-12 pt-1.5"
                      imgClassName={spriteMapping.scaleClass}
                      objectPosition={spriteMapping.objectPosition}
                    />
                  )}

                  {isSelected && !depleted && (
                    <div
                      className={`absolute inset-x-0 bottom-0 h-1 ${
                        isReinforcement
                          ? 'bg-sky-300'
                          : isSpell
                            ? 'bg-fuchsia-300'
                            : 'bg-amber-300'
                      }`}
                    />
                  )}
                </div>

                {/* Deployment Action Button Directly Below Icon */}
                <button
                  type="button"
                  data-testid={`battle-card-btn-${slotKey}`}
                  disabled={depleted}
                  aria-pressed={isSelected}
                  aria-label={`${isReinforcement ? '援军 ' : ''}${item.name}，${
                    depleted ? '已耗尽' : `剩余 ${item.count}`
                  }`}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onSelectCard(card);
                  }}
                  className={`clash-btn min-w-[78px] px-2.5 py-1.5 rounded-xl border-2 flex flex-col items-center justify-center leading-tight cursor-pointer ${
                    depleted
                      ? 'bg-[#1c120a] border-[#3d2612] text-stone-400 opacity-50 cursor-not-allowed'
                      : isSelected
                        ? isReinforcement
                          ? 'bg-sky-400 border-sky-100 text-sky-950 shadow-[0_3px_0_#075985]'
                          : isSpell
                            ? 'bg-fuchsia-400 border-fuchsia-100 text-fuchsia-950 shadow-[0_3px_0_#701a75]'
                            : 'bg-amber-400 border-amber-100 text-amber-950 shadow-[0_3px_0_#78350f]'
                        : isReinforcement
                          ? 'bg-[#173049] border-sky-500/80 text-sky-100 hover:border-sky-300 shadow-[0_3px_0_#0c1e33]'
                          : isSpell
                            ? 'bg-[#2e1842] border-purple-500/80 text-fuchsia-100 hover:border-fuchsia-300 shadow-[0_3px_0_#1a0b26]'
                            : 'bg-[#3a2717] border-[#6e4723] text-amber-100 hover:border-amber-400 shadow-[0_3px_0_#140c06]'
                  }`}
                >
                  <span className="text-[11px] font-extrabold whitespace-nowrap">
                    {isReinforcement ? `援·${item.name}` : item.name}
                  </span>
                  <span
                    className={`text-[10px] font-bold whitespace-nowrap tabular-nums ${
                      depleted
                        ? 'text-stone-500'
                        : isSelected
                          ? 'opacity-90'
                          : 'text-amber-200/80'
                    }`}
                  >
                    {depleted ? '已耗尽' : isSelected ? '▶ 部署中' : `剩余 ×${item.count}`}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
