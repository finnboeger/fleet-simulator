import type { FleetEnvelope, Point } from '../simulation/types.js';
import type { Scene } from './Scene.js';

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

  renderHistory(_envelope: FleetEnvelope, _scene: Scene): void {}


  draw(scene: Scene, _envelope: FleetEnvelope, _timeSec: number): void {
    const geometry = scene.geometry;
    if (!geometry) return;

  const { ctx } = scene;
  const s = (p: Point) => scene.simToScreen(p);
  const ci = this.colorInt;

  const startLineLeft = { x: -150, y: geometry.startLine.y };
  const startLineRight = { x: 150, y: geometry.startLine.y };
  const gateLeft = { x: -80, y: geometry.leewardGate.y };

  const gateRight = { x: 80, y: geometry.leewardGate.y };
  const windward = geometry.windwardMark;
  const offset = geometry.offsetMark;

    // Upwind from start line to windward mark.
    drawOutline(
      ctx,

  s(startLineLeft),
  s(startLineRight),
  s(windward),

      45,
      toRgba(ci, 0.85),
    );

    // Downwind from offset mark to leeward gate.
    drawOutline(
      ctx,

  s({ x: offset.x - 120, y: offset.y }),
  s({ x: offset.x + 120, y: offset.y }),
  s(gateLeft),

      170,
      toRgba(ci, 0.60),
    );

    // Second upwind from leeward gate to windward mark.
    drawOutline(
      ctx,

  s(gateLeft),
  s(gateRight),
  s(windward),

      45,
      toRgba(ci, 0.85),
    );

    // Final downwind from offset mark to start line.
    drawOutline(
      ctx,

  s({ x: offset.x - 120, y: offset.y }),
  s({ x: offset.x + 120, y: offset.y }),
  s(startLineLeft),

      170,
      toRgba(ci, 0.60),
    );

  }

  destroy(): void {}
}


function drawOutline(
  ctx: CanvasRenderingContext2D,
  lowerLeft: Point,

  lowerRight: Point,
  upper: Point,
  angleDeg: number,

  strokeStyle: string,
): void {
  const angleRad = (angleDeg * Math.PI) / 180;

  const travel = Math.tan(angleRad);
  const xOffset = Math.max(10, Math.abs(upper.y - lowerLeft.y) * travel * 0.07);

  const lowerInnerLeft = lerp(lowerLeft, upper, 0.28);
  const lowerInnerRight = lerp(lowerRight, upper, 0.28);
  const upperInnerLeft = lerp(lowerLeft, upper, 0.72);

  const upperInnerRight = lerp(lowerRight, upper, 0.72);
  const points = [
    lowerLeft,

  { x: lowerInnerLeft.x - xOffset, y: lowerInnerLeft.y },
  { x: upper.x - xOffset, y: upper.y },
  { x: upper.x + xOffset, y: upper.y },

    { x: lowerInnerRight.x + xOffset, y: lowerInnerRight.y },
    lowerRight,
  ];

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);

  ctx.closePath();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = 2;

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}
import type { FleetEnvelope, Point } from '../simulation/types.js';
import type { Scene } from './Scene.js';

function toRgba(colorInt: number, alpha: number): string {
  const r = (colorInt >> 16) & 0xff;
  const g = (colorInt >> 8) & 0xff;
  const b = colorInt & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}

type Vec = { x: number; y: number };

export class EnvelopeLayer {
  private readonly colorInt: number;

  constructor(hexColorInt: number) {
    this.colorInt = hexColorInt;
  }

  renderHistory(_envelope: FleetEnvelope, _scene: Scene): void {}

