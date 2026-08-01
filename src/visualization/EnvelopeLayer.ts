import type { FleetEnvelope, Point } from '../simulation/types.js';
import type { Scene } from './Scene.js';
import { GATE_HALF_WIDTH, START_LINE_HALF_WIDTH } from './Scene.js';

function toRgba(colorInt: number, alpha: number): string {
  const r = (colorInt >> 16) & 0xff;
  const g = (colorInt >> 8) & 0xff;
  const b = colorInt & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}

type Vec = { x: number; y: number };

type LegOutlineSpec = {
  id: string;
  start: Point;
  end: Point;
  startHalfWidth: number;
  endHalfWidth: number;
  angleDeg: number;
  travel: 'up' | 'down';
  fillCut: 'axis' | 'horizontal';
  outlineVertices?: Point[];
};

export class EnvelopeLayer {
  private readonly colorInt: number;

  constructor(hexColorInt: number) {
    this.colorInt = hexColorInt;
  }

  renderHistory(_envelope: FleetEnvelope, _scene: Scene): void {}

  draw(scene: Scene, _envelope: FleetEnvelope, _timeSec: number, showOutline = true): void {
    const geometry = scene.geometry;
    if (!geometry) return;

    const specs = buildLegSpecs(geometry, _envelope.legs, _envelope.upwindAngle, _envelope.downwindAngle);
    const { ctx } = scene;

    const firstTrack = _envelope.tracks.find((track) => track.role === 'first');
    const lastTrack = _envelope.tracks.find((track) => track.role === 'last');

    if (firstTrack && lastTrack) {
      const firstPoint = sampleTrackPointAtTime(firstTrack.points, _timeSec);
      const lastPoint = sampleTrackPointAtTime(lastTrack.points, _timeSec);

      if (firstPoint && lastPoint) {
        const fillStyle = toRgba(this.colorInt, 0.16);
        const legCount = Math.min(specs.length, geometry.legs.length);

        for (let legIndex = 0; legIndex < legCount; legIndex++) {
          const span = legSpanForTrackPoints(legIndex, firstPoint, lastPoint);
          if (!span) continue;

          const spec = specs[legIndex];
          const polygon = buildLegOutlinePolygon(scene, spec);
          const start = scene.simToScreen(spec.start);
          const end = scene.simToScreen(spec.end);

          fillLegProgressBand(
            ctx,
            polygon,
            start,
            end,
            span.followerProgress,
            span.leaderProgress,
            spec.fillCut,
            fillStyle,
          );
        }
      }
    }

    if (showOutline) {
      specs.forEach((spec, index) => {
        drawLegOutline(ctx, scene, spec, toRgba(this.colorInt, index % 2 === 0 ? 0.85 : 0.65));
      });
    }
  }

  destroy(): void {}
}

function buildLegSpecs(
  geometry: NonNullable<Scene['geometry']>,
  legs: FleetEnvelope['legs'],
  upwindAngle: number,
  downwindAngle: number,
): LegOutlineSpec[] {
  return legs.map((leg, index) => {
    const outlineVertices = reachingFinishOutlineVertices(geometry, leg);
    const spec: LegOutlineSpec = {
      id: `${leg.type}-${index}`,
      start: leg.start,
      end: leg.end,
      startHalfWidth: anchorHalfWidth(geometry, leg.start),
      endHalfWidth: endAnchorHalfWidth(geometry, leg.type, leg.end),
      angleDeg: leg.type === 'upwind' ? upwindAngle : leg.type === 'offset' ? 75 : downwindAngle,
      travel: leg.type === 'upwind' ? 'up' : 'down',
      fillCut: isReachingFinishLeg(geometry, leg)
        ? 'axis'
        : leg.type === 'downwind' || leg.type === 'finish'
          ? 'horizontal'
          : 'axis',
    };

    if (outlineVertices) {
      spec.outlineVertices = outlineVertices;
    }

    return spec;
  });
}

function isReachingFinishLeg(
  geometry: NonNullable<Scene['geometry']>,
  leg: FleetEnvelope['legs'][number],
): boolean {
  return (
    geometry.hasReachingFinish &&
    leg.type === 'finish' &&
    samePoint(leg.start, geometry.leewardGate) &&
    samePoint(leg.end, geometry.reachingFinishMark)
  );
}

function reachingFinishOutlineVertices(
  geometry: NonNullable<Scene['geometry']>,
  leg: FleetEnvelope['legs'][number],
): Point[] | undefined {
  if (!isReachingFinishLeg(geometry, leg)) return undefined;

  const leftGate = { x: -GATE_HALF_WIDTH, y: geometry.leewardGate.y };
  const rightGate = { x: GATE_HALF_WIDTH, y: geometry.leewardGate.y };
  const rightStart = { x: START_LINE_HALF_WIDTH, y: geometry.startLine.y };

  // Requested reaching-finish boundaries:
  // left gate -> right start, right gate -> reaching finish mark.
  return [leftGate, rightGate, geometry.reachingFinishMark, rightStart];
}

