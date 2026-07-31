import type { CourseGeometry, CourseLeg, LegType, Point, RaceConfig } from './types.js';

/**
 * Wind direction is fixed upward in the viewport (negative-Y axis).
 * The start line is at the bottom; the windward mark is at the top.
 *
 * Coordinate system:
 *   x increases to the right
 *   y increases upward (inverted for screen coords in the renderer layer)
 *
 * All distances are in metres.
 */

function pt(x: number, y: number): Point {
  return { x, y };
}

function legLength(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Build the windward-leeward course geometry from a race config.
 *
 * Layout (y = 0 at start line, positive y toward windward mark):
 *   startLine (0, 0)
 *   leewardGate (0, startToGate)
 *   windwardMark (0, startToGate + beatLength)
 *   offsetMark  (offsetMeters, startToGate + beatLength)
 */
export function buildCourseGeometry(config: RaceConfig): CourseGeometry {
  const { beatLengthMeters, laps, offsetMeters, startToGateMeters } = config;

  const startLine = pt(0, 0);
  const leewardGate = pt(0, startToGateMeters);
  const windwardMark = pt(0, startToGateMeters + beatLengthMeters);
  const offsetMark = pt(offsetMeters, startToGateMeters + beatLengthMeters);

  const legs: CourseLeg[] = [];
  let idx = 0;

  function addLeg(type: LegType, start: Point, end: Point): void {
    legs.push({ type, start, end, lengthMeters: legLength(start, end), index: idx++ });
  }

  // Start area to leeward gate
  addLeg('start-to-gate', startLine, leewardGate);

  for (let lap = 0; lap < laps; lap++) {
    const isLastLap = lap === laps - 1;

    // Upwind
    addLeg('upwind', leewardGate, windwardMark);

    // Offset leg (only if not the final lap's finish sequence)
    addLeg('offset', windwardMark, offsetMark);

    if (isLastLap) {
      // Final downwind directly to finish (start line used as finish)
      addLeg('finish', offsetMark, startLine);
    } else {
      // Regular downwind back to leeward gate
      addLeg('downwind', offsetMark, leewardGate);
    }
  }

  return { legs, startLine, leewardGate, windwardMark };
}

/** Total course distance in metres for a given geometry. */
export function totalCourseDistance(geometry: CourseGeometry): number {
  return geometry.legs.reduce((sum, leg) => sum + leg.lengthMeters, 0);
}
