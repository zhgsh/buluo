import type { BattleState, SpellType, TroopType } from './types';
import { createSpriteRegistry, type CachedSprite } from './spriteCache';

import imgArcher from '../assets/sprites/troop_archer.png';
import imgBalloon from '../assets/sprites/troop_balloon.png';
import imgBarbarian from '../assets/sprites/troop_barbarian.png';
import imgGiant from '../assets/sprites/troop_giant.png';
import imgGoblin from '../assets/sprites/troop_goblin.png';
import imgWallBreaker from '../assets/sprites/troop_wall_breaker.png';

export type ProcessedTroopSprite = CachedSprite;
export type ProcessedSpellSprite = CachedSprite;

export interface SpriteSheetMapping {
  imageUrl: string;
  objectPosition: string;
  scaleClass: string;
  frameBgClass: string;
  selectedBorderClass: string;
  selectedHaloClass: string;
}

function encodeSvgDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
}

const HEAL_SPELL_SVG = encodeSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <defs>
    <radialGradient id="healGlow" cx="50%" cy="54%" r="48%">
      <stop offset="0%" stop-color="#fef08a" stop-opacity="0.95"/>
      <stop offset="55%" stop-color="#facc15" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#f59e0b" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="healLiquid" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fef9c3"/>
      <stop offset="45%" stop-color="#facc15"/>
      <stop offset="100%" stop-color="#d97706"/>
    </linearGradient>
    <linearGradient id="glassRim" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#fffbeb"/>
      <stop offset="100%" stop-color="#fde68a"/>
    </linearGradient>
  </defs>
  <circle cx="48" cy="54" r="38" fill="url(#healGlow)"/>
  <rect x="38" y="12" width="20" height="10" rx="3" fill="#92400e" stroke="#451a03" stroke-width="2.5"/>
  <rect x="34" y="20" width="28" height="8" rx="3" fill="#e2e8f0" stroke="#451a03" stroke-width="2.5"/>
  <path d="M40 28 L56 28 L60 37 C70 43 75 54 73 65 C71 77 61 84 48 84 C35 84 25 77 23 65 C21 54 26 43 36 37 Z" fill="url(#glassRim)" fill-opacity="0.28" stroke="#451a03" stroke-width="3" stroke-linejoin="round"/>
  <path d="M27 56 C27 47 34 40 48 40 C62 40 69 47 69 56 C70 70 61 80 48 80 C35 80 26 70 27 56 Z" fill="url(#healLiquid)" stroke="#b45309" stroke-width="2"/>
  <path d="M44 48 H52 V56 H60 V64 H52 V72 H44 V64 H36 V56 H44 Z" fill="#fffbeb" stroke="#92400e" stroke-width="2" stroke-linejoin="round"/>
  <ellipse cx="36" cy="50" rx="4" ry="8" transform="rotate(-22 36 50)" fill="#ffffff" fill-opacity="0.72"/>
  <circle cx="63" cy="34" r="2.5" fill="#fef08a"/>
  <circle cx="31" cy="32" r="2" fill="#fef9c3"/>
</svg>
`);

const RAGE_SPELL_SVG = encodeSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <defs>
    <radialGradient id="rageGlow" cx="50%" cy="54%" r="48%">
      <stop offset="0%" stop-color="#f0abfc" stop-opacity="0.95"/>
      <stop offset="55%" stop-color="#a855f7" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#6b21a8" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="rageLiquid" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f5d0fe"/>
      <stop offset="45%" stop-color="#c026d3"/>
      <stop offset="100%" stop-color="#6b21a8"/>
    </linearGradient>
    <linearGradient id="rageGlass" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#fae8ff"/>
      <stop offset="100%" stop-color="#d8b4fe"/>
    </linearGradient>
  </defs>
  <circle cx="48" cy="54" r="38" fill="url(#rageGlow)"/>
  <rect x="38" y="12" width="20" height="10" rx="3" fill="#78350f" stroke="#2e1065" stroke-width="2.5"/>
  <rect x="34" y="20" width="28" height="8" rx="3" fill="#e2e8f0" stroke="#2e1065" stroke-width="2.5"/>
  <path d="M40 28 L56 28 L60 37 C70 43 75 54 73 65 C71 77 61 84 48 84 C35 84 25 77 23 65 C21 54 26 43 36 37 Z" fill="url(#rageGlass)" fill-opacity="0.28" stroke="#2e1065" stroke-width="3" stroke-linejoin="round"/>
  <path d="M27 56 C27 47 34 40 48 40 C62 40 69 47 69 56 C70 70 61 80 48 80 C35 80 26 70 27 56 Z" fill="url(#rageLiquid)" stroke="#581c87" stroke-width="2"/>
  <polygon points="52,44 40,60 48,60 44,75 58,56 49,56" fill="#fef08a" stroke="#4a044e" stroke-width="2" stroke-linejoin="round"/>
  <ellipse cx="36" cy="50" rx="4" ry="8" transform="rotate(-22 36 50)" fill="#ffffff" fill-opacity="0.68"/>
  <path d="M25 38 L30 33 M71 38 L66 33" stroke="#f0abfc" stroke-width="2.5" stroke-linecap="round"/>
</svg>
`);

export const TROOP_IMAGE_URLS: Record<TroopType, string> = {
  barbarian: imgBarbarian,
  archer: imgArcher,
  giant: imgGiant,
  goblin: imgGoblin,
  wall_breaker: imgWallBreaker,
  balloon: imgBalloon,
};

