import React from 'react';
import type { BuildingType, SpellType, TroopType } from './types';

export const GoldIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    {/* Coin rim & 3D thickness */}
    <ellipse cx="12" cy="13.2" rx="9.5" ry="9" fill="#92400e" stroke="#451a03" strokeWidth="1.6" />
    <circle cx="12" cy="11.5" r="9.3" fill="#f59e0b" stroke="#451a03" strokeWidth="1.6" />
    {/* Bright gold face */}
    <circle cx="12" cy="11.5" r="7" fill="#fde047" stroke="#b45309" strokeWidth="1" />
    {/* Specular gleam */}
    <path d="M7.2 8.2 A6 6 0 0 1 14.8 6.2" fill="none" stroke="#fef9c3" strokeWidth="1.8" strokeLinecap="round" />
    {/* Embossed diamond/crest relief (no text) */}
    <polygon points="12,7.2 14.4,11.5 12,15.8 9.6,11.5" fill="#d97706" stroke="#92400e" strokeWidth="0.7" />
    <polygon points="12,8.4 13.3,11.5 12,14.6 10.7,11.5" fill="#fef08a" opacity="0.65" />
  </svg>
);

export const ElixirIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    {/* Teardrop outer shell */}
    <path
      d="M12 2.2 C12 2.2 4.6 10.4 4.6 15.1 A7.4 7.4 0 0 0 19.4 15.1 C19.4 10.4 12 2.2 12 2.2 Z"
      fill="#c026d3"
      stroke="#4a044e"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    {/* Rich inner liquid core */}
    <path
      d="M12 5.4 C12 5.4 6.6 11.4 6.6 15.1 A5.4 5.4 0 0 0 17.4 15.1 C17.4 11.4 12 5.4 12 5.4 Z"
      fill="#e879f9"
    />
    {/* Bottom shadow crescent */}
    <path
      d="M7.2 16.2 A5.2 5.2 0 0 0 16.8 16.2 A5.8 5.8 0 0 1 7.2 16.2 Z"
      fill="#86198f"
      opacity="0.7"
    />
    {/* Glossy specular highlight */}
    <ellipse cx="9.2" cy="14" rx="1.6" ry="3.1" transform="rotate(-14 9.2 14)" fill="#fdf4ff" opacity="0.9" />
    <circle cx="11.2" cy="8.5" r="0.9" fill="#fdf4ff" opacity="0.85" />
  </svg>
);

export const GemIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <polygon
      points="7,3 17,3 22,9 12,21 2,9"
      fill="#10b981"
      stroke="#064e3b"
      strokeWidth="2"
    />
    <polygon points="7,3 17,3 15,9 9,9" fill="#6ee7b7" />
    <polygon points="9,9 15,9 12,21" fill="#059669" />
  </svg>
);

export const TrophyIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path
      d="M6 4h12v5a6 6 0 0 1-12 0V4z"
      fill="#fbbf24"
      stroke="#451a03"
      strokeWidth="2"
    />
    <path d="M6 6H3v2a3 3 0 0 0 3 3M18 6h3v2a3 3 0 0 1-3 3" fill="none" stroke="#b45309" strokeWidth="2" />
    <rect x="10.5" y="14.5" width="3" height="4" fill="#b45309" />
    <rect x="7" y="18.5" width="10" height="3" rx="1" fill="#78350f" stroke="#451a03" strokeWidth="1.2" />
  </svg>
);

export const BuilderIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <rect x="10.5" y="10" width="3" height="11" rx="1" fill="#b45309" stroke="#451a03" strokeWidth="1.5" />
    <path d="M5 6h11l3 3-2 2H5V6z" fill="#94a3b8" stroke="#1e293b" strokeWidth="1.6" />
  </svg>
);

