import React, { useEffect, useRef, useState } from 'react';
import { Gift, MessageSquare, Send, Shield, X } from 'lucide-react';
import {
  CLAN_REQUEST_COOLDOWN_MS,
  getAllianceByName,
  getClanRequestCooldownState,
  type ClanChatEntry,
} from '../game/clanLogic';
import type { VillageState } from '../game/types';
import { getResourceCaps, getUsedClanSpace } from '../game/villageLogic';
import { TroopSpriteThumb } from './TroopSpriteThumb';

interface ClanChatProps {
  village: VillageState;
  nowMs: number;
  messages: ClanChatEntry[];
  onClose: () => void;
  onSendMessage: (text: string) => void;
  onQuickRequestReinforcements: () => void;
  onOpenClanCastle: () => void;
}

function formatMessageTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export const ClanChat: React.FC<ClanChatProps> = ({
  village,
  nowMs,
  messages,
  onClose,
  onSendMessage,
  onQuickRequestReinforcements,
  onOpenClanCastle,
}) => {
  const [draft, setDraft] = useState('');
  const [liveNowMs, setLiveNowMs] = useState<number>(() => Math.max(nowMs, Date.now()));
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLiveNowMs(Math.max(nowMs, Date.now()));
  }, [nowMs, village.clanLastRequestAt]);

  useEffect(() => {
    const lastReq = village.clanLastRequestAt;
    if (!lastReq || Date.now() - lastReq >= CLAN_REQUEST_COOLDOWN_MS) return;
    const id = window.setInterval(() => {
      const cur = Date.now();
      setLiveNowMs(cur);
      if (cur - lastReq >= CLAN_REQUEST_COOLDOWN_MS) {
        window.clearInterval(id);
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [village.clanLastRequestAt]);

  useEffect(() => {
    const el = listRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  const alliance = getAllianceByName(village.clanName);
  const caps = getResourceCaps(village);
  const usedClan = getUsedClanSpace(village.clanReinforcements);
  const isFull = caps.hasClanCastle && usedClan >= caps.maxClanSpace;
  const cooldown = getClanRequestCooldownState(village, liveNowMs);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setDraft('');
  };

  return (
    <aside
      role="region"
      aria-label="联盟聊天"
      className="fixed left-3 sm:left-4 bottom-20 sm:bottom-24 z-20 w-[min(360px,calc(100vw-24px))] h-[min(430px,56vh)] pointer-events-auto rounded-2xl bg-[#24170e]/95 border-2 border-[#8b5e34] shadow-[0_12px_30px_rgba(0,0,0,0.65)] flex flex-col overflow-hidden backdrop-blur-sm"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#180f08] border-b border-[#6e4723] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-sky-600/25 border border-sky-400/50 flex items-center justify-center shrink-0">
            <MessageSquare className="w-4 h-4 text-sky-300" />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="text-xs font-extrabold text-amber-100 truncate">
              {alliance.name}
            </div>
            <div className="text-[10px] font-bold text-sky-300/90 truncate">
              {alliance.badge} · 援军 {usedClan}/{caps.maxClanSpace}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenClanCastle}
            className="clash-btn px-2 py-1 rounded-lg bg-[#3a2717] border border-[#7c5329] text-amber-200 text-[10px] font-extrabold flex items-center gap-1 cursor-pointer"
          >
            <Shield className="w-3 h-3 text-sky-300" />
            城堡
          </button>
          <button
            type="button"
            aria-label="关闭联盟聊天"
            onClick={onClose}
            className="clash-btn w-7 h-7 rounded-lg bg-red-800/90 border border-red-950 text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable Chat & Donation Feed */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-3 py-2.5 space-y-2 text-xs"
      >
        {messages.map((msg) => {
          if (msg.kind === 'system') {
            return (
              <div
                key={msg.id}
                className="px-2.5 py-1.5 rounded-lg bg-[#180f08]/80 border border-[#5c3a1d]/70 text-[11px] text-amber-300/85 text-center font-semibold"
              >
                {msg.text}
              </div>
            );
          }

          if (msg.kind === 'donation') {
            return (
              <div
                key={msg.id}
                className="rounded-xl bg-[#12263a]/90 border border-sky-500/60 px-2.5 py-2 flex items-center gap-2.5 shadow-sm"
              >
                {msg.troopType ? (
                  <div className="w-8 h-8 rounded-lg bg-[#1c120a] border border-sky-400/50 p-0.5 flex items-center justify-center shrink-0">
                    <TroopSpriteThumb
                      type={msg.troopType}
                      alt={msg.senderName}
                      className="w-full h-full"
                    />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/50 flex items-center justify-center shrink-0">
                    <Gift className="w-4 h-4 text-sky-300" />
                  </div>
                )}
                <div className="min-w-0 flex-1 leading-snug">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold text-sky-300 truncate">
                      {msg.senderName}
                      {msg.senderRole && (
                        <span className="ml-1 text-[10px] font-bold text-sky-200/75">
                          [{msg.senderRole}]
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-sky-200/60 tabular-nums shrink-0">
                      {formatMessageTime(msg.timestampMs)}
                    </span>
                  </div>
                  <div className="text-[11px] font-bold text-emerald-200 mt-0.5">
                    {msg.text}
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`rounded-xl px-2.5 py-2 border ${
                msg.isOwn
                  ? 'bg-[#3d2915] border-amber-500/60 ml-6'
                  : 'bg-[#1a110a]/90 border-[#5c3a1d] mr-4'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-[11px] font-extrabold truncate ${
                    msg.isOwn ? 'text-amber-300' : 'text-amber-100'
                  }`}
                >
                  {msg.senderName}
                  {msg.senderRole && !msg.isOwn && (
                    <span className="ml-1 text-[10px] font-bold text-amber-400/80">
                      [{msg.senderRole}]
                    </span>
                  )}
                </span>
                <span className="text-[10px] text-amber-200/50 tabular-nums shrink-0">
                  {formatMessageTime(msg.timestampMs)}
                </span>
              </div>
              <p className="text-[11px] text-amber-50/90 mt-0.5 leading-relaxed break-words">
                {msg.text}
              </p>
              {msg.thumbnailDataUrl && (
                <div className="mt-2 space-y-1">
                  <img
                    src={msg.thumbnailDataUrl}
                    alt="分享的村庄等距视角缩略图"
                    data-testid="clan-chat-shared-thumbnail"
                    referrerPolicy="no-referrer"
                    className="w-full rounded-lg border border-amber-500/60 object-cover aspect-[5/3] bg-[#1b3312]"
                  />
                  {msg.layoutSummary && (
                    <div className="text-[10px] font-bold text-amber-200/80 tabular-nums">
                      {msg.layoutSummary}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer: Quick Request Reinforcements + Chat Input */}
      <div className="px-3 py-2 bg-[#180f08] border-t border-[#6e4723] space-y-2 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold text-amber-200/75 tabular-nums truncate">
            {!caps.hasClanCastle
              ? '建成部落城堡后可请求援军'
              : isFull
                ? `援军已满 (${usedClan}/${caps.maxClanSpace})`
                : cooldown.active
                  ? `求援冷却中 ${cooldown.remainingSec}s`
                  : `盟友在线 · 空余 ${caps.maxClanSpace - usedClan} 人口`}
          </span>

          <button
            type="button"
            disabled={!caps.hasClanCastle || isFull || cooldown.active}
            onClick={onQuickRequestReinforcements}
            className={`clash-btn px-2.5 py-1 rounded-lg border text-[11px] font-extrabold flex items-center gap-1 shrink-0 cursor-pointer tabular-nums ${
              !caps.hasClanCastle || isFull || cooldown.active
                ? 'bg-[#26190f] border-[#422a15] text-amber-400/45 cursor-not-allowed'
                : 'bg-gradient-to-b from-sky-400 to-sky-600 border-sky-950 text-sky-950'
            }`}
          >
            <Gift className="w-3 h-3" />
            {cooldown.active ? `冷却 (${cooldown.remainingSec}s)` : '快速求援'}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
          <input
            type="text"
            value={draft}
            maxLength={120}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="向联盟发送消息或请求支援..."
            aria-label="输入联盟聊天消息"
            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-[#2a1c11] border border-[#6e4723] focus:border-amber-400 focus:outline-none text-xs text-amber-50 placeholder:text-amber-200/40"
          />
          <button
            type="submit"
            aria-label="发送联盟消息"
            disabled={draft.trim().length === 0}
            className={`clash-btn px-3 py-1.5 rounded-lg border text-xs font-extrabold flex items-center gap-1 shrink-0 cursor-pointer ${
              draft.trim().length === 0
                ? 'bg-[#26190f] border-[#422a15] text-amber-400/40 cursor-not-allowed'
                : 'bg-amber-500 border-amber-950 text-amber-950'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            发送
          </button>
        </form>
      </div>
    </aside>
  );
};
