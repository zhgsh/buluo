import { BUILDING_CATALOG, GRID_SIZE } from './catalog';
import { type CameraState, TILE_H, TILE_W } from './isoMath';
import type { VillageState } from './types';

export interface VillageThumbnailFraming {
  width: number;
  height: number;
  camera: CameraState;
}

export interface VillageLayoutStats {
  townHallLevel: number;
  totalBuildings: number;
  defensesCount: number;
  wallsCount: number;
  resourcesCount: number;
  decorationsCount: number;
  clanName: string;
  trophies: number;
}

const DEFENSE_TYPES = new Set([
  'cannon',
  'archer_tower',
  'mortar',
  'air_defense',
  'wizard_tower',
]);

const RESOURCE_TYPES = new Set([
  'gold_mine',
  'elixir_collector',
  'gold_storage',
  'elixir_storage',
]);

/**
 * Computes camera framing so the entire 28x28 isometric village clearing plus
 * tall building roofs and outer border trees fit cleanly inside the thumbnail.
 */
export function computeVillageThumbnailFraming(
  width = 800,
  height = 480
): VillageThumbnailFraming {
  const safeW = Math.max(320, Math.round(width));
  const safeH = Math.max(200, Math.round(height));

  // Isometric diamond spans GRID_SIZE * TILE_W horizontally and GRID_SIZE * TILE_H vertically.
  // Add small margin for tall Town Hall roofs, outer forest props, and bottom caption strip.
  const worldSpanW = GRID_SIZE * TILE_W + 210;
  const worldSpanH = GRID_SIZE * TILE_H + 220;

  const sidePad = safeW * 0.04;
  const topPad = safeH * 0.06;
  const bottomPad = safeH * 0.1;

  const rawZoom = Math.min(
    (safeW - sidePad * 2) / worldSpanW,
    (safeH - topPad - bottomPad) / worldSpanH
  );
  const zoom = Math.max(0.28, Math.min(1.2, Number(rawZoom.toFixed(4))));

  return {
    width: safeW,
    height: safeH,
    camera: {
      x: 0,
      y: -18,
      zoom,
    },
  };
}

export function computeVillageLayoutStats(village: VillageState): VillageLayoutStats {
  let defensesCount = 0;
  let wallsCount = 0;
  let resourcesCount = 0;
  let decorationsCount = 0;

  for (const b of village.buildings) {
    if (b.type === 'wall') {
      wallsCount += 1;
    } else if (DEFENSE_TYPES.has(b.type)) {
      defensesCount += 1;
    } else if (RESOURCE_TYPES.has(b.type)) {
      resourcesCount += 1;
    } else if (BUILDING_CATALOG[b.type]?.category === 'decoration') {
      decorationsCount += 1;
    }
  }

  return {
    townHallLevel: village.townHallLevel,
    totalBuildings: village.buildings.length,
    defensesCount,
    wallsCount,
    resourcesCount,
    decorationsCount,
    clanName: village.clanName?.trim() || '未加入联盟',
    trophies: Math.round(village.trophies),
  };
}

export function formatVillageLayoutSummary(stats: VillageLayoutStats): string {
  return `大本营 Lv.${stats.townHallLevel} · 防御 ${stats.defensesCount} · 城墙 ${stats.wallsCount} · 总建筑 ${stats.totalBuildings}`;
}

export function buildVillageThumbnailFilename(village: VillageState): string {
  return `天启崛起-TH${village.townHallLevel}-村庄阵型.png`;
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) {
    throw new Error('无效的图片 Data URL');
  }
  const header = dataUrl.slice(0, commaIdx);
  const base64Body = dataUrl.slice(commaIdx + 1);
  const mimeMatch = /^data:([^;]+);base64$/i.exec(header);
  const mime = mimeMatch?.[1] || 'image/png';
  const binaryStr = atob(base64Body);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}
