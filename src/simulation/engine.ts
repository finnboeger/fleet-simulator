import type { ClassPerformance, RaceConfig, SimulationOutput } from './types.js';
import { buildCourseGeometry } from './course.js';
import { simulateFleetEnvelope } from './envelope.js';
import { clampWindSpeed, resolveFleetPerformance } from './performance.js';
import { fleetRaceStartSeconds, START_SEQUENCE_SECONDS } from './progression.js';
import { knotsToMps, trackDurationSeconds } from './progression.js';

let _cache: { key: string; output: SimulationOutput } | null = null;

export function runSimulation(
  config: RaceConfig,
  classPerformances: Map<string, ClassPerformance>,
): SimulationOutput {
  const key = JSON.stringify(config);
  if (_cache?.key === key) return _cache.output;
  const output = compute(config, classPerformances);
  _cache = { key, output };
  return output;
}

function compute(
  config: RaceConfig,
  classPerformances: Map<string, ClassPerformance>,
): SimulationOutput {
  const geometry = buildCourseGeometry(config);
  const windKnots = clampWindSpeed(config.windSpeedKnots);

  const fleetInputs = config.fleets.map((fleet) => {
    const perf = classPerformances.get(fleet.className);
    if (!perf) throw new Error(`No class performance loaded for "${fleet.className}"`);
    return { fleet, perf };
  });

  const minRaceStart =
    fleetInputs.length > 0
      ? Math.min(...fleetInputs.map(({ fleet }) => fleetRaceStartSeconds(fleet.additionalDelayMinutes)))
      : START_SEQUENCE_SECONDS;

  const maxLastFinish =
    fleetInputs.length > 0
      ? Math.max(
          ...fleetInputs.map(({ fleet, perf }) => {
            const raceStartSec = fleetRaceStartSeconds(fleet.additionalDelayMinutes);
            const { base, multipliers } = resolveFleetPerformance(perf, windKnots, fleet);
            const lastUpMps = knotsToMps(base.upwindVMG * multipliers.lastMultiplier);
            const lastDnMps = knotsToMps(base.downwindVMG * multipliers.lastMultiplier);
            return raceStartSec + trackDurationSeconds(geometry.legs, lastUpMps, lastDnMps);
          }),
        )
      : START_SEQUENCE_SECONDS;

  const timelineStartSeconds = minRaceStart - 60;
  const timelineEndSeconds = maxLastFinish + 60;

  const fleets = fleetInputs.map(({ fleet, perf }) =>
    simulateFleetEnvelope(fleet, perf, windKnots, geometry.legs, timelineEndSeconds),
  );

  return { fleets, timelineStartSeconds, durationSeconds: timelineEndSeconds };
}
