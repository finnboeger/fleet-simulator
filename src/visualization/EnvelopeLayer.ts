import type { FleetEnvelope, Point, SideLimitSample, TrajectoryPoint } from '../simulation/types.js';
import type { Scene } from './Scene.js';

const HISTORY_STEP_SEC = 30;

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
    if (d < bestDiff) { best = s; bestDiff = d; }
  }
  return best;
}

function toRgba(colorInt: number, alpha: number): string {
  const r = (colorInt >> 16) & 0xff;
  const g = (colorInt >> 8) & 0xff;
  const b = colorInt & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}

function downsample(points: TrajectoryPoint[]): Point[] {
  let startIdx = 0;
  for (let i = 0; i < points.length; i++) {
    if (points[i].legIndex > 0 || points[i].legProgress > 0) { startIdx = i; break; }
  }
  const pts: Point[] = [];
  for (let i = startIdx; i < points.length; i += HISTORY_STEP_SEC) {
    pts.push(points[i].position);
  }
  if (points.length > 0) pts.push(points[points.length - 1].position);
  return pts;
}

export class EnvelopeLayer {
  private readonly colorInt: number;
  private history: { first: Point[]; bulk: Point[]; last: Point[] } =
    { first: [], bulk: [], last: [] };

  constructor(hexColorInt: number) {
    this.colorInt = hexColorInt;
  }

  /** Pre-compute downsampled track points once per simulation. No drawing. */
  renderHistory(envelope: FleetEnvelope, _scene: Scene): void {
    const [first, bulk, last] = envelope.tracks;
    this.history = {
      first: downsample(first.points),
      bulk: downsample(bulk.points),
      last: downsample(last.points),
    };
  }

  /** Draw history trails and the current-time position marker onto the scene canvas. */
  draw(scene: Scene, envelope: FleetEnvelope, timeSec: number): void {
    const { ctx } = scene;
    const toS = (p: Point) => scene.simToScreen(p);
    const ci = this.colorInt;

    // History trails (first/last faint, bulk prominent)
    this.polyline(ctx, this.history.first.map(toS), toRgba(ci, 0.38), 1.5);
    this.polyline(ctx, this.history.bulk.map(toS), toRgba(ci, 0.68), 2.5);
    this.polyline(ctx, this.history.last.map(toS), toRgba(ci, 0.38), 1.5);

    // Current-time position marker
    const [first, bulk, last] = envelope.tracks;
    const firstS = toS(binarySearch(first.points, timeSec).position);
    const bulkPt = binarySearch(bulk.points, timeSec);
    const bulkS = toS(bulkPt.position);
    const lastS = toS(binarySearch(last.points, timeSec).position);

    const sideSamples = envelope.sideLimitsPerLeg[bulkPt.legIndex] ?? [];
    const lim = nearestLimit(sideSamples, timeSec);
    const halfSpread = lim
      ? Math.abs((lim.rightX - lim.leftX) * scene.transform.scale) / 2
      : 20;
    const endW = Math.max(6, halfSpread * 0.22);

    // Outer diamond – 18% alpha (first / last limits at 50% saturation per plan)
    ctx.beginPath();
    ctx.moveTo(firstS.x, firstS.y);
    ctx.lineTo(bulkS.x + halfSpread, bulkS.y);
    ctx.lineTo(lastS.x, lastS.y);
    ctx.lineTo(bulkS.x - halfSpread, bulkS.y);
    ctx.closePath();
    ctx.fillStyle = toRgba(ci, 0.18);
    ctx.fill();

    // Inner diamond – 30% alpha (bulk at higher saturation per plan)
    ctx.beginPath();
    ctx.moveTo(firstS.x - endW, firstS.y);
    ctx.lineTo(firstS.x + endW, firstS.y);
    ctx.lineTo(bulkS.x + halfSpread * 0.5, bulkS.y);
    ctx.lineTo(lastS.x + endW, lastS.y);
    ctx.lineTo(lastS.x - endW, lastS.y);
    ctx.lineTo(bulkS.x - halfSpread * 0.5, bulkS.y);
    ctx.closePath();
    ctx.fillStyle = toRgba(ci, 0.30);
    ctx.fill();

    // Bulk dot
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

  private polyline(
    ctx: CanvasRenderingContext2D,
    pts: { x: number; y: number }[],
    color: string,
    width: number,
  ): void {
    if (pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}
