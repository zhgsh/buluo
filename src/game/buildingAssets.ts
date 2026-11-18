import type { BuildingType } from './types';
import { createSpriteRegistry, type CachedSprite } from './spriteCache';

import imgAirDefense from '../assets/sprites/bldg_air_defense.png';
import imgArcherTower from '../assets/sprites/bldg_archer_tower.png';
import imgArmyCamp from '../assets/sprites/bldg_army_camp.png';
import imgBarracks from '../assets/sprites/bldg_barracks.png';
import imgBuildersHut from '../assets/sprites/bldg_builders_hut.png';
import imgCannon from '../assets/sprites/bldg_cannon.png';
import imgClanCastle from '../assets/sprites/bldg_clan_castle.png';
import imgElixirCollector from '../assets/sprites/bldg_elixir_collector.png';
import imgElixirStorage from '../assets/sprites/bldg_elixir_storage.png';
import imgFlag from '../assets/sprites/bldg_flag.png';
import imgFlowerBed from '../assets/sprites/bldg_flower_bed.png';
import imgGoldMine from '../assets/sprites/bldg_gold_mine.png';
import imgGoldStorage from '../assets/sprites/bldg_gold_storage.png';
import imgMortar from '../assets/sprites/bldg_mortar.png';
import imgSpellFactory from '../assets/sprites/bldg_spell_factory.png';
import imgStatue from '../assets/sprites/bldg_statue.png';
import imgTownHall from '../assets/sprites/bldg_town_hall.png';
import imgWall from '../assets/sprites/bldg_wall.png';
import imgWizardTower from '../assets/sprites/bldg_wizard_tower.png';

export type ProcessedBuildingSprite = CachedSprite;

export const BUILDING_IMAGE_URLS: Record<BuildingType, string> = {
  town_hall: imgTownHall,
  gold_mine: imgGoldMine,
  elixir_collector: imgElixirCollector,
  gold_storage: imgGoldStorage,
  elixir_storage: imgElixirStorage,
  builders_hut: imgBuildersHut,
  army_camp: imgArmyCamp,
  barracks: imgBarracks,
  spell_factory: imgSpellFactory,
  clan_castle: imgClanCastle,
  cannon: imgCannon,
  archer_tower: imgArcherTower,
  mortar: imgMortar,
  air_defense: imgAirDefense,
  wizard_tower: imgWizardTower,
  wall: imgWall,
  flag: imgFlag,
  flower_bed: imgFlowerBed,
  statue: imgStatue,
};

const registry = createSpriteRegistry<BuildingType>('building', BUILDING_IMAGE_URLS);

export function subscribeBuildingSprites(fn: () => void): () => void {
  return registry.subscribe(fn);
}

export function preloadBuildingSprites() {
  registry.preloadAll();
}

export function getBuildingSprite(type: BuildingType): ProcessedBuildingSprite | null {
  return registry.getSprite(type);
}
