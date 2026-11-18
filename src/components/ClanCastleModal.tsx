import React, { useEffect, useState } from 'react';
import { Clock, Shield, Send, Trash2, Users, X } from 'lucide-react';
import { BUILDING_CATALOG, TROOP_CATALOG, TROOP_ORDER } from '../game/catalog';
import {
  CLAN_REQUEST_COOLDOWN_MS,
  getAllianceByName,
  getClanRequestCooldownState,
  SIMULATED_ALLIANCES,
  type ClanDonationEvent,
  type ReinforcementPreference,
} from '../game/clanLogic';
import type { TroopType, VillageState } from '../game/types';
import { getResourceCaps, getUsedClanSpace } from '../game/villageLogic';
import { BuildingSpriteThumb } from './BuildingSpriteThumb';
import { TroopSpriteThumb } from './TroopSpriteThumb';

interface ClanCastleModalProps {
  village: VillageState;
  nowMs: number;
  recentDonations: ClanDonationEvent[];
  onClose: () => void;
  onJoinAlliance: (allianceName: string) => void;
  onRequestReinforcements: (preference: ReinforcementPreference) => void;
  onDismissReinforcement: (troopType: TroopType) => void;
  onOpenShop: () => void;
}

const PREFERENCES: Array<{ id: ReinforcementPreference; label: string; desc: string }> = [
  { id: 'balanced', label: '均衡援军', desc: '巨人前排 + 弓箭/野蛮人混编' },
  { id: 'tank', label: '前排坦克', desc: '优先增援巨人与野蛮人' },
  { id: 'ranged', label: '空中/远程', desc: '优先增援气球兵与弓箭手' },
];

