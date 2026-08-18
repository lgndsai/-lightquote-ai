import type { RooflinePoint, RooflineStroke } from '@/lib/types/db';

/**
 * Roofline rendering.
 *
 * Strokes are stored in normalized 0..1 space relative to the photo's own
 * box, so a path traced on an iPhone lands in exactly the same place on an
 * iPad, on the marked export, and in the n8n payload.
 */

export const LIGHT_PALETTES: Record<string, string[]> = {
  warm_white: ['#FFC98B'],
  soft_white: ['#FFF6E6'],
  holiday: ['#E23B3B', '#3FBF6F', '#FFFFFF'],
  team_colors: ['#2563EB', '#F59E0B'],
  security: ['#FFFFFF'],
  christmas: ['#D62828', '#2E9E5B', '#FFFFFF'],
  fourth_of_july: ['#2563EB', '#FFFFFF', '#D62828'],
  game_day: ['#F59E0B', '#111827'],
};

/** Bulb pitch as a fraction of the photo's width. */
const BULB_PITCH = 0.016;

export function paletteFor(style: string) {
  return LIGHT_PALETTES[style] ?? LIGHT_PALETTES.warm_white;
}

export function distance(a: RooflinePoint, b: RooflinePoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Walks a stroke and returns evenly spaced points along it. */
function bulbPositions(points: RooflinePoint[], pitch: number): RooflinePoint[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [points[0]];

  const out: RooflinePoint[] = [points[0]];
  let carried = 0;

  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const segment = distance(a, b);
    if (segment === 0) continue;

    let travelled = pitch - carried;
    while (travelled <= segment) {
      const t = travelled / segment;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      travelled += pitch;
    }
    carried = (carried + segment) % pitch;
  }

  return out;
}

export interface DrawOptions {
  /** Multiplies bulb size — the export uses a larger factor than the screen. */
  scale?: number;
  showGuide?: boolean;
}

/**
 * Draws the traced lighting run: a faint guide line plus glowing bulbs
 * cycling through the style palette.
 */
export function drawStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: RooflineStroke[],
  width: number,
  height: number,
  style: string,
  { scale = 1, showGuide = true }: DrawOptions = {},
) {
  const palette = paletteFor(style);
  const px = (n: number) => n * width;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue;

    const toCanvas = (p: RooflinePoint) => [p.x * width, p.y * height] as const;

    if (showGuide && stroke.points.length > 1) {
      ctx.beginPath();
      const [sx, sy] = toCanvas(stroke.points[0]);
      ctx.moveTo(sx, sy);
      for (const point of stroke.points.slice(1)) {
        const [x, y] = toCanvas(point);
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = Math.max(1, px(stroke.width * 0.35) * scale);
      ctx.stroke();
    }

    const bulbs = bulbPositions(stroke.points, BULB_PITCH);
    const radius = Math.max(1.2, px(stroke.width * 0.5) * scale);

    bulbs.forEach((point, index) => {
      const color = palette[index % palette.length];
      const [x, y] = toCanvas(point);

      const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 3.2);
      glow.addColorStop(0, hexToRgba(color, 0.85));
      glow.addColorStop(0.45, hexToRgba(color, 0.28));
      glow.addColorStop(1, hexToRgba(color, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, radius * 3.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  ctx.restore();
}

function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const int = Number.parseInt(full, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Removes every point within `radius` of the eraser and splits what remains
 * into separate strokes, so erasing the middle of a run leaves both ends.
 */
export function eraseAt(
  strokes: RooflineStroke[],
  point: RooflinePoint,
  radius: number,
): RooflineStroke[] {
  const result: RooflineStroke[] = [];

  for (const stroke of strokes) {
    let current: RooflinePoint[] = [];

    for (const p of stroke.points) {
      if (distance(p, point) <= radius) {
        if (current.length > 1) result.push({ points: current, width: stroke.width });
        current = [];
      } else {
        current.push(p);
      }
    }

    if (current.length > 1) result.push({ points: current, width: stroke.width });
  }

  return result;
}

/** Total traced length in normalized units — a rough footage sanity check. */
export function totalStrokeLength(strokes: RooflineStroke[]) {
  return strokes.reduce((sum, stroke) => {
    let length = 0;
    for (let i = 1; i < stroke.points.length; i += 1) {
      length += distance(stroke.points[i - 1], stroke.points[i]);
    }
    return sum + length;
  }, 0);
}