  draw(scene: Scene, envelope: FleetEnvelope, timeSec: number): void {
    const geometry = scene.geometry;
    if (!geometry) return;

    const leg = currentLegIndex(envelope, timeSec, geometry);
    const outline = buildOutlineForLeg(scene, geometry, leg);
    if (outline.length < 2) return;

    const { ctx } = scene;
    ctx.beginPath();
    ctx.moveTo(outline[0].x, outline[0].y);
    for (let i = 1; i < outline.length; i++) ctx.lineTo(outline[i].x, outline[i].y);
    ctx.closePath();
    ctx.strokeStyle = toRgba(this.colorInt, 0.85);
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  destroy(): void {}
}

function currentLegIndex(envelope: FleetEnvelope, timeSec: number, geometry: NonNullable<Scene['geometry']>): number {
  const firstTrack = envelope.tracks[0];
  let lo = 0;
  let hi = firstTrack.points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (firstTrack.points[mid].timeSeconds < timeSec) lo = mid + 1;
    else hi = mid;
  }
  return geometry.legs[firstTrack.points[Math.min(lo, firstTrack.points.length - 1)]?.legIndex ?? 0]?.index ?? 0;
}

function buildOutlineForLeg(
  scene: Scene,
  geometry: NonNullable<Scene['geometry']>,
  legIndex: number,
): Point[] {
  const leg = geometry.legs[legIndex] ?? geometry.legs[0];
  const toS = (p: Point) => scene.simToScreen(p);

  if (leg.type === 'upwind') {
    const isFirstUpwind = legIndex === 1;
    const start = isFirstUpwind ? geometry.startLine : geometry.leewardGate;
    return hexagonBetween(
      toS({ x: start.x - 150, y: start.y }),
      toS({ x: start.x + 150, y: start.y }),
      toS({ x: geometry.windwardMark.x - 90, y: geometry.windwardMark.y }),
      toS({ x: geometry.windwardMark.x + 90, y: geometry.windwardMark.y }),
      45,
    );
  }

  if (leg.type === 'downwind' || leg.type === 'finish') {
    const end = leg.type === 'finish' ? geometry.startLine : geometry.leewardGate;
    return hexagonBetween(
      toS({ x: geometry.offsetMark.x - 90, y: geometry.offsetMark.y }),
      toS({ x: geometry.offsetMark.x + 90, y: geometry.offsetMark.y }),
      toS({ x: end.x - 80, y: end.y }),
      toS({ x: end.x + 80, y: end.y }),
      170,
    );
  }

  if (leg.type === 'offset') {
    return hexagonBetween(
      toS({ x: geometry.windwardMark.x - 90, y: geometry.windwardMark.y }),
      toS({ x: geometry.windwardMark.x + 90, y: geometry.windwardMark.y }),
      toS({ x: geometry.offsetMark.x - 90, y: geometry.offsetMark.y }),
      toS({ x: geometry.offsetMark.x + 90, y: geometry.offsetMark.y }),
      170,
    );
  }

  return hexagonBetween(
    toS({ x: geometry.startLine.x - 150, y: geometry.startLine.y }),
    toS({ x: geometry.startLine.x + 150, y: geometry.startLine.y }),
    toS({ x: geometry.leewardGate.x - 80, y: geometry.leewardGate.y }),
    toS({ x: geometry.leewardGate.x + 80, y: geometry.leewardGate.y }),
    170,
  );
}

function hexagonBetween(startLeft: Point, startRight: Point, endLeft: Point, endRight: Point, angleDeg: number): Point[] {
  const startUpLeft = rayIntersection(startLeft, rayDir(angleDeg, 'up-left'), endLeft, rayDir(angleDeg, 'down-left'));
  const startUpRight = rayIntersection(startRight, rayDir(angleDeg, 'up-right'), endRight, rayDir(angleDeg, 'down-right'));
  return [startLeft, startUpLeft, endLeft, endRight, startUpRight, startRight];
}

function rayDir(angleDeg: number, kind: 'up-left' | 'up-right' | 'down-left' | 'down-right'): Vec {
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  switch (kind) {
    case 'up-left':
      return { x: -dx, y: -dy };
    case 'up-right':
      return { x: dx, y: -dy };
    case 'down-left':
      return { x: -dx, y: dy };
    case 'down-right':
      return { x: dx, y: dy };
  }
}

function rayIntersection(p1: Point, d1: Vec, p2: Point, d2: Vec): Point {
  const det = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(det) < 1e-6) return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const t = (dx * d2.y - dy * d2.x) / det;
  return { x: p1.x + d1.x * t, y: p1.y + d1.y * t };
}
