import { Container, Graphics } from 'pixi.js';
import type { FleetEnvelope, SideLimitSample, TrajectoryPoint } from '../simulation/types.js';
import type { Scene } from './Scene.js';

// Show one history point per this many seconds (keeps draw calls manageable)
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

export class EnvelopeLayer extends Container {
  private readonly hexColor: number;
  private histG = new Graphics();
  private markG = new Graphics();

  constructor(hexColor: number) {
    super();
    this.hexColor = hexColor;
    this.addChild(this.histG);
    this.addChild(this.markG);
  }

  /** Call once per simulation change – renders downsampled track trails. */
  renderHistory(envelope: FleetEnvelope, scene: Scene): void {
    this.histG.clear();
    const [first, bulk, last] = envelope.tracks;
    const toS = (p: { x: number; y: number }) => scene.simToScreen(p);

    this.polyline(first.points, toS, 0.35, 1.5);
    this.polyline(bulk.points, toS, 0.65, 2.5);
    this.polyline(last.points, toS, 0.35, 1.5);
  }

  /** Call each frame – renders the current-time position marker. */
  renderAtTime(envelope: FleetEnvelope, timeSec: number, scene: Scene): void {
    this.markG.clear();
    const [first, bulk, last] = envelope.tracks;
    if (!first.points.length) return;

    const toS = (p: { x: number; y: number }) => scene.simToScreen(p);

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

    // Outer envelope (first → side limits → last)
    this.markG.poly([
      firstS.x, firstS.y,
      bulkS.x + halfSpread, bulkS.y,
      lastS.x, lastS.y,
      bulkS.x - halfSpread, bulkS.y,
    ]).fill({ color: this.hexColor, alpha: 0.18 });

    // Inner denser region (100 % saturation at bulk, 50 % at first/last per plan)
    this.markG.poly([
      firstS.x - endW, firstS.y,
      firstS.x + endW, firstS.y,
      bulkS.x + halfSpread * 0.5, bulkS.y,
      lastS.x + endW, lastS.y,
      lastS.x - endW, lastS.y,
      bulkS.x - halfSpread * 0.5, bulkS.y,
    ]).fill({ color: this.hexColor, alpha: 0.30 });

    // Bulk dot
    this.markG.circle(bulkS.x, bulkS.y, 7).fill({ color: this.hexColor, alpha: 0.92 });
    this.markG.circle(bulkS.x, bulkS.y, 7).stroke({ color: 0xffffff, width: 1.5 });
  }

  private polyline(
    points: TrajectoryPoint[],
    toS: (p: { x: number; y: number }) => { x: number; y: number },
    alpha: number,
    width: number,
  ): void {
    // Skip pre-race standing still at start line
    let startIdx = 0;
    for (let i = 0; i < points.length; i++) {
      if (points[i].legIndex > 0 || points[i].legProgress > 0) { startIdx = i; break; }
    }

    // Collect downsampled points
    const pts: { x: number; y: number }[] = [];
    for (let i = startIdx; i < points.length; i += HISTORY_STEP_SEC) {
      pts.push(toS(points[i].position));
    }
    // Always include last point so the line reaches the finish
    const last = points[points.length - 1];
    if (last) pts.push(toS(last.position));

    if (pts.length < 2) return;

    this.histG.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) this.histG.lineTo(pts[i].x, pts[i].y);
    this.histG.stroke({ color: this.hexColor, width, alpha });
  }
}
