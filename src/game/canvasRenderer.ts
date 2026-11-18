import { BUILDING_CATALOG, GRID_SIZE, SPELL_CATALOG, TROOP_CATALOG } from './catalog';
import { getBuildingSprite, preloadBuildingSprites } from './buildingAssets';
import { getTroopSprite, preloadTroopSprites } from './troopAssets';
import {
  CameraState,
  TILE_H,
  TILE_W,
  canPlaceBuilding,
  gridToWorld,
  worldToScreen,
} from './isoMath';
import { isDefenseBuilding, VFXPools } from './battleLogic';
import { type EditModeState, getEditPlacedBuildings } from './villageLogic';
import type {
  BattleBuilding,
  BattleState,
  BattleTroop,
  BuildingType,
  PlacedBuilding,
  TroopType,
  VillageState,
} from './types';

// Precomputed outer forest trees & rocks around the 28x28 clearing
interface SceneryProp {
  gx: number;
  gy: number;
  kind: 'pine' | 'oak' | 'rock';
  scale: number;
  seed: number;
}

const SCENERY_PROPS: SceneryProp[] = (() => {
  const props: SceneryProp[] = [];
  let s = 42;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = 0; i < 28; i++) {
    const side = i % 4;
    let gx = 0;
    let gy = 0;
    if (side === 0) {
      gx = -5.5 + rand() * 3.5;
      gy = -2 + rand() * (GRID_SIZE + 4);
    } else if (side === 1) {
      gx = GRID_SIZE + 2 + rand() * 3.5;
      gy = -2 + rand() * (GRID_SIZE + 4);
    } else if (side === 2) {
      gx = -2 + rand() * (GRID_SIZE + 4);
      gy = -5.5 + rand() * 3.5;
    } else {
      gx = -2 + rand() * (GRID_SIZE + 4);
      gy = GRID_SIZE + 2 + rand() * 3.5;
    }
    const r = rand();
    props.push({
      gx,
      gy,
      kind: r < 0.62 ? 'pine' : r < 0.88 ? 'oak' : 'rock',
      scale: 0.82 + rand() * 0.45,
      seed: rand() * Math.PI * 2,
    });
  }
  return props;
})();

function drawIsoDiamond(
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  wTiles: number,
  hTiles: number
) {
  const p0 = gridToWorld(gx, gy);
  const p1 = gridToWorld(gx + wTiles, gy);
  const p2 = gridToWorld(gx + wTiles, gy + hTiles);
  const p3 = gridToWorld(gx, gy + hTiles);
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.lineTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.lineTo(p3.x, p3.y);
  ctx.closePath();
}

function drawIsoPrism(
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  w: number,
  h: number,
  heightPx: number,
  topColor: string,
  leftColor: string,
  rightColor: string,
  strokeColor = '#1c130b',
  baseYOffset = 0
) {
  const p0 = gridToWorld(gx, gy);
  const p1 = gridToWorld(gx + w, gy);
  const p2 = gridToWorld(gx + w, gy + h);
  const p3 = gridToWorld(gx, gy + h);

  // Left visible face (p3 -> p2)
  ctx.beginPath();
  ctx.moveTo(p3.x, p3.y - baseYOffset);
  ctx.lineTo(p2.x, p2.y - baseYOffset);
  ctx.lineTo(p2.x, p2.y - baseYOffset - heightPx);
  ctx.lineTo(p3.x, p3.y - baseYOffset - heightPx);
  ctx.closePath();
  ctx.fillStyle = leftColor;
  ctx.fill();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Right visible face (p2 -> p1)
  ctx.beginPath();
  ctx.moveTo(p2.x, p2.y - baseYOffset);
  ctx.lineTo(p1.x, p1.y - baseYOffset);
  ctx.lineTo(p1.x, p1.y - baseYOffset - heightPx);
  ctx.lineTo(p2.x, p2.y - baseYOffset - heightPx);
  ctx.closePath();
  ctx.fillStyle = rightColor;
  ctx.fill();
  ctx.stroke();

  // Top face
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y - baseYOffset - heightPx);
  ctx.lineTo(p1.x, p1.y - baseYOffset - heightPx);
  ctx.lineTo(p2.x, p2.y - baseYOffset - heightPx);
  ctx.lineTo(p3.x, p3.y - baseYOffset - heightPx);
  ctx.closePath();
  ctx.fillStyle = topColor;
  ctx.fill();
  ctx.stroke();
}