function anchorHalfWidth(geometry: NonNullable<Scene['geometry']>, point: Point): number {
  if (samePoint(point, geometry.startLine)) return START_LINE_HALF_WIDTH;
  if (samePoint(point, geometry.leewardGate)) return GATE_HALF_WIDTH;
  return 0;
}

function endAnchorHalfWidth(
  geometry: NonNullable<Scene['geometry']>,
  legType: LegOutlineSpec['travel'] extends never ? never : 'upwind' | 'offset' | 'downwind' | 'finish',
  point: Point,
): number {
  if (samePoint(point, geometry.startLine)) return legType === 'finish' ? -START_LINE_HALF_WIDTH : START_LINE_HALF_WIDTH;
  if (samePoint(point, geometry.leewardGate)) return legType === 'downwind' ? -GATE_HALF_WIDTH : GATE_HALF_WIDTH;
  return 0;
}

function samePoint(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;
}

function drawLegOutline(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  spec: LegOutlineSpec,
  strokeStyle: string,
): void {
  const points = buildLegOutlinePolygon(scene, spec);
  pathPolygon(ctx, points);
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

function buildLegOutlinePolygon(scene: Scene, spec: LegOutlineSpec): Point[] {
  if (spec.outlineVertices) {
    return spec.outlineVertices.map((vertex) => scene.simToScreen(vertex));
  }

  const startCenter = scene.simToScreen(spec.start);
  const endCenter = scene.simToScreen(spec.end);
  const scale = scene.transform.scale;

  const startHalfWidthPx = spec.startHalfWidth * scale;
  const endHalfWidthPx = spec.endHalfWidth * scale;

  const startLeft = { x: startCenter.x - startHalfWidthPx, y: startCenter.y };
  const startRight = { x: startCenter.x + startHalfWidthPx, y: startCenter.y };
  const endLeft = { x: endCenter.x - endHalfWidthPx, y: endCenter.y };
  const endRight = { x: endCenter.x + endHalfWidthPx, y: endCenter.y };

  const lowerLeftCorner = rayIntersection(
    startLeft,
    rayDirection(spec.angleDeg, spec.travel, 'left', 'start'),
    endLeft,
    rayDirection(spec.angleDeg, spec.travel, 'left', 'end'),
  );
  const lowerRightCorner = rayIntersection(
    startRight,
    rayDirection(spec.angleDeg, spec.travel, 'right', 'start'),
    endRight,
    rayDirection(spec.angleDeg, spec.travel, 'right', 'end'),
  );

  return [
    startLeft,
    lowerLeftCorner,
    endLeft,
    endRight,
    lowerRightCorner,
    startRight,
  ];
}

function pathPolygon(ctx: CanvasRenderingContext2D, points: Point[]): void {
  if (points.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
}

function fillLegProgressBand(
  ctx: CanvasRenderingContext2D,
  polygon: Point[],
  start: Point,
  end: Point,
  followerProgress: number,
  leaderProgress: number,
  fillCut: 'axis' | 'horizontal',
  fillStyle: string,
): void {
  if (polygon.length < 3) return;

  let clipped: Point[];

  if (fillCut === 'horizontal') {
    const followerY = start.y + (end.y - start.y) * clamp01(followerProgress);
    const leaderY = start.y + (end.y - start.y) * clamp01(leaderProgress);
    const minY = Math.min(followerY, leaderY);
    const maxY = Math.max(followerY, leaderY);
    if (maxY - minY <= 1e-4) return;

    clipped = clipPolygonByMinY(polygon, minY);
    clipped = clipPolygonByMaxY(clipped, maxY);
  } else {
    const axis = sub(end, start);
    const axisLen = length(axis);
    if (axisLen < 1e-6) return;

    const axisUnit = scale(axis, 1 / axisLen);
    // Map progress onto the polygon's projected extent along the leg axis.
    // This ensures slanted or asymmetric leg outlines can be fully filled.
    let polyMinS = Number.POSITIVE_INFINITY;
    let polyMaxS = Number.NEGATIVE_INFINITY;
    for (const vertex of polygon) {
      const s = dot(sub(vertex, start), axisUnit);
      if (s < polyMinS) polyMinS = s;
      if (s > polyMaxS) polyMaxS = s;
    }

    const minS = polyMinS + clamp01(followerProgress) * (polyMaxS - polyMinS);
    const maxS = polyMinS + clamp01(leaderProgress) * (polyMaxS - polyMinS);
    if (maxS - minS <= 1e-4) return;

    clipped = clipPolygonByMinS(polygon, start, axisUnit, minS);
    clipped = clipPolygonByMaxS(clipped, start, axisUnit, maxS);
  }

  if (clipped.length < 3) return;

  ctx.save();
  pathPolygon(ctx, clipped);
  ctx.fillStyle = fillStyle;
  ctx.fill();
  ctx.restore();
}

function clipPolygonByMinY(polygon: Point[], minY: number): Point[] {
  return clipPolygonHalfPlane(polygon, (p) => p.y >= minY - 1e-9, (a, b) => {
    const t = (minY - a.y) / (b.y - a.y);
    return lerpPoint(a, b, t);
  });
}

function clipPolygonByMaxY(polygon: Point[], maxY: number): Point[] {
  return clipPolygonHalfPlane(polygon, (p) => p.y <= maxY + 1e-9, (a, b) => {
    const t = (maxY - a.y) / (b.y - a.y);
    return lerpPoint(a, b, t);
  });
}

function legSpanForTrackPoints(
  legIndex: number,
  firstPoint: FleetEnvelope['tracks'][number]['points'][number],
  lastPoint: FleetEnvelope['tracks'][number]['points'][number],
): { followerProgress: number; leaderProgress: number } | null {
  const leaderProgress = progressOnLeg(legIndex, firstPoint);
  const followerProgress = progressOnLeg(legIndex, lastPoint);

  // Once the follower has rounded the mark at leg end, this leg is done.
  if (followerProgress >= 1 - 1e-6) return null;
  if (leaderProgress <= followerProgress + 1e-6) return null;

  return { followerProgress, leaderProgress };
}

function progressOnLeg(
  legIndex: number,
  point: FleetEnvelope['tracks'][number]['points'][number],
): number {
  if (point.legIndex < legIndex) return 0;
  if (point.legIndex > legIndex) return 1;
  return clamp01(point.legProgress);
}

function clipPolygonByMinS(
  polygon: Point[],
  origin: Point,
  axisUnit: Vec,
  minS: number,
): Point[] {
  return clipPolygonHalfPlane(polygon, (p) => dot(sub(p, origin), axisUnit) >= minS - 1e-9, (a, b) => {
    const sa = dot(sub(a, origin), axisUnit);
    const sb = dot(sub(b, origin), axisUnit);
    const t = (minS - sa) / (sb - sa);
    return lerpPoint(a, b, t);
  });
}

function clipPolygonByMaxS(
  polygon: Point[],
  origin: Point,
  axisUnit: Vec,
  maxS: number,
): Point[] {
  return clipPolygonHalfPlane(polygon, (p) => dot(sub(p, origin), axisUnit) <= maxS + 1e-9, (a, b) => {
    const sa = dot(sub(a, origin), axisUnit);
    const sb = dot(sub(b, origin), axisUnit);
    const t = (maxS - sa) / (sb - sa);
    return lerpPoint(a, b, t);
  });
}

function clipPolygonHalfPlane(
  polygon: Point[],
  inside: (p: Point) => boolean,
  intersect: (a: Point, b: Point) => Point,
): Point[] {
  if (polygon.length === 0) return [];

  const output: Point[] = [];
  let prev = polygon[polygon.length - 1];
  let prevInside = inside(prev);

  for (const curr of polygon) {
    const currInside = inside(curr);

    if (currInside) {
      if (!prevInside) output.push(intersect(prev, curr));
      output.push(curr);
    } else if (prevInside) {
      output.push(intersect(prev, curr));
    }

    prev = curr;
    prevInside = currInside;
  }

  return output;
}

function lerpPoint(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function dot(a: Vec, b: Vec): number {
  return a.x * b.x + a.y * b.y;
}

function sub(a: Vec, b: Vec): Vec {
  return { x: a.x - b.x, y: a.y - b.y };
}

function scale(v: Vec, k: number): Vec {
  return { x: v.x * k, y: v.y * k };
}

function length(v: Vec): number {
  return Math.hypot(v.x, v.y);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function sampleTrackPointAtTime(
  points: FleetEnvelope['tracks'][number]['points'],
  timeSec: number,
): FleetEnvelope['tracks'][number]['points'][number] | null {
  if (points.length === 0) return null;
  const rounded = Math.round(timeSec);
  const idx = Math.max(0, Math.min(points.length - 1, rounded));
  return points[idx];
}

function rayDirection(
  angleDeg: number,
  travel: 'up' | 'down',
  side: 'left' | 'right',
  originRole: 'start' | 'end',
): Vec {
  const rad = (angleDeg * Math.PI) / 180;
  const acrossWind = Math.sin(rad);
  const alongWind = Math.cos(rad);
  const alongCourse = (travel === 'up' ? -1 : 1) * (originRole === 'end' ? -1 : 1);
  const horizontal = side === 'left' ? -1 : 1;
  return {
    x: horizontal * acrossWind,
    y: alongCourse * alongWind,
  };
}

function rayIntersection(p1: Point, d1: Vec, p2: Point, d2: Vec): Point {
  const det = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(det) < 1e-6) {
    return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  }

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const t = (dx * d2.y - dy * d2.x) / det;
  return { x: p1.x + d1.x * t, y: p1.y + d1.y * t };
}
