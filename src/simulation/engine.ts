import type { ClassPerformance, RaceConfig, SimulationOutput } from './types.js';
import { buildCourseGeometry } from './course.js';
import { simulateFleetEnvelope } from './envelope.js';
import { clampWindSpeed } from './performance.js';
import { fleetRaceStartSeconds } from './progression.js';

/**
 * Run a full deterministic simulation for all fleets in the race config.
 *
 * @param config  The race configuration.
 * @param classPerformances  Pre-loaded and parsed class performance tables
 *                           keyed by class name.
 */
export function runSimulation(
  config: RaceConfig,
  classPerformances: Map<string, ClassPerformance>,
): SimulationOutput {
  const geometry = buildCourseGeometry(config);
  const windKnots = clampWindSpeed(config.windSpeedKnots);

  // Total sim duration = latest race start + generous buffer for slowest fleet to finish.
  const maxRaceStart = Math.max(
    ...config.fleets.map((f) => fleetRaceStartSeconds(f.startDelayMinutes)),
  );
  // Rough upper bound: 6 hours from the last race start.
  const totalSec = maxRaceStart + 6 * 3600;

  const fleets = config.fleets.map((fleet) => {
    const perf = classPerformances.get(fleet.className);
    if (!perf) throw new Error(`No class performance loaded for "${fleet.className}"`);
    return simulateFleetEnvelope(fleet, perf, windKnots, geometry.legs, totalSec);
  });

  return { fleets, durationSeconds: totalSec };
}
