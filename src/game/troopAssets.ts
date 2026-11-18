import type { TroopType } from './types';
import { createSpriteRegistry, type CachedSprite } from './spriteCache';

import imgArcher from '../assets/sprites/troop_archer.png';
import imgBalloon from '../assets/sprites/troop_balloon.png';
import imgBarbarian from '../assets/sprites/troop_barbarian.png';
import imgGiant from '../assets/sprites/troop_giant.png';
import imgGoblin from '../assets/sprites/troop_goblin.png';
import imgWallBreaker from '../assets/sprites/troop_wall_breaker.png';

export type ProcessedTroopSprite = CachedSprite;

export const TROOP_IMAGE_URLS: Record<TroopType, string> = {
  barbarian: imgBarbarian,
  archer: imgArcher,
  giant: imgGiant,
  goblin: imgGoblin,
  wall_breaker: imgWallBreaker,
  balloon: imgBalloon,
};

const registry = createSpriteRegistry<TroopType>('troop', TROOP_IMAGE_URLS);

export function subscribeTroopSprites(fn: () => void): () => void {
  return registry.subscribe(fn);
}

export function preloadTroopSprites() {
  registry.preloadAll();
}

export function getTroopSprite(type: TroopType): ProcessedTroopSprite | null {
  return registry.getSprite(type);
}