export const StarIcon: React.FC<{ filled: boolean; className?: string }> = ({
  filled,
  className = 'w-6 h-6',
}) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <polygon
      points="12,2 15.1,8.3 22,9.3 17,14.2 18.2,21 12,17.8 5.8,21 7,14.2 2,9.3 8.9,8.3"
      fill={filled ? '#facc15' : '#3f2e1e'}
      stroke="#1c130b"
      strokeWidth="1.8"
    />
  </svg>
);

export const ClashCrestLogo: React.FC<{ className?: string }> = ({ className = 'w-64 h-auto' }) => (
  <svg viewBox="0 0 420 145" className={className} role="img" aria-label="天启崛起">
    {/* Crossed Swords behind shield */}
    <g stroke="#1c130b" strokeWidth="3" strokeLinejoin="round">
      <path d="M44 108 L112 36 L122 46 L54 118 Z" fill="#e2e8f0" />
      <path d="M108 32 L126 50 L118 58 L100 40 Z" fill="#f59e0b" />
      <path d="M132 108 L64 36 L54 46 L122 118 Z" fill="#cbd5e1" />
      <path d="M68 32 L50 50 L58 58 L76 40 Z" fill="#f59e0b" />
    </g>
    {/* Shield Badge */}
    <path
      d="M58 30 L118 30 L118 76 C118 102 88 120 88 120 C88 120 58 102 58 76 Z"
      fill="#b91c1c"
      stroke="#fbbf24"
      strokeWidth="5"
    />
    <path
      d="M66 38 L110 38 L110 74 C110 94 88 109 88 109 C88 109 66 94 66 74 Z"
      fill="#991b1b"
    />
    <polygon points="88,48 94,63 108,65 97,75 100,90 88,82 76,90 79,75 68,65 82,63" fill="#fde047" stroke="#451a03" strokeWidth="2" />

    {/* Bold Display Lockup */}
    <text
      x="145"
      y="76"
      fill="#fef08a"
      stroke="#1c130b"
      strokeWidth="9"
      paintOrder="stroke fill"
      fontFamily="'Cinzel', 'PingFang SC', 'Microsoft YaHei', serif"
      fontWeight="900"
      fontSize="54"
      letterSpacing="3"
    >
      天启崛起
    </text>
    <text
      x="147"
      y="108"
      fill="#fed7aa"
      stroke="#1c130b"
      strokeWidth="4"
      paintOrder="stroke fill"
      fontFamily="'Cinzel', serif"
      fontWeight="700"
      fontSize="16"
      letterSpacing="4"
    >
      APOCALYPSE RISING
    </text>
  </svg>
);

