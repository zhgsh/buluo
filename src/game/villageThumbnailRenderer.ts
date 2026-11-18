import { renderVillageCanvas } from './canvasRenderer';
import type { VillageState } from './types';
import {
  type VillageLayoutStats,
  computeVillageLayoutStats,
  computeVillageThumbnailFraming,
  formatVillageLayoutSummary,
} from './villageThumbnailLogic';

export interface GeneratedVillageThumbnail {
  dataUrl: string;
  width: number;
  height: number;
  stats: VillageLayoutStats;
  summary: string;
  generatedAtMs: number;
}

/**
 * Renders the full current village layout in isometric perspective onto an
 * offscreen 2D canvas and exports a clean PNG data URL suitable for sharing
 * with clan members or downloading.
 */
export function generateVillageThumbnailDataUrl(
  village: VillageState,
  options: { width?: number; height?: number; nowMs?: number } = {}
): GeneratedVillageThumbnail {
  const nowMs = options.nowMs ?? Date.now();
  const framing = computeVillageThumbnailFraming(options.width ?? 800, options.height ?? 480);
  const stats = computeVillageLayoutStats(village);
  const summary = formatVillageLayoutSummary(stats);

  const canvas = document.createElement('canvas');
  canvas.width = framing.width;
  canvas.height = framing.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('无法创建离屏画布上下文');
  }

  renderVillageCanvas(ctx, framing.width, framing.height, framing.camera, village, nowMs, {
    selectedBuildingId: null,
    placingType: null,
    movingBuildingId: null,
    hoverGrid: null,
    editMode: null,
  });

  // Subtle corner framing border & bottom information strip for clan sharing clarity
  const barH = 38;
  const grad = ctx.createLinearGradient(0, framing.height - barH - 18, 0, framing.height);
  grad.addColorStop(0, 'rgba(18, 12, 7, 0)');
  grad.addColorStop(0.45, 'rgba(18, 12, 7, 0.72)');
  grad.addColorStop(1, 'rgba(18, 12, 7, 0.92)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, framing.height - barH - 18, framing.width, barH + 18);

  ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, framing.width - 2, framing.height - 2);

  ctx.fillStyle = '#fef3c7';
  ctx.font = '800 14px "Plus Jakarta Sans", "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(`天启崛起 · ${stats.clanName}`, 16, framing.height - 19);

  ctx.fillStyle = '#fcd34d';
  ctx.font = '700 13px "Plus Jakarta Sans", "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(summary, framing.width - 16, framing.height - 19);

  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: framing.width,
    height: framing.height,
    stats,
    summary,
    generatedAtMs: nowMs,
  };
}
