import type { FleetEnvelope, Point, SideLimitSample, TrajectoryPoint } from '../simulation/types.js';
import type { Scene } from './Scene.js';

function binarySearch(points: TrajectoryPoint[], timeSec: number): TrajectoryPoint {
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].timeSeconds < timeSec) lo = mid + 1;
    else hi = mid;
  }
  return points[Math.min(lo, points.length - 1)];
}

function nearestLimit(samples: SideLimitSample[], timeSec: number): SideLimitSample | null {
  if (!samples.length) return null;
  let best = samples[0];
  let bestDiff = Math.abs(best.timeSeconds - timeSec);
  for (const s of samples) {
    const d = Math.abs(s.timeSeconds - timeSec);
    if (d < bestDiff) {
      best = s;
      bestDiff = d;
    }
  }
  return best;
}

function toRgba(colorInt: number, alpha: number): string {
  const r = (colorInt >> 16) & 0xff;
  const g = (colorInt >> 8) & 0xff;
  const b = colorInt & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}

export class EnvelopeLayer {
  private readonly colorInt: number;

  constructor(hexColorInt: number) {
    this.colorInt = hexColorInt;
  }

  /** Pre-compute any drawing caches once per simulation. No drawing. */
  renderHistory(_envelope: FleetEnvelope, _scene: Scene): void {}

  /** Draw the current fleet envelope and position marker onto the scene canvas. */
  draw(scene: Scene, envelope: FleetEnvelope, timeSec: number): void {
    const { ctx } = scene;
    const toS = (p: Point) => scene.simToScreen(p);
    const ci = this.colorInt;

    const [first, bulk, last] = envelope.tracks;
    const firstPt = binarySearch(first.points, timeSec);
    const bulkPt = binarySearch(bulk.points, timeSec);
    const lastPt = binarySearch(last.points, timeSec);
    const firstS = toS(firstPt.position);
    const bulkS = toS(bulkPt.position);
    const lastS = toS(lastPt.position);

    const sideSamples = envelope.sideLimitsPerLeg[bulkPt.legIndex] ?? [];
    const lim = nearestLimit(sideSamples, timeSec);
    const halfSpread = lim
      ? Math.abs((lim.rightX - lim.leftX) * scene.transform.scale) / 2
      : 20;

    if (bulkPt.legIndex === 0 || bulkPt.legIndex % 3 === 2) {
      const lineWidth = Math.max(8, halfSpread * 0.75);
      ctx.beginPath();
      ctx.moveTo(firstS.x, firstS.y);
      ctx.lineTo(lastS.x, lastS.y);
      ctx.strokeStyle = toRgba(ci, 0.42);
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.stroke();
    } else {
      const points = buildEnvelopePolygon(firstS, bulkS, lastS, bulkPt.legProgress, halfSpread);
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      ctx.closePath();
      ctx.fillStyle = toRgba(ci, 0.24);
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(bulkS.x, bulkS.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = toRgba(ci, 0.92);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // No-op: no PixiJS objects to release.
  destroy(): void {}
}

function buildEnvelopePolygon(
  first: Point,
  bulk: Point,
  last: Point,
  progress: number,
  halfSpread: number,
): Point[] {
  const startW = Math.max(4, halfSpread * Math.min(1, progress * 2));
  const midW = Math.max(4, halfSpread);
  const endW = Math.max(4, halfSpread * Math.min(1, (1 - progress) * 2));

  const firstLeft = offsetPoint(first, bulk, startW, -1);
  const firstRight = offsetPoint(first, bulk, startW, 1);
  const bulkLeft = offsetPoint(bulk, last, midW, -1);
  const bulkRight = offsetPoint(bulk, last, midW, 1);
  const lastLeft = offsetPoint(last, bulk, endW, -1);
  const lastRight = offsetPoint(last, bulk, endW, 1);

  if (progress < 0.5) {
    return [firstLeft, bulkLeft, bulkRight, firstRight];
  }
  if (progress > 0.5) {
    return [bulkLeft, lastLeft, lastRight, bulkRight];
  }

  return [firstLeft, bulkLeft, lastLeft, lastRight, bulkRight, firstRight];
}

function offsetPoint(origin: Point, toward: Point, width: number, side: -1 | 1): Point {
  const dx = toward.x - origin.x;
  const dy = toward.y - origin.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * width * side;
  const ny = (dx / len) * width * side;
  return { x: origin.x + nx, y: origin.y + ny };
}
