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
};

export class EnvelopeLayer {
  private readonly colorInt: number;

  constructor(hexColorInt: number) {
    this.colorInt = hexColorInt;
  }

  renderHistory(_envelope: FleetEnvelope, _scene: Scene): void {}

  draw(scene: Scene, _envelope: FleetEnvelope, _timeSec: number): void {
    const geometry = scene.geometry;
    if (!geometry) return;

    const specs = buildLegSpecs(geometry, _envelope.upwindAngle, _envelope.downwindAngle);
    const { ctx } = scene;

    specs.forEach((spec, index) => {
      drawLegOutline(ctx, scene, spec, toRgba(this.colorInt, index % 2 === 0 ? 0.85 : 0.65));
    });
  }

  destroy(): void {}
}

function buildLegSpecs(
  geometry: NonNullable<Scene['geometry']>,
  upwindAngle: number,
  downwindAngle: number,
): LegOutlineSpec[] {
  const laps = geometry.legs.filter((leg) => leg.type === 'upwind').length;
  const specs: LegOutlineSpec[] = [
    {
      id: 'upwind-1',
      start: geometry.startLine,
      end: geometry.windwardMark,
      startHalfWidth: START_LINE_HALF_WIDTH,
      endHalfWidth: 0,
      angleDeg: upwindAngle,
      travel: 'up',
    },
  ];

  for (let lap = 1; lap <= laps; lap++) {
    specs.push({
      id: `offset-${lap}`,
      start: geometry.windwardMark,
      end: geometry.offsetMark,
      startHalfWidth: 0,
      endHalfWidth: 0,
      angleDeg: 75,
      travel: 'down',
    });

    if (lap < laps) {
      specs.push({
        id: `downwind-${lap}`,
        start: geometry.offsetMark,
        end: geometry.leewardGate,
        startHalfWidth: 0,
        endHalfWidth: -GATE_HALF_WIDTH,
        angleDeg: downwindAngle,
        travel: 'down',
      });

      specs.push({
        id: `upwind-${lap + 1}`,
        start: geometry.leewardGate,
        end: geometry.windwardMark,
        startHalfWidth: GATE_HALF_WIDTH,
        endHalfWidth: 0,
        angleDeg: upwindAngle,
        travel: 'up',
      });
    } else {
      specs.push({
        id: 'finish',
        start: geometry.offsetMark,
        end: geometry.startLine,
        startHalfWidth: 0,
        endHalfWidth: -START_LINE_HALF_WIDTH,
        angleDeg: downwindAngle,
        travel: 'down',
      });
    }
  }

  return specs;
}

function drawLegOutline(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  spec: LegOutlineSpec,
  strokeStyle: string,
): void {
  const startCenter = scene.simToScreen(spec.start);
  const endCenter = scene.simToScreen(spec.end);

  const startLeft = { x: startCenter.x - spec.startHalfWidth, y: startCenter.y };
  const startRight = { x: startCenter.x + spec.startHalfWidth, y: startCenter.y };
  const endLeft = { x: endCenter.x - spec.endHalfWidth, y: endCenter.y };
  const endRight = { x: endCenter.x + spec.endHalfWidth, y: endCenter.y };

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

  const points = [
    startLeft,
    lowerLeftCorner,
    endLeft,
    endRight,
    lowerRightCorner,
    startRight,
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