export const TroopBadgeIcon: React.FC<{ type: TroopType; className?: string }> = ({
  type,
  className = 'w-9 h-9',
}) => {
  switch (type) {
    case 'barbarian':
      return (
        <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
          <circle cx="18" cy="18" r="15" fill="#fef08a" stroke="#451a03" strokeWidth="2" />
          <circle cx="18" cy="19" r="9" fill="#fed7aa" stroke="#451a03" strokeWidth="1.5" />
          <path d="M9 15 Q18 5 27 15 L25 18 Q18 11 11 18 Z" fill="#eab308" stroke="#451a03" strokeWidth="1.3" />
          <path d="M12 23 Q18 27 24 23" fill="none" stroke="#b45309" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    case 'archer':
      return (
        <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
          <circle cx="18" cy="18" r="15" fill="#fbcfe8" stroke="#451a03" strokeWidth="2" />
          <path d="M10 19 Q18 8 26 19 Z" fill="#15803d" stroke="#14532d" strokeWidth="1.5" />
          <circle cx="18" cy="20" r="6" fill="#fed7aa" stroke="#451a03" strokeWidth="1.2" />
          <path d="M11 16 Q18 10 25 16" fill="none" stroke="#ec4899" strokeWidth="3" />
        </svg>
      );
    case 'giant':
      return (
        <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
          <circle cx="18" cy="18" r="15" fill="#fed7aa" stroke="#451a03" strokeWidth="2" />
          <circle cx="18" cy="18" r="10" fill="#fdba74" stroke="#7c2d12" strokeWidth="1.5" />
          <path d="M10 22 Q18 30 26 22" fill="#c2410c" stroke="#451a03" strokeWidth="1.2" />
          <circle cx="14.5" cy="16" r="1.5" fill="#1c130b" />
          <circle cx="21.5" cy="16" r="1.5" fill="#1c130b" />
        </svg>
      );
    case 'goblin':
      return (
        <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
          <circle cx="18" cy="18" r="15" fill="#bbf7d0" stroke="#14532d" strokeWidth="2" />
          <polygon points="5,15 12,13 11,20" fill="#4ade80" stroke="#14532d" strokeWidth="1.3" />
          <polygon points="31,15 24,13 25,20" fill="#4ade80" stroke="#14532d" strokeWidth="1.3" />
          <circle cx="18" cy="19" r="8" fill="#4ade80" stroke="#14532d" strokeWidth="1.5" />
          <circle cx="15" cy="18" r="1.5" fill="#ef4444" />
          <circle cx="21" cy="18" r="1.5" fill="#ef4444" />
        </svg>
      );
    case 'wall_breaker':
      return (
        <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
          <circle cx="18" cy="18" r="15" fill="#cbd5e1" stroke="#1e293b" strokeWidth="2" />
          <circle cx="18" cy="18" r="8.5" fill="#f8fafc" stroke="#1e293b" strokeWidth="1.5" />
          <circle cx="15" cy="17" r="2" fill="#0f172a" />
          <circle cx="21" cy="17" r="2" fill="#0f172a" />
          <circle cx="25" cy="24" r="4" fill="#1e293b" stroke="#f97316" strokeWidth="1.5" />
        </svg>
      );
    case 'balloon':
      return (
        <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
          <circle cx="18" cy="18" r="15" fill="#fecaca" stroke="#7f1d1d" strokeWidth="2" />
          <circle cx="18" cy="15" r="9" fill="#dc2626" stroke="#1c130b" strokeWidth="1.5" />
          <rect x="14" y="25" width="8" height="5" fill="#78350f" stroke="#1c130b" strokeWidth="1.2" />
        </svg>
      );
  }
};

export const SpellBadgeIcon: React.FC<{ type: SpellType; className?: string }> = ({
  type,
  className = 'w-9 h-9',
}) => (
  <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
    <rect x="14" y="5" width="8" height="4" rx="1" fill="#b45309" stroke="#1c130b" strokeWidth="1.4" />
    <circle
      cx="18"
      cy="20"
      r="11"
      fill={type === 'heal' ? '#facc15' : '#a855f7'}
      stroke="#1c130b"
      strokeWidth="2"
    />
    <circle cx="14.5" cy="17" r="2.5" fill="#ffffff" opacity="0.6" />
  </svg>
);

export const BuildingBadgeIcon: React.FC<{ type: BuildingType; className?: string }> = ({
  type,
  className = 'w-8 h-8',
}) => {
  const color =
    type === 'gold_mine' || type === 'gold_storage'
      ? '#f59e0b'
      : type === 'elixir_collector' || type === 'elixir_storage'
        ? '#d946ef'
        : type === 'cannon' || type === 'mortar' || type === 'wall' || type === 'statue'
          ? '#64748b'
          : type === 'archer_tower' || type === 'air_defense'
            ? '#b45309'
            : type === 'wizard_tower' || type === 'spell_factory'
              ? '#7e22ce'
              : type === 'flower_bed'
                ? '#16a34a'
                : '#b91c1c';
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <polygon points="16,4 28,11 28,23 16,29 4,23 4,11" fill={color} stroke="#1c130b" strokeWidth="2" />
      <polygon points="16,4 28,11 16,17 4,11" fill="#fef08a" opacity="0.35" />
    </svg>
  );
};
