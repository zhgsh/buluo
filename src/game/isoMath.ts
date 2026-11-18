import { BUILDING_CATALOG, GRID_SIZE } from './catalog';
import type { PlacedBuilding } from './types';

// Isometric tile half-dimensions in world units (before camera zoom)
export const TILE_W = 54;
export const TILE_H = 27;

export interface CameraState {
  x: number; // world X center
  y: number; // world Y center
  zoom: number;
}

/**
 * Converts continuous grid coordinates (gx, gy) to isometric world coordinates (wx, wy).
 * Grid origin (0, 0) is at top corner; (GRID_SIZE, GRID_SIZE) is at bottom corner.
 */
export function gridToWorld(gx: number, gy: number): { x: number; y: number } {
  const half = GRID_SIZE / 2;
  const rx = gx - half;
  const ry = gy - half;
  return {
    x: (rx - ry) * (TILE_W / 2),
    y: (rx + ry) * (TILE_H / 2),
  };
}

/**
 * Inverse of gridToWorld: converts world coordinates (wx, wy) to continuous grid coordinates (gx, gy).
 */
export function worldToGrid(wx: number, wy: number): { gx: number; gy: number } {
  const halfW = TILE_W / 2;
  const halfH = TILE_H / 2;
  const rx = (wx / halfW + wy / halfH) / 2;
  const ry = (wy / halfH - wx / halfW) / 2;
  const half = GRID_SIZE / 2;
  return {
    gx: rx + half,
    gy: ry + half,
  };
}

/**
 * Converts CSS canvas-relative screen coordinates to world coordinates.
 */
export function screenToWorld(
  sx: number,
  sy: number,
  viewportW: number,
  viewportH: number,
  camera: CameraState
): { x: number; y: number } {
  return {
    x: (sx - viewportW / 2) / camera.zoom + camera.x,
    y: (sy - viewportH / 2) / camera.zoom + camera.y,
  };
}

/**
 * Converts world coordinates to CSS canvas-relative screen coordinates.
 */
export function worldToScreen(
  wx: number,
  wy: number,
  viewportW: number,
  viewportH: number,
  camera: CameraState
): { x: number; y: number } {
  return {
    x: (wx - camera.x) * camera.zoom + viewportW / 2,
    y: (wy - camera.y) * camera.zoom + viewportH / 2,
  };
}

/**
 * Checks whether a building of `size x size` can be placed at integer grid cell (gx, gy).
 */
export function canPlaceBuilding(
  gx: number,
  gy: number,
  size: number,
  buildings: PlacedBuilding[],
  ignoreBuildingId?: string
): boolean {
  if (!Number.isInteger(gx) || !Number.isInteger(gy)) return false;
  if (gx < 0 || gy < 0 || gx + size > GRID_SIZE || gy + size > GRID_SIZE) {
    return false;
  }

  for (const b of buildings) {
    if (ignoreBuildingId && b.id === ignoreBuildingId) continue;
    const bSize = BUILDING_CATALOG[b.type].size;
    const overlapX = gx < b.gx + bSize && gx + size > b.gx;
    const overlapY = gy < b.gy + bSize && gy + size > b.gy;
    if (overlapX && overlapY) {
      return false;
    }
  }
  return true;
}

/**
 * Finds the nearest valid placement spot near center or spiral outward.
 */
export function findAvailableGridSpot(
  size: number,
  buildings: PlacedBuilding[],
  preferGx = 12,
  preferGy = 12
): { gx: number; gy: number } | null {
  for (let radius = 0; radius <= GRID_SIZE; radius++) {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
        const gx = preferGx + dx;
        const gy = preferGy + dy;
        if (canPlaceBuilding(gx, gy, size, buildings)) {
          return { gx, gy };
        }
      }
    }
  }
  return null;
}

export function dist2D(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Shortest distance from point (px, py) to an axis-aligned building footprint [gx, gx+size] x [gy, gy+size].
 */
export function distanceToBuildingEdge(
  px: number,
  py: number,
  gx: number,
  gy: number,
  size: number
): number {
  const cx = Math.max(gx, Math.min(px, gx + size));
  const cy = Math.max(gy, Math.min(py, gy + size));
  return dist2D(px, py, cx, cy);
}
