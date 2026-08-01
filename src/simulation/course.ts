import { START_LINE_HALF_WIDTH } from '../visualization/Scene.js';
import type { CourseGeometry, CourseLeg, LegType, Point, RaceConfig } from './types.js';

const REACHING_FINISH_OFFSET_Y_METERS = 50;

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
 *   alternateWindwardMark (0, startToGate + alternateBeatLength)
 *   offsetMark  (-offsetMeters, startToGate + beatLength)
 *   reachingFinishMark (startLineRightMark.x, startLineRightMark.y + 50)
 */
export function buildCourseGeometry(config: RaceConfig): CourseGeometry {
  const {
    beatLengthNm,
    hasAlternateTopMark,
    hasReachingFinish,
    alternateBeatLengthNm,
    laps,
    offsetMeters,
    startToGateMeters,
  } = config;
  const beatLengthMeters = beatLengthNm * 1852;
  const alternateBeatLengthMeters = alternateBeatLengthNm * 1852;

  const startLine = pt(0, 0);
  const leewardGate = pt(0, startToGateMeters);
  const windwardMark = pt(0, startToGateMeters + beatLengthMeters);
  const alternateWindwardMark = pt(0, startToGateMeters + alternateBeatLengthMeters);
  const offsetMark = pt(-offsetMeters, startToGateMeters + beatLengthMeters);
  const reachingFinishMark = pt(START_LINE_HALF_WIDTH, startLine.y + REACHING_FINISH_OFFSET_Y_METERS);

  const legs = buildFleetCourseLegs(
    { startLine, leewardGate, windwardMark, alternateWindwardMark, offsetMark, reachingFinishMark },
    laps,
    false,
    hasReachingFinish,
  );

  return {
    legs,
    hasAlternateTopMark,
    hasReachingFinish,
    startLine,
    leewardGate,
    windwardMark,
    alternateWindwardMark,
    offsetMark,
    reachingFinishMark,
  };
}

export function buildFleetCourseLegs(
  marks: Pick<CourseGeometry, 'startLine' | 'leewardGate' | 'windwardMark' | 'alternateWindwardMark' | 'offsetMark' | 'reachingFinishMark'>,
  laps: number,
  useAlternateTopMark: boolean,
  hasReachingFinish: boolean,
): CourseLeg[] {
  const topMark = useAlternateTopMark ? marks.alternateWindwardMark : marks.windwardMark;

  const legs: CourseLeg[] = [];
  let idx = 0;

  function addLeg(type: LegType, start: Point, end: Point): void {
    legs.push({ type, start, end, lengthMeters: legLength(start, end), index: idx++ });
  }

  for (let lap = 0; lap < laps; lap++) {
    const isLastLap = lap === laps - 1;

    // Upwind
    addLeg('upwind', lap === 0 ? marks.startLine : marks.leewardGate, topMark);

    if (useAlternateTopMark) {
      if (isLastLap) {
        if (hasReachingFinish) {
          addLeg('downwind', topMark, marks.leewardGate);
          addLeg('finish', marks.leewardGate, marks.reachingFinishMark);
        } else {
          addLeg('finish', topMark, marks.startLine);
        }
      } else {
        addLeg('downwind', topMark, marks.leewardGate);
      }
      continue;
    }

    // Offset leg (only on the regular windward mark course)
    addLeg('offset', marks.windwardMark, marks.offsetMark);

    if (isLastLap) {
      if (hasReachingFinish) {
        addLeg('downwind', marks.offsetMark, marks.leewardGate);
        addLeg('finish', marks.leewardGate, marks.reachingFinishMark);
      } else {
        // Final downwind directly to finish (start line used as finish)
        addLeg('finish', marks.offsetMark, marks.startLine);
      }
    } else {
      // Regular downwind back to leeward gate
      addLeg('downwind', marks.offsetMark, marks.leewardGate);
    }
  }

  return legs;
}

/** Total course distance in metres for a given geometry. */
export function totalCourseDistance(geometry: CourseGeometry): number {
  return geometry.legs.reduce((sum, leg) => sum + leg.lengthMeters, 0);
}
