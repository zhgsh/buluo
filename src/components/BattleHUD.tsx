import React from 'react';
import { Flag, Pause, Settings, Volume2, VolumeX } from 'lucide-react';
import {
  SPELL_CATALOG,
  SPELL_ORDER,
  TROOP_CATALOG,
  TROOP_ORDER,
} from '../game/catalog';
import {
  ElixirIcon,
  GoldIcon,
  SpellBadgeIcon,
  StarIcon,
} from '../game/svgIcons';
import { TroopSpriteThumb } from './TroopSpriteThumb';
import type { BattleState } from '../game/types';

interface BattleHUDProps {
  battle: BattleState;
  muted: boolean;
  toastMessage: string | null;
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
  onSelectCard,
  onEndBattle,
  onToggleMute,
  onOpenSettings,
  onPause,
}) => {
  const availableCards: Array<{
    keyLabel: string;
    card: NonNullable<BattleState['selectedCard']>;
    name: string;
    role: string;
    count: number;
  }> = [];

  let shortcutIdx = 1;
  for (const t of TROOP_ORDER) {
    const count = battle.availableTroops[t] ?? 0;
    const deployed = battle.troopsDeployed[t] ?? 0;
    if (count > 0 || deployed > 0) {
      availableCards.push({
        keyLabel: String(shortcutIdx++),
        card: { kind: 'troop', type: t },
        name: TROOP_CATALOG[t].name,
        role: TROOP_CATALOG[t].role,
        count,
      });
    }
  }
  for (const t of TROOP_ORDER) {
    const count = battle.availableReinforcements?.[t] ?? 0;
    const deployed = battle.reinforcementsDeployed?.[t] ?? 0;
    if (count > 0 || deployed > 0) {
      availableCards.push({
        keyLabel: String(shortcutIdx++),
        card: { kind: 'reinforcement', type: t },
        name: TROOP_CATALOG[t].name,
        role: '部落城堡援军 (+15% 战力)',
        count,
      });
    }
  }
  for (const s of SPELL_ORDER) {
    const count = battle.availableSpells[s] ?? 0;
    const used = battle.spellsUsed[s] ?? 0;
    if (count > 0 || used > 0) {
      availableCards.push({
        keyLabel: String(shortcutIdx++),
        card: { kind: 'spell', type: s },
        name: SPELL_CATALOG[s].name,
        role: SPELL_CATALOG[s].role,
        count,
      });
    }
  }

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 sm:p-4">
      {/* Top Row: Target & Timer | Stars & Destruction | Loot & Controls */}
      <div className="flex items-start justify-between gap-3">
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
        <div className="self-center px-5 py-2 rounded-xl bg-[#1c130b]/95 border-2 border-red-500 text-amber-100 text-sm font-bold shadow-lg">
          {toastMessage}
        </div>
      )}

      {/* Bottom Deployment Dock */}
      <div className="flex flex-col items-center gap-2">
        {battle.selectedCard && (
          <div className="px-3.5 py-1 rounded-lg bg-[#1c130b]/90 border border-amber-700/70 text-[11px] font-bold text-amber-200">
            {battle.selectedCard.kind === 'troop'
              ? `${TROOP_CATALOG[battle.selectedCard.type].name} · ${TROOP_CATALOG[battle.selectedCard.type].role}（点击红色禁区外草地部署）`
              : battle.selectedCard.kind === 'reinforcement'
                ? `援军 · ${TROOP_CATALOG[battle.selectedCard.type].name}（部落联盟支援 +15% 战力 · 点击草地部署）`
                : `${SPELL_CATALOG[battle.selectedCard.type].name} · ${SPELL_CATALOG[battle.selectedCard.type].role}（点击战场任意位置释放）`}
          </div>
        )}

        <div className="pointer-events-auto flex items-center gap-2 px-3 py-2 rounded-2xl bg-[#2a1c11]/95 border-2 border-[#7c5329] shadow-[0_6px_0_#140c06] overflow-x-auto max-w-full">
          {availableCards.map((item) => {
            const isSelected =
              battle.selectedCard?.kind === item.card.kind &&
              battle.selectedCard?.type === item.card.type;
            const isReinforcement = item.card.kind === 'reinforcement';
            const depleted = item.count <= 0;
            return (
              <button
                key={`${item.card.kind}_${item.card.type}`}
                type="button"
                disabled={depleted}
                onClick={() => onSelectCard(item.card)}
                className={`clash-btn relative min-w-[74px] px-2.5 py-2 rounded-xl border-2 flex flex-col items-center gap-1 cursor-pointer ${
                  depleted
                    ? 'bg-[#1c120a] border-[#3d2612] opacity-45 cursor-not-allowed'
                    : isSelected
                      ? isReinforcement
                        ? 'bg-sky-400 border-amber-200 -translate-y-1 shadow-[0_4px_0_#075985]'
                        : 'bg-amber-500 border-amber-200 -translate-y-1 shadow-[0_4px_0_#78350f]'
                      : isReinforcement
                        ? 'bg-[#173049] border-sky-500/80 hover:border-sky-300'
                        : 'bg-[#3a2717] border-[#6e4723] hover:border-amber-400'
                }`}
              >
                <span className="absolute top-1 left-1.5 text-[10px] font-bold text-amber-200/80">
                  [{item.keyLabel}]
                </span>
                <span className="absolute top-1 right-1.5 text-xs font-extrabold text-white tabular-nums text-stroke-sm">
                  ×{item.count}
                </span>
                {item.card.kind === 'troop' || item.card.kind === 'reinforcement' ? (
                  <TroopSpriteThumb
                    type={item.card.type}
                    alt={item.name}
                    className="w-10 h-10 mt-2"
                  />
                ) : (
                  <SpellBadgeIcon type={item.card.type} className="w-9 h-9 mt-2" />
                )}
                <span
                  className={`text-[11px] font-extrabold whitespace-nowrap ${
                    isSelected
                      ? isReinforcement
                        ? 'text-sky-950'
                        : 'text-amber-950'
                      : 'text-amber-100'
                  }`}
                >
                  {isReinforcement ? `援·${item.name}` : item.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