export const ClanCastleModal: React.FC<ClanCastleModalProps> = ({
  village,
  nowMs,
  recentDonations,
  onClose,
  onJoinAlliance,
  onRequestReinforcements,
  onDismissReinforcement,
  onOpenShop,
}) => {
  const [preference, setPreference] = useState<ReinforcementPreference>('balanced');
  const [liveNowMs, setLiveNowMs] = useState<number>(() => Math.max(nowMs, Date.now()));

  useEffect(() => {
    setLiveNowMs(Math.max(nowMs, Date.now()));
  }, [nowMs, village.clanLastRequestAt]);

  useEffect(() => {
    const lastReq = village.clanLastRequestAt;
    if (!lastReq) return;
    if (Date.now() - lastReq >= CLAN_REQUEST_COOLDOWN_MS) return;

    const timerId = window.setInterval(() => {
      const current = Date.now();
      setLiveNowMs(current);
      if (current - lastReq >= CLAN_REQUEST_COOLDOWN_MS) {
        window.clearInterval(timerId);
      }
    }, 100);

    return () => window.clearInterval(timerId);
  }, [village.clanLastRequestAt]);

  const caps = getResourceCaps(village);
  const usedSpace = getUsedClanSpace(village.clanReinforcements);
  const cooldown = getClanRequestCooldownState(village, liveNowMs);
  const cooldownSec = cooldown.remainingSec;
  const currentAlliance = getAllianceByName(village.clanName);
  const castleBuilding = village.buildings.find((b) => b.type === 'clan_castle');

  const stationedTroops = TROOP_ORDER.filter(
    (t) => (village.clanReinforcements?.[t] ?? 0) > 0
  );
  const isFull = caps.hasClanCastle && usedSpace >= caps.maxClanSpace;
  const formattedRemainingTimer = `00:${String(cooldownSec).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/65 p-4">
      <div
        role="dialog"
        aria-label="部落城堡与联盟援军"
        className="w-full max-w-3xl rounded-2xl bg-[#2a1c11] border-4 border-[#8b5e34] shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#1c120a] border-b-2 border-[#6e4723]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#2a1c11] border border-[#7c5329] p-1 flex items-center justify-center shrink-0">
              <BuildingSpriteThumb
                type="clan_castle"
                alt="部落城堡"
                className="w-full h-full"
              />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-amber-100">
                部落城堡{' '}
                {castleBuilding && castleBuilding.level > 0 && (
                  <span className="text-sm font-black text-amber-400">
                    Lv.{castleBuilding.level}
                  </span>
                )}
              </h2>
              <p className="text-xs text-amber-300/85 mt-0.5 tabular-nums">
                {caps.hasClanCastle
                  ? `所属联盟：${currentAlliance.name} · 援军容量 ${usedSpace}/${caps.maxClanSpace}`
                  : '尚未建成部落城堡 · 请先在商店建造或等待施工完成'}
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="关闭部落城堡"
            onClick={onClose}
            className="clash-btn w-9 h-9 rounded-xl bg-red-700 border border-red-950 text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {!caps.hasClanCastle ? (
            <div className="rounded-xl bg-[#3a2717] border-2 border-[#6e4723] p-6 text-center space-y-3">
              <Shield className="w-10 h-10 text-amber-400 mx-auto" />
              <div className="text-base font-extrabold text-amber-100">
                {castleBuilding
                  ? `${BUILDING_CATALOG.clan_castle.name}正在施工建造中`
                  : '建造部落城堡以加入模拟联盟'}
              </div>
              <p className="text-xs text-amber-200/80 max-w-md mx-auto">
                建成后可加入模拟部落联盟，向盟友请求精锐援军并在战斗中随时部署增援部队（援军拥有 +15% 生命与攻击加成）。
              </p>
              {!castleBuilding && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenShop();
                  }}
                  className="clash-btn px-5 py-2.5 rounded-xl bg-amber-500 border-2 border-amber-950 text-amber-950 text-sm font-extrabold cursor-pointer"
                >
                  前往商店建造
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Simulated Alliance Switcher */}
              <section className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-amber-200 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-sky-400" />
                    模拟部落联盟
                  </h3>
                  <span className="text-[11px] font-bold text-sky-300">
                    {currentAlliance.badge}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {SIMULATED_ALLIANCES.map((al) => {
                    const selected = al.name === currentAlliance.name;
                    return (
                      <button
                        key={al.id}
                        type="button"
                        onClick={() => onJoinAlliance(al.name)}
                        className={`text-left rounded-xl p-3 border-2 transition cursor-pointer ${
                          selected
                            ? 'bg-[#3d2b18] border-sky-400 shadow-[0_0_0_1px_rgba(56,189,248,0.4)]'
                            : 'bg-[#1c120a]/80 border-[#5c3a1d] hover:border-amber-500/70'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-sm font-extrabold text-amber-100 truncate">
                            {al.name}
                          </span>
                          {selected && (
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-sky-500 text-sky-950 shrink-0">
                              已加入
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-amber-200/75 mt-1 line-clamp-2">
                          {al.motto}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Current Garrisoned Reinforcements */}
              <section className="rounded-xl bg-[#1c120a]/85 border-2 border-[#6e4723] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-amber-100">
                    城堡当前驻扎援军（出战可部署）
                  </h3>
                  <span className="text-xs font-black text-sky-300 tabular-nums">
                    已占用 {usedSpace} / {caps.maxClanSpace} 人口
                  </span>
                </div>

                {stationedTroops.length === 0 ? (
                  <div className="py-4 text-center text-xs text-amber-200/65 border border-dashed border-[#5c3a1d] rounded-lg">
                    暂无援军驻扎，点击下方“请求联盟增援”即可获得盟友支援部队。
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2.5">
                    {stationedTroops.map((tType) => {
                      const def = TROOP_CATALOG[tType];
                      const count = village.clanReinforcements?.[tType] ?? 0;
                      return (
                        <div
                          key={tType}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#3a2717] border-2 border-sky-500/60"
                        >
                          <TroopSpriteThumb
                            type={tType}
                            alt={def.name}
                            className="w-9 h-9"
                          />
                          <div className="leading-tight">
                            <div className="text-xs font-extrabold text-amber-100">
                              {def.name}{' '}
                              <span className="text-sky-300 tabular-nums">×{count}</span>
                            </div>
                            <div className="text-[10px] text-sky-200/80">
                              盟军强化 (+15% 战力)
                            </div>
                          </div>
                          <button
                            type="button"
                            aria-label={`遣散一名援军${def.name}`}
                            onClick={() => onDismissReinforcement(tType)}
                            className="clash-btn w-6 h-6 rounded-md bg-red-800 border border-red-950 text-white flex items-center justify-center cursor-pointer ml-1"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {recentDonations.length > 0 && (
                  <div className="pt-2 border-t border-[#4a2f16] text-xs text-emerald-300 space-y-1">
                    <div className="font-bold text-emerald-200">最新联盟捐赠动态：</div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {recentDonations.map((d, i) => (
                        <span key={`${d.troopType}_${i}`}>
                          · {d.donorName} 捐赠了 {d.count}×{TROOP_CATALOG[d.troopType].name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {/* Request Reinforcements */}
              <section className="rounded-xl bg-[#3a2717] border-2 border-[#6e4723] p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-extrabold text-amber-100">
                      选择援军兵种偏好并请求支援
                    </h3>
                    <p className="text-[11px] text-amber-200/75">
                      在线盟友（{currentAlliance.members.map((m) => m.name).join('、')}）将按偏好填满城堡。
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {PREFERENCES.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPreference(p.id)}
                      className={`text-left px-3 py-2 rounded-lg border-2 cursor-pointer ${
                        preference === p.id
                          ? 'bg-amber-500/20 border-amber-400 text-amber-100'
                          : 'bg-[#1c120a]/70 border-[#5c3a1d] text-amber-200/80'
                      }`}
                    >
                      <div className="text-xs font-extrabold">{p.label}</div>
                      <div className="text-[10px] opacity-80 mt-0.5">{p.desc}</div>
                    </button>
                  ))}
                </div>

                {/* Cooldown Timer & Progress Bar + Request Button */}
                <div className="pt-2 border-t border-[#5c3a1d]/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div
                      role="timer"
                      aria-label="下一次请求剩余时间"
                      className="flex items-center justify-between text-xs font-bold tabular-nums"
                    >
                      <span className="flex items-center gap-1.5 text-amber-200/90">
                        <Clock
                          className={`w-3.5 h-3.5 ${
                            cooldown.active ? 'text-sky-400 animate-pulse' : 'text-emerald-400'
                          }`}
                        />
                        {cooldown.active ? '下一次请求剩余时间' : '增援冷却状态'}
                      </span>
                      <span
                        className={
                          cooldown.active
                            ? 'text-sky-300 font-extrabold'
                            : 'text-emerald-300 font-extrabold'
                        }
                      >
                        {cooldown.active
                          ? `${formattedRemainingTimer} (${cooldownSec}s)`
                          : '已就绪 · 可立即请求'}
                      </span>
                    </div>

                    <div
                      role="progressbar"
                      aria-label="请求增援冷却进度"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(cooldown.progressPercent)}
                      className="w-full h-2.5 rounded-full bg-[#1c120a] border border-[#5c3a1d] overflow-hidden"
                    >
                      <div
                        className={`h-full transition-[width] duration-100 ease-linear ${
                          cooldown.active
                            ? 'bg-gradient-to-r from-sky-500 via-cyan-400 to-sky-300'
                            : 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                        }`}
                        style={{ width: `${cooldown.progressPercent}%` }}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isFull || cooldown.active}
                    onClick={() => onRequestReinforcements(preference)}
                    className={`clash-btn relative overflow-hidden px-5 py-2.5 rounded-xl border-2 text-sm font-extrabold flex items-center justify-center gap-2 shrink-0 cursor-pointer tabular-nums ${
                      isFull || cooldown.active
                        ? 'bg-[#26190f] border-[#422a15] text-amber-200/75 cursor-not-allowed'
                        : 'bg-gradient-to-b from-sky-400 to-sky-600 border-sky-950 text-sky-950'
                    }`}
                  >
                    {cooldown.active && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-0 left-0 bg-sky-500/25 border-r border-sky-400/60 transition-[width] duration-100 ease-linear pointer-events-none"
                        style={{ width: `${cooldown.progressPercent}%` }}
                      />
                    )}
                    <Send className="w-4 h-4 relative z-10" />
                    <span className="relative z-10">
                      {isFull
                        ? cooldown.active
                          ? `城堡已满 (${cooldownSec}s)`
                          : '援军城堡已满'
                        : cooldown.active
                          ? `冷却中 (${cooldownSec}s)`
                          : '请求联盟增援'}
                    </span>
                  </button>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
