import type { CourseLeg, Point, TrajectoryPoint } from './types.js';

/** Duration of the 5-minute starting sequence in seconds. */
export const START_SEQUENCE_SECONDS = 5 * 60;

/**
 * Compute a fleet's race-start time (seconds from t=0) based on the
 * fixed 5-minute starting sequence plus the fleet's additional delay.
 *
 * t = 0 is the moment the very first starting sequence begins.
 */
export function fleetRaceStartSeconds(additionalDelayMinutes: number): number {
  return (5 + additionalDelayMinutes) * 60;
}

/**
 * Given a speed in knots (course-axis), return metres per second.
 */
export function knotsToMps(knots: number): number {
  return knots * 0.514444;
}

/**
 * Speed in metres-per-second for a given leg type and performance row fields.
 */
export interface LegSpeed {
  upwindMps: number;
  downwindMps: number;
}

/**
 * Interpolate a position along a leg.
 */
function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/**
 * Generate time-stepped trajectory samples for a single track (first / bulk / last).
 *
 * @param legs         Ordered course legs.
 * @param raceStartSec Time (seconds from t=0) at which this track crosses the start line.
 * @param upwindMps    Course-axis speed on upwind legs (m/s).
 * @param downwindMps  Course-axis speed on downwind legs (m/s).
 * @param stepSec      Simulation time step in seconds (default 1).
 * @param totalSec     Total simulation duration in seconds.
 */
export function generateTrajectory(
  legs: CourseLeg[],
  raceStartSec: number,
  upwindMps: number,
  downwindMps: number,
  stepSec: number,
  totalSec: number,
): TrajectoryPoint[] {
  /** Seconds into the track (0 = race start / crossing start line). */
  const legDurations: number[] = legs.map((leg) => {
    const mps = legSpeed(leg, upwindMps, downwindMps);
    return leg.lengthMeters / mps;
  });

  const points: TrajectoryPoint[] = [];

  for (let t = 0; t <= totalSec; t += stepSec) {
    const elapsed = t - raceStartSec;

    if (elapsed < 0) {
      // Before the race start — boat is on the start line.
      points.push({
        timeSeconds: t,
        position: { ...legs[0].start },
        legIndex: 0,
        legProgress: 0,
      });
      continue;
    }

    // Walk through legs to find the current position.
    let remaining = elapsed;
    let resolved = false;

    for (let i = 0; i < legs.length; i++) {
      const dur = legDurations[i];
      if (remaining <= dur) {
        const progress = remaining / dur;
        points.push({
          timeSeconds: t,
          position: lerp(legs[i].start, legs[i].end, progress),
          legIndex: i,
          legProgress: progress,
        });
        resolved = true;
        break;
      }
      remaining -= dur;
    }

    if (!resolved) {
      // Past the finish — hold at last leg's end.
      const lastLeg = legs[legs.length - 1];
      points.push({
        timeSeconds: t,
        position: { ...lastLeg.end },
        legIndex: legs.length - 1,
        legProgress: 1,
      });
    }
  }

  return points;
}

function legSpeed(leg: CourseLeg, upwindMps: number, downwindMps: number): number {
  switch (leg.type) {
    case 'upwind':
      return upwindMps;
    case 'downwind':
    case 'offset':
    case 'finish':
      return downwindMps;
  }
}

/**
 * Total time to sail the provided course legs at the supplied speeds.
 */
export function trackDurationSeconds(
  legs: CourseLeg[],
  upwindMps: number,
  downwindMps: number,
): number {
  return legs.reduce((sum, leg) => sum + leg.lengthMeters / legSpeed(leg, upwindMps, downwindMps), 0);
}

/**
 * Compute the side-limit horizontal extent at each time step for one leg.
 *
 * Rule: at leg entry a boat can choose to go left or right immediately,
 * tacking/gybing once at the halfway point of the leg.
 * The horizontal spread is derived from the tacking angle.
 *
 * @param leg          The course leg.
 * @param tackAngleDeg Angle from course axis (upwindAngle or downwindAngle).
 * @param timePoints   The time-stepped positions along the leg's centre track.
 */
export function computeLegSideLimits(
  leg: CourseLeg,
  tackAngleDeg: number,
  timePoints: TrajectoryPoint[],
): Array<{ timeSeconds: number; leftX: number; rightX: number }> {
  // Horizontal spread from tacking: at progress p, a boat sailing at
  // `tackAngleDeg` to the wind reaches half-way, then returns.
  // Spread = leg.length * tan(angle) at half-way, linearly tapers to 0 at ends.
  const halfLength = leg.lengthMeters / 2;
  const angleRad = (tackAngleDeg * Math.PI) / 180;
  const maxHalfSpread = halfLength * Math.tan(angleRad);

  return timePoints
    .filter((pt) => pt.legIndex === leg.index)
    .map((pt) => {
      // Triangle: spread peaks at midpoint (progress = 0.5)
      const spread = maxHalfSpread * (1 - Math.abs(pt.legProgress - 0.5) * 2);
      return {
        timeSeconds: pt.timeSeconds,
        leftX: pt.position.x - spread,
        rightX: pt.position.x + spread,
      };
    });
}