function drawTerrain(ctx: CanvasRenderingContext2D, timeSec: number) {
  // Outer forest meadow
  drawIsoDiamond(ctx, -10, -10, GRID_SIZE + 20, GRID_SIZE + 20);
  ctx.fillStyle = '#3b6a23';
  ctx.fill();

  // Subtle river along bottom-right edge (gx > GRID_SIZE + 5)
  drawIsoDiamond(ctx, GRID_SIZE + 5.2, -10, 4.5, GRID_SIZE + 20);
  ctx.fillStyle = '#2589bd';
  ctx.fill();

  // Shimmering water highlights
  ctx.strokeStyle = 'rgba(186, 230, 253, 0.45)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const wy = ((i * 4.5 + timeSec * 1.4) % (GRID_SIZE + 14)) - 7;
    const a = gridToWorld(GRID_SIZE + 6.4, wy);
    const b = gridToWorld(GRID_SIZE + 6.4, wy + 1.8);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // Playable 28x28 clearing with subtle border
  drawIsoDiamond(ctx, -0.35, -0.35, GRID_SIZE + 0.7, GRID_SIZE + 0.7);
  ctx.fillStyle = '#4c7c2c';
  ctx.fill();

  drawIsoDiamond(ctx, 0, 0, GRID_SIZE, GRID_SIZE);
  ctx.fillStyle = '#68a63c';
  ctx.fill();

  // Checkerboard grass subtle tiles (batched in a single path for 60fps performance)
  ctx.beginPath();
  for (let x = 0; x < GRID_SIZE; x += 2) {
    for (let y = 0; y < GRID_SIZE; y += 2) {
      if (((x + y) / 2) % 2 === 0) {
        const p0 = gridToWorld(x, y);
        const p1 = gridToWorld(x + 2, y);
        const p2 = gridToWorld(x + 2, y + 2);
        const p3 = gridToWorld(x, y + 2);
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.closePath();
      }
    }
  }
  ctx.fillStyle = '#5e9935';
  ctx.fill();

  // Subtle grid lines (batched in a single path)
  ctx.beginPath();
  for (let i = 0; i <= GRID_SIZE; i += 2) {
    const a = gridToWorld(i, 0);
    const b = gridToWorld(i, GRID_SIZE);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);

    const c = gridToWorld(0, i);
    const d = gridToWorld(GRID_SIZE, i);
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
  }
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Clearing perimeter edge stroke
  drawIsoDiamond(ctx, 0, 0, GRID_SIZE, GRID_SIZE);
  ctx.strokeStyle = 'rgba(254, 240, 138, 0.28)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawSceneryProp(ctx: CanvasRenderingContext2D, prop: SceneryProp, timeSec: number) {
  const pos = gridToWorld(prop.gx, prop.gy);
  const s = prop.scale;
  const sway = Math.sin(timeSec * 1.6 + prop.seed) * 1.8;

  ctx.save();
  ctx.translate(pos.x, pos.y);

  // Ground shadow
  ctx.fillStyle = 'rgba(15, 30, 10, 0.34)';
  ctx.beginPath();
  ctx.ellipse(3, 2, 16 * s, 9 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  if (prop.kind === 'rock') {
    ctx.fillStyle = '#78716c';
    ctx.strokeStyle = '#292524';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-12 * s, 2);
    ctx.lineTo(-9 * s, -9 * s);
    ctx.lineTo(1 * s, -12 * s);
    ctx.lineTo(11 * s, -5 * s);
    ctx.lineTo(13 * s, 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#a8a29e';
    ctx.beginPath();
    ctx.moveTo(-7 * s, -7 * s);
    ctx.lineTo(1 * s, -10 * s);
    ctx.lineTo(5 * s, -4 * s);
    ctx.closePath();
    ctx.fill();
  } else if (prop.kind === 'pine') {
    // Trunk
    ctx.fillStyle = '#5c3a21';
    ctx.fillRect(-3 * s, -12 * s, 6 * s, 14 * s);
    // Layered pine cones
    const tiers = [
      { y: -12 * s, w: 18 * s, h: 18 * s, c: '#22542b' },
      { y: -22 * s, w: 14 * s, h: 16 * s, c: '#2e6f39' },
      { y: -31 * s, w: 10 * s, h: 14 * s, c: '#3d8b49' },
    ];
    for (const t of tiers) {
      ctx.fillStyle = t.c;
      ctx.strokeStyle = '#132d17';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(sway * 0.5, t.y - t.h);
      ctx.lineTo(t.w + sway * 0.2, t.y);
      ctx.lineTo(-t.w + sway * 0.2, t.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = '#6b4226';
    ctx.fillRect(-3.5 * s, -13 * s, 7 * s, 15 * s);
    ctx.fillStyle = '#2d6a36';
    ctx.strokeStyle = '#143319';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(sway * 0.4, -22 * s, 14 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#428e4c';
    ctx.beginPath();
    ctx.arc(-4 * s + sway * 0.4, -25 * s, 9 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

const SPRITE_FIT: Record<
  BuildingType,
  { maxW: number; maxH: number; bottomInset: number; topAnchorOffset: number }
> = {
  town_hall: { maxW: 204, maxH: 204, bottomInset: 4, topAnchorOffset: 108 },
  army_camp: { maxW: 206, maxH: 185, bottomInset: 5, topAnchorOffset: 88 },
  gold_mine: { maxW: 152, maxH: 148, bottomInset: 4, topAnchorOffset: 84 },
  elixir_collector: { maxW: 144, maxH: 150, bottomInset: 4, topAnchorOffset: 86 },
  gold_storage: { maxW: 148, maxH: 140, bottomInset: 4, topAnchorOffset: 78 },
  elixir_storage: { maxW: 146, maxH: 145, bottomInset: 4, topAnchorOffset: 82 },
  barracks: { maxW: 154, maxH: 154, bottomInset: 4, topAnchorOffset: 88 },
  spell_factory: { maxW: 152, maxH: 154, bottomInset: 4, topAnchorOffset: 88 },
  clan_castle: { maxW: 174, maxH: 186, bottomInset: 4, topAnchorOffset: 98 },
  cannon: { maxW: 140, maxH: 132, bottomInset: 4, topAnchorOffset: 74 },
  archer_tower: { maxW: 120, maxH: 168, bottomInset: 3, topAnchorOffset: 108 },
  mortar: { maxW: 142, maxH: 138, bottomInset: 4, topAnchorOffset: 78 },
  air_defense: { maxW: 142, maxH: 145, bottomInset: 4, topAnchorOffset: 82 },
  wizard_tower: { maxW: 122, maxH: 170, bottomInset: 3, topAnchorOffset: 112 },
  builders_hut: { maxW: 102, maxH: 102, bottomInset: 3, topAnchorOffset: 68 },
  wall: { maxW: 44, maxH: 58, bottomInset: 2, topAnchorOffset: 44 },
  flag: { maxW: 52, maxH: 88, bottomInset: 2, topAnchorOffset: 76 },
  flower_bed: { maxW: 56, maxH: 54, bottomInset: 2, topAnchorOffset: 42 },
  statue: { maxW: 112, maxH: 128, bottomInset: 4, topAnchorOffset: 94 },
};

function drawBuildingVisual(
  ctx: CanvasRenderingContext2D,
  opts: {
    type: BuildingType;
    level: number;
    gx: number;
    gy: number;
    size: number;
    timeSec: number;
    turretAngle?: number;
    recoil?: number;
    hitFlash?: boolean;
    destroyed?: boolean;
    upgrading?: boolean;
    upgradeProgress?: number;
    selected?: boolean;
    storedResource?: number;
  }
) {
  const { type, level, gx, gy, size, timeSec } = opts;
  const center = gridToWorld(gx + size / 2, gy + size / 2);

  // Selection highlight ring
  if (opts.selected) {
    drawIsoDiamond(ctx, gx - 0.15, gy - 0.15, size + 0.3, size + 0.3);
    ctx.fillStyle = 'rgba(250, 204, 21, 0.26)';
    ctx.fill();
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  if (opts.destroyed) {
    // Scorched rubble crater
    drawIsoDiamond(ctx, gx + 0.15, gy + 0.15, size - 0.3, size - 0.3);
    ctx.fillStyle = 'rgba(41, 37, 36, 0.72)';
    ctx.fill();
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#57534e';
    for (let i = 0; i < 4; i++) {
      const rx = center.x + Math.cos(i * 1.7) * size * 7;
      const ry = center.y + Math.sin(i * 1.7) * size * 3.5;
      ctx.fillRect(rx - 4, ry - 3, 8, 5);
    }
    return;
  }

  const sprite = getBuildingSprite(type);
  const fit = SPRITE_FIT[type];

  if (sprite) {
    // Soft grounded isometric contact shadow
    ctx.fillStyle = 'rgba(18, 34, 10, 0.34)';
    ctx.beginPath();
    ctx.ellipse(
      center.x + 2,
      center.y + 4,
      size * (TILE_W * 0.42),
      size * (TILE_H * 0.42),
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    const scale = Math.min(fit.maxW / sprite.width, fit.maxH / sprite.height);
    const drawW = sprite.width * scale;
    const drawH = sprite.height * scale;
    const bottomY = center.y + (size * TILE_H) / 2 - fit.bottomInset;
    const drawX = center.x - drawW / 2;
    const drawY = bottomY - drawH;

    ctx.save();
    if (opts.hitFlash) {
      ctx.filter = 'brightness(1.85)';
    }

    if (type === 'cannon') {
      const angle = opts.turretAngle ?? Math.PI * 0.75;
      const aimX = Math.cos(angle - Math.PI / 4);
      const aimY = Math.sin(angle - Math.PI / 4);
      const recoil = opts.recoil ?? 0;
      const kickX = -aimX * recoil * 5;
      const kickY = -aimY * recoil * 3;
      const flipH = aimX > 0.15;

      ctx.translate(center.x + kickX, bottomY + kickY);
      if (flipH) ctx.scale(-1, 1);
      ctx.drawImage(sprite.canvas, -drawW / 2, -drawH, drawW, drawH);
    } else if (type === 'mortar') {
      const recoil = opts.recoil ?? 0;
      const squash = 1 - recoil * 0.06;
      ctx.translate(center.x, bottomY);
      ctx.scale(1 + recoil * 0.05, squash);
      ctx.drawImage(sprite.canvas, -drawW / 2, -drawH, drawW, drawH);
    } else {
      ctx.drawImage(sprite.canvas, drawX, drawY, drawW, drawH);
    }

    // Subtle ambient live accents on top of realistic artwork
    if (type === 'army_camp') {
      for (let i = 0; i < 3; i++) {
        const phase = (timeSec * 1.4 + i * 0.33 + gx) % 1;
        const sparkX = center.x + Math.sin(timeSec * 5 + i * 2.1) * 5;
        const sparkY = center.y - 12 - phase * 26;
        ctx.globalAlpha = (1 - phase) * 0.85;
        ctx.fillStyle = i % 2 === 0 ? '#fde047' : '#fb923c';
        ctx.beginPath();
        ctx.arc(sparkX, sparkY, 2.1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (type === 'wizard_tower' || type === 'spell_factory') {
      const pulse = 0.2 + 0.18 * Math.sin(timeSec * 3.8 + gx);
      ctx.globalAlpha = pulse;
      ctx.fillStyle = type === 'wizard_tower' ? '#e879f9' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(center.x, drawY + drawH * 0.25, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Wall level indicator crest for Lv.2+
    if (type === 'wall' && level >= 2) {
      const crestColor =
        level >= 4 ? '#38bdf8' : level === 3 ? '#c084fc' : '#f59e0b';
      ctx.fillStyle = crestColor;
      ctx.strokeStyle = '#1c130b';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(center.x, bottomY - drawH * 0.34, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  } else {
    // Fallback procedural rendering while image decodes
    // Stone foundation slab for non-walls
    if (type !== 'wall') {
      drawIsoDiamond(ctx, gx + 0.08, gy + 0.08, size - 0.16, size - 0.16);
      ctx.fillStyle = '#7c8568';
      ctx.fill();
      ctx.strokeStyle = 'rgba(28, 19, 11, 0.45)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.save();
    if (opts.hitFlash) {
      ctx.filter = 'brightness(1.9)';
    }

    const pad = type === 'wall' ? 0.08 : 0.35;
    const bx = gx + pad;
    const by = gy + pad;
    const bw = size - pad * 2;

    switch (type) {
    case 'town_hall': {
      const wallColors = ['#e5d5b7', '#cbd5e1', '#d6b888', '#b8b0a6', '#8b8378'];
      const roofColors = ['#c2410c', '#b91c1c', '#991b1b', '#7e22ce', '#b45309'];
      const roofDark = ['#7c2d12', '#7f1d1d', '#6b1414', '#581c87', '#78350f'];
      const wc = wallColors[Math.min(level - 1, 4)] ?? '#e5d5b7';
      const rc = roofColors[Math.min(level - 1, 4)] ?? '#c2410c';
      const rd = roofDark[Math.min(level - 1, 4)] ?? '#7c2d12';
      const hPx = 30 + level * 3;
      drawIsoPrism(ctx, bx, by, bw, bw, hPx, '#f0e5d0', wc, '#a69880');

      // Timber corner pilasters
      const p1 = gridToWorld(bx + bw, by);
      const p2 = gridToWorld(bx + bw, by + bw);
      const p3 = gridToWorld(bx, by + bw);
      ctx.strokeStyle = '#5c3a21';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p2.x, p2.y);
      ctx.lineTo(p2.x, p2.y - hPx);
      ctx.stroke();

      // Pitched roof pyramid with slight eave overhang
      const peakX = center.x;
      const peakY = center.y - hPx - 30 - level * 2;
      ctx.beginPath();
      ctx.moveTo(p3.x - 4, p3.y - hPx + 2);
      ctx.lineTo(p2.x, p2.y - hPx + 4);
      ctx.lineTo(peakX, peakY);
      ctx.closePath();
      ctx.fillStyle = rc;
      ctx.fill();
      ctx.strokeStyle = '#1c130b';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(p2.x, p2.y - hPx + 4);
      ctx.lineTo(p1.x + 4, p1.y - hPx + 2);
      ctx.lineTo(peakX, peakY);
      ctx.closePath();
      ctx.fillStyle = rd;
      ctx.fill();
      ctx.stroke();

      // Flagpole + waving red clan pennant
      const flagWave = Math.sin(timeSec * 4) * 3;
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(peakX, peakY);
      ctx.lineTo(peakX, peakY - 18);
      ctx.stroke();
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(peakX, peakY - 18);
      ctx.lineTo(peakX + 14, peakY - 14 + flagWave * 0.4);
      ctx.lineTo(peakX, peakY - 9);
      ctx.closePath();
      ctx.fill();

      // Arched wooden doorway + gold trim
      ctx.fillStyle = '#451a03';
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(center.x - 18, center.y - 6, 12, 16, [6, 6, 0, 0]);
      ctx.fill();
      ctx.stroke();
      break;
    }

    case 'gold_mine': {
      drawIsoPrism(ctx, bx + 0.15, by + 0.15, bw - 0.3, bw - 0.3, 18, '#b45309', '#92400e', '#6b2f0b');
      // Timber mine A-frame & spinning pulley wheel
      const spin = timeSec * 2.5;
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(center.x - 16, center.y - 12);
      ctx.lineTo(center.x, center.y - 34);
      ctx.lineTo(center.x + 16, center.y - 12);
      ctx.stroke();

      ctx.save();
      ctx.translate(center.x, center.y - 28);
      ctx.fillStyle = '#78350f';
      ctx.strokeStyle = '#1c130b';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const a = spin + (i * Math.PI) / 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * -9, Math.sin(a) * -9);
        ctx.lineTo(Math.cos(a) * 9, Math.sin(a) * 9);
        ctx.stroke();
      }
      ctx.restore();

      // Gleaming gold ore nuggets at front
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#854d0e';
      ctx.lineWidth = 1;
      for (const [ox, oy, r] of [[-12, 0, 5.5], [-4, 4, 5], [3, -2, 4.5]]) {
        ctx.beginPath();
        ctx.arc(center.x + ox, center.y + oy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      break;
    }

    case 'elixir_collector': {
      drawIsoPrism(ctx, bx + 0.15, by + 0.15, bw - 0.3, bw - 0.3, 10, '#64748b', '#475569', '#334155');
      // Brass base ring
      ctx.fillStyle = '#d97706';
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(center.x, center.y - 10, 19, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Glass dome vat with bubbling magenta elixir
      const pulse = Math.sin(timeSec * 3.5) * 2.5;
      ctx.fillStyle = 'rgba(217, 70, 239, 0.88)';
      ctx.strokeStyle = '#f5d0fe';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(center.x, center.y - 24, 16, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Specular glass highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.beginPath();
      ctx.ellipse(center.x - 6, center.y - 29, 3.5, 7, -0.3, 0, Math.PI * 2);
      ctx.fill();

      // Brass pump piston on top
      ctx.fillStyle = '#f59e0b';
      ctx.strokeStyle = '#1c130b';
      ctx.lineWidth = 1.4;
      ctx.fillRect(center.x - 7, center.y - 46 + pulse, 14, 7);
      ctx.strokeRect(center.x - 7, center.y - 46 + pulse, 14, 7);
      break;
    }

    case 'gold_storage': {
      // Heavy iron-banded wooden treasure vault
      drawIsoPrism(ctx, bx + 0.12, by + 0.12, bw - 0.24, bw - 0.24, 20, '#b45309', '#92400e', '#78350f');
      // Iron corner bands
      ctx.fillStyle = '#334155';
      ctx.fillRect(center.x - 20, center.y - 18, 40, 4);
      // Overflowing dome of gold coins
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#854d0e';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(center.x, center.y - 22, 19, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.ellipse(center.x - 3, center.y - 25, 11, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'elixir_storage': {
      drawIsoPrism(ctx, bx + 0.15, by + 0.15, bw - 0.3, bw - 0.3, 9, '#475569', '#334155', '#1e293b');
      // Large crystal flask
      ctx.fillStyle = '#c026d3';
      ctx.strokeStyle = '#fdf4ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(center.x, center.y - 24, 19, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Glass shine
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.ellipse(center.x - 7, center.y - 30, 4, 8, -0.3, 0, Math.PI * 2);
      ctx.fill();
      // Iron collar bands
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(center.x - 19, center.y - 23);
      ctx.lineTo(center.x + 19, center.y - 23);
      ctx.stroke();
      // Cork stopper
      ctx.fillStyle = '#b45309';
      ctx.fillRect(center.x - 5, center.y - 47, 10, 6);
      break;
    }

    case 'builders_hut': {
      drawIsoPrism(ctx, bx, by, bw, bw, 15, '#b45309', '#92400e', '#78350f');
      const p1 = gridToWorld(bx + bw, by);
      const p2 = gridToWorld(bx + bw, by + bw);
      const p3 = gridToWorld(bx, by + bw);
      ctx.fillStyle = '#dc2626';
      ctx.strokeStyle = '#1c130b';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(p3.x - 2, p3.y - 15);
      ctx.lineTo(p2.x, p2.y - 15 + 2);
      ctx.lineTo(center.x, center.y - 34);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#991b1b';
      ctx.beginPath();
      ctx.moveTo(p2.x, p2.y - 15 + 2);
      ctx.lineTo(p1.x + 2, p1.y - 15);
      ctx.lineTo(center.x, center.y - 34);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Little wooden door
      ctx.fillStyle = '#451a03';
      ctx.fillRect(center.x - 11, center.y - 4, 7, 10);
      break;
    }

    case 'army_camp': {
      // Dirt clearing + stone campfire ring + crossed logs + crackling flame + red clan banner
      drawIsoDiamond(ctx, bx + 0.3, by + 0.3, bw - 0.6, bw - 0.6);
      ctx.fillStyle = '#786245';
      ctx.fill();
      // Stone ring
      ctx.fillStyle = '#57534e';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(center.x + Math.cos(a) * 14, center.y + Math.sin(a) * 7, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      // Logs
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(center.x - 10, center.y + 3);
      ctx.lineTo(center.x + 10, center.y - 3);
      ctx.moveTo(center.x + 10, center.y + 3);
      ctx.lineTo(center.x - 10, center.y - 3);
      ctx.stroke();
      // Flame
      const flicker = Math.sin(timeSec * 11) * 3;
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(center.x - 10, center.y);
      ctx.lineTo(center.x, center.y - 24 + flicker);
      ctx.lineTo(center.x + 10, center.y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.moveTo(center.x - 5, center.y);
      ctx.lineTo(center.x, center.y - 14 + flicker * 0.6);
      ctx.lineTo(center.x + 5, center.y);
      ctx.closePath();
      ctx.fill();
      // War banner pole on corner
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(center.x + 28, center.y - 6);
      ctx.lineTo(center.x + 28, center.y - 38);
      ctx.stroke();
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(center.x + 28, center.y - 38);
      ctx.lineTo(center.x + 42, center.y - 33);
      ctx.lineTo(center.x + 28, center.y - 28);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'barracks': {
      drawIsoPrism(ctx, bx, by, bw, bw, 18, '#a16207', '#7c2d12', '#5c1f0c');
      // Pitched dark-slate military roof
      const p1 = gridToWorld(bx + bw, by);
      const p2 = gridToWorld(bx + bw, by + bw);
      const p3 = gridToWorld(bx, by + bw);
      ctx.fillStyle = '#b91c1c';
      ctx.strokeStyle = '#1c130b';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(p3.x - 2, p3.y - 18);
      ctx.lineTo(p2.x, p2.y - 18 + 2);
      ctx.lineTo(center.x, center.y - 40);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#7f1d1d';
      ctx.beginPath();
      ctx.moveTo(p2.x, p2.y - 18 + 2);
      ctx.lineTo(p1.x + 2, p1.y - 18);
      ctx.lineTo(center.x, center.y - 40);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Crossed swords emblem
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(center.x - 8, center.y - 29);
      ctx.lineTo(center.x + 8, center.y - 17);
      ctx.moveTo(center.x + 8, center.y - 29);
      ctx.lineTo(center.x - 8, center.y - 17);
      ctx.stroke();
      break;
    }

    case 'spell_factory': {
      drawIsoPrism(ctx, bx, by, bw, bw, 20, '#312e81', '#3730a3', '#1e1b4b');
      // Glowing arcane cauldron & chimney rim
      const glow = 0.72 + Math.sin(timeSec * 4) * 0.28;
      ctx.fillStyle = '#1e1b4b';
      ctx.strokeStyle = '#818cf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(center.x, center.y - 24, 15, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = `rgba(56, 189, 248, ${glow})`;
      ctx.beginPath();
      ctx.ellipse(center.x, center.y - 24, 11, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'clan_castle': {
      drawIsoPrism(ctx, bx, by, bw, bw, 24, '#cbd5e1', '#94a3b8', '#64748b');
      ctx.fillStyle = '#b91c1c';
      ctx.strokeStyle = '#1c130b';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(center.x - 18, center.y - 24);
      ctx.lineTo(center.x + 18, center.y - 24);
      ctx.lineTo(center.x, center.y - 46);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#2563eb';
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.4;
      ctx.fillRect(center.x - 6, center.y - 19, 12, 13);
      ctx.strokeRect(center.x - 6, center.y - 19, 12, 13);
      break;
    }

    case 'cannon': {
      // Timber carriage base
      drawIsoPrism(ctx, bx + 0.15, by + 0.15, bw - 0.3, bw - 0.3, 10, '#a16207', '#78350f', '#451a03');
      // Turntable stone ring
      ctx.fillStyle = '#475569';
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(center.x, center.y - 12, 16, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Rotating thick iron cannon barrel
      const angle = opts.turretAngle ?? Math.PI * 0.75;
      const recoil = opts.recoil ?? 0;
      const sx = Math.cos(angle - Math.PI / 4) * 1.1;
      const sy = Math.sin(angle - Math.PI / 4) * 0.6;
      const barrelLen = 24 - recoil * 6;
      ctx.save();
      ctx.translate(center.x, center.y - 18);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 13;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-sx * 4, -sy * 4);
      ctx.lineTo(sx * barrelLen, sy * barrelLen);
      ctx.stroke();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(-sx * 2, -sy * 2 - 1);
      ctx.lineTo(sx * (barrelLen - 1), sy * (barrelLen - 1) - 1);
      ctx.stroke();
      // Muzzle gold ring
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(sx * barrelLen, sy * barrelLen, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    }

    case 'archer_tower': {
      // Tall stone-and-timber lookout tower
      drawIsoPrism(ctx, bx + 0.3, by + 0.3, bw - 0.6, bw - 0.6, 38, '#b45309', '#92400e', '#78350f');
      // Elevated wooden battlement platform at top of tower (baseYOffset = 38)
      drawIsoPrism(ctx, bx + 0.12, by + 0.12, bw - 0.24, bw - 0.24, 8, '#d97706', '#b45309', '#92400e', '#1c130b', 38);
      // Archer on top
      ctx.fillStyle = '#15803d';
      ctx.strokeStyle = '#1c130b';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(center.x, center.y - 51, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ec4899';
      ctx.beginPath();
      ctx.arc(center.x, center.y - 57, 4.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'mortar': {
      drawIsoPrism(ctx, bx + 0.1, by + 0.1, bw - 0.2, bw - 0.2, 12, '#64748b', '#475569', '#334155');
      const recoil = opts.recoil ?? 0;
      ctx.save();
      ctx.translate(center.x, center.y - 18 + recoil * 4);
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.5;
      ctx.fillRect(-10, -14, 20, 14);
      ctx.strokeRect(-10, -14, 20, 14);
      ctx.beginPath();
      ctx.ellipse(0, -14, 12, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      break;
    }

    case 'air_defense': {
      drawIsoPrism(ctx, bx + 0.2, by + 0.2, bw - 0.4, bw - 0.4, 18, '#b45309', '#78350f', '#451a03');
      for (let r = -1; r <= 1; r++) {
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(center.x + r * 7 - 2.5, center.y - 34, 5, 16);
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.moveTo(center.x + r * 7 - 3.5, center.y - 34);
        ctx.lineTo(center.x + r * 7, center.y - 42);
        ctx.lineTo(center.x + r * 7 + 3.5, center.y - 34);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }

    case 'wizard_tower': {
      drawIsoPrism(ctx, bx + 0.25, by + 0.25, bw - 0.5, bw - 0.5, 44, '#64748b', '#475569', '#334155');
      const bob = Math.sin(timeSec * 3.5) * 3;
      ctx.fillStyle = '#7e22ce';
      ctx.beginPath();
      ctx.arc(center.x, center.y - 52, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d946ef';
      ctx.beginPath();
      ctx.arc(center.x, center.y - 63 + bob, 5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'wall': {
      const topC = level >= 4 ? '#38bdf8' : level >= 3 ? '#c084fc' : level >= 2 ? '#e2e8f0' : '#a8a29e';
      const leftC = level >= 4 ? '#0284c7' : level >= 3 ? '#7e22ce' : level >= 2 ? '#94a3b8' : '#78716c';
      const rightC = level >= 4 ? '#0369a1' : level >= 3 ? '#581c87' : level >= 2 ? '#64748b' : '#57534e';
      drawIsoPrism(ctx, bx, by, bw, bw, 17 + level * 2, topC, leftC, rightC);
      break;
    }

    case 'flag': {
      drawIsoPrism(ctx, bx + 0.1, by + 0.1, bw - 0.2, bw - 0.2, 8, '#cbd5e1', '#94a3b8', '#64748b');
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(center.x, center.y - 8);
      ctx.lineTo(center.x, center.y - 44);
      ctx.stroke();
      const wave = Math.sin(timeSec * 4 + gx) * 2.5;
      ctx.fillStyle = '#dc2626';
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(center.x, center.y - 44);
      ctx.lineTo(center.x + 18, center.y - 38 + wave);
      ctx.lineTo(center.x, center.y - 30);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }

    case 'flower_bed': {
      drawIsoPrism(ctx, bx, by, bw, bw, 8, '#4ade80', '#94a3b8', '#64748b');
      for (const [fx, fy, col] of [
        [-7, -6, '#ef4444'],
        [5, -8, '#facc15'],
        [0, -3, '#c084fc'],
        [-6, 0, '#fb923c'],
      ] as const) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(center.x + fx, center.y + fy, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'statue': {
      drawIsoPrism(ctx, bx + 0.1, by + 0.1, bw - 0.2, bw - 0.2, 16, '#cbd5e1', '#94a3b8', '#64748b');
      ctx.fillStyle = '#e2e8f0';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(center.x - 9, center.y - 44, 18, 28, 4);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(center.x, center.y - 50, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    }
    }

    ctx.restore();
  }

  const overlayTopY = center.y - fit.topAnchorOffset;

  // Construction scaffolding & progress bar
  if (opts.upgrading) {
    ctx.fillStyle = 'rgba(180, 83, 9, 0.35)';
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 2;
    ctx.strokeRect(center.x - 22, center.y - 34, 44, 34);

    const pct = Math.max(0, Math.min(1, opts.upgradeProgress ?? 0));
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.fillRect(center.x - 26, overlayTopY - 8, 52, 8);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(center.x - 25, overlayTopY - 7, 50 * pct, 6);
  }

  // Clickable resource bubble above mines/collectors (artistic icon, no text)
  if ((opts.storedResource ?? 0) >= 12 && !opts.upgrading) {
    const isGold = type === 'gold_mine';
    const bob = Math.sin(timeSec * 4 + gx) * 3;
    const bx = center.x;
    const byPos = overlayTopY - 8 + bob;

    ctx.save();
    // Soft shadow under bubble
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.arc(bx, byPos + 2.5, 14, 0, Math.PI * 2);
    ctx.fill();

    // Outer bubble badge
    const bgGrad = ctx.createRadialGradient(bx - 4, byPos - 5, 2, bx, byPos, 14.5);
    if (isGold) {
      bgGrad.addColorStop(0, '#fffbeb');
      bgGrad.addColorStop(1, '#fef08a');
    } else {
      bgGrad.addColorStop(0, '#fdf4ff');
      bgGrad.addColorStop(1, '#f5d0fe');
    }
    ctx.fillStyle = bgGrad;
    ctx.strokeStyle = isGold ? '#92400e' : '#701a75';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(bx, byPos, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (isGold) {
      // 3D Gold Coin artwork
      ctx.fillStyle = '#92400e';
      ctx.beginPath();
      ctx.ellipse(bx, byPos + 1.5, 8.5, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#f59e0b';
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(bx, byPos - 0.5, 8.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(bx, byPos - 0.5, 5.8, 0, Math.PI * 2);
      ctx.fill();

      // Embossed diamond crest
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.moveTo(bx, byPos - 4.3);
      ctx.lineTo(bx + 2.4, byPos - 0.5);
      ctx.lineTo(bx, byPos + 3.3);
      ctx.lineTo(bx - 2.4, byPos - 0.5);
      ctx.closePath();
      ctx.fill();

      // Specular gleam
      ctx.strokeStyle = '#fef9c3';
      ctx.lineWidth = 1.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(bx, byPos - 0.5, 5.2, Math.PI * 1.15, Math.PI * 1.6);
      ctx.stroke();
    } else {
      // Glossy Elixir Droplet artwork
      const dropGrad = ctx.createLinearGradient(bx - 5, byPos - 8, bx + 6, byPos + 9);
      dropGrad.addColorStop(0, '#f5d0fe');
      dropGrad.addColorStop(0.45, '#d946ef');
      dropGrad.addColorStop(1, '#86198f');

      ctx.fillStyle = dropGrad;
      ctx.strokeStyle = '#4a044e';
      ctx.lineWidth = 1.4;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(bx, byPos - 9);
      ctx.bezierCurveTo(bx - 5.2, byPos - 2.5, bx - 6.8, byPos + 1.5, bx - 6.8, byPos + 3.2);
      ctx.arc(bx, byPos + 3.2, 6.8, Math.PI, 0, true);
      ctx.bezierCurveTo(bx + 6.8, byPos + 1.5, bx + 5.2, byPos - 2.5, bx, byPos - 9);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Specular highlight lobe
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.beginPath();
      ctx.ellipse(bx - 2.4, byPos + 2.3, 1.5, 2.8, -0.25, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(bx - 0.8, byPos - 3.2, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Level badge on selected non-wall, non-decoration buildings
  if (
    type !== 'wall' &&
    BUILDING_CATALOG[type].category !== 'decoration' &&
    level > 0 &&
    opts.selected
  ) {
    ctx.fillStyle = '#1c130b';
    ctx.fillRect(center.x - 18, center.y + 10, 36, 17);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(center.x - 18, center.y + 10, 36, 17);
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Lv.${level}`, center.x, center.y + 18.5);
  }
}

const TROOP_SPRITE_FIT: Record<TroopType, { maxW: number; maxH: number }> = {
  barbarian: { maxW: 34, maxH: 42 },
  archer: { maxW: 34, maxH: 42 },
  goblin: { maxW: 34, maxH: 40 },
  wall_breaker: { maxW: 36, maxH: 42 },
  giant: { maxW: 52, maxH: 64 },
  balloon: { maxW: 52, maxH: 66 },
};

function drawTroopSprite(
  ctx: CanvasRenderingContext2D,
  tr: {
    type: TroopType;
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    walkPhase: number;
    hitFlashTimer?: number;
    attackAnimTimer?: number;
    rageTimer?: number;
    healTimer?: number;
    dead?: boolean;
    koTimer?: number;
    isReinforcement?: boolean;
  },
  timeSec: number
) {
  const def = TROOP_CATALOG[tr.type];
  const pos = gridToWorld(tr.x, tr.y);
  const sprite = getTroopSprite(tr.type);
  const bob = def.isAir
    ? Math.sin(timeSec * 4 + tr.walkPhase) * 4 - 36
    : Math.abs(Math.sin(tr.walkPhase)) * -4;

  ctx.save();
  if (tr.dead) {
    const t = Math.max(0, (tr.koTimer ?? 0) / 0.35);
    ctx.globalAlpha = t;
    ctx.translate(pos.x, pos.y);
    ctx.scale(1.2 - t * 0.2, t);
  } else {
    ctx.translate(pos.x, pos.y);
  }

  // Ground shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 2, def.isAir ? 14 : 10, def.isAir ? 7 : 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Clan Castle Reinforcement banner ring
  if (tr.isReinforcement && !tr.dead) {
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 2, 13, 6.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Rage / Heal aura
  if ((tr.rageTimer ?? 0) > 0) {
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, bob - 14, 18, 0, Math.PI * 2);
    ctx.stroke();
  }
  if ((tr.healTimer ?? 0) > 0) {
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, bob - 14, 15, 0, Math.PI * 2);
    ctx.stroke();
  }

  if ((tr.hitFlashTimer ?? 0) > 0) {
    ctx.filter = 'brightness(2.2)';
  }

  ctx.translate(0, bob);

  if (sprite) {
    const fit = TROOP_SPRITE_FIT[tr.type];
    const fitScale = Math.min(fit.maxW / sprite.width, fit.maxH / sprite.height);
    const attackLung = (tr.attackAnimTimer ?? 0) > 0 ? 1.14 : 1.0;
    const tilt =
      tr.type === 'balloon'
        ? Math.sin(timeSec * 2.5 + tr.walkPhase) * 0.05
        : Math.sin(tr.walkPhase) * 0.08;
    const drawW = sprite.width * fitScale * attackLung;
    const drawH = (sprite.height * fitScale) / attackLung;

    ctx.rotate(tilt);
    ctx.drawImage(sprite.canvas, -drawW / 2, -drawH, drawW, drawH);
  } else {
    const scale = tr.type === 'giant' ? 1.45 : tr.type === 'balloon' ? 1.35 : 1.0;
    const attackLung = (tr.attackAnimTimer ?? 0) > 0 ? 1.2 : 1.0;
    ctx.scale(scale * attackLung, scale / attackLung);

    if (tr.type === 'balloon') {
      // Hot air balloon canopy + basket
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-5, 2, 10, 8);
      ctx.strokeStyle = '#1c130b';
      ctx.lineWidth = 1.3;
      ctx.strokeRect(-5, 2, 10, 8);

      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(0, -14, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(-4, -17, 5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Body
      ctx.fillStyle = def.accentColor;
      ctx.strokeStyle = '#1c130b';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(-6, -12, 12, 13, 3);
      ctx.fill();
      ctx.stroke();

      // Head
      ctx.fillStyle = tr.type === 'goblin' ? '#4ade80' : tr.type === 'wall_breaker' ? '#f1f5f9' : '#fed7aa';
      ctx.beginPath();
      ctx.arc(0, -16, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Characteristic hair / hood / weapon
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.arc(0, -18, 5, Math.PI, Math.PI * 2);
      ctx.fill();

      if (tr.type === 'barbarian') {
        // Sword
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(5, -6);
        ctx.lineTo(13, -15);
        ctx.stroke();
      } else if (tr.type === 'wall_breaker') {
        // Bomb held overhead
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(6, -16, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ctx.restore();

  // HP bar above damaged alive troop
  if (!tr.dead && tr.hp < tr.maxHp) {
    const barW = 24;
    const headH = sprite ? TROOP_SPRITE_FIT[tr.type].maxH + 5 : tr.type === 'giant' ? 34 : 26;
    const barY = pos.y + bob - headH;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(pos.x - barW / 2, barY, barW, 4);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(pos.x - barW / 2 + 0.5, barY + 0.5, (barW - 1) * (tr.hp / tr.maxHp), 3);
  }
}

export function renderVillageCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  camera: CameraState,
  village: VillageState,
  nowMs: number,
  interaction: {
    selectedBuildingId: string | null;
    placingType: BuildingType | null;
    movingBuildingId: string | null;
    hoverGrid: { gx: number; gy: number } | null;
    editMode?: {
      state: EditModeState;
      draggingId: string | null;
    } | null;
  }
) {
  preloadBuildingSprites();
  preloadTroopSprites();
  const timeSec = nowMs / 1000;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#274818';
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);

  drawTerrain(ctx, timeSec);

  const editMeta = interaction.editMode ?? null;
  const isEditing = Boolean(editMeta);

  // Crisp 1x1 tactical grid overlay when Edit Mode is active
  if (isEditing) {
    ctx.beginPath();
    for (let i = 0; i <= GRID_SIZE; i++) {
      const a = gridToWorld(i, 0);
      const b = gridToWorld(i, GRID_SIZE);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);

      const c = gridToWorld(0, i);
      const d = gridToWorld(GRID_SIZE, i);
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 1;
    ctx.stroke();

    drawIsoDiamond(ctx, 0, 0, GRID_SIZE, GRID_SIZE);
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  const liveById = new Map(village.buildings.map((b) => [b.id, b]));
  const visibleBuildings = editMeta
    ? getEditPlacedBuildings(editMeta.state)
    : village.buildings;

  const activeSelectedId = editMeta
    ? editMeta.draggingId ?? editMeta.state.selectedId
    : interaction.selectedBuildingId;

  // Defense range preview for selected or dragged building
  if (activeSelectedId) {
    const sb = visibleBuildings.find((b) => b.id === activeSelectedId);
    if (sb && isDefenseBuilding(sb.type) && (!editMeta || sb.id !== editMeta.draggingId)) {
      const def = BUILDING_CATALOG[sb.type];
      const lvStats = def.levels[Math.max(0, sb.level - 1)];
      if (lvStats?.range) {
        const c = gridToWorld(sb.gx + def.size / 2, sb.gy + def.size / 2);
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
        ctx.fillStyle = 'rgba(250, 204, 21, 0.08)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(
          c.x,
          c.y,
          lvStats.range * (TILE_W / 2) * 1.4,
          lvStats.range * (TILE_H / 2) * 1.4,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  // Collect renderables sorted by depth (gx + gy)
  type DrawItem = { depth: number; draw: () => void };
  const items: DrawItem[] = [];

  for (const prop of SCENERY_PROPS) {
    items.push({
      depth: prop.gx + prop.gy,
      draw: () => drawSceneryProp(ctx, prop, timeSec),
    });
  }

  for (const b of visibleBuildings) {
    const def = BUILDING_CATALOG[b.type];
    // When dragging an already-placed building in Edit Mode, leave a soft footprint at origin
    if (editMeta?.draggingId === b.id) {
      drawIsoDiamond(ctx, b.gx, b.gy, def.size, def.size);
      ctx.fillStyle = 'rgba(250, 204, 21, 0.16)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      continue;
    }

    const live = liveById.get(b.id);
    const upgrading =
      Boolean(live && live.upgradingToLevel !== undefined && live.upgradeEndsAt !== undefined);
    let progress = 0;
    if (upgrading && live?.upgradeEndsAt && live.upgradeTotalSec) {
      const rem = (live.upgradeEndsAt - nowMs) / 1000;
      progress = 1 - rem / live.upgradeTotalSec;
    }

    items.push({
      depth: b.gx + b.gy + def.size,
      draw: () =>
        drawBuildingVisual(ctx, {
          type: b.type,
          level: Math.max(1, b.level),
          gx: b.gx,
          gy: b.gy,
          size: def.size,
          timeSec,
          selected: b.id === activeSelectedId,
          upgrading,
          upgradeProgress: progress,
          storedResource: isEditing ? undefined : live?.storedResource,
        }),
    });
  }

  // Draw stationed troops around Army Camps (hidden while editing layout for clarity)
  if (!isEditing) {
    const camp = village.buildings.find((b) => b.type === 'army_camp');
    if (camp) {
      let slot = 0;
      for (const [tKey, count] of Object.entries(village.army)) {
        const showCount = Math.min(count, 6);
        for (let i = 0; i < showCount; i++) {
          const angle = (slot * 0.9 + timeSec * 0.35) % (Math.PI * 2);
          const rad = 1.2 + (slot % 3) * 0.65;
          const tx = camp.gx + 2 + Math.cos(angle) * rad;
          const ty = camp.gy + 2 + Math.sin(angle) * rad;
          const troopType = tKey as TroopType;
          items.push({
            depth: tx + ty + 0.5,
            draw: () =>
              drawTroopSprite(
                ctx,
                {
                  type: troopType,
                  x: tx,
                  y: ty,
                  hp: 100,
                  maxHp: 100,
                  walkPhase: timeSec * 2 + slot,
                },
                timeSec
              ),
          });
          slot++;
        }
      }
    }
  }

  items.sort((a, b) => a.depth - b.depth);
  for (const it of items) it.draw();

  // Placement / move / Edit Mode drag-drop ghost preview
  let ghostType: BuildingType | null = null;
  let ghostLevel = 1;
  let ignoreId: string | undefined;

  if (editMeta) {
    if (editMeta.draggingId) {
      const dragged = editMeta.state.entries.find((e) => e.id === editMeta.draggingId);
      if (dragged) {
        ghostType = dragged.type;
        ghostLevel = Math.max(1, dragged.level);
        ignoreId = dragged.id;
      }
    } else if (editMeta.state.activeTrayType) {
      ghostType = editMeta.state.activeTrayType;
      const stashed = editMeta.state.entries.find(
        (e) => !e.placed && e.type === editMeta.state.activeTrayType
      );
      ghostLevel = Math.max(1, stashed?.level ?? 1);
    } else if (editMeta.state.selectedId) {
      const sel = editMeta.state.entries.find(
        (e) => e.placed && e.id === editMeta.state.selectedId
      );
      if (sel) {
        ghostType = sel.type;
        ghostLevel = Math.max(1, sel.level);
        ignoreId = sel.id;
      }
    }
  } else {
    ghostType =
      interaction.placingType ??
      (interaction.movingBuildingId
        ? village.buildings.find((b) => b.id === interaction.movingBuildingId)?.type ?? null
        : null);
    ignoreId = interaction.movingBuildingId ?? undefined;
  }

  if (ghostType && interaction.hoverGrid) {
    const size = BUILDING_CATALOG[ghostType].size;
    const gx = Math.floor(interaction.hoverGrid.gx - size / 2 + 0.5);
    const gy = Math.floor(interaction.hoverGrid.gy - size / 2 + 0.5);
    const valid = canPlaceBuilding(gx, gy, size, visibleBuildings, ignoreId);

    drawIsoDiamond(ctx, gx, gy, size, size);
    ctx.fillStyle = valid ? 'rgba(34, 197, 94, 0.38)' : 'rgba(239, 68, 68, 0.42)';
    ctx.fill();
    ctx.strokeStyle = valid ? '#4ade80' : '#f87171';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Draw defense range preview at hovered ghost position
    if (isEditing && isDefenseBuilding(ghostType)) {
      const lvStats = BUILDING_CATALOG[ghostType].levels[Math.max(0, ghostLevel - 1)];
      if (lvStats?.range) {
        const c = gridToWorld(gx + size / 2, gy + size / 2);
        ctx.strokeStyle = valid
          ? 'rgba(74, 222, 128, 0.5)'
          : 'rgba(248, 113, 113, 0.45)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.ellipse(
          c.x,
          c.y,
          lvStats.range * (TILE_W / 2) * 1.4,
          lvStats.range * (TILE_H / 2) * 1.4,
          0,
          0,
          Math.PI * 2
        );
        ctx.stroke();
      }
    }

    // Floating semi-transparent building preview during Edit Mode drag/hover
    if (isEditing) {
      ctx.save();
      ctx.globalAlpha = valid ? 0.85 : 0.55;
      ctx.translate(0, -6);
      drawBuildingVisual(ctx, {
        type: ghostType,
        level: ghostLevel,
        gx,
        gy,
        size,
        timeSec,
        selected: false,
      });
      ctx.restore();
    }
  }

  ctx.restore();
}

export function renderBattleCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  camera: CameraState,
  battle: BattleState,
  pools: VFXPools,
  nowMs: number,
  hoverGrid: { gx: number; gy: number } | null,
  options?: { hideDamageTexts?: boolean }
) {
  preloadBuildingSprites();
  preloadTroopSprites();
  const timeSec = nowMs / 1000;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#274818';
  ctx.fillRect(0, 0, width, height);

  // Camera shake from trauma^2
  const shakeMag = battle.cameraTrauma * battle.cameraTrauma * 12;
  const shakeX = shakeMag > 0.2 ? (Math.random() - 0.5) * shakeMag : 0;
  const shakeY = shakeMag > 0.2 ? (Math.random() - 0.5) * shakeMag : 0;

  ctx.save();
  ctx.translate(width / 2 + shakeX, height / 2 + shakeY);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);

  drawTerrain(ctx, timeSec);

  // Red deployment boundary around intact buildings when a troop/reinforcement is selected
  if (
    (battle.selectedCard?.kind === 'troop' ||
      battle.selectedCard?.kind === 'reinforcement') &&
    battle.phase !== 'ended'
  ) {
    ctx.fillStyle = 'rgba(239, 68, 68, 0.14)';
    ctx.strokeStyle = 'rgba(248, 113, 113, 0.45)';
    ctx.lineWidth = 1.5;
    for (const b of battle.buildings) {
      if (b.destroyed) continue;
      drawIsoDiamond(ctx, b.gx - 0.85, b.gy - 0.85, b.size + 1.7, b.size + 1.7);
      ctx.fill();
      ctx.stroke();
    }
  }

  // Active spell rings on ground
  for (const sp of battle.spells) {
    const sDef = SPELL_CATALOG[sp.type];
    const c = gridToWorld(sp.x, sp.y);
    const pulse = 0.85 + Math.sin(sp.pulsePhase) * 0.12;
    const rx = sp.radius * (TILE_W / 2) * 1.42 * pulse;
    const ry = sp.radius * (TILE_H / 2) * 1.42 * pulse;

    ctx.fillStyle = sp.type === 'heal' ? 'rgba(250, 204, 21, 0.22)' : 'rgba(168, 85, 247, 0.24)';
    ctx.strokeStyle = sDef.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Mortar landing telegraph ring
  for (const pr of battle.projectiles) {
    if (pr.kind === 'mortar') {
      const tc = gridToWorld(pr.targetX, pr.targetY);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.65)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(tc.x, tc.y, pr.splashRadius * 34, pr.splashRadius * 17, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Depth-sorted ground entities
  type DrawItem = { depth: number; draw: () => void };
  const groundItems: DrawItem[] = [];
  const airItems: DrawItem[] = [];

  for (const prop of SCENERY_PROPS) {
    groundItems.push({
      depth: prop.gx + prop.gy,
      draw: () => drawSceneryProp(ctx, prop, timeSec),
    });
  }

  for (const b of battle.buildings) {
    groundItems.push({
      depth: b.gx + b.gy + b.size,
      draw: () => {
        drawBuildingVisual(ctx, {
          type: b.type,
          level: b.level,
          gx: b.gx,
          gy: b.gy,
          size: b.size,
          timeSec,
          turretAngle: b.turretAngle,
          recoil: b.fireRecoilTimer > 0 ? b.fireRecoilTimer / 0.16 : 0,
          hitFlash: b.hitFlashTimer > 0,
          destroyed: b.destroyed,
        });

        // Damaged building HP bar
        if (!b.destroyed && b.hp < b.maxHp) {
          const c = gridToWorld(b.gx + b.size / 2, b.gy + b.size / 2);
          const barW = b.type === 'wall' ? 20 : 42;
          const barY = c.y - SPRITE_FIT[b.type].topAnchorOffset + 6;
          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.fillRect(c.x - barW / 2, barY, barW, 5);
          ctx.fillStyle = b.hp / b.maxHp > 0.4 ? '#22c55e' : '#ef4444';
          ctx.fillRect(c.x - barW / 2 + 0.5, barY + 0.5, (barW - 1) * (b.hp / b.maxHp), 4);
        }
      },
    });
  }

  for (const tr of battle.troops) {
    if (tr.dead && tr.koTimer <= 0) continue;
    const item: DrawItem = {
      depth: tr.x + tr.y + 0.3,
      draw: () => drawTroopSprite(ctx, tr, timeSec),
    };
    if (tr.isAir) airItems.push(item);
    else groundItems.push(item);
  }

  groundItems.sort((a, b) => a.depth - b.depth);
  for (const it of groundItems) it.draw();

  airItems.sort((a, b) => a.depth - b.depth);
  for (const it of airItems) it.draw();

  // Projectiles
  for (const pr of battle.projectiles) {
    const pos = gridToWorld(pr.x, pr.y);
    const arcZ = Math.sin(Math.min(1, pr.progress) * Math.PI) * pr.arcHeight * 24;

    // Shadow on ground
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(pos.x, pos.y, 5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (pr.kind === 'cannonball' || pr.kind === 'mortar') {
      ctx.fillStyle = pr.kind === 'mortar' ? '#f97316' : '#1e293b';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y - arcZ - 8, pr.kind === 'mortar' ? 6.5 : 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (pr.kind === 'fireball') {
      ctx.fillStyle = '#d946ef';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y - arcZ - 14, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (pr.kind === 'rocket') {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y - arcZ - 12, 5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Arrow
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pos.x - 4, pos.y - arcZ - 10);
      ctx.lineTo(pos.x + 4, pos.y - arcZ - 12);
      ctx.stroke();
    }
  }

  // Pooled particles
  for (const p of pools.particles) {
    if (!p.active) continue;
    const pos = gridToWorld(p.x, p.y);
    const alpha = Math.max(0, 1 - p.life / p.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y - p.z * 14, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Hover deploy cursor
  if (hoverGrid && battle.selectedCard && battle.phase !== 'ended') {
    const pos = gridToWorld(hoverGrid.gx, hoverGrid.gy);
    ctx.strokeStyle = battle.selectedCard.kind === 'spell' ? '#c084fc' : '#4ade80';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(pos.x, pos.y, 14, 7, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();

  // Screen-space floating damage numbers & loot texts
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const t of pools.texts) {
    if (!t.active) continue;
    if (
      options?.hideDamageTexts &&
      (t.kind === 'damage_building' || t.kind === 'damage_troop')
    ) {
      continue;
    }
    const wp = gridToWorld(t.x, t.y);
    const sp = worldToScreen(
      wp.x + t.jitterX,
      wp.y - t.anchorPx - t.risePx,
      width,
      height,
      camera
    );
    const progress = t.maxLife > 0 ? t.life / t.maxLife : 1;
    const alpha = progress < 0.65 ? 1 : Math.max(0, (1 - progress) / 0.35);
    const popScale =
      progress < 0.16 ? 1 + (1 - progress / 0.16) * 0.28 : 1;
    const finalScale = t.scale * popScale * Math.max(0.85, Math.min(1.2, camera.zoom));

    ctx.save();
    ctx.translate(sp.x, sp.y);
    ctx.scale(finalScale, finalScale);
    ctx.globalAlpha = alpha;
    ctx.font =
      t.kind === 'loot'
        ? '800 14px "Plus Jakarta Sans", sans-serif'
        : '900 17px "Plus Jakarta Sans", sans-serif';
    ctx.lineJoin = 'round';
    if (t.kind === 'damage_building' || t.kind === 'damage_troop') {
      ctx.shadowColor = 'rgba(250, 204, 21, 0.55)';
      ctx.shadowBlur = 8;
    }
    ctx.strokeStyle = '#140c06';
    ctx.lineWidth = t.kind === 'loot' ? 3.5 : 4.5;
    ctx.strokeText(t.text, 0, 0);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, 0, 0);
    ctx.restore();
  }
  ctx.restore();
}