export const SPELL_IMAGE_URLS: Record<SpellType, string> = {
  heal: HEAL_SPELL_SVG,
  rage: RAGE_SPELL_SVG,
};

export const TROOP_SPRITE_MAPPINGS: Record<TroopType, SpriteSheetMapping> = {
  barbarian: {
    imageUrl: TROOP_IMAGE_URLS.barbarian,
    objectPosition: '50% 38%',
    scaleClass: 'scale-110',
    frameBgClass: 'bg-gradient-to-b from-amber-900/80 to-[#24160c]',
    selectedBorderClass: 'border-amber-300',
    selectedHaloClass: 'shadow-[0_0_16px_rgba(251,191,36,0.65),0_4px_0_#78350f]',
  },
  archer: {
    imageUrl: TROOP_IMAGE_URLS.archer,
    objectPosition: '50% 35%',
    scaleClass: 'scale-110',
    frameBgClass: 'bg-gradient-to-b from-rose-950/80 to-[#24160c]',
    selectedBorderClass: 'border-amber-300',
    selectedHaloClass: 'shadow-[0_0_16px_rgba(251,191,36,0.65),0_4px_0_#78350f]',
  },
  giant: {
    imageUrl: TROOP_IMAGE_URLS.giant,
    objectPosition: '50% 32%',
    scaleClass: 'scale-105',
    frameBgClass: 'bg-gradient-to-b from-orange-950/85 to-[#24160c]',
    selectedBorderClass: 'border-amber-300',
    selectedHaloClass: 'shadow-[0_0_16px_rgba(251,191,36,0.65),0_4px_0_#78350f]',
  },
  goblin: {
    imageUrl: TROOP_IMAGE_URLS.goblin,
    objectPosition: '50% 40%',
    scaleClass: 'scale-110',
    frameBgClass: 'bg-gradient-to-b from-emerald-950/85 to-[#24160c]',
    selectedBorderClass: 'border-amber-300',
    selectedHaloClass: 'shadow-[0_0_16px_rgba(251,191,36,0.65),0_4px_0_#78350f]',
  },
  wall_breaker: {
    imageUrl: TROOP_IMAGE_URLS.wall_breaker,
    objectPosition: '50% 40%',
    scaleClass: 'scale-105',
    frameBgClass: 'bg-gradient-to-b from-slate-800/90 to-[#1f1612]',
    selectedBorderClass: 'border-amber-300',
    selectedHaloClass: 'shadow-[0_0_16px_rgba(251,191,36,0.65),0_4px_0_#78350f]',
  },
  balloon: {
    imageUrl: TROOP_IMAGE_URLS.balloon,
    objectPosition: '50% 45%',
    scaleClass: 'scale-105',
    frameBgClass: 'bg-gradient-to-b from-red-950/85 to-[#24160c]',
    selectedBorderClass: 'border-amber-300',
    selectedHaloClass: 'shadow-[0_0_16px_rgba(251,191,36,0.65),0_4px_0_#78350f]',
  },
};

export const SPELL_SPRITE_MAPPINGS: Record<SpellType, SpriteSheetMapping> = {
  heal: {
    imageUrl: SPELL_IMAGE_URLS.heal,
    objectPosition: '50% 50%',
    scaleClass: 'scale-105',
    frameBgClass: 'bg-gradient-to-b from-yellow-900/80 to-[#24160c]',
    selectedBorderClass: 'border-yellow-300',
    selectedHaloClass: 'shadow-[0_0_18px_rgba(250,204,21,0.72),0_4px_0_#78350f]',
  },
  rage: {
    imageUrl: SPELL_IMAGE_URLS.rage,
    objectPosition: '50% 50%',
    scaleClass: 'scale-105',
    frameBgClass: 'bg-gradient-to-b from-purple-950/85 to-[#201228]',
    selectedBorderClass: 'border-fuchsia-300',
    selectedHaloClass: 'shadow-[0_0_18px_rgba(217,70,239,0.72),0_4px_0_#581c87]',
  },
};

export function getBattleCardSpriteMapping(
  card: NonNullable<BattleState['selectedCard']>
): SpriteSheetMapping {
  if (card.kind === 'spell') {
    return SPELL_SPRITE_MAPPINGS[card.type];
  }
  const base = TROOP_SPRITE_MAPPINGS[card.type];
  if (card.kind === 'reinforcement') {
    return {
      ...base,
      frameBgClass: 'bg-gradient-to-b from-sky-900/90 to-[#112338]',
      selectedBorderClass: 'border-sky-300',
      selectedHaloClass: 'shadow-[0_0_18px_rgba(56,189,248,0.72),0_4px_0_#075985]',
    };
  }
  return base;
}

const troopRegistry = createSpriteRegistry<TroopType>('troop', TROOP_IMAGE_URLS);
const spellRegistry = createSpriteRegistry<SpellType>('spell', SPELL_IMAGE_URLS);

export function subscribeTroopSprites(fn: () => void): () => void {
  return troopRegistry.subscribe(fn);
}

export function preloadTroopSprites() {
  troopRegistry.preloadAll();
}

export function getTroopSprite(type: TroopType): ProcessedTroopSprite | null {
  return troopRegistry.getSprite(type);
}

export function subscribeSpellSprites(fn: () => void): () => void {
  return spellRegistry.subscribe(fn);
}

export function preloadSpellSprites() {
  spellRegistry.preloadAll();
}

export function getSpellSprite(type: SpellType): ProcessedSpellSprite | null {
  return spellRegistry.getSprite(type);
}
