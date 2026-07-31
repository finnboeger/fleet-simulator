import type {
  ClassPerformance,
  CourseLeg,
  FleetConfig,
  FleetEnvelope,
  SideLimitSample,
  TrackSamples,
} from './types.js';
import { resolveFleetPerformance } from './performance.js';
import {
  computeLegSideLimits,
  fleetRaceStartSeconds,
  generateTrajectory,
  knotsToMps,
  trackDurationSeconds,
} from './progression.js';

const STEP_SECONDS = 1;

/**
 * Simulate the full envelope for one fleet.
 *
 * @param fleet       Fleet configuration (slowdowns, start delay, …).
 * @param perf        Pre-parsed class performance table.
 * @param windKnots   Wind speed (will be clamped internally).
 * @param legs        Ordered course legs.
 * @param totalSec    Total simulation duration in seconds.
 */
export function simulateFleetEnvelope(
  fleet: FleetConfig,
  perf: ClassPerformance,
  windKnots: number,
  legs: CourseLeg[],
  totalSec: number,
): FleetEnvelope {
  const { base, multipliers } = resolveFleetPerformance(perf, windKnots, fleet);
  const raceStartSec = fleetRaceStartSeconds(fleet.additionalDelayMinutes);

  const firstUpMps = knotsToMps(base.upwindVMG * multipliers.firstMultiplier);
  const firstDnMps = knotsToMps(base.downwindVMG * multipliers.firstMultiplier);
  const bulkUpMps = knotsToMps(base.upwindVMG * multipliers.bulkMultiplier);
  const bulkDnMps = knotsToMps(base.downwindVMG * multipliers.bulkMultiplier);
  const lastUpMps = knotsToMps(base.upwindVMG * multipliers.lastMultiplier);
  const lastDnMps = knotsToMps(base.downwindVMG * multipliers.lastMultiplier);

  const firstPoints = generateTrajectory(legs, raceStartSec, firstUpMps, firstDnMps, STEP_SECONDS, totalSec);
  const bulkPoints = generateTrajectory(legs, raceStartSec, bulkUpMps, bulkDnMps, STEP_SECONDS, totalSec);
  const lastPoints = generateTrajectory(legs, raceStartSec, lastUpMps, lastDnMps, STEP_SECONDS, totalSec);
  const firstFinishSeconds = raceStartSec + trackDurationSeconds(legs, firstUpMps, firstDnMps);

  const tracks: [TrackSamples, TrackSamples, TrackSamples] = [
    { role: 'first', points: firstPoints },
    { role: 'bulk', points: bulkPoints },
    { role: 'last', points: lastPoints },
  ];

  // Compute side limits per leg using the bulk track and the appropriate tack angle.
  const sideLimitsPerLeg: SideLimitSample[][] = legs.map((leg) => {
    const angleForLeg = isUpwindLeg(leg) ? base.upwindAngle : base.downwindAngle;
    // Use the bulk track's positions for side-limit projection.
    return computeLegSideLimits(leg, angleForLeg, bulkPoints);
  });

  return {
    fleetId: fleet.id,
    raceStartSeconds: raceStartSec,
    upwindAngle: base.upwindAngle,
    downwindAngle: base.downwindAngle,
    firstFinishSeconds,
    tracks,
    sideLimitsPerLeg,
  };
}

function isUpwindLeg(leg: CourseLeg): boolean {
  return leg.type === 'upwind';
}
